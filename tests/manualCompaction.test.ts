import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createChatThread} from "@/features/agent/commands/chat";
import {beginAgentRun, finishAgentRun} from "@/features/agent/commands/agentRuns";
import {updateContextPolicy} from "@/features/agent/commands/contextSettings";
import {upsertConnector} from "@/features/settings/commands/connectors";
import {DEFAULT_CONTEXT_POLICY} from "@/features/agent/runtime/contextPolicy";
import {compactThreadNow, ManualCompactionError, recoverManualCompactions} from "@/features/agent/runtime/manualCompaction";
import {withExecutionOwnership} from "@/features/agent/runtime/runOwnership";
import {createAgentExecutionService} from "@/features/agent/runtime/agentExecutionService";
import {reserveAgentThreadWork} from "@/features/agent/runtime/threadWork";
import type {ChatMessage} from "@/features/agent/models/chat";
import type {ConnectorConfig} from "@/features/settings/models/connector";

const answer = (content: string) => Response.json({choices: [{message: {content}, finish_reason: "stop"}], usage: {prompt_tokens: 300, completion_tokens: 30, total_tokens: 330}});
const messages = (threadId: string, count = 8, size = 900): ChatMessage[] => Array.from({length: count}, (_, i) => ({
    id: `m${i}`, threadId, role: i % 2 ? "assistant" : "user", content: `${i}: ${"x".repeat(size)}`, status: "complete", createdAt: new Date(1000 + i).toISOString()}));
const tracked: ReturnType<typeof createAgentExecutionService>[] = [];
afterEach(async () => {for (const owner of tracked.splice(0)) await owner.shutdown(); vi.restoreAllMocks();});

