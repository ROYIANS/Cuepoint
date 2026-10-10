import {db} from "@/db/database";
import {
    assertAudioBatchDispatch, controlAudioGenerationBatch, linkAudioBatchJob,
    ownedAudioGenerationBatch, readAudioGenerationBatch, settleAudioGenerationBatch
} from "@/db/audioGenerationBatches";
import {AUDIO_BATCH_CONCURRENCY, type AudioGenerationBatch} from "@/domain/audioGenerationBatch";
import {refreshAudioGeneration, submitAudioGeneration, type AudioGenerationOptions} from "./runtime";
import {withThreadRunLock, type ThreadLockManager} from "@/lib/agent/runOwnership";

interface AudioBatchWorker {
    batch: AudioGenerationBatch;
    controller: AbortController;
    paused: boolean;
    ownsLock: boolean;
    done: Promise<void>;
    actions: Set<Promise<unknown>>;
    closing: boolean;
}
const workers = new Map<string, AudioBatchWorker>();

function browserLocks(): ThreadLockManager {
    if (typeof navigator === "undefined" || !navigator.locks) throw new Error("批量配音需要支持 Web Locks 的浏览器，并通过 HTTPS 或 localhost 打开");
    return navigator.locks;
}
async function ownership<T>(batch: AudioGenerationBatch, action: () => Promise<T>, locks: ThreadLockManager = browserLocks()): Promise<T> {
    const lockBatch = () => locks.request(`cuepoint.audio-batch.${batch.id}`, {ifAvailable: true}, async lock => {
        if (!lock) throw new Error("此批次正在另一个页面执行");
        return action();
    });
    return batch.owner.kind === "agent" ? withThreadRunLock(batch.owner.threadId, lockBatch, locks) : lockBatch();
}

/** Review/control mutations share live dispatch ownership until every write settles. */
export async function audioBatchUserAction<T>(projectId: string, id: string, action: () => Promise<T>, locks?: ThreadLockManager): Promise<T> {
    const worker = workers.get(id);
    if (worker?.ownsLock && !worker.closing) {
        const pending = Promise.resolve().then(action);
        worker.actions.add(pending);
        try { return await pending; } finally { worker.actions.delete(pending); }
    }
    if (worker) await worker.done;
    return ownership(await ownedAudioGenerationBatch(projectId, id), action, locks);
}

