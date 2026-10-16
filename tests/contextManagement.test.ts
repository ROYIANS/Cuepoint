import {interceptStoreTable} from "./helpers/storeFaults";
import {createProject as createBoundTestProject} from "@/features/projects/commands/projects";
import {createChatThread} from "@/features/agent/commands/chat";
import {deleteChatThread} from "@/features/agent/commands/lifecycle";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/platform/product/store";
import { beginAgentRun, finishAgentRun, interruptThreadRuns } from "@/features/agent/commands/agentRuns";

import { updateContextPolicy, resetThreadContextPolicy, saveContextPolicyAsDefault } from "@/features/agent/commands/contextSettings";
import { createAgentTask } from "@/features/agent/commands/agentTasks";
import { DEFAULT_CONTEXT_POLICY, normalizeContextPolicy, resolveContextCapacity } from "@/features/agent/runtime/contextPolicy";
import { selectContextHistory, budgetContext, findApplicableSummary, buildContextMessages } from "@/features/agent/runtime/contextPlanner";
import { prepareRunContext, pruneSeenToolResults, summaryOutputCap, summaryReasoningEffort, PRUNE_RESULT_CHARACTERS } from "@/features/agent/runtime/contextCompaction";
import { isContextOverflow } from "@/features/agent/runtime/runChat";
import { BUILTIN_TOOLS } from "@/features/agent/runtime/tools";
import { executeChatRun } from "@/features/agent/runtime/runChat";
import { toResponseInput } from "@/features/agent/providers/responsesStream";
import type {ChatMessage} from "@/features/agent/models/chat";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import type { AgentRequestMessage, AgentRun } from "@/features/agent/models/agent";

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
    const task = await createAgentTask({projectId:(await createBoundTestProject("测试项目")).id, title: "task", goal: "goal" });
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
  it.each(["failed", "empty", "larger"])("retries once, keeps the old envelope and sends uncompressed when summary is %s", async (mode) => {
    const { run } = await begin();
    const fetcher = vi.fn(async () => {
      if (mode === "failed") return new Response(`error ${connector.apiKey}`, { status: 500 });
      return json(mode === "empty" ? "" : "x".repeat(20000));
    });
    // Still inside the hard window: the run proceeds with the original request instead of failing.
    const next = await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(next.context?.summaryId).toBeUndefined();
    expect(next.requestMessages).toEqual(run.requestMessages);
    const records = await db.contextCompactions.toArray();
    expect(records).toHaveLength(2);
    expect(records.every(record => record.status === "failed")).toBe(true);
    expect(JSON.stringify(records)).not.toContain(connector.apiKey);
  });
  it("fails clearly after the retry when the request is beyond the hard window", async () => {
    const { run } = await begin(8, 900);
    await db.agentRuns.update(run.id, { requestMessages: [{ role: "user", content: "x".repeat(40000) }], continuationMessages: [{ role: "user", content: "x".repeat(40000) }] });
    const fetcher = vi.fn(async () => new Response(`error ${connector.apiKey}`, { status: 500 }));
    await expect(prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await db.contextCompactions.toArray()).every(record => record.status === "failed")).toBe(true);
  });
  it.each(["stopped", "deleted"])("keeps the old envelope when summary is %s", async (mode) => {
    const { run } = await begin(); const controller = new AbortController();
    const fetcher = vi.fn(async () => {
      if (mode === "stopped") controller.abort();
      if (mode === "deleted") await deleteChatThread(run.threadId);
      return json("summary");
    });
    await expect(prepareRunContext(run.id, [], connector.apiKey, controller.signal, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    if (mode === "deleted") { expect(await db.contextCompactions.count()).toBe(0); return; }
    const saved = await db.agentRuns.get(run.id);
    expect(saved?.context?.summaryId).toBeUndefined();
    expect(saved?.requestMessages).toEqual(run.requestMessages);
    const record = (await db.contextCompactions.toArray())[0];
    expect(record.status).toBe("interrupted");
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
    await db.agentRuns.update(run.id, { enabledToolNames: ["workspace_overview"], interactionMode: "smart", toolLoading: undefined, offeredTools: undefined });
    const tool = { ...BUILTIN_TOOLS[0], execute: vi.fn(async () => ({ data: "x".repeat(5000) })) };
    const bodies: Array<{messages: AgentRequestMessage[];tools?: unknown[]}> = [];
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)); bodies.push(body);
      if (body.messages[0].content.startsWith("Summarize")) return json("已整理历史，继续当前目标。");
      if (bodies.length === 1) return Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: "call", type: "function", function: { name: "workspace_overview", arguments: "{}" } }] }, finish_reason: "tool_calls" }], usage: { prompt_tokens: 1500, completion_tokens: 10, total_tokens: 1510 } });
      return Response.json({ choices: [{ message: { content: "最终回复" }, finish_reason: "stop" }], usage: { prompt_tokens: 1800, completion_tokens: 10, total_tokens: 1810 } });
    });
    await executeChatRun((await db.agentRuns.get(run.id))!, connector.apiKey, new AbortController(), fetcher, [tool]);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    expect(tool.execute).toHaveBeenCalledTimes(1);
    // The first request is under threshold; its provider-reported size anchors the post-tool recheck.
    expect(bodies).toHaveLength(4);
    expect(bodies.filter(body => !body.tools)).toHaveLength(1);
    expect(bodies[1].tools).toBeUndefined();
    expect(bodies[2].messages.slice(-2).map((m) => m.role)).toEqual(["assistant", "tool"]);
    expect((await db.contextCompactions.toArray())[0]?.status).toBe("completed");
    expect((await db.agentRuns.get(run.id))?.modelStep).toBe(3);
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

    const failure = interceptStoreTable(db, "agentRuns", "put", async (_tx,args,next)=> {const [value,key]=args as Parameters<typeof db.agentRuns.put>;
      if (value.context?.summaryId) throw new Error("disk full");
      return next(); });
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

