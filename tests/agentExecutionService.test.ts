import {afterEach, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import type {ProductStore, TableScope} from "@/platform/storage/types";
import {UnknownCommitError} from "@/platform/storage/errors";
import {createAgentExecutionService} from "@/features/agent/runtime/agentExecutionService";
import {createSubmissionAttempt} from "@/features/agent/models/chatSubmissionAttempt";
import {createChatThread} from "@/features/agent/commands/chat";
import * as chatCommands from "@/features/agent/commands/chat";
import * as runCommands from "@/features/agent/commands/agentRuns";
import {upsertConnector} from "@/features/settings/commands/connectors";
import {updateGeneralAgentConfig} from "@/features/agent/commands/agentSettings";
import {withExecutionOwnership, type ThreadLockManager} from "@/features/agent/runtime/runOwnership";
import {BUILTIN_TOOLS} from "@/features/agent/runtime/tools";
import {saveToolRound, pauseForApproval, transitionToolCall} from "@/features/agent/commands/agentTools";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import type {ChatSubmissionAttempt} from "@/features/agent/models/chatSubmissionAttempt";

function deferred<T = void>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => {resolve = done;});
    return {promise, resolve};
}
const answer = (content = "answer") => Response.json({choices: [{message: {content}, finish_reason: "stop"}]});
async function connector() {
    return upsertConnector({definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret"});
}
async function attempt(config: ConnectorConfig, threadId?: string): Promise<ChatSubmissionAttempt> {
    const thread = threadId ?? (await createChatThread()).id;
    return createSubmissionAttempt({originThreadId: thread, submitted: {scope: thread, text: "hello", textRevision: 1, attachments: [], imports: []},
        recovery: {scope: thread, revision: 2}, connector: {id: config.id, definitionId: config.definitionId, baseUrl: config.baseUrl},
        model: "test", taskMode: false, interactionMode: "conversation"});
}
const tracked: ReturnType<typeof createAgentExecutionService>[] = [];
function service(options: Parameters<typeof createAgentExecutionService>[0]) {
    const store = options.store === db ? new Proxy(db, {}) : options.store;
    const owner = createAgentExecutionService({...options, store}); tracked.push(owner); return owner;
}
afterEach(async () => {for (const owner of tracked.splice(0)) await owner.shutdown(); vi.restoreAllMocks();});

it("publishes a synchronous immutable reservation, isolates A/B and retains original completion through Stop", async () => {
    const config = await connector(), a = await attempt(config), b = await attempt(config);
    // Structural assignability must not carry the current secret into view snapshots.
    a.connector = config;
    a.createdThread = {...(await db.chatThreads.get(a.threadId))!, excludedMemoryIds: ["memory"]};
    const entered = deferred(), releaseB = deferred(); let requests = 0;
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
        requests++;
        if (requests === 2) entered.resolve();
        if (requests === 1) await new Promise<void>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")), {once: true}));
        else await releaseB.promise;
        return answer("B original result");
    });
    const owner = service({store: db, fetchImpl: fetcher});
    await owner.initialize();
    const seen = vi.fn(); const detach = owner.subscribe(a.threadId, seen);
    const first = owner.submit({attempt: a});
    const snapshot = owner.snapshot(a.threadId);
    expect(snapshot.active).toBe(true); expect(snapshot.attempts[0].submitted.text).toBe("hello");
    expect(Object.isFrozen(snapshot)).toBe(true); expect(Object.isFrozen(snapshot.attempts[0].submitted.attachments)).toBe(true);
    expect(snapshot.attempts[0].connector).toEqual({id: config.id, definitionId: config.definitionId, baseUrl: config.baseUrl});
    expect(Object.isFrozen(snapshot.attempts[0].createdThread?.excludedMemoryIds)).toBe(true);
    expect(() => owner.submit({attempt: a})).toThrow();
    a.submitted.text = "mutated caller";
    expect(owner.snapshot(a.threadId).attempts[0].submitted.text).toBe("hello");
    detach(); // No reader is an execution lifecycle event.
    const second = owner.submit({attempt: b});
    await entered.promise;
    expect(owner.snapshot(a.threadId).feedback?.invocationId).not.toBe(owner.snapshot(b.threadId).feedback?.invocationId);
    expect(owner.requestStop({threadId: a.threadId, token: second.token})).toBe(false);
    expect(owner.requestStop(first)).toBe(true); expect(owner.requestStop(first)).toBe(false);
    expect(owner.snapshot(a.threadId).stopping).toBe(true);
    expect(owner.snapshot(b.threadId).stopping).toBe(false);
    await first.done;
    expect(owner.snapshot(a.threadId).active).toBe(false); expect(owner.snapshot(b.threadId).active).toBe(true);
    releaseB.resolve(); await second.done;
    expect((await db.chatMessages.get(b.admission.assistantMessageId))?.content).toBe("B original result");
    expect((await db.agentRuns.get(a.admission.runId))?.status).toBe("cancelled");
    expect(fetcher).toHaveBeenCalledTimes(2);
});

