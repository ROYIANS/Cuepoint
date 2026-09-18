import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun, finishAgentRun, interruptThreadRuns } from "@/db/agentRuns";
import { createChatThread, deleteChatThread } from "@/db/repo";
import { updateContextPolicy, resetThreadContextPolicy, saveContextPolicyAsDefault } from "@/db/contextSettings";
import { createAgentTask } from "@/db/agentTasks";
import { DEFAULT_CONTEXT_POLICY, normalizeContextPolicy, resolveContextCapacity } from "@/lib/agent/contextPolicy";
import { selectContextHistory, budgetContext, findApplicableSummary, buildContextMessages } from "@/lib/agent/contextPlanner";
import { prepareRunContext } from "@/lib/agent/contextCompaction";
import { BUILTIN_TOOLS } from "@/lib/agent/tools";
import { executeChatRun } from "@/lib/agent/runChat";
import { toResponseInput } from "@/lib/ai/responsesStream";
import type { ChatMessage, ConnectorConfig } from "@/domain/types";
import type { AgentRequestMessage, AgentRun } from "@/domain/agent";

const connector: ConnectorConfig = { id: "cx", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret-key", updatedAt: "2026-01-01" };
const policy = { ...DEFAULT_CONTEXT_POLICY, customContextTokens: 4096 };
const json = (content: string) => Response.json({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 200, completion_tokens: 30, total_tokens: 230 } });
const history = (threadId: string, n = 8, size = 900): ChatMessage[] => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, threadId, role: i % 2 ? "assistant" : "user", content: `${i}: ${"x".repeat(size)}`, status: "complete", createdAt: new Date(1000 + i).toISOString() }));
async function begin(n = 8, size = 900) {
  const thread = await createChatThread();
  await updateContextPolicy(thread.id, policy);
  const messages = history(thread.id, n, size);
  await db.chatMessages.bulkAdd(messages);
  const run = await beginAgentRun({ threadId: thread.id, connector, model: "unknown-model", content: "接着完成当前目标", interactionMode: "conversation" });
  return { thread, run, messages };
}

