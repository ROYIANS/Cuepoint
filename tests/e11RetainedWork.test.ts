import {afterEach, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createChatDraftStore} from "@/features/agent/runtime/chatDraftStore";
import {currentAgentThreadWork, reserveAgentThreadWork, shutdownAgentThreadWork} from "@/features/agent/runtime/threadWork";
import * as referenceImport from "@/features/references/documents/import";
import {createAgentTask} from "@/features/agent/commands/agentTasks";
import {createProject} from "@/features/projects/commands/projects";
import {upsertConnector} from "@/features/settings/commands/connectors";
import {prepareTaskWrapup} from "@/features/agent/runtime/taskWrapup";
import {createAgentExecutionService} from "@/features/agent/runtime/agentExecutionService";
import {createSubmissionAttempt} from "@/features/agent/models/chatSubmissionAttempt";
import type {ProductStore} from "@/platform/storage/types";

function deferred() {let resolve!: () => void; const promise = new Promise<void>(yes => {resolve = yes;}); return {promise, resolve};}
afterEach(() => vi.restoreAllMocks());

it("registers original import handles before synchronous cancellation or shutdown observation", async () => {
    const importer = vi.spyOn(referenceImport, "importReferenceFile");
    const drafts = createChatDraftStore(), a = drafts.session("A", "project");
    const detach = drafts.subscribe(() => {for (const job of drafts.snapshot("A").imports) a.cancel(job.id);});
    await a.importFiles([new File(["a"], "a.txt"), new File(["b"], "b.txt")]);
    expect(importer).not.toHaveBeenCalled(); expect(drafts.snapshot("A").imports).toEqual([]); detach();
    const next = createChatDraftStore(), scope = next.session("B", "project"); let closing: Promise<void> | undefined;
    next.subscribe(() => {if (next.snapshot("B").imports.length) closing ??= next.shutdown();});
    await scope.importFiles([new File(["c"], "c.txt")]); await closing;
    expect(importer).not.toHaveBeenCalled(); expect(next.snapshot("B").imports).toEqual([]);
});

it("shutdown waits the original held import, suppresses late attachments and cleans queued jobs", async () => {
    const held = deferred(); let signal!: AbortSignal;
    const importer = vi.spyOn(referenceImport, "importReferenceFile").mockImplementation(async (_project, _file, options) => {
        signal = options!.signal!; await held.promise; throw new DOMException("stopped", "AbortError");
    });
    const drafts = createChatDraftStore(), session = drafts.session("origin", "project");
    const original = session.importFiles([new File(["a"], "a.txt"), new File(["b"], "b.txt")]);
    let done = false; const shutdown = drafts.shutdown().then(() => {done = true;});
    expect(signal.aborted).toBe(true); await Promise.resolve(); expect(done).toBe(false);
    held.resolve(); await original; await shutdown;
    expect(importer).toHaveBeenCalledTimes(1); expect(drafts.snapshot("origin").imports).toEqual([]);
    expect(drafts.snapshot("origin").attachments).toEqual([]);
});

it("keeps named ownership until original completion and releases before done handlers reserve again", async () => {
    const store = new Proxy(db, {}), held = deferred(), controller = new AbortController();
    const a = reserveAgentThreadWork(store, {kind: "videoBatch", threadId: "a", batchId: "batch"}, controller);
    a.follow(held.promise);
    expect(() => reserveAgentThreadWork(store, {kind: "taskWrapup", threadId: "a", taskId: "task"}, new AbortController())).toThrow("尚有执行");
    const b = reserveAgentThreadWork(store, {kind: "audioBatch", threadId: "b", projectId: "p", batchId: "audio"}, new AbortController());
    b.follow(Promise.resolve()); await b.work.done;
    const closing = shutdownAgentThreadWork(store); expect(controller.signal.aborted).toBe(true);
    expect(currentAgentThreadWork(store, "a")).toBe(a.work); held.resolve(); await closing;
    expect(currentAgentThreadWork(store, "a")).toBeUndefined();
    const other = new Proxy(db, {}), finished = reserveAgentThreadWork(other, {kind: "model", threadId: "a", invocationId: "one"}, new AbortController());
    finished.follow(Promise.resolve()); await finished.work.done;
    const second = reserveAgentThreadWork(other, {kind: "model", threadId: "a", invocationId: "two"}, new AbortController());
    second.follow(Promise.resolve()); await second.work.done;
});