it("holds two actual Studio tool operations and stops A without cancelling B's original tool publication", async () => {
    const config = await connector();
    await updateGeneralAgentConfig({permissionMode: "full", enabledSkillIds: ["workspace"]});
    const a = await attempt(config), b = await attempt(config);
    a.interactionMode = "smart"; b.interactionMode = "smart";
    const entered = deferred(), release = deferred(); let tools = 0;
    const tool = {...BUILTIN_TOOLS[0], effect: "read" as const, execute: vi.fn(async () => {if (++tools === 2) entered.resolve(); await release.promise; return {original: true};})};
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as {messages: {role: string}[]};
        if (body.messages.some(message => message.role === "tool")) return answer();
        return Response.json({choices: [{message: {content: "", tool_calls: [{id: crypto.randomUUID(), type: "function", function: {name: tool.name, arguments: "{}"}}]}, finish_reason: "tool_calls"}]});
    });
    const owner = service({store: db, fetchImpl: fetcher, registry: [tool]});
    const first = owner.submit({attempt: a}), second = owner.submit({attempt: b});
    await entered.promise;
    expect(owner.requestStop(first)).toBe(true);
    expect(owner.snapshot(a.threadId).active).toBe(true); expect(owner.snapshot(b.threadId).stopping).toBe(false);
    expect(() => owner.submit({attempt: {...a, admission: {runId: "duplicate", userMessageId: "duplicate-user", assistantMessageId: "duplicate-assistant"}}})).toThrow("尚有执行");
    release.resolve(); await Promise.all([first.done, second.done]);
    expect(tool.execute).toHaveBeenCalledTimes(2);
    expect((await db.agentToolCalls.where("threadId").equals(b.threadId).toArray())[0].status).toBe("completed");
    expect((await db.agentRuns.get(b.admission.runId))?.status).toBe("completed");
});

it("retains the actual lock and local reservation while a final publication is held", async () => {
    const config = await connector(), submitted = await attempt(config);
    const atFlush = deferred(), release = deferred(); let hold = false, held = false;
    const transaction: ProductStore["transaction"] = async (mode, scope, callback) => {
        const names = scope.map(table => typeof table === "string" ? table : table.name);
        if (hold && !held && mode === "rw" && names.length === 2 && names.includes("chatMessages") && names.includes("agentRuns")) {
            held = true; atFlush.resolve(); await release.promise;
        }
        return db.transaction(mode, scope, callback);
    };
    const store = new Proxy(db, {get(target, key, receiver) {return key === "transaction" ? transaction : Reflect.get(target, key, receiver) as unknown;}});
    const fetcher = vi.fn<typeof fetch>(async () => {hold = true; return answer("final text");});
    const owner = service({store, fetchImpl: fetcher});
    const current = owner.submit({attempt: submitted});
    await atFlush.promise;
    expect(owner.snapshot(submitted.threadId).active).toBe(true);
    await expect(withExecutionOwnership(submitted.threadId, async () => undefined)).rejects.toThrow("另一个页面");
    owner.requestStop(current);
    expect(owner.snapshot(submitted.threadId).active).toBe(true);
    release.resolve(); await current.done;
    expect((await db.chatMessages.get(submitted.admission.assistantMessageId))?.content).toBe("final text");
    expect(owner.snapshot(submitted.threadId).active).toBe(false);
    expect(owner.requestStop(current)).toBe(false);
    await expect(withExecutionOwnership(submitted.threadId, async () => true)).resolves.toBe(true);
});