describe("context policy and immutable scope", () => {
  it("matches LobeHub defaults and rejects invalid persisted numbers", () => {
    expect(normalizeContextPolicy()).toEqual({ autoCompress: true, limitHistory: false, historyMessageCount: 20 });
    expect(normalizeContextPolicy({ historyMessageCount: NaN, customContextTokens: -10 })).toEqual(DEFAULT_CONTEXT_POLICY);
    expect(normalizeContextPolicy({ historyMessageCount: 0 }).historyMessageCount).toBe(0);
    expect(resolveContextCapacity("unknown-model")).toEqual({ capacity: undefined, capacitySource: undefined });
    expect(resolveContextCapacity("unknown-model", { source: "provider", contextWindow: 2000 }, undefined, policy).capacity).toBe(2000);
    expect(resolveContextCapacity("unknown-model", { source: "provider", contextWindow: 16000 }, undefined, policy)).toEqual({ capacity: 4096, capacitySource: "本地预算" });
  });
  it("limits previous displayed messages by complete turns and leaves the current question intact", () => {
    const rows = history("t", 6);
    for (const [limit, length] of [[0, 0], [1, 0], [2, 2], [3, 2], [4, 4], [100, 6]]) {
      const selected = selectContextHistory(rows, { ...policy, limitHistory: true, historyMessageCount: limit });
      expect(selected).toHaveLength(length);
      const request = buildContextMessages("system", "skill", selected, "draft");
      expect(request.at(-1)).toEqual({ role: "user", content: "draft" });
      expect(request[0].content).toBe("system\nskill");
    }
    rows[5].status = "error";
    expect(selectContextHistory(rows, policy).map((m) => m.id)).not.toContain("m5");
  });
  it("freezes new thread defaults and each run; reset and save defaults are explicit", async () => {
    await updateContextPolicy(undefined, { ...policy, historyMessageCount: 4 });
    const first = await createChatThread();
    const task = await createAgentTask({ title: "task", goal: "goal" });
    expect((await db.chatThreads.get(task.threadId))?.contextPolicy?.historyMessageCount).toBe(4);
    await updateContextPolicy(undefined, { ...policy, historyMessageCount: 8 });
    expect((await db.chatThreads.get(first.id))?.contextPolicy?.historyMessageCount).toBe(4);
    const run = await beginAgentRun({ threadId: first.id, connector, model: "unknown", content: "hi", modelMetadata: { source: "provider", contextWindow: 10000 } });
    await resetThreadContextPolicy(first.id);
    expect((await db.agentRuns.get(run.id))?.context?.policy.historyMessageCount).toBe(4);
    expect((await db.chatThreads.get(first.id))?.contextPolicy?.historyMessageCount).toBe(8);
    await updateContextPolicy(first.id, { ...policy, historyMessageCount: 6 });
    await saveContextPolicyAsDefault(first.id);
    expect((await createChatThread()).contextPolicy?.historyMessageCount).toBe(6);
    const legacy = await createChatThread();
    await db.chatThreads.update(legacy.id, { contextPolicy: undefined });
    expect((await beginAgentRun({ threadId: legacy.id, connector, model: "unknown", content: "hi" })).context?.policy).toEqual(DEFAULT_CONTEXT_POLICY);
  });
  it("reserves output and margin, uses tools, and raises a threshold after summary", () => {
    const messages: AgentRequestMessage[] = [{ role: "user", content: "x".repeat(8000) }];
    const first = budgetContext(messages, [], 4096);
    expect(first.needsCompression).toBe(true);
    expect(first.inputBudget! + first.outputReserve).toBeLessThan(4096);
    expect(budgetContext(messages, [], 4096, true).threshold).toBeGreaterThan(first.threshold!);
    expect(budgetContext(messages, [], undefined).overBudget).toBe(false);
  });
});

