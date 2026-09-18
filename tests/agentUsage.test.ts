import { describe, expect, it, vi } from "vitest";
import { streamChatCompletions } from "@/lib/ai/chatStream";
import { beginAgentRun, recordAgentModelMetrics } from "@/db/agentRuns";
import { startModelStep } from "@/db/agentTools";
import { createChatThread, deleteChatThread } from "@/db/repo";
import { db } from "@/db/database";
import type { ConnectorConfig } from "@/domain/types";
import { executeChatRun } from "@/lib/agent/runChat";
const connector: ConnectorConfig = { id: "cx", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret", updatedAt: "2026-09-18" };
const input = { baseUrl: connector.baseUrl, apiKey: connector.apiKey, model: "demo", messages: [{ role: "user" as const, content: "hi" }] };
const answer = { choices: [{ message: { content: "answer" }, finish_reason: "stop" }] };
async function begin() {
  const thread = await createChatThread();
  return beginAgentRun({ threadId: thread.id, connector, model: "demo", content: "hi" });
}

describe("provider usage and timestamps", () => {
  it("reads JSON counts without inventing a first-token timestamp or missing counts", async () => {
    const result = await streamChatCompletions(input, { fetchImpl: vi.fn(async () => Response.json({ ...answer, usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 } })) });
    expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 2, totalTokens: 6 });
    expect(result.metrics?.firstTokenAt).toBeUndefined();
    expect(result.metrics!.endedAt).toBeGreaterThanOrEqual(result.metrics!.startedAt);
    const malformed = await streamChatCompletions(input, { fetchImpl: vi.fn(async () => Response.json({ ...answer, usage: { prompt_tokens: -1, completion_tokens: "9", total_tokens: null } })) });
    expect(malformed.usage).toBeUndefined();
    const partial = await streamChatCompletions(input, { fetchImpl: vi.fn(async () => Response.json({ ...answer, usage: { prompt_tokens: 0 } })) });
    expect(partial.usage).toEqual({ inputTokens: 0 });
  });
  it("keeps final SSE usage-only frames after finish_reason and ignores null intermediate usage", async () => {
    const events = [
      { choices: [{ delta: { content: "answer" }, finish_reason: null }], usage: null },
      { choices: [{ delta: {}, finish_reason: "stop" }], usage: null },
      { choices: [], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } },
    ];
    const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n";
    const result = await streamChatCompletions(input, { fetchImpl: vi.fn(async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } })) });
    expect(result.ok).toBe(true);
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 3, totalTokens: 8 });
    expect(result.metrics?.firstTokenAt).toBeTypeOf("number");
  });
  it("retains reported usage for truncated replies without marking the reply complete", async () => {
    const result = await streamChatCompletions(input, { fetchImpl: vi.fn(async () => Response.json({ choices: [{ message: { content: "partial" }, finish_reason: "length" }], usage: { total_tokens: 12 } })) });
    expect(result.ok).toBe(false);
    expect(result.usage).toEqual({ totalTokens: 12 });
  });
  it("saves actual JSON usage through the runtime", async () => {
    const run = await begin();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => Response.json({ ...answer, usage: { prompt_tokens: 20, completion_tokens: 3, total_tokens: 23 } })));
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "completed", usage: { inputTokens: 20, outputTokens: 3, totalTokens: 23 } });
    expect((await db.agentRuns.get(run.id))?.outputTokensPerSecond).toBeUndefined();
  });
});

describe("durable model metrics", () => {
  it("deduplicates the same step, sums known counts and excludes approval gaps from speed", async () => {
    const run = await begin();
    await startModelStep(run.id, 8);
    const first = { step: 1, startedAt: 1000, firstTokenAt: 1500, endedAt: 2500, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } };
    await recordAgentModelMetrics(run.id, first);
    await recordAgentModelMetrics(run.id, { ...first, usage: { totalTokens: 999 } });
    await startModelStep(run.id, 8);
    await recordAgentModelMetrics(run.id, { step: 2, startedAt: 9000, firstTokenAt: 9500, endedAt: 10500, usage: { inputTokens: 30, outputTokens: 40, totalTokens: 70 } });
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.modelMetrics).toHaveLength(2);
    expect(saved.usage).toEqual({ inputTokens: 40, outputTokens: 60, totalTokens: 100 });
    expect(saved.outputTokensPerSecond).toBe(30);
  });
  it("does not turn absent usage or a crashed round into zero usage", async () => {
    const run = await begin();
    await startModelStep(run.id, 8);
    await recordAgentModelMetrics(run.id, { step: 1, startedAt: 1, endedAt: 3, usage: { inputTokens: 2, totalTokens: 5 } });
    await startModelStep(run.id, 8);
    await recordAgentModelMetrics(run.id, { step: 2, startedAt: 4, endedAt: 9, usage: { totalTokens: 8 } });
    expect((await db.agentRuns.get(run.id))?.usage).toEqual({ totalTokens: 13 });
    await startModelStep(run.id, 8); // interrupted before counts saved
    expect((await db.agentRuns.get(run.id))?.usage).toBeUndefined();
    expect((await db.agentRuns.get(run.id))?.outputTokensPerSecond).toBeUndefined();
    await startModelStep(run.id, 8);
    await recordAgentModelMetrics(run.id, { step: 4, startedAt: 12, endedAt: 18, usage: { totalTokens: 7 } });
    expect((await db.agentRuns.get(run.id))?.usage).toBeUndefined();
    expect((await db.agentRuns.get(run.id))?.outputTokensPerSecond).toBeUndefined();
    await deleteChatThread(run.threadId);
    await recordAgentModelMetrics(run.id, { step: 4, startedAt: 12, endedAt: 18 });
    expect(await db.agentRuns.count()).toBe(0);
  });
});