it("owns compatibility preparation before await and prevents late creation/dispatch after exact Stop", async () => {
    const config = await connector(), submitted = await attempt(config);
    config.definitionId = "apimart"; await db.connectors.put(config); submitted.connector.definitionId = "apimart";
    const entered = deferred(), release = deferred();
    // Hold the actual selected compatibility probe transport.
    const fetcher = vi.fn<typeof fetch>(async () => {entered.resolve(); await release.promise; return Response.json({data: [{id: "test", category: "chat"}]});});
    const owner = service({store: db, fetchImpl: fetcher});
    const current = owner.submit({attempt: submitted});
    await entered.promise;
    expect(() => owner.submit({attempt: submitted})).toThrow();
    owner.requestStop(current); release.resolve(); await current.done;
    expect((await db.agentRuns.toArray())).toHaveLength(0);
    expect(owner.snapshot(submitted.threadId).attempts[0].phase).toBe("failed");
    expect(fetcher).toHaveBeenCalledTimes(1);
});

it("retains headless first-thread creation receipts without route callbacks or a mounted view", async () => {
    const config = await connector(), captured = await attempt(config);
    captured.originThreadId = undefined; captured.threadId = "reserved-new-thread";
    const entered = deferred(), release = deferred();
    const create = chatCommands.createChatThread;
    vi.spyOn(chatCommands, "createChatThread").mockImplementation(async (...args) => {entered.resolve(); await release.promise; return create(...args);});
    const fetcher = vi.fn<typeof fetch>(async () => answer());
    const owner = service({store: db, fetchImpl: fetcher});
    const current = owner.submit({attempt: captured});
    await entered.promise;
    const detach = owner.subscribe(captured.threadId, () => undefined); detach();
    expect(owner.snapshot(captured.threadId).attempts[0].phase).toBe("preparing");
    release.resolve(); await current.done;
    expect(owner.snapshot(captured.threadId).attempts[0].createdThread?.id).toBe(captured.threadId);
    expect(fetcher).toHaveBeenCalledTimes(1);
});

it("stops a held actual begin boundary but retains its admitted identity and terminal publication", async () => {
    const config = await connector(), submitted = await attempt(config);
    const entered = deferred(), release = deferred(), begin = runCommands.beginAgentRun;
    vi.spyOn(runCommands, "beginAgentRun").mockImplementation(async (...args) => {entered.resolve(); await release.promise; return begin(...args);});
    const fetcher = vi.fn<typeof fetch>(async () => answer());
    const owner = service({store: db, fetchImpl: fetcher}), current = owner.submit({attempt: submitted});
    await entered.promise; owner.requestStop(current);
    expect(owner.snapshot(submitted.threadId).active).toBe(true);
    release.resolve(); await current.done;
    expect(fetcher).not.toHaveBeenCalled();
    expect(owner.snapshot(submitted.threadId).attempts[0].phase).toBe("accepted");
    expect((await db.agentRuns.get(submitted.admission.runId))?.status).toBe("cancelled");
});