describe("durable context compaction", () => {
  it("uses a separate request and metrics, activates a summary, retains originals and reuses it", async () => {
    const { run, messages } = await begin();
    const requests: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)); requests.push(body);
      return json(requests.length === 1 ? "目标：继续创作。已确认关键约束，下一步完成计划。" : "这是最终回复");
    });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(requests[0].tools).toBeUndefined();
    expect(requests[0].max_tokens).toBeGreaterThan(0);
    const record = (await db.contextCompactions.toArray())[0];
    expect(record.status).toBe("completed");
    expect(record.usage?.totalTokens).toBe(230);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved).toMatchObject({ status: "completed", modelStep: 1, usage: { totalTokens: 230 } });
    expect(saved.requestMessages).toEqual(run.requestMessages);
    expect(saved.continuationMessages![1].content).toContain("历史摘要");
    expect(await db.chatMessages.bulkGet(messages.map((m) => m.id))).toEqual(messages);
    const next = await beginAgentRun({ threadId: run.threadId, connector, model: "unknown-model", content: "再继续", interactionMode: "conversation" });
    expect(next.context?.summaryId).toBe(record.id);
    expect(next.context?.capacity).toBe(4096);
    expect(JSON.stringify(record)).not.toContain(connector.apiKey);
    await deleteChatThread(run.threadId);
    expect(await db.contextCompactions.count()).toBe(0);
  });
  it("invalidates summaries after history is edited, truncated, or disabled", async () => {
    const { run } = await begin();
    await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, vi.fn(async () => json("有效的简短摘要")));
    const records = await db.contextCompactions.toArray();
    expect(findApplicableSummary(run.context!.history, records)).toBeDefined();
    expect(findApplicableSummary(run.context!.history.slice(2), records)).toBeUndefined();
    const edited = run.context!.history.map((m, i) => i ? m : { ...m, content: "changed" });
    expect(findApplicableSummary(edited, records)).toBeUndefined();
    await finishAgentRun(run.id, "completed", { content: "answer" });
    await updateContextPolicy(run.threadId, { ...policy, limitHistory: true, historyMessageCount: 0 });
    const next = await beginAgentRun({ threadId: run.threadId, connector, model: "unknown-model", content: "next", interactionMode: "conversation" });
    expect(next.context?.summaryId).toBeUndefined();
    expect(next.requestMessages).toHaveLength(2);
  });
  it.each(["failed", "empty", "larger", "stopped", "deleted"])("keeps the old envelope when summary is %s", async (mode) => {
    const { run } = await begin(); const controller = new AbortController();
    const fetcher = vi.fn(async () => {
      if (mode === "stopped") controller.abort();
      if (mode === "deleted") await deleteChatThread(run.threadId);
      if (mode === "failed") return new Response(`error ${connector.apiKey}`, { status: 500 });
      return json(mode === "empty" ? "" : mode === "larger" ? "x".repeat(20000) : "summary");
    });
    await expect(prepareRunContext(run.id, [], connector.apiKey, controller.signal, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    if (mode === "deleted") { expect(await db.contextCompactions.count()).toBe(0); return; }
    const saved = await db.agentRuns.get(run.id);
    expect(saved?.context?.summaryId).toBeUndefined();
    expect(saved?.requestMessages).toEqual(run.requestMessages);
    const record = (await db.contextCompactions.toArray())[0];
    expect(record.status).toBe(mode === "stopped" ? "interrupted" : "failed");
    expect(JSON.stringify(record)).not.toContain(connector.apiKey);
  });
  it("recovers a reload without network and only retries an unfinished summary explicitly", async () => {
    const { run } = await begin();
    await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, vi.fn(async () => json("保存的摘要")));
    const record = (await db.contextCompactions.toArray())[0];
    await db.contextCompactions.add({ ...record, id: "abandoned", status: "running", activatedAt: undefined, content: "" });
    await interruptThreadRuns(run.threadId);
    expect((await db.contextCompactions.get("abandoned"))?.status).toBe("interrupted");
    const retry = await beginAgentRun({ threadId: run.threadId, connector, model: run.model, retryOfRunId: run.id });
    expect(retry.context?.summaryId).toBe(record.id);
    const fetcher = vi.fn(async () => json("final"));
    await executeChatRun(retry, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps Responses reasoning and tool pairs byte-for-byte when compacting base history", async () => {
    const { run } = await begin();
    const tail: AgentRequestMessage[] = [{ role: "assistant", content: "", tool_calls: [{ id: "call", type: "function", function: { name: "tool", arguments: "{}" } }] }, { role: "tool", tool_call_id: "call", content: "result" }];
    const responseTail: NonNullable<AgentRun["responseItems"]> = [{ type: "reasoning", summary: [], encrypted_content: "opaque" }, { type: "function_call", call_id: "call", name: "tool", arguments: "{}" }, { type: "function_call_output", call_id: "call", output: "result" }];
    await db.agentRuns.update(run.id, { protocol: "responses", continuationMessages: [...run.requestMessages, ...tail], responseItems: [...toResponseInput(run.requestMessages), ...responseTail] });
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.tools).toBeUndefined(); expect(body.max_output_tokens).toBeGreaterThan(0);
      return Response.json({ status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "有效摘要", annotations: [] }] }] });
    });
    const next = await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher);
    expect(next.continuationMessages?.slice(-2)).toEqual(tail);
    expect(next.responseItems?.slice(-3)).toEqual(responseTail);
    expect(next.context?.summaryId).toBeDefined();
  });
  it("rechecks after a tool result and never replays the completed tool", async () => {
    const { run } = await begin(4, 900);
    await db.agentRuns.update(run.id, { enabledToolNames: ["workspace_overview"] });
    const tool = { ...BUILTIN_TOOLS[0], execute: vi.fn(async () => ({ data: "x".repeat(5000) })) };
    const bodies: Array<{messages: AgentRequestMessage[];tools?: unknown[]}> = [];
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)); bodies.push(body);
      if (body.messages[0].content.startsWith("Summarize")) return json("已整理历史，继续当前目标。");
      if (bodies.length === 1) return Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: "call", type: "function", function: { name: "workspace_overview", arguments: "{}" } }] }, finish_reason: "tool_calls" }] });
      return json("最终回复");
    });
    await executeChatRun((await db.agentRuns.get(run.id))!, connector.apiKey, new AbortController(), fetcher, [tool]);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(bodies).toHaveLength(3);
    expect(bodies[1].tools).toBeUndefined();
    expect(bodies[2].messages.slice(-2).map((m) => m.role)).toEqual(["assistant", "tool"]);
    expect((await db.contextCompactions.toArray())[0]?.status).toBe("completed");
    expect((await db.agentRuns.get(run.id))?.modelStep).toBe(2);
  });
  it("incrementally summarizes a long history using bounded requests", async () => {
    const { run } = await begin(20, 900);
    const requests: AgentRequestMessage[][] = [];
    const fetcher = vi.fn(async (_url, init) => { requests.push(JSON.parse(String(init?.body)).messages); return json("累计保留的目标、约束、完成工作与下一步。"); });
    const next = await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher);
    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(8);
    for (const input of requests) expect(budgetContext(input, [], policy.customContextTokens).overBudget).toBe(false);
    const versions = await db.contextCompactions.orderBy("createdAt").toArray();
    expect(versions[1].previousSummaryId).toBe(versions[0].id);
    expect(versions[1].input[1].content).toContain(versions[0].content);
    expect(next.context?.summaryId).toBe(versions.at(-1)?.id);
    expect(budgetContext(next.continuationMessages!, [], policy.customContextTokens, true).overBudget).toBe(false);
  });
  it("rolls back activation if persistence fails and guards unresolved calls", async () => {
    const { run } = await begin();
    const original = db.agentRuns.put.bind(db.agentRuns);
    const failure = vi.spyOn(db.agentRuns, "put").mockImplementation(async (value, key) => {
      if (value.context?.summaryId) throw new Error("disk full");
      return original(value, key);
    });
    try {
      await expect(prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, vi.fn(async () => json("summary")))).rejects.toThrow("disk full");
      expect((await db.agentRuns.get(run.id))?.context?.summaryId).toBeUndefined();
      expect((await db.contextCompactions.toArray())[0].status).toBe("failed");
    } finally { failure.mockRestore(); }
    await db.agentToolCalls.add({ id: "call", runId: run.id, threadId: run.threadId, providerCallId: "call", step: 1, order: 0, name: "workspace_overview", title: "read", arguments: "{}", effect: "read", highRisk: false, status: "unknown", createdAt: "now", updatedAt: "now" });
    const fetcher = vi.fn(async () => json("summary"));
    await expect(prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher)).rejects.toThrow("核实工具");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not send auxiliary requests with unknown capacity or when compression is disabled", async () => {
    const { run } = await begin();
    await db.agentRuns.update(run.id, { context: { ...run.context!, capacity: undefined } });
    const fetcher = vi.fn(async () => json("answer"));
    await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    await db.agentRuns.update(run.id, { context: { ...run.context!, policy: { ...policy, autoCompress: false } } });
    await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses an oversized indivisible question before any HTTP request", async () => {
    const { run } = await begin(0);
    const draft = "x".repeat(30000);
    const requestMessages: AgentRequestMessage[] = [{ role: "system", content: "instructions" }, { role: "user", content: draft }];
    await db.agentRuns.update(run.id, { requestMessages, context: { ...run.context!, draft, baseMessages: requestMessages } });
    const fetcher = vi.fn(async () => json("answer"));
    await expect(prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher)).rejects.toThrow("无法安全压缩");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
