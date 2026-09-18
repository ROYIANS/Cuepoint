import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { resolveAgentToolApproval } from "@/db/agentTools";
import { createChatThread, updateChatThread } from "@/db/repo";
import type { AgentReasoningEffort } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { assertReasoningEffort, getReasoningPolicy } from "@/lib/ai/reasoningPolicy";
import { streamChatCompletions } from "@/lib/ai/chatStream";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { BUILTIN_TOOLS, type AgentToolDefinition } from "@/lib/agent/tools";

const connector: ConnectorConfig = { id: "cx", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret", updatedAt: "2026-09-18" };
const answer = () => Response.json({ choices: [{ message: { content: "完成" }, finish_reason: "stop" }] });

describe("verified reasoning policy", () => {
  it("uses exact model/connector capabilities and provider-specific allowed levels", () => {
    expect(getReasoningPolicy(connector, "gpt-5")?.levels).toEqual(["minimal", "low", "medium", "high"]);
    expect(getReasoningPolicy(connector, "gpt-5.1")?.levels).toEqual(["none", "low", "medium", "high"]);
    expect(getReasoningPolicy(connector, "gpt-5.6-luna")).toMatchObject({ levels: ["none", "low", "medium", "high", "xhigh", "max"], contextWindow: 1_050_000 });
    expect(getReasoningPolicy({ ...connector, definitionId: "aihubmix" }, "gpt-5.6-luna")?.levels).not.toContain("max");
    for (const model of ["gpt-5-custom", "gpt-5-pro", "vendor/gpt-5", "gpt-4o", "constructor", "__proto__"]) {
      expect(getReasoningPolicy(connector, model)).toBeUndefined();
      expect(() => assertReasoningEffort(connector, model, "high")).toThrow("不支持");
      expect(() => assertReasoningEffort(connector, model, undefined)).not.toThrow();
    }
    for (const definitionId of ["deepseek", "apimart"] as const) {
      expect(getReasoningPolicy({ ...connector, definitionId }, "gpt-5")).toBeUndefined();
    }
    expect(() => assertReasoningEffort(connector, "gpt-5", "none")).toThrow();
    expect(() => assertReasoningEffort(connector, "gpt-5.1", "minimal")).toThrow();
    expect(() => assertReasoningEffort(connector, "o3", "xhigh")).toThrow();
  });
  it("adds only the selected wire field and never sends model-default settings", async () => {
    for (const effort of [undefined, "high"] as const) {
      const fetcher = vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (effort) expect(body.reasoning_effort).toBe(effort);
        else expect(body).not.toHaveProperty("reasoning_effort");
        expect(body).not.toHaveProperty("reasoning");
        expect(body).not.toHaveProperty("connectorDefinitionId");
        return answer();
      });
      const result = await streamChatCompletions({ baseUrl: connector.baseUrl, apiKey: connector.apiKey, connectorDefinitionId: connector.definitionId, model: "gpt-5", reasoningEffort: effort, messages: [{ role: "user", content: "hi" }] }, { fetchImpl: fetcher });
      expect(result.ok).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("rejects mismatched wire parameters before any network request", async () => {
    const fetcher = vi.fn(async () => answer());
    for (const input of [
      { model: "custom", connectorDefinitionId: connector.definitionId, reasoningEffort: "high" as const },
      { model: "gpt-5", connectorDefinitionId: connector.definitionId, reasoningEffort: "none" as const },
      { model: "gpt-5", reasoningEffort: "high" as const },
      { model: "gpt-5", connectorDefinitionId: "deepseek" as const, reasoningEffort: "high" as const },
      { model: "gpt-5", connectorDefinitionId: connector.definitionId, reasoningEffort: "invalid" as AgentReasoningEffort },
    ]) {
      const result = await streamChatCompletions({ baseUrl: connector.baseUrl, apiKey: connector.apiKey, messages: [{ role: "user", content: "hi" }], ...input }, { fetchImpl: fetcher });
      expect(result.ok).toBe(false);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("durable reasoning configuration", () => {
  it("freezes selected effort and preserves it on retry including original default", async () => {
    for (const reasoningEffort of [undefined, "high"] as const) {
      const thread = await createChatThread();
      const original = await beginAgentRun({ threadId: thread.id, connector, model: "gpt-5", content: "hi", reasoningEffort });
      expect((await db.agentRuns.get(original.id))?.reasoningEffort).toBe(reasoningEffort);
      await finishAgentRun(original.id, "failed", { content: "partial" });
      const retry = await beginAgentRun({ threadId: thread.id, connector, model: "gpt-5", retryOfRunId: original.id, reasoningEffort: "low" });
      expect(retry.reasoningEffort).toBe(reasoningEffort);
      expect(retry.requestMessages).toEqual(original.requestMessages);
    }
  });
  it("rolls back all execution writes on invalid effort", async () => {
    const thread = await createChatThread();
    await expect(beginAgentRun({ threadId: thread.id, connector, model: "gpt-5", content: "hi", reasoningEffort: "none" })).rejects.toThrow("不支持");
    expect(await db.chatMessages.count()).toBe(0);
    expect(await db.agentRuns.count()).toBe(0);
  });
  it("keeps frozen effort through tool rounds and approval resume", async () => {
    await updateGeneralAgentConfig({ enabledSkillIds: ["workspace", "planning"] });
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "gpt-5", content: "hi", reasoningEffort: "high" });
    const controlled: AgentToolDefinition = { ...BUILTIN_TOOLS[0], effect: "write", execute: vi.fn(async () => ({ ok: true })) };
    const registry = [controlled, BUILTIN_TOOLS[1]];
    const bodies: Array<{reasoning_effort?: string}> = [];
    const fetcher = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length <= 2) {
        const name = bodies.length === 1 ? "update_run_plan" : "workspace_overview";
        const args = name === "update_run_plan" ? '{"steps":[{"id":"one","title":"检查","status":"pending"}]}' : "{}";
        return Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: `call-${bodies.length}`, type: "function", function: { name, arguments: args } }] }, finish_reason: "tool_calls" }] });
      }
      return answer();
    });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, registry);
    expect((await db.agentRuns.get(run.id))?.status).toBe("waiting_approval");
    const call = (await db.agentToolCalls.toArray()).find((item) => item.status === "awaiting_approval")!;
    await resolveAgentToolApproval(run.id, call.id, "approve");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, registry);
    expect(bodies).toHaveLength(3);
    expect(bodies.map((body) => body.reasoning_effort)).toEqual(["high", "high", "high"]);
    expect(controlled.execute).toHaveBeenCalledTimes(1);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });
});


describe("conversation reasoning selection", () => {
  it("persists explicit defaults and keeps separate conversations independent", async () => {
    const first = await createChatThread();
    const second = await createChatThread();
    const selection = { connectorId: connector.id, baseUrl: connector.baseUrl, model: "gpt-5.6-luna", value: "high" as const };
    await updateChatThread(first.id, { reasoningSelection: selection });
    expect((await db.chatThreads.get(first.id))?.reasoningSelection).toEqual(selection);
    expect((await db.chatThreads.get(second.id))?.reasoningSelection).toBeUndefined();
    await updateChatThread(first.id, { reasoningSelection: { ...selection, value: undefined } });
    expect((await db.chatThreads.get(first.id))?.reasoningSelection?.value).toBeUndefined();
  });
});