for (const committed of [true, false]) it(`unknown admission with ${committed ? "positive" : "absent"} readback never dispatches/re-admits automatically`, async () => {
    const config = await connector(), submitted = await attempt(config), begin = runCommands.beginAgentRun;
    let admissions = 0;
    vi.spyOn(runCommands, "beginAgentRun").mockImplementation(async (...args) => {
        admissions++;
        if (committed) await begin(...args);
        throw new UnknownCommitError("original-admission", "fixture");
    });
    const fetcher = vi.fn<typeof fetch>(async () => answer());
    const owner = service({store: db, fetchImpl: fetcher});
    await expect(owner.submit({attempt: submitted}).done).rejects.toBeInstanceOf(UnknownCommitError);
    const snapshot = owner.snapshot(submitted.threadId);
    expect(snapshot.attempts[0].phase).toBe(committed ? "accepted" : "uncertain");
    expect(owner.dismissAttempt({threadId: submitted.threadId, userMessageId: submitted.admission.userMessageId})).toBe(false);
    if (!committed) {
        await owner.checkAdmission({threadId: submitted.threadId, userMessageId: submitted.admission.userMessageId}).done;
        expect(owner.snapshot(submitted.threadId).attempts[0].phase).toBe("uncertain");
    } else {
        await owner.recoverAdmissionState({threadId: submitted.threadId, userMessageId: submitted.admission.userMessageId}).done;
        expect((await db.agentRuns.get(submitted.admission.runId))?.status).toBe("interrupted");
    }
    expect(() => owner.retrySubmission({threadId: submitted.threadId, userMessageId: submitted.admission.userMessageId})).toThrow();
    expect(admissions).toBe(1); expect(fetcher).not.toHaveBeenCalled();
});

it("persists an explicit refusal without a connector and validates run/call thread association", async () => {
    const config = await connector(), submitted = await attempt(config);
    await updateGeneralAgentConfig({permissionMode: "ask", enabledSkillIds: ["workspace"]});
    const run = await runCommands.beginAgentRun({threadId: submitted.threadId, connector: config, model: "test", content: "hello"});
    const call = {id: "approval", type: "function" as const, function: {name: BUILTIN_TOOLS[0].name, arguments: "{}"}};
    await saveToolRound(run.id, "", [call], [{title: "approval", effect: "write", highRisk: false}]);
    const toolCall = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
    await transitionToolCall(run.id, toolCall.id, ["pending"], "awaiting_approval");
    await pauseForApproval(run.id);
    await db.connectors.clear();
    const fetcher = vi.fn<typeof fetch>(async () => answer());
    const owner = service({store: db, fetchImpl: fetcher});
    await expect(owner.resolveApproval({threadId: run.threadId, runId: run.id, callId: toolCall.id, decision: "reject"}).done).rejects.toThrow("决定已保存");
    expect((await db.agentToolCalls.get(toolCall.id))?.decision).toBe("reject");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(owner.cancelSavedRun({threadId: "foreign", runId: run.id}).done).rejects.toThrow("执行不存在");
});

it("memoizes local startup recovery and blocks admission while shutdown drains original work", async () => {
    const config = await connector(), submitted = await attempt(config), entered = deferred(), release = deferred();
    const fetcher = vi.fn<typeof fetch>(async () => {entered.resolve(); await release.promise; return answer();});
    const owner = service({store: db, fetchImpl: fetcher});
    expect(owner.initialize()).toBe(owner.initialize());
    const first = owner.submit({attempt: submitted}); await entered.promise;
    let reentrantShutdown: Promise<void> | undefined;
    owner.subscribe(submitted.threadId, () => {
        if (owner.snapshot(submitted.threadId).stopping) reentrantShutdown = owner.shutdown();
    });
    const shutdown = owner.shutdown(); expect(shutdown).toBe(owner.shutdown());
    expect(reentrantShutdown).toBe(shutdown);
    expect(() => owner.submit({attempt: {...submitted, threadId: "other"}})).toThrow("退出");
    expect(owner.snapshot(submitted.threadId).stopping).toBe(true);
    let drained = false; void shutdown.then(() => {drained = true;}); await Promise.resolve(); expect(drained).toBe(false);
    release.resolve(); await Promise.all([first.done, shutdown]); expect(drained).toBe(true);
});