describe("automatic compaction hardening", () => {
  async function wide(n = 8, size = 900) {
    const thread = await createChatThread();
    await updateContextPolicy(thread.id, { ...DEFAULT_CONTEXT_POLICY, customContextTokens: 100000 });
    await db.chatMessages.bulkAdd(history(thread.id, n, size));
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "unknown-model", content: "接着完成当前目标", interactionMode: "conversation" });
    return { thread, run };
  }
  it("recognizes provider context-length rejections only", () => {
    for (const message of ["请求失败（400）：This model's maximum context length is 8192 tokens", "context_length_exceeded", "prompt is too long: 210000 tokens", "Your input exceeds the context window of this model"]) expect(isContextOverflow(message)).toBe(true);
    for (const message of ["请求失败（401）：invalid api key", "请求失败（429）：rate limit", "模型暂时不可用"]) expect(isContextOverflow(message)).toBe(false);
  });
  it("compacts once on a provider overflow and repeats the same step with the summary", async () => {
    const { run } = await wide();
    const bodies: Array<{ messages: AgentRequestMessage[] }> = [];
    let mains = 0;
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)); bodies.push(body);
      if (body.messages[0].content.startsWith("Summarize")) return json("已整理：目标、约束与进度。");
      mains++;
      if (mains === 1) return new Response(JSON.stringify({ error: { code: "context_length_exceeded", message: "maximum context length exceeded" } }), { status: 400 });
      return json("最终回复");
    });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.status).toBe("completed");
    expect(saved.modelStep).toBe(1);
    expect(bodies[2].messages.some(message => String(message.content).includes("历史摘要"))).toBe(true);
    expect((await db.contextCompactions.toArray()).map(record => record.status)).toEqual(["completed"]);
  });
  it("does not loop: an overflow with nothing to compact fails with the original error after one request", async () => {
    const thread = await createChatThread();
    await updateContextPolicy(thread.id, { ...DEFAULT_CONTEXT_POLICY, customContextTokens: 100000 });
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "unknown-model", content: "你好", interactionMode: "conversation" });
    const fetcher = vi.fn(async () => new Response("maximum context length exceeded", { status: 400 }));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
  });
  it("clips only bulky results the model already saw, once, keeping the latest round intact", () => {
    const big = (tag: string) => tag.repeat(PRUNE_RESULT_CHARACTERS + 500);
    const messages: AgentRequestMessage[] = [{ role: "system", content: "s" }, { role: "user", content: "q" },
      { role: "assistant", content: "", tool_calls: [{ id: "a", type: "function", function: { name: "t", arguments: "{}" } }] }, { role: "tool", tool_call_id: "a", content: big("a") },
      { role: "assistant", content: "", tool_calls: [{ id: "b", type: "function", function: { name: "t", arguments: "{}" } }] }, { role: "tool", tool_call_id: "b", content: big("b") }];
    const pruned = pruneSeenToolResults(messages)!;
    expect(pruned[3].content.length).toBeLessThan(PRUNE_RESULT_CHARACTERS);
    expect(pruned[3].content).toContain("已省略");
    expect(pruned[5]).toEqual(messages[5]);
    expect(pruneSeenToolResults(pruned)).toBeUndefined();
    expect(pruneSeenToolResults(messages.slice(0, 2))).toBeUndefined();
  });
  it("prunes seen results before asking a model to summarize, and skips the request when that suffices", async () => {
    const { run } = await wide(0);
    const tool = (id: string, content: string): AgentRequestMessage[] => [{ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name: "t", arguments: "{}" } }] }, { role: "tool", tool_call_id: id, content }];
    await db.agentRuns.update(run.id, { context: { ...run.context!, capacity: 4096 }, continuationMessages: [...run.requestMessages, ...tool("a", "a".repeat(12000)), ...tool("b", "latest result")] });
    const fetcher = vi.fn(async () => json("unused"));
    const next = await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    const messages = next.continuationMessages!;
    expect(messages.find(message => message.role === "tool" && message.tool_call_id === "a")!.content).toContain("已省略");
    expect(messages.at(-1)).toEqual({ role: "tool", tool_call_id: "b", content: "latest result" });
    expect(next.context?.summaryId).toBeUndefined();
  });
  it("asks for a cheap, capped, tool-free summary", async () => {
    const { run } = await begin();
    const bodies: Array<Record<string, unknown>> = [];
    await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, vi.fn(async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return json("有效的简短摘要"); }));
    expect(bodies[0].tools).toBeUndefined();
    expect(bodies[0].reasoning_effort).toBeUndefined();
    const cap = Number(bodies[0].max_tokens);
    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThanOrEqual(4096);
    expect(summaryOutputCap([{ role: "user", content: "x".repeat(400) }], 10000)).toBe(512);
    expect(summaryOutputCap([{ role: "user", content: "x".repeat(40000) }], 10000)).toBe(4096);
    expect(summaryOutputCap([{ role: "user", content: "x" }], 300)).toBe(300);
    const identity = { definitionId: "openai-compatible" as const, baseUrl: connector.baseUrl };
    expect(summaryReasoningEffort(identity, "gpt-5", "high")).toBe("minimal");
    expect(summaryReasoningEffort(identity, "gpt-5.1", "xhigh")).toBe("none");
    expect(summaryReasoningEffort(identity, "gpt-5-pro", "high")).toBe("high");
    expect(summaryReasoningEffort(identity, "gpt-5", undefined)).toBeUndefined();
  });
  it("rejects an empty summary after the retry and sends the original request", async () => {
    const { run } = await begin();
    const next = await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, vi.fn(async () => json("")));
    expect(next.context?.summaryId).toBeUndefined();
    expect((await db.contextCompactions.toArray()).every(record => record.status === "failed" && record.error)).toBe(true);
  });
});
