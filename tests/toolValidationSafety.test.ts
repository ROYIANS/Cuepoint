import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { db } from "@/db/database";
import { beginAgentRun } from "@/db/agentRuns";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { createChatThread } from "@/db/repo";
import { BUILTIN_TOOLS, toolSchemas, validateToolCall } from "@/lib/agent/tools";
import { executeChatRun } from "@/lib/agent/runChat";
import { ToolValidationError, readToolValidationFailure } from "@/lib/agent/toolErrors";

describe("tool diagnostics preserve validation and permission boundaries", () => {
  it("explains received and required types in Chinese without echoing model strings", () => {
    const name = "business_read_text";
    const input = { kind: "episode", ownerId: "owner", id: "episode", field: "story.script", limit: "sensitive-input" };
    try { validateToolCall(name, JSON.stringify(input), [name]); }
    catch (error) {
      expect(error).toBeInstanceOf(ToolValidationError);
      expect((error as ToolValidationError).failure.issues).toContainEqual({ path: "limit", constraint: "必须是数字", received: "文本" });
      expect(JSON.stringify((error as ToolValidationError).failure)).not.toContain("sensitive-input");
      return;
    }
    throw new Error("Expected strict type validation to reject a string");
  });

  it("keeps advertised integer and enum constraints strict without coerced values", () => {
    const name = "business_read_text";
    const schema = toolSchemas([name])[0].function.parameters;
    expect(schema).toMatchObject({ additionalProperties: false, properties: {
      kind: { type: "string", enum: expect.arrayContaining(["episode", "project"]) },
      limit: { type: "integer", minimum: 1, maximum: 12000 },
    } });
    const valid = { kind: "episode", ownerId: "owner", id: "episode", field: "story.script", limit: 12000 };
    for (const patch of [{ limit: "12000" }, { limit: 1.5 }, { limit: 0 }, { kind: "episodes" }, { unexpected: true }]) {
      expect(() => validateToolCall(name, JSON.stringify({ ...valid, ...patch }), [name])).toThrow(ToolValidationError);
    }
    expect(() => validateToolCall(name, JSON.stringify(valid), [name])).not.toThrow();
  });

  it("does not let the low-risk invalid-read label authorize a corrected high-risk call", async () => {
    await updateGeneralAgentConfig({ permissionMode: "ask", enabledSkillIds: ["workspace"] });
    const thread = await createChatThread();
    const connector = { id: "validation-safety", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture-key", updatedAt: "2026-09-21" };
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "test-model", content: "读取需要批准的信息" });
    const tool = {
      ...BUILTIN_TOOLS[0],
      parseArguments: (value: unknown) => z.object({ limit: z.number().int().min(1).max(10) }).strict().parse(value),
      parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 } }, required: ["limit"], additionalProperties: false },
      highRisk: () => true,
      execute: vi.fn(async () => ({ ok: true })),
    };
    let requests = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      requests++;
      if (requests === 2) {
        const body = JSON.parse(String(init?.body));
        expect(readToolValidationFailure(body.messages.at(-1).content)).toMatchObject({ executed: false });
      }
      return Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: `call-${requests}`, type: "function", function: { name: tool.name, arguments: JSON.stringify({ limit: requests === 1 ? 100 : 10 }) } }] }, finish_reason: "tool_calls" }] });
    };
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, [tool]);
    expect(requests).toBe(2);
    expect(tool.execute).not.toHaveBeenCalled();
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "waiting_approval" });
    const calls = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).sort((a, b) => a.step - b.step);
    expect(calls[0]).toMatchObject({ status: "failed", highRisk: false });
    expect(calls[1]).toMatchObject({ status: "awaiting_approval", highRisk: true });
  });
});