it("propagates the supplied store into lock-aware recovery instead of the ambient owner", async () => {
    const storeScopes: TableScope[] = [];
    const transaction: ProductStore["transaction"] = (mode, scope, callback) => {storeScopes.push(scope); return db.transaction(mode, scope, callback);};
    const store = new Proxy(db, {get(target, key, receiver) {return key === "transaction" ? transaction : Reflect.get(target, key, receiver) as unknown;}});
    const locks: ThreadLockManager = {async request(_name, _options, callback) {return callback({held: true});}};
    const config = await connector(), submitted = await attempt(config);
    const owner = service({store, locks, fetchImpl: async () => answer()});
    await owner.submit({attempt: submitted}).done;
    expect(storeScopes.some(scope => scope.some(table => (typeof table === "string" ? table : table.name) === "agentGenerationBatches"))).toBe(true);
    expect((await db.agentRuns.get(submitted.admission.runId))?.status).toBe("completed");
});


it("can synchronously Stop from the first subscription without exposing a partial invocation", async () => {
    const config = await connector(), submitted = await attempt(config);
    const fetcher = vi.fn<typeof fetch>(async () => answer());
    const owner = service({store: db, fetchImpl: fetcher});
    const stopped: boolean[] = [];
    owner.subscribe(submitted.threadId, () => {
        const snapshot = owner.snapshot(submitted.threadId);
        if (snapshot.active && !snapshot.stopping && snapshot.token) stopped.push(owner.requestStop({threadId: submitted.threadId, token: snapshot.token}));
    });
    const current = owner.submit({attempt: submitted});
    expect(stopped).toEqual([true]);
    expect(owner.snapshot(submitted.threadId).stopping).toBe(true);
    await current.done;
    expect(owner.snapshot(submitted.threadId).attempts[0].phase).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
});

it("retains a failed unsent payload when the memoized startup reconciliation rejects", async () => {
    const config = await connector(), submitted = await attempt(config);
    const store = new Proxy(db, {get(target, key, receiver) {
        if (key === "agentRuns") return new Proxy(target.agentRuns, {get(table, method, owner) {
            if (method === "where") return () => {throw new Error("startup unavailable");};
            return Reflect.get(table, method, owner) as unknown;
        }});
        return Reflect.get(target, key, receiver) as unknown;
    }});
    const fetcher = vi.fn<typeof fetch>(async () => answer());
    const owner = service({store, fetchImpl: fetcher});
    const current = owner.submit({attempt: submitted});
    await expect(current.done).rejects.toThrow("startup unavailable");
    expect(owner.snapshot(submitted.threadId)).toMatchObject({active: false, attempts: [{phase: "failed", submitted: {text: "hello"}}]});
    expect(owner.initialize()).toBe(owner.initialize());
    expect(fetcher).not.toHaveBeenCalled(); expect(await db.agentRuns.count()).toBe(0);
});

it("keeps exact released feedback lineage until another invocation replaces it", async () => {
    const config = await connector(), submitted = await attempt(config);
    const owner = service({store: db, fetchImpl: async () => answer()});
    const first = owner.submit({attempt: submitted});
    const feedback = owner.feedback(first.threadId, first.token);
    await first.done;
    expect(owner.feedback(first.threadId, first.token)).toBe(feedback);
    const another = await attempt(config, first.threadId);
    const second = owner.submit({attempt: another});
    expect(owner.feedback(first.threadId, first.token)).toBeUndefined();
    expect(owner.requestStop(first)).toBe(false);
    await second.done;
});


it("cold startup only reconciles abandoned records, with zero external requests or replay", async () => {
    const config = await connector(), submitted = await attempt(config);
    const abandoned = await runCommands.beginAgentRun({threadId: submitted.threadId, connector: config, model: "test", content: "saved input"});
    await runCommands.checkpointAgentRun(abandoned.id, 1, {content: "confirmed partial"});
    const fetcher = vi.fn<typeof fetch>(async () => answer());
    const owner = service({store: db, fetchImpl: fetcher});
    const startup = owner.initialize();
    expect(owner.initialize()).toBe(startup);
    await startup;
    expect((await db.agentRuns.get(abandoned.id))?.status).toBe("interrupted");
    expect((await db.chatMessages.get(abandoned.assistantMessageId))?.content).toBe("confirmed partial");
    expect(owner.snapshot(submitted.threadId).active).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
});
