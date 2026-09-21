import { db } from './database';
import { AtomicToolRollbackError, executeAtomicTool } from './agentTools';
import { resolveConnector, setCharacterSlot, setSceneSlot, setPropSlot, setStyleSlot, setShotSlot } from './repo';
import type { AgentGenerationJob } from '@/domain/agentGeneration';
import { generationEntityKey, generationTargetKey, validateBatchLimits, type GenerationBatch, type GenerationBatchItem, type GenerationSnapshot } from '@/domain/agentGenerationBatch';
import { generationSubmitSchema, type GenerationSubmitArgs } from '@/lib/agent/generationProfiles';
import { prepareGenerationSnapshot, readGenerationTarget, loadGenerationInputs } from '@/lib/agent/generationRuntime';
import { assertProjectToolScope } from '@/lib/agent/projectScope';
import type { AgentToolContext } from '@/lib/agent/tools';
import { createId, nowIso } from '@/lib/ids';
import { targetRevision } from '@/lib/productionRevision';
import { flushPendingDrafts } from '@/lib/debouncedDraft';

type Prepared = Awaited<ReturnType<typeof prepareGenerationSnapshot>>;
const terminal = (job: AgentGenerationJob) => ['downloaded', 'applied', 'conflict', 'failed'].includes(job.status);
export function frozenGeneration(prepared: Prepared): GenerationSnapshot {
  const { args, config, provider, request, current, inputs, fingerprint } = prepared;
  return { connectorId: config.id, provider, baseUrl: config.baseUrl, model: args.model, kind: request.kind, target: request.target,
    baseRevision: current.revision, sourceRevisions: [{ kind: request.target.kind, id: request.target.entityId, revision: current.revision }], parameters: request.parameters, inputs, fingerprint };
}
async function recheck(prepared: Prepared) {
  const current = await readGenerationTarget(prepared.request.target);
  const config = await resolveConnector(prepared.config.id);
  if (current.revision !== prepared.current.revision || !config?.apiKey.trim() || config.baseUrl !== prepared.config.baseUrl || config.definitionId !== prepared.provider) throw new Error('目标或连接配置已变化，请重新检查');
  for (const record of prepared.records) {
    if (!record) throw new Error('输入素材已删除');
    const currentMedia = await db.media.get(record.id);
    if (!currentMedia || currentMedia.projectId !== record.projectId || currentMedia.mimeType !== record.mimeType || currentMedia.blob.size !== record.blob.size) throw new Error('输入素材已变化');
  }
}
export async function ownedGenerationBatch(id: string, threadId: string, mutate = true) {
  const batch = await db.agentGenerationBatches.get(id);
  if (!batch || batch.threadId !== threadId) throw new Error('批次不存在或不属于当前对话');
  const thread = await db.chatThreads.get(threadId), run = await db.agentRuns.get(batch.runId), call = await db.agentToolCalls.get(batch.originCallId);
  if (!thread || !run || run.threadId !== threadId || run.projectId !== thread.projectId || run.projectId && run.projectId !== batch.projectId || !call || call.runId !== run.id || call.threadId !== threadId || call.name !== 'prepare_generation_batch') throw new Error('批次来源或项目归属已失效');
  if (batch.projectId !== 'studio' && !await db.projects.get(batch.projectId)) throw new Error('批次项目已删除');
  if (batch.taskId) {
    const task = await db.agentTasks.get(batch.taskId);
    if (!task || task.threadId !== threadId || run.taskId !== task.id || task.projectId !== run.projectId) throw new Error('批次任务来源已失效');
    if (mutate && task.lifecycle !== 'open') throw new Error('请先重新打开任务');
  }
  return batch;
}
const itemsFor = (batchId: string) => db.agentGenerationBatchItems.where('batchId').equals(batchId).sortBy('order');
export async function readGenerationBatch(id: string, threadId: string) {
  return db.transaction('r', db.tables, async () => {
    const batch = await ownedGenerationBatch(id, threadId, false);
    const items = await itemsFor(id), jobs = await db.agentGenerationJobs.where('batchId').equals(id).toArray();
    const currentMedia: Record<string, string | undefined> = {};
    for (const item of items) {
      try { currentMedia[item.targetKey] = (await readGenerationTarget(item.baseline.target)).slot.result?.mediaId; } catch { currentMedia[item.targetKey] = undefined; }
    }
    return { batch, items, jobs, currentMedia };
  });
}
export async function prepareGenerationBatch(title: string, candidates: GenerationSubmitArgs[], context: AgentToolContext) {
  try {
    return await prepareGenerationBatchDraft(title, candidates, context);
  } catch (error) {
    // Preparation never submits a remote request. Preflight failures happen before
    // the atomic batch/items/result write, and transaction failures roll it back.
    throw new AtomicToolRollbackError(error instanceof Error ? error.message : '批量草稿准备失败，未提交生成');
  }
}
async function prepareGenerationBatchDraft(title: string, candidates: GenerationSubmitArgs[], context: AgentToolContext) {
  const existing = await db.agentGenerationBatches.where('sourceCallId').equals(context.callId).first();
  if (existing) { await ownedGenerationBatch(existing.id, context.threadId, false); return batchDraftSummary(existing, await itemsFor(existing.id)); }
  validateBatchLimits(candidates.map(draft => ({ draft })));
  await assertProjectToolScope(context, 'prepare_generation_batch', { projectId: candidates[0].target.projectId }, true);
  const prepared: Prepared[] = [];
  for (const candidate of candidates) prepared.push(await prepareGenerationSnapshot(candidate, context.signal));
  return executeAtomicTool(context, async () => {
    for (const item of prepared) await recheck(item);
    const run = (await db.agentRuns.get(context.runId))!;
    const at = nowIso(), id = createId('genbatch');
    const items: GenerationBatchItem[] = prepared.map((value, order) => ({ id: createId('candidate'), batchId: id, projectId: value.request.target.projectId, threadId: context.threadId,
      order, targetKey: generationTargetKey(value.request.target), label: value.current.label, proposal: value.args, draft: value.args, included: true, state: 'draft', baseline: frozenGeneration(value), createdAt: at, updatedAt: at }));
    const batch: GenerationBatch = { version: 1, id, projectId: items[0].projectId, threadId: context.threadId, runId: context.runId, sourceCallId: context.callId, originCallId: context.callId, taskId: run.taskId,
      title: title.trim().slice(0, 160) || '批量生成', revision: 1, status: 'draft', itemIds: items.map(i => i.id), confirmedItemIds: [], entityRevisions: {}, selections: {}, applications: [], createdAt: at, updatedAt: at };
    await db.agentGenerationBatches.add(batch); await db.agentGenerationBatchItems.bulkAdd(items);
    return batchDraftSummary(batch, items);
  });
}
function batchDraftSummary(batch: GenerationBatch, items: GenerationBatchItem[]) { return { batchId: batch.id, status: batch.status, targetCount: new Set(items.map(i => i.targetKey)).size, candidateCount: items.length, submitted: false }; }
function requireRevision(batch: GenerationBatch, revision: number) { if (batch.revision !== revision) throw new Error('批次已更新，请重新读取；当前编辑仍保留'); }
function immutableContext(draft: GenerationSubmitArgs, proposal: GenerationSubmitArgs) {
  if (targetRevision({ target: draft.target, inputs: draft.inputs }) !== targetRevision({ target: proposal.target, inputs: proposal.inputs })) throw new Error('目标和输入素材不能修改，请建立新提案');
}
async function writeBatch(batch: GenerationBatch, patch: Partial<GenerationBatch>) {
  const next = { ...batch, ...patch, revision: batch.revision + 1, updatedAt: nowIso() };
  await db.agentGenerationBatches.put(next); return next;
}
/** Save all edited rows by CAS. Temporary empty prompts are valid drafts, never confirmed requests. */
export async function saveGenerationBatchDraft(id: string, threadId: string, revision: number, edits: Array<{ id: string; draft: GenerationSubmitArgs; included: boolean }>) {
  return db.transaction('rw', db.tables, async () => {
    const batch = await ownedGenerationBatch(id, threadId); requireRevision(batch, revision);
    if (batch.status !== 'draft') throw new Error('已确认的配置不能修改');
    const items = await itemsFor(id);
    if (edits.length !== items.length || new Set(edits.map(e => e.id)).size !== items.length) throw new Error('候选列表已变化');
    for (const item of items) {
      const edit = edits.find(e => e.id === item.id); if (!edit) throw new Error('候选列表已变化');
      // Parse structure with a placeholder while preserving unfinished prompt text.
      const parsed = generationSubmitSchema.parse({ ...edit.draft, prompt: edit.draft.prompt.trim() ? edit.draft.prompt : '草稿' });
      parsed.prompt = edit.draft.prompt; immutableContext(parsed, item.proposal);
      await db.agentGenerationBatchItems.put({ ...item, draft: parsed, included: edit.included, updatedAt: nowIso() });
    }
    return writeBatch(batch, {});
  });
}
export async function changeGenerationBatchItems(id: string, threadId: string, revision: number, itemId: string, action: 'clone' | 'remove') {
  return db.transaction('rw', db.tables, async () => {
    const batch = await ownedGenerationBatch(id, threadId); requireRevision(batch, revision);
    if (batch.status !== 'draft') throw new Error('只能编辑草稿候选');
    const items = await itemsFor(id), item = items.find(i => i.id === itemId); if (!item) throw new Error('候选不存在');
    if (action === 'remove') {
      if (items.length === 1) throw new Error('最后一份候选请使用放弃批次');
      await db.agentGenerationBatchItems.delete(item.id);
      return writeBatch(batch, { itemIds: batch.itemIds.filter(value => value !== item.id) });
    }
    validateBatchLimits([...items, item]);
    const clone = { ...item, id: createId('candidate'), order: Math.max(...items.map(i => i.order)) + 1, createdAt: nowIso(), updatedAt: nowIso() };
    await db.agentGenerationBatchItems.add(clone);
    return writeBatch(batch, { itemIds: [...batch.itemIds, clone.id] });
  });
}
export async function confirmGenerationBatch(id: string, threadId: string, revision: number, signal: AbortSignal) {
  const before = await readGenerationBatch(id, threadId); requireRevision(before.batch, revision);
  if (before.batch.status !== 'draft') throw new Error('批次已确认或放弃');
  const included = before.items.filter(i => i.included); validateBatchLimits(included);
  const prepared: Prepared[] = [];
  for (const item of included) {
    const value = await prepareGenerationSnapshot(item.draft, signal);
    if (value.current.revision !== item.baseline.baseRevision || targetRevision(value.inputs) !== targetRevision(item.baseline.inputs)) throw new Error('原目标或输入已变化，请重新准备批次');
    prepared.push(value);
  }
  return db.transaction('rw', db.tables, async () => {
    signal.throwIfAborted();
    const batch = await ownedGenerationBatch(id, threadId); requireRevision(batch, revision);
    if (batch.status !== 'draft') throw new Error('批次已确认或放弃');
    const revisions: Record<string, string> = {};
    for (const [index, item] of included.entries()) {
      await recheck(prepared[index]);
      const snapshot = frozenGeneration(prepared[index]); revisions[generationEntityKey(snapshot.target)] = snapshot.baseRevision;
      await db.agentGenerationBatchItems.put({ ...item, snapshot, state: 'queued', updatedAt: nowIso() });
    }
    for (const item of before.items.filter(i => !i.included)) await db.agentGenerationBatchItems.update(item.id, { state: 'cancelled' });
    return writeBatch(batch, { status: 'ready', confirmedAt: nowIso(), confirmedItemIds: included.map(i => i.id), entityRevisions: revisions });
  });
}
export async function controlGenerationBatch(id: string, threadId: string, action: 'pause' | 'cancel' | 'run', reason?: string) {
  return db.transaction('rw', db.tables, async () => {
    const batch = await ownedGenerationBatch(id, threadId);
    if (action === 'run' && (!batch.confirmedAt || batch.status === 'draft')) throw new Error('请先确认生成请求');
    if (action === 'run' && (await db.agentGenerationJobs.where('batchId').equals(id).toArray()).some(j => j.status === 'unknown')) {
      return writeBatch(batch, { status: 'paused', pauseReason: '提交结果未知；仅可继续查询其他已受理任务，请核实供应商记录' });
    }
    if (action === 'cancel') for (const item of await itemsFor(id)) if (!item.jobId) await db.agentGenerationBatchItems.update(item.id, { state: 'cancelled', updatedAt: nowIso() });
    return writeBatch(batch, { status: action === 'run' ? (batch.status === 'cancelled' ? 'cancelled' : 'running') : action === 'cancel' ? 'cancelled' : 'paused', pauseReason: reason });
  });
}
export async function assertBatchDispatch(job: AgentGenerationJob) {
  if (!job.batchId || !job.batchItemId) throw new Error('不是批次任务');
  const batch = await ownedGenerationBatch(job.batchId, job.threadId);
  const item = await db.agentGenerationBatchItems.get(job.batchItemId);
  if (batch.status !== 'running' || !item || item.jobId !== job.id || item.state !== 'claimed' || !batch.confirmedItemIds.includes(item.id) || !await db.agentGenerationJobs.get(job.id)) throw new Error('批次已暂停或取消，未再次提交');
  if ((await db.agentGenerationJobs.where('batchId').equals(batch.id).toArray()).some(j => j.status === 'unknown')) throw new Error('本批有未知提交，已暂停后续发送');
  if ((await readGenerationTarget(job.target)).revision !== batch.entityRevisions[generationEntityKey(job.target)]) throw new Error('目标已被修改，尚未付费提交');
}
export async function claimBatchItem(id: string, threadId: string, itemId: string): Promise<AgentGenerationJob | undefined> {
  return db.transaction('rw', db.tables, async () => {
    const batch = await ownedGenerationBatch(id, threadId);
    if (batch.status !== 'running') return;
    const jobs = await db.agentGenerationJobs.where('batchId').equals(id).toArray();
    if (jobs.some(j => j.status === 'unknown')) { await writeBatch(batch, { status: 'paused', pauseReason: '提交结果未知，请核实供应商记录' }); return; }
    const item = await db.agentGenerationBatchItems.get(itemId);
    if (!item || item.batchId !== id || item.jobId || item.state !== 'queued' || !item.snapshot || !batch.confirmedItemIds.includes(item.id)) return;
    const duplicates = await db.agentGenerationJobs.where('fingerprint').equals(item.snapshot.fingerprint).toArray();
    if (duplicates.some(j => !terminal(j) && (j.batchId !== id || j.status === 'unknown'))) throw new Error('相同请求仍在其他任务处理中，不能重复提交');
    const at = nowIso();
    const job: AgentGenerationJob = { ...item.snapshot, version: 1, id: createId('genjob'), batchId: id, batchItemId: item.id, runId: batch.runId, threadId, projectId: batch.projectId, status: 'submitting', createdAt: at, updatedAt: at };
    await db.agentGenerationJobs.add(job);
    await db.agentGenerationBatchItems.put({ ...item, jobId: job.id, state: 'claimed', updatedAt: at });
    await assertBatchDispatch(job); return job;
  });
}
export async function settleGenerationBatch(id: string, threadId: string) {
  return db.transaction('rw', db.tables, async () => {
    const batch = await ownedGenerationBatch(id, threadId), items = await itemsFor(id), jobs = await db.agentGenerationJobs.where('batchId').equals(id).toArray();
    if (batch.status === 'cancelled') return batch;
    const pending = items.some(i => i.state === 'queued') || jobs.some(j => !terminal(j));
    return writeBatch(batch, { status: pending ? 'paused' : 'settled', pauseReason: pending ? batch.pauseReason ?? '本地等待已暂停；继续时只恢复已有任务和未发送候选' : undefined });
  });
}
export async function selectBatchCandidate(id: string, threadId: string, itemId: string) {
  return db.transaction('rw', db.tables, async () => {
    const batch = await ownedGenerationBatch(id, threadId), item = await db.agentGenerationBatchItems.get(itemId);
    const job = item?.jobId ? await db.agentGenerationJobs.get(item.jobId) : undefined;
    if (!item || item.batchId !== id || !job?.result || !terminal(job)) throw new Error('候选尚无本地结果');
    const media = await db.media.get(job.result.mediaId);
    if (!media || media.projectId !== batch.projectId || !media.blob.size || !media.mimeType.startsWith(`${job.kind}/`)) throw new Error('候选素材不可用');
    return writeBatch(batch, { selections: { ...batch.selections, [item.targetKey]: item.id } });
  });
}
/** Explicit user selection writes are grouped by entity. Other entities can succeed independently. */
export async function applyBatchSelections(id: string, threadId: string) {
  const before = await readGenerationBatch(id, threadId); await flushPendingDrafts(before.batch.projectId);
  const chosen = before.items.filter(i => before.batch.selections[i.targetKey] === i.id);
  const groups = new Map<string, GenerationBatchItem[]>();
  for (const item of chosen) { const key = generationEntityKey(item.baseline.target); groups.set(key, [...groups.get(key) ?? [], item]); }
  const outcomes: Array<{ targetKey: string; applied: boolean; error?: string }> = [];
  for (const [key, items] of groups) {
    try {
      const inputRecords: Awaited<ReturnType<typeof loadGenerationInputs>> = [];
      for (const item of items) { const job = await db.agentGenerationJobs.get(item.jobId!); if (!job?.result) throw new Error('候选结果不可用'); inputRecords.push(...await loadGenerationInputs(job)); }
      await db.transaction('rw', db.tables, async () => {
        let batch = await ownedGenerationBatch(id, threadId);
        for (const record of inputRecords) {
          const saved = await db.media.get(record.id);
          if (!saved || saved.projectId !== record.projectId || saved.mimeType !== record.mimeType || saved.blob.size !== record.blob.size) throw new Error('输入素材已变化，未写入结果');
        }
        const current = await readGenerationTarget(items[0].baseline.target);
        if (current.revision !== batch.entityRevisions[key]) throw new Error('目标已被人工修改；结果保留，未覆盖');
        for (const item of items) {
          if (batch.selections[item.targetKey] !== item.id) throw new Error('所选候选已变化，请重新检查');
          const job = await db.agentGenerationJobs.get(item.jobId!);
          if (!job?.result || job.batchId !== id || job.batchItemId !== item.id) throw new Error('候选记录已变化');
          const media = await db.media.get(job.result.mediaId);
          if (!media || media.projectId !== job.projectId || !media.blob.size || !media.mimeType.startsWith(`${job.kind}/`)) throw new Error('结果素材不可用');
          const target = await readGenerationTarget(job.target);
          if (target.slot.result?.mediaId === job.result.mediaId) continue;
          const slot = { ...target.slot, result: job.result };
          switch (job.target.kind) {
            case 'shot': await setShotSlot(job.target.entityId, job.target.slot!, slot); break;
            case 'character': await setCharacterSlot(job.target.entityId, job.target.slot, slot); break;
            case 'scene': await setSceneSlot(job.target.entityId, job.target.slot, slot); break;
            case 'prop': await setPropSlot(job.target.entityId, job.target.slot, slot); break;
            case 'style': await setStyleSlot(job.target.entityId, job.target.slot, slot); break;
          }
          const after = await readGenerationTarget(job.target);
          await db.agentGenerationJobs.update(job.id, { status: 'applied', error: undefined, updatedAt: nowIso() });
          batch = await writeBatch(batch, { entityRevisions: { ...batch.entityRevisions, [key]: after.revision }, applications: [...batch.applications, {
            itemId: item.id, jobId: job.id, targetKey: item.targetKey, baseline: job.baseRevision, beforeRevision: target.revision, afterRevision: after.revision, before: target.slot.result, result: job.result, at: nowIso(),
          }] });
        }
      });
      outcomes.push(...items.map(item => ({ targetKey: item.targetKey, applied: true })));
    } catch (error) { outcomes.push(...items.map(item => ({ targetKey: item.targetKey, applied: false, error: error instanceof Error ? error.message : '写入失败，结果保留' }))); }
  }
  return outcomes;
}
export async function retryFailedBatch(id: string, threadId: string) {
  const before = await readGenerationBatch(id, threadId);
  const failures = before.items.filter(i => before.jobs.find(j => j.id === i.jobId)?.status === 'failed');
  if (!failures.length) throw new Error('没有明确失败的候选；未知提交不能重试');
  const prepared: Prepared[] = [];
  for (const item of failures) prepared.push(await prepareGenerationSnapshot(item.draft, new AbortController().signal));
  return db.transaction('rw', db.tables, async () => {
    const source = await ownedGenerationBatch(id, threadId);
    const at = nowIso(), nextId = createId('genbatch');
    for (const [index, item] of failures.entries()) { if ((await db.agentGenerationJobs.get(item.jobId!))?.status !== 'failed') throw new Error('失败状态已变化'); await recheck(prepared[index]); }
    const items = failures.map((item, index): GenerationBatchItem => ({ ...item, id: createId('candidate'), batchId: nextId, order: index, state: 'draft', included: true, jobId: undefined, snapshot: undefined, baseline: frozenGeneration(prepared[index]), createdAt: at, updatedAt: at }));
    const batch: GenerationBatch = { ...source, id: nextId, sourceCallId: undefined, title: `${source.title.slice(0, 150)} · 重试`, retrySourceBatchId: source.id, revision: 1, status: 'draft', itemIds: items.map(i => i.id), confirmedItemIds: [], confirmedAt: undefined, pauseReason: undefined, selections: {}, entityRevisions: {}, applications: [], createdAt: at, updatedAt: at };
    await db.agentGenerationBatches.add(batch); await db.agentGenerationBatchItems.bulkAdd(items); return batch;
  });
}

/** Call only while the caller holds this thread's Web Lock. Local reads/writes, no HTTP. */
export async function recoverAbandonedGenerationBatches(threadId: string) {
  await db.transaction('rw', db.tables, async () => {
    const batches = await db.agentGenerationBatches.where('threadId').equals(threadId).toArray();
    for (const batch of batches) {
      if (batch.status !== 'running') continue;
      for (const job of await db.agentGenerationJobs.where('batchId').equals(batch.id).toArray()) {
        if (job.status === 'submitting' && !job.providerTaskId) await db.agentGenerationJobs.update(job.id, { status: 'unknown', error: '上次提交结果未知，请核实供应商记录；不会自动重发', updatedAt: nowIso() });
      }
      await writeBatch(batch, { status: 'paused', pauseReason: '上次本地执行已中断，继续前请检查各候选状态' });
    }
  });
}
