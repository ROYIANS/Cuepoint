import { db } from '@/db/database';
import { assertBatchDispatch, claimBatchItem, controlGenerationBatch, ownedGenerationBatch, readGenerationBatch, settleGenerationBatch } from '@/db/agentGenerationBatches';
import { updateGenerationJob } from '@/db/agentGeneration';
import { BATCH_CONCURRENCY } from '@/domain/agentGenerationBatch';
import { loadGenerationInputs, monitorAgentGeneration, submitClaimedGeneration, type GenerationRuntimeOptions } from './generationRuntime';
import { withThreadRunLock, type ThreadLockManager } from './runOwnership';

interface LocalWorker { batchId: string; controller: AbortController; done: Promise<void>; actions: Set<Promise<unknown>>; closing: boolean; ownsLock: boolean }
const workers = new Map<string, LocalWorker>();
export async function batchUserAction<T>(threadId: string, action: () => Promise<T>, locks?: ThreadLockManager): Promise<T> {
  const worker = workers.get(threadId);
  // The current local worker already owns the Web Lock. Keep it held until UI writes settle.
  if (worker && worker.ownsLock && !worker.closing) {
    const pending = Promise.resolve().then(action); worker.actions.add(pending);
    try { return await pending; } finally { worker.actions.delete(pending); }
  }
  if (worker) await worker.done;
  return withThreadRunLock(threadId, action, locks);
}
export function isGenerationBatchRunning(threadId: string) { return workers.has(threadId); }
export async function startGenerationBatch(id: string, threadId: string, options: GenerationRuntimeOptions & { locks?: ThreadLockManager; signal?: AbortSignal } = {}) {
  if (workers.has(threadId)) throw new Error('此对话已有批次正在执行');
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const worker: LocalWorker = { batchId: id, controller, done: Promise.resolve(), actions: new Set(), closing: false, ownsLock: false };
  workers.set(threadId, worker);
  worker.done = withThreadRunLock(threadId, async () => {
    worker.ownsLock = true;
    const context = { threadId, signal: controller.signal };
    await ownedGenerationBatch(id, threadId);
    await controlGenerationBatch(id, threadId, 'run');
    // Storage may be the reason execution stopped. Do not rely solely on a
    // successful pause write to prevent another paid request in this process.
    let dispatchPaused = false;
    const pause = async (reason: string) => {
      dispatchPaused = true;
      await controlGenerationBatch(id, threadId, 'pause', reason);
    };
    const settleWorkers = async (execute: () => Promise<void>) => {
      const outcomes = await Promise.allSettled(Array.from({ length: BATCH_CONCURRENCY }, execute));
      const failed = outcomes.find(outcome => outcome.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
    };
    try {
      // Retrieval comes first; a saved accepted job is never submitted a second time.
      const saved = await readGenerationBatch(id, threadId);
      const recover = saved.jobs.filter(j => !['downloaded', 'applied', 'conflict', 'failed', 'unknown'].includes(j.status));
      let recoveryIndex = 0;
      const retrieve = async () => {
        while (!controller.signal.aborted) {
          const job = recover[recoveryIndex++]; if (!job) return;
          try { await monitorAgentGeneration(job.id, context, options); }
          catch (error) { await pause(error instanceof Error ? error.message : '查询已暂停'); }
        }
      };
      await settleWorkers(retrieve);
      const items = (await readGenerationBatch(id, threadId)).items;
      let index = 0;
      const dispatch = async () => {
        while (!controller.signal.aborted && !dispatchPaused) {
          const item = items[index++]; if (!item) return;
          if (item.state !== 'queued') continue;
          let job;
          let transportEntered = false;
          try {
            job = await claimBatchItem(id, threadId, item.id); if (!job) continue;
            const config = await db.connectors.get(job.connectorId);
            if (!config?.apiKey.trim() || config.definitionId !== job.provider || config.baseUrl !== job.baseUrl) throw new Error('供应商配置已变化，尚未付费提交');
            transportEntered = true;
            await submitClaimedGeneration(job, config, context, options, async () => {
              await loadGenerationInputs(job!);
              if (dispatchPaused) throw new Error('本地队列已暂停，尚未付费提交');
              await db.transaction('r', db.tables, async () => {
                await assertBatchDispatch(job!);
                const latest = await db.connectors.get(config.id);
                if (!latest?.apiKey.trim() || latest.definitionId !== job!.provider || latest.baseUrl !== job!.baseUrl || latest.apiKey !== config.apiKey) throw new Error('供应商配置已变化，尚未付费提交');
              });
            });
          } catch (error) {
            try {
              const latest = job ? await db.agentGenerationJobs.get(job.id) : undefined;
              if (!transportEntered && latest?.status === 'submitting' && !latest.providerTaskId) {
                // Only this live stack knows preparation failed before entering shared transport.
                await updateGenerationJob(latest.id, { status: 'failed', error: '本地配置校验失败，尚未付费提交' });
              }
              const current = job ? await db.agentGenerationJobs.get(job.id) : undefined;
              if (!current || current.status !== 'failed') await pause(error instanceof Error ? error.message : '生成等待已暂停');
            } catch (storageError) {
              dispatchPaused = true;
              throw storageError;
            }
          }
        }
      };
      await settleWorkers(dispatch);
    } finally {
      worker.closing = true;
      await Promise.allSettled([...worker.actions]);
      await settleGenerationBatch(id, threadId);
    }
  }, options.locks).finally(() => { workers.delete(threadId); options.signal?.removeEventListener('abort', abort); });
  return worker.done;
}
export async function stopGenerationBatch(id: string, threadId: string, action: 'pause' | 'cancel', locks?: ThreadLockManager) {
  const worker = workers.get(threadId);
  if (worker) {
    if (worker.batchId !== id) throw new Error('正在执行另一个批次');
    worker.controller.abort();
    await worker.done.catch(() => undefined);
  }
  await batchUserAction(threadId, () => controlGenerationBatch(id, threadId, action), locks);
}
/** Page teardown stops local waits only; persisted jobs remain available for explicit continuation. */
export function pauseThreadGeneration(threadId: string) { workers.get(threadId)?.controller.abort(); }