async function setupTask() {
    const project = await createProject("retained wrapup");
    const task = await createAgentTask({projectId: project.id, title: "task", goal: "review", plan: [], acceptanceCriteria: []});
    const connector = await upsertConnector({definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "old-key"});
    return {task, connector};
}
const wrapupResponse = () => Response.json({choices: [{message: {content: JSON.stringify({overview: "需要人工检查", results: [], acceptance: [], decisions: [], lessons: [], unresolved: []})}, finish_reason: "stop"}]});

it.each([false, true])("refreshes saved credentials after held evidence reads and refuses changed identity: %s", async changedIdentity => {
    const {task, connector} = await setupTask(); const reached = deferred(), release = deferred();
    const get: ProductStore["chatThreads"]["get"] = async id => {reached.resolve(); await release.promise; return db.chatThreads.get(id);};
    // Explicit runtime read after the durable evidence transaction; the transaction retains real StoreTx capability.
    const table = new Proxy(db.chatThreads, {get(target, key, receiver) {return key === "get" ? get : Reflect.get(target, key, receiver) as unknown;}});
    const store = new Proxy(db, {get(target, key, receiver) {return key === "chatThreads" ? table : Reflect.get(target, key, receiver) as unknown;}});
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {expect(new Headers(init?.headers).get("authorization")).toBe("Bearer rotated-key"); return wrapupResponse();});
    const original = prepareTaskWrapup(task.id, connector, "test", new AbortController(), fetcher, undefined, undefined, undefined, store);
    await reached.promise;
    await db.connectors.update(connector.id, {apiKey: "rotated-key", ...(changedIdentity ? {baseUrl: "https://changed.test/v1"} : {})});
    release.resolve();
    if (changedIdentity) {await expect(original).rejects.toThrow("原连接已变化"); expect(fetcher).not.toHaveBeenCalled();}
    else {expect((await original).status).toBe("draft"); expect(fetcher).toHaveBeenCalledOnce();}
});

it("retains an actual AI wrapup after view detach, excludes same-thread Send and publishes once", async () => {
    const {task, connector} = await setupTask(), entered = deferred(), release = deferred();
    const fetcher = vi.fn<typeof fetch>(async () => {entered.resolve(); await release.promise; return wrapupResponse();});
    const owner = createAgentExecutionService({store: new Proxy(db, {}), fetchImpl: fetcher}); await owner.initialize();
    const detach = owner.subscribe(task.threadId, () => undefined);
    const work = owner.prepareTaskWrapup({threadId: task.threadId, taskId: task.id, connectorId: connector.id, model: "test"});
    detach();
    const attempt = createSubmissionAttempt({originThreadId: task.threadId, submitted: {scope: "A", text: "duplicate", textRevision: 1, attachments: [], imports: []}, recovery: {scope: "A", revision: 2}, connector, model: "test", taskMode: true, interactionMode: "smart"});
    expect(() => owner.submit({attempt})).toThrow("尚有执行"); await entered.promise;
    expect(owner.snapshot(task.threadId).kind).toBe("taskWrapup"); expect(owner.snapshot(task.threadId).wrapupId).toBeTruthy();
    release.resolve(); await work.done;
    expect(owner.snapshot(task.threadId).active).toBe(false);
    expect((await db.agentTaskWrapups.where("taskId").equals(task.id).first())?.status).toBe("draft");
    expect(fetcher).toHaveBeenCalledOnce(); await owner.shutdown();
});

it("consume retains its own revision before synchronous subscribers edit back to empty", () => {
    const drafts = createChatDraftStore(), scope = drafts.session("A");
    scope.setText("original"); const submitted = scope.capture(); let edited = false;
    drafts.subscribe(() => {if (!edited && drafts.snapshot("A").text === "") {edited = true; scope.setText("new edit"); scope.setText("");}});
    const recovery = scope.consume(submitted);
    expect(recovery.revision).toBeLessThan(drafts.snapshot("A").revision);
    expect(scope.restore(submitted, recovery)).toBe(false); expect(drafts.snapshot("A").text).toBe("");
});
