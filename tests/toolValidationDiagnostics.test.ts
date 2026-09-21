import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { db } from "@/db/database";
import { beginAgentRun } from "@/db/agentRuns";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { createChatThread, createProject, firstEpisode, updateEpisodeDraft } from "@/db/repo";
import { executeChatRun } from "@/lib/agent/runChat";
import { BUILTIN_TOOLS, getLegacyToolValidationFailure, validateToolCall } from "@/lib/agent/tools";
import { readToolValidationFailure, ToolValidationError } from "@/lib/agent/toolErrors";
import type { ConnectorConfig } from "@/domain/types";

const name = "business_read_text";
const tool = BUILTIN_TOOLS.find((item) => item.name === name)!;
const args = { kind: "project", id: "project-fixture", field: "story.script", limit: 24000 };
const connector: ConnectorConfig = { id: "diagnostics", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture-key", updatedAt: "2026-09-21" };
function failure(raw: string) {
  try { validateToolCall(name, raw, [name]); }
  catch (error) { expect(error).toBeInstanceOf(ToolValidationError); return (error as ToolValidationError).failure; }
  throw new Error("Expected invalid arguments");
}

describe("tool argument diagnostics", () => {
  it("explains the limit constraint, no-execution outcome and paginated recovery", () => {
    const result = failure(JSON.stringify(args));
    expect(result).toMatchObject({ code: "INVALID_TOOL_ARGUMENTS", executed: false, issues: [{ path: "limit", constraint: "不得大于 12000", received: 24000 }] });
    expect(result.error).toContain("未执行");
    expect(result.recovery).toMatch(/新的工具调用标识/);
    expect(result.recovery).toMatch(/nextOffset/);
    expect(result.recovery).toMatch(/对结论的影响/);
    expect(readToolValidationFailure(JSON.stringify(result))).toEqual(result);
    expect(() => validateToolCall(name, JSON.stringify({ ...args, limit: 12000 }), [name])).not.toThrow();
  });

  it("reports both screenshot errors together and strictly accepts only the corrected episode path", () => {
    const wrong = { ...args, kind: "episode", field: "script", ownerId: "project-fixture" };
    const result = failure(JSON.stringify(wrong));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "limit", received: 24000 }),
      expect.objectContaining({ path: "field", constraint: expect.stringContaining("story.script") }),
    ]));
    expect(() => validateToolCall(name, JSON.stringify({ ...wrong, field: "story.script", limit: 12000 }), [name])).not.toThrow();
    expect(() => validateToolCall(name, JSON.stringify({ ...wrong, limit: 12000 }), [name])).toThrow("story.script");
    expect(failure(JSON.stringify({ ...wrong, field: "story.__proto__", limit: 12000 })).issues[0]?.constraint).toContain("不是允许");
  });

  it("never echoes string values, unrecognized keys or thrown schema messages", () => {
    const secret = "secret-credential-marker";
    for (const raw of [JSON.stringify({ ...args, limit: secret }), JSON.stringify({ ...args, kind: secret }), JSON.stringify({ ...args, [secret]: secret }), `{${secret}`, JSON.stringify({ ...args, field: secret.repeat(100) })]) {
      expect(JSON.stringify(failure(raw))).not.toContain(secret);
    }
    const definition = { ...tool, parseArguments: () => { throw new Error(secret); } };
    try { validateToolCall(name, "{}", [name], [definition]); }
    catch (error) { expect(String(error)).not.toContain(secret); }
  });

  it("bounds issue counts and oversized arguments without including their content", () => {
    expect(failure("x".repeat(32769))).toMatchObject({ issues: [{ received: 32769 }] });
    const fields = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`field${index}`, z.number()]));
    const definition = { ...tool, parseArguments: (value: unknown) => z.object(fields).parse(value) };
    try { validateToolCall(name, "{}", [name], [definition]); }
    catch (error) { expect((error as ToolValidationError).failure.issues).toHaveLength(6); }
    expect(readToolValidationFailure(JSON.stringify({ code: "INVALID_TOOL_ARGUMENTS", executed: true, error: "x", issues: [], recovery: "" }))).toBeUndefined();
    expect(readToolValidationFailure("{" )).toBeUndefined();
  });

  it("supplements only exact legacy argument failures using current local constraints", () => {
    const legacy = { name, title: tool.title, status: "failed" as const, error: `工具 ${tool.title} 的参数无效`, arguments: JSON.stringify(args) };
    expect(getLegacyToolValidationFailure(legacy)?.issues[0]).toMatchObject({ path: "limit", received: 24000 });
    expect(getLegacyToolValidationFailure({ ...legacy, error: "未知执行结果" })).toBeUndefined();
    expect(getLegacyToolValidationFailure({ ...legacy, status: "unknown" })).toBeUndefined();
    expect(getLegacyToolValidationFailure({ ...legacy, arguments: JSON.stringify({ ...args, limit: 12000 }) })).toBeUndefined();
  });

  it.each(["chat-completions", "responses"] as const)("returns actionable error to %s and executes only a new corrected read", async (protocol) => {
    await updateGeneralAgentConfig({ permissionMode: "full", enabledSkillIds: ["business-read"] });
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: protocol === "responses" ? "gpt-5.6-luna" : "test-model", content: "读取剧本" });
    const project = await createProject("诊断项目");
    const episode = (await firstEpisode(project.id))!;
    await updateEpisodeDraft(episode.id, { script: "片段" });
    const wrong = { kind: "episode", ownerId: project.id, id: episode.id, field: "script", limit: 24000 };
    const execute = vi.fn(tool.execute);
    let requests = 0;
    const fetchImpl: typeof fetch = async (_url, init) => {
      requests++;
      if (requests === 2) {
        const body = JSON.parse(String(init?.body));
        const last = protocol === "responses" ? body.input.at(-1).output : body.messages.at(-1).content;
        expect(readToolValidationFailure(last)).toMatchObject({ executed: false, issues: expect.arrayContaining([expect.objectContaining({ path: "limit", received: 24000 })]) });
        expect(last).toContain("story.script");
        expect(execute).not.toHaveBeenCalled();
      }
      const raw = JSON.stringify(requests === 1 ? wrong : { ...wrong, field: "story.script", limit: 12000 });
      if (protocol === "responses") return Response.json({ id: `response-${requests}`, status: "completed", output: requests < 3 ? [{ type: "function_call", call_id: `call-${requests}`, name, arguments: raw, status: "completed" }] : [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "已修正后读取", annotations: [] }] }] });
      return Response.json({ choices: [{ message: requests < 3 ? { content: "", tool_calls: [{ id: `call-${requests}`, type: "function", function: { name, arguments: raw } }] } : { content: "已修正后读取" }, finish_reason: requests < 3 ? "tool_calls" : "stop" }] });
    };
    await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl, BUILTIN_TOOLS.map((item) => item.name === name ? { ...tool, execute } : item));
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    expect(requests).toBe(3);
    expect(execute).toHaveBeenCalledTimes(1);
    const calls = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).sort((a, b) => a.step - b.step);
    expect(calls[0]).toMatchObject({ status: "failed", highRisk: false, arguments: JSON.stringify(wrong) });
    expect(calls[1]).toMatchObject({ status: "completed", providerCallId: "call-2" });
    expect(JSON.parse(calls[1].result!)).toMatchObject({ field: "story.script", text: "片段", nextOffset: null });
  });
});