/** Explicit continuation only. Mount/reload never invokes this dispatcher. */
export async function startAudioGenerationBatch(projectId: string, id: string, options: AudioGenerationOptions & {locks?: ThreadLockManager} = {}): Promise<void> {
    if (workers.has(id)) throw new Error("此批次已在当前页面执行");
    const batch = await ownedAudioGenerationBatch(projectId, id, true);
    if (!batch.confirmedAt || batch.status === "draft" || batch.status === "cancelled") throw new Error("请先核对并确认本批付费请求");
    const controller = new AbortController();
    const worker: AudioBatchWorker = {batch, controller, paused: false, ownsLock: false, done: Promise.resolve(), actions: new Set(), closing: false};
    // Reserve before awaiting ownership so simultaneous starts cannot both dispatch.
    if (workers.has(id)) throw new Error("此批次已在当前页面执行");
    workers.set(id, worker);
    const abort = () => { worker.paused = true; controller.abort(); };
    options.signal?.addEventListener("abort", abort, {once: true});
    if (options.signal?.aborted) abort();
    worker.done = ownership(batch, async () => {
        worker.ownsLock = true;
        const pause = async (reason: string) => {
            worker.paused = true;
            await controlAudioGenerationBatch(projectId, id, "pause", reason);
        };
        const drain = async (execute: () => Promise<void>) => {
            const outcomes = await Promise.allSettled(Array.from({length: AUDIO_BATCH_CONCURRENCY}, execute));
            const failure = outcomes.find(outcome => outcome.status === "rejected");
            if (failure?.status === "rejected") throw failure.reason instanceof Error ? failure.reason : new Error("批次子任务失败", {cause: failure.reason});
        };
        try {
            // Stored bytes and known jobs recover before any remaining paid request.
            const before = await readAudioGenerationBatch(projectId, id);
            const recover = before.jobs.filter(job => !job.dormant && !["prepared", "saved", "failed"].includes(job.status));
            let recoveryIndex = 0;
            await drain(async () => {
                while (!controller.signal.aborted && !worker.paused) {
                    const job = recover[recoveryIndex++];
                    if (!job) return;
                    try { await refreshAudioGeneration(projectId, job.id, {...options, signal: controller.signal}); }
                    catch (error) { await pause(error instanceof Error ? error.message : "已有音频恢复已暂停"); }
                }
            });
            if (controller.signal.aborted || worker.paused) return;
            await controlAudioGenerationBatch(projectId, id, "run");
            const items = (await readAudioGenerationBatch(projectId, id)).items;
            let index = 0;
            await drain(async () => {
                while (!controller.signal.aborted && !worker.paused) {
                    const item = items[index++];
                    if (!item) return;
                    if (item.state === "cancelled" || item.state === "draft") continue;
                    try {
                        const job = await linkAudioBatchJob(projectId, id, item.id);
                        if (!job || job.status !== "prepared") continue;
                        const result = await submitAudioGeneration(projectId, job.id, {
                            ...options, signal: controller.signal,
                            beforeSubmit: async () => {
                                if (worker.paused || controller.signal.aborted) throw new Error("队列已停止，尚未付费提交");
                                await assertAudioBatchDispatch(projectId, job.id);
                            }
                        });
                        if (result.status === "uncertain" || result.failureStage === "preflight" || result.status === "failed" && !result.failureStage) await pause(result.error ?? "本批已暂停，请检查提交状态");
                    } catch (error) {
                        // Latch before persistence: a storage failure cannot allow the sibling to send again.
                        await pause(error instanceof Error ? error.message : "批量发送已暂停");
                    }
                }
            });
        } finally {
            worker.closing = true;
            await Promise.allSettled([...worker.actions]);
            await settleAudioGenerationBatch(projectId, id);
        }
    }, options.locks).finally(() => {
        if (workers.get(id) === worker) workers.delete(id);
        options.signal?.removeEventListener("abort", abort);
    });
    return worker.done;
}

export async function stopAudioGenerationBatch(projectId: string, id: string, action: "pause" | "cancel", locks?: ThreadLockManager) {
    const worker = workers.get(id);
    if (worker) {
        worker.paused = true;
        worker.controller.abort();
        await worker.done.catch(() => undefined);
    }
    return audioBatchUserAction(projectId, id, () => controlAudioGenerationBatch(projectId, id, action), locks);
}

/** One read/download/local-decode pass, never a paid POST. */
export async function recoverAudioGenerationBatch(projectId: string, id: string, options: AudioGenerationOptions & {locks?: ThreadLockManager} = {}) {
    return audioBatchUserAction(projectId, id, async () => {
        const view = await readAudioGenerationBatch(projectId, id);
        if (view.batch.dormant) throw new Error("导入的历史批次不能恢复网络任务");
        for (const job of view.jobs) if (!job.dormant && !["prepared", "saved", "failed"].includes(job.status)) await refreshAudioGeneration(projectId, job.id, options);
        await settleAudioGenerationBatch(projectId, id);
    }, options.locks);
}

/** Teardown/Agent Stop stops local waits and future dispatch; accepted results stay durable. */
export function pauseAudioGenerationBatches(owner: {projectId?: string; threadId?: string}) {
    for (const worker of workers.values()) if (owner.projectId === worker.batch.projectId || worker.batch.owner.kind === "agent" && owner.threadId === worker.batch.owner.threadId) {
        worker.paused = true;
        worker.controller.abort();
    }
}

export async function reconcileAudioBatchHistory(projectId: string, id: string, locks?: ThreadLockManager) {
    // Mounting the same live queue must not turn its accepted in-flight job into an abandoned one.
    if (workers.has(id)) return;
    return audioBatchUserAction(projectId, id, async () => {
        const view = await readAudioGenerationBatch(projectId, id);
        if (view.batch.dormant) return;
        for (const job of view.jobs) if (job.status === "submitting") {
            const current = await db.audioGenerationJobs.get(job.id);
            if (current?.status === "submitting") await refreshAudioGeneration(projectId, current.id);
        }
        if (view.batch.status === "running") await controlAudioGenerationBatch(projectId, id, "pause", "上次本地执行已中断，进度保留；不会自动发送");
    }, locks);
}