async function setup(options: {count?: number; policy?: Partial<typeof DEFAULT_CONTEXT_POLICY>} = {}) {
    const config: ConnectorConfig = await upsertConnector({definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret-key"});
    const thread = await createChatThread();
    await updateContextPolicy(thread.id, {...DEFAULT_CONTEXT_POLICY, customContextTokens: 16000, ...options.policy});
    await db.chatMessages.bulkAdd(messages(thread.id, options.count ?? 8));
    return {config, thread};
}
const compact = (threadId: string, config: ConnectorConfig, fetchImpl: typeof fetch, controller = new AbortController()) =>
    compactThreadNow({threadId, connector: config, model: "unknown-model", controller, fetchImpl});
async function code(promise: Promise<unknown>) {
    try {await promise;} catch (cause) {if (cause instanceof ManualCompactionError) return cause.code; throw cause;}
    return "ok";
}

describe("manual compaction", () => {
    it("saves a run-less summary that the next send reuses, with request-level before and after", async () => {
        const {config, thread} = await setup();
        const bodies: Array<Record<string, unknown>> = [];
        const fetcher = vi.fn<typeof fetch>(async (_url, init) => {bodies.push(JSON.parse(String(init?.body))); return answer("已整理：目标、约束与进度。");});
        const result = await compact(thread.id, config, fetcher);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(bodies[0].tools).toBeUndefined();
        expect(result.record).toMatchObject({origin: "manual", runId: "manual", status: "completed", threadId: thread.id});
        expect(result.record.coverage).toHaveLength(8);
        expect(result.after).toBeLessThan(result.before);
        expect(result.record).toMatchObject({requestBefore: result.before, requestAfter: result.after});
        expect(JSON.stringify(await db.contextCompactions.toArray())).not.toContain(config.apiKey);
        expect(await db.chatMessages.where("threadId").equals(thread.id).count()).toBe(8);
        const next = await beginAgentRun({threadId: thread.id, connector: config, model: "unknown-model", content: "继续", interactionMode: "conversation"});
        expect(next.context?.summaryId).toBe(result.record.id);
        expect(next.requestMessages.some(message => message.content.includes("历史摘要"))).toBe(true);
        // Newer turns after the covered prefix still compact incrementally.
        await db.chatMessages.bulkAdd(messages(thread.id, 12).slice(8).map((message, i) => ({...message, id: `n${i}`, createdAt: new Date(5000 + i).toISOString()})));
        await finishAgentRun(next.id, "completed", {content: "ok"});
        const second = await compact(thread.id, config, fetcher);
        expect(second.record.previousSummaryId).toBe(result.record.id);
        expect(second.record.coverage.length).toBeGreaterThan(result.record.coverage.length);
    });
    it("keeps working when automatic compression is switched off", async () => {
        const {config, thread} = await setup({policy: {autoCompress: false}});
        const result = await compact(thread.id, config, vi.fn<typeof fetch>(async () => answer("已整理：目标与进度。")));
        const next = await beginAgentRun({threadId: thread.id, connector: config, model: "unknown-model", content: "继续", interactionMode: "conversation"});
        expect(next.context?.summaryId).toBe(result.record.id);
    });
    it("reports nothing to compact for an empty thread or an already covered history", async () => {
        const {config, thread} = await setup({count: 0});
        const fetcher = vi.fn<typeof fetch>(async () => answer("已整理：目标与进度。"));
        expect(await code(compact(thread.id, config, fetcher))).toBe("nothing");
        await db.chatMessages.bulkAdd(messages(thread.id));
        await compact(thread.id, config, fetcher);
        expect(await code(compact(thread.id, config, fetcher))).toBe("nothing");
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
    it("refuses during an active run, a pending approval and an unknown tool outcome without any request", async () => {
        const {config, thread} = await setup();
        const run = await beginAgentRun({threadId: thread.id, connector: config, model: "unknown-model", content: "继续", interactionMode: "conversation"});
        const fetcher = vi.fn<typeof fetch>(async () => answer("不应被调用"));
        // A live owner (this or another page) holds the thread lock for the whole run.
        expect(await withExecutionOwnership(thread.id, () => code(compact(thread.id, config, fetcher)))).toBe("busy");
        await db.agentRuns.update(run.id, {status: "waiting_approval", hasToolCalls: true});
        expect(await code(compact(thread.id, config, fetcher))).toBe("busy");
        await db.agentRuns.update(run.id, {status: "completed", hasToolCalls: true});
        await db.agentToolCalls.add({id: "call", runId: run.id, threadId: thread.id, status: "unknown"} as never);
        expect(await code(compact(thread.id, config, fetcher))).toBe("busy");
        await db.agentToolCalls.update("call", {status: "completed"});
        await db.agentTaskWrapups.add({id: "w", threadId: thread.id, status: "preparing"} as never);
        expect(await code(compact(thread.id, config, fetcher))).toBe("busy");
        expect(fetcher).not.toHaveBeenCalled();
        expect(await db.contextCompactions.count()).toBe(0);
        await db.agentTaskWrapups.delete("w");
        expect(await code(compact(thread.id, config, answerFetch()))).toBe("ok");
    });
    it.each([
        ["provider failure", () => new Response(`error secret-key`, {status: 500}), "summary"],
        ["empty summary", () => answer(""), "summary"],
        ["oversized summary", () => answer("x".repeat(20000)), "summary"],
    ])("fails safely on %s: record failed, nothing activated, key redacted", async (_name, response, expected) => {
        const {config, thread} = await setup();
        const failure = await compact(thread.id, config, vi.fn<typeof fetch>(async () => response())).catch(cause => cause as ManualCompactionError);
        expect(failure).toBeInstanceOf(ManualCompactionError);
        expect((failure as ManualCompactionError).code).toBe(expected);
        expect((failure as ManualCompactionError).message).not.toContain("secret-key");
        const [record] = await db.contextCompactions.toArray();
        expect(record).toMatchObject({status: "failed", origin: "manual"});
        expect(record.activatedAt).toBeUndefined();
        expect(JSON.stringify(record)).not.toContain("secret-key");
        const next = await beginAgentRun({threadId: thread.id, connector: config, model: "unknown-model", content: "继续", interactionMode: "conversation"});
        expect(next.context?.summaryId).toBeUndefined();
    });
    it("is cancellable: aborts the request, marks the record interrupted and never activates it", async () => {
        const {config, thread} = await setup();
        const controller = new AbortController();
        const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
            queueMicrotask(() => controller.abort());
            return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")), {once: true}));
        });
        expect(await code(compact(thread.id, config, fetcher, controller))).toBe("cancelled");
        const [record] = await db.contextCompactions.toArray();
        expect(record.status).toBe("interrupted");
        expect(record.activatedAt).toBeUndefined();
        expect(await code(compact(thread.id, config, answerFetch(), controller))).toBe("cancelled");
        expect(await db.contextCompactions.count()).toBe(1);
    });
    it("does not activate a summary whose history changed while it was produced", async () => {
        const {config, thread} = await setup();
        const fetcher = vi.fn<typeof fetch>(async () => {
            await db.chatMessages.update("m0", {content: "edited while summarizing"});
            return answer("已整理：目标与进度。");
        });
        expect(await code(compact(thread.id, config, fetcher))).toBe("changed");
        expect((await db.contextCompactions.toArray())[0].status).toBe("failed");
    });
    it("closes an abandoned running record on recovery without a request", async () => {
        const {config, thread} = await setup();
        await compact(thread.id, config, answerFetch());
        const [done] = await db.contextCompactions.toArray();
        await db.contextCompactions.add({...done, id: "abandoned", status: "running", activatedAt: undefined, content: ""});
        await recoverManualCompactions(thread.id);
        expect((await db.contextCompactions.get("abandoned"))?.status).toBe("interrupted");
        expect((await db.contextCompactions.get(done.id))?.status).toBe("completed");
    });
});

function answerFetch() {return vi.fn<typeof fetch>(async () => answer("已整理：目标、约束与进度。"));}

describe("manual compaction through the execution service", () => {
    function service(fetchImpl: typeof fetch) {
        const owner = createAgentExecutionService({store: new Proxy(db, {}), fetchImpl}); tracked.push(owner); return owner;
    }
    it("takes the thread-work reservation, exposes progress and Stop, and excludes other work", async () => {
        const {config, thread} = await setup();
        const entered = Promise.withResolvers<void>();
        const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
            entered.resolve();
            return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")), {once: true}));
        });
        const owner = service(fetcher);
        await owner.initialize();
        const handle = owner.compactContext({threadId: thread.id, connectorId: config.id, model: "unknown-model"});
        expect(owner.snapshot(thread.id)).toMatchObject({active: true, kind: "contextCompaction"});
        expect(() => owner.compactContext({threadId: thread.id, connectorId: config.id, model: "unknown-model"})).toThrow();
        await entered.promise;
        expect(owner.requestStop({threadId: thread.id, token: handle.token})).toBe(true);
        await handle.done;
        expect(owner.snapshot(thread.id).active).toBe(false);
        expect((await db.contextCompactions.toArray())[0].status).toBe("interrupted");
    });
    it("publishes a typed failure as the snapshot error", async () => {
        const {config, thread} = await setup({count: 0});
        const owner = service(answerFetch());
        await owner.initialize();
        await owner.compactContext({threadId: thread.id, connectorId: config.id, model: "unknown-model"}).done;
        expect(owner.snapshot(thread.id).error).toBe("没有更多可整理的完整对话。");
    });
    it("cannot start while another owner holds the thread", async () => {
        const {config, thread} = await setup();
        const store = new Proxy(db, {});
        const owner = createAgentExecutionService({store, fetchImpl: answerFetch()}); tracked.push(owner);
        const held = reserveAgentThreadWork(store, {kind: "model", threadId: thread.id, invocationId: "other"}, new AbortController());
        expect(() => owner.compactContext({threadId: thread.id, connectorId: config.id, model: "unknown-model"})).toThrow();
        held.follow(Promise.resolve());
    });
});
