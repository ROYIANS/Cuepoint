import { saveFixtureToolRound } from "./helpers/toolDispatch";
import { taskGenerationSource, saveTaskRecord, validateTaskSources } from '@/db/agentTaskRecords';
import { createAgentTaskForThread } from '@/db/agentTasks';
import { getTaskWrapupState } from '@/db/agentTaskWrapups';
import { describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { beginAgentRun, finishAgentRun } from '@/db/agentRuns';
import {  transitionToolCall } from '@/db/agentTools';
import { createProject, addShot, createChatThread } from '@/db/repo';
import { prepareGenerationBatch, readGenerationBatch, confirmGenerationBatch, applyBatchSelections, selectBatchCandidate } from '@/db/agentGenerationBatches';
import { startGenerationBatch, stopGenerationBatch } from '@/lib/agent/generationBatchRuntime';
import { type GenerationSubmitArgs } from '@/lib/agent/generationProfiles';
import type { ConnectorConfig } from '@/domain/types';
import type { AgentToolContext } from '@/lib/agent/tools';
import type { ThreadLockManager } from '@/lib/agent/runOwnership';
import { BUSINESS_TOOLS } from '@/lib/agent/businessTools';

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII='), c => c.charCodeAt(0));
function lockManager(): ThreadLockManager {
  let held = false;
  return { async request(_name, _options, callback) { if (held) return callback(null); held = true; try { return await callback({}); } finally { held = false; } } };
}
async function fixture(count = 4, provider: 'apimart' | 'aihubmix' = 'apimart', kind: 'image' | 'video' = 'image') {
  const config: ConnectorConfig = { id: 'batch-connector', name: 'Generation', definitionId: provider, baseUrl: `https://${provider}.test/v1`, apiKey: 'private-batch-key', updatedAt: 'now' };
  await db.connectors.put(config);
  const project = await createProject('批量测试');
  const episode = (await db.episodes.where('projectId').equals(project.id).first())!;
  const shot = await addShot(project.id, episode.id), thread = await createChatThread();
  const run = await beginAgentRun({ threadId: thread.id, connector: config, model: 'chat', content: '准备候选' });
  const draft: GenerationSubmitArgs = { connectorId: config.id, model: kind === 'image' ? 'gpt-image-2' : provider === 'apimart' ? 'MiniMax-H3' : 'veo-3.1-fast-generate-preview', prompt: '雨夜车站', parameters: {}, inputs: [], target: { kind: 'shot', projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: 'firstFrame' } };
  const candidates = Array.from({ length: count }, (_, index) => ({ ...draft, target: { ...draft.target, slot: kind === 'video' ? 'clip' : index > 3 ? 'lastFrame' : 'firstFrame' } }));
  await saveFixtureToolRound(run.id, '', [{ id: 'batch-source', type: 'function', function: { name: 'prepare_generation_batch', arguments: JSON.stringify({ title: '候选批次', candidates }) } }], [{ title: '准备批量生成', effect: 'bookkeeping', highRisk: false, atomic: true }]);
  const call = (await db.agentToolCalls.where('runId').equals(run.id).first())!;
  await transitionToolCall(run.id, call.id, ['pending'], 'running');
  const context: AgentToolContext = { runId: run.id, threadId: thread.id, callId: call.id, signal: new AbortController().signal };
  const result = await prepareGenerationBatch('候选批次', candidates, context) as { batchId: string };
  return { config, project, episode, shot, thread, run, call, context, candidates, id: result.batchId, locks: lockManager() };
}
function apimartMock(behavior?: (index: number) => Response | Promise<Response>) {
  let posts = 0;
  const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
    if (init?.method === 'POST') { posts++; return behavior ? behavior(posts) : Response.json({ code: 200, data: [{ task_id: `task-${posts}`, status: 'submitted' }] }); }
    if (String(url).includes('/tasks/')) return Response.json({ code: 200, data: { id: new URL(String(url)).pathname.split('/').at(-1), status: 'completed', progress: 100, result: { images: [{ url: 'https://cdn.test/output' }] } } });
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  });
  return { fetchImpl, posts: () => posts };
}
async function confirm(f: Awaited<ReturnType<typeof fixture>>) { const state = await readGenerationBatch(f.id, f.thread.id); return confirmGenerationBatch(f.id, f.thread.id, state.batch.revision, new AbortController().signal); }
async function run(f: Awaited<ReturnType<typeof fixture>>, fetchImpl: typeof fetch) { await startGenerationBatch(f.id, f.thread.id, { locks: f.locks, fetchImpl, pollIntervalMs: 0, maxPolls: 2 }); return readGenerationBatch(f.id, f.thread.id); }

describe('batch fault boundaries', () => {
  it('rejects generic Agent slot writes of a batch candidate without changing the target', async () => {
    const f = await fixture(1); await finishAgentRun(f.run.id, 'completed'); await confirm(f);
    const state = await run(f, apimartMock().fetchImpl);
    const runRecord = await beginAgentRun({ threadId: f.thread.id, connector: f.config, model: 'chat', content: '尝试直接写入' });
    const definition = BUSINESS_TOOLS.find(tool => tool.name === 'slot_update')!;
    const raw = { kind: 'shot', ownerId: f.project.id, episodeId: f.episode.id, id: f.shot.id, slot: 'firstFrame', patch: { result: state.jobs[0].result } };
    const args = definition.parseArguments(raw);
    await saveFixtureToolRound(runRecord.id, '', [{ id: 'generic-write', type: 'function', function: { name: definition.name, arguments: JSON.stringify(raw) } }], [{ title: definition.title, effect: definition.effect, highRisk: false, atomic: true }]);
    const call = (await db.agentToolCalls.where('runId').equals(runRecord.id).first())!;
    await transitionToolCall(runRecord.id, call.id, ['pending'], 'running');
    const context: AgentToolContext = { runId: runRecord.id, threadId: f.thread.id, callId: call.id, signal: new AbortController().signal };
    context.preview = await definition.prepare!(args, context);
    await expect(definition.execute(args, context)).rejects.toThrow('批量候选');
    expect((await db.shots.get(f.shot.id))?.firstFrame.result).toBeUndefined();
    expect((await readGenerationBatch(f.id, f.thread.id)).batch.applications).toHaveLength(0);
  });

  it('retains the thread lock until the sibling transport settles after a storage exception', async () => {
    const f = await fixture(2); await confirm(f);
    let releases: Array<() => void> = [];
    const mock = apimartMock(index => new Promise(resolve => {
      releases.push(() => resolve(index === 1 ? new Response('gateway unavailable', { status: 503 }) : Response.json({ code: 200, data: [{ task_id: 'still-in-flight' }] })));
    }));
    const putBatch = db.agentGenerationBatches.put.bind(db.agentGenerationBatches);
    let pauseFailed = false;
    const batches = vi.spyOn(db.agentGenerationBatches, 'put').mockImplementation(batch => {
      if (batch.status === 'paused') { pauseFailed = true; return Promise.reject(new Error('pause disk failure')); }
      return putBatch(batch);
    });
    const running = startGenerationBatch(f.id, f.thread.id, { locks: f.locks, fetchImpl: mock.fetchImpl, pollIntervalMs: 0 }).catch(() => undefined);
    try {
      await vi.waitFor(() => expect(releases).toHaveLength(2));
      releases[0]();
      await vi.waitFor(() => expect(pauseFailed).toBe(true));
      let competingAcquired = false;
      await f.locks.request('same-thread', { ifAvailable: true }, async lock => { competingAcquired = Boolean(lock); });
      expect(competingAcquired).toBe(false);
    } finally {
      releases.forEach(release => release()); releases = [];
      await running; batches.mockRestore();
    }
  });

  it('stops new paid dispatch even when both acceptance and pause persistence fail', async () => {
    const f = await fixture(); await confirm(f);
    const putJob = db.agentGenerationJobs.put.bind(db.agentGenerationJobs);
    const putBatch = db.agentGenerationBatches.put.bind(db.agentGenerationBatches);
    const jobs = vi.spyOn(db.agentGenerationJobs, 'put').mockImplementation((job) => {
      if (['submitted', 'unknown'].includes(job.status)) return Promise.reject(new Error('acceptance storage unavailable'));
      return putJob(job);
    });
    const batches = vi.spyOn(db.agentGenerationBatches, 'put').mockImplementation((batch) => {
      if (batch.status === 'paused') return Promise.reject(new Error('pause storage unavailable'));
      return putBatch(batch);
    });
    const mock = apimartMock();
    try {
      await run(f, mock.fetchImpl).catch(() => undefined);
      expect(mock.posts()).toBeLessThanOrEqual(2);
      expect((await readGenerationBatch(f.id, f.thread.id)).items.filter(item => item.state === 'queued')).toHaveLength(2);
    } finally { jobs.mockRestore(); batches.mockRestore(); }
    const paid = mock.posts();
    await run(f, mock.fetchImpl);
    expect(mock.posts()).toBe(paid);
    expect((await readGenerationBatch(f.id, f.thread.id)).jobs.every(job => job.status === 'unknown')).toBe(true);
  });

  it('cancel during accepted polling preserves remote jobs and cancels only unsent candidates', async () => {
    const f = await fixture(); await confirm(f);
    let complete = false, queries = 0, posts = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === 'POST') return Response.json({ code: 200, data: [{ task_id: `accepted-${++posts}` }] });
      if (String(url).includes('/tasks/')) {
        queries++;
        return Response.json({ code: 200, data: { id: new URL(String(url)).pathname.split('/').at(-1), status: complete ? 'completed' : 'processing', ...(complete ? { result: { images: [{ url: 'https://cdn.test/result' }] } } : {}) } });
      }
      return new Response(png);
    });
    const running = startGenerationBatch(f.id, f.thread.id, { locks: f.locks, fetchImpl, pollIntervalMs: 10000 });
    await vi.waitFor(() => expect(queries).toBe(2));
    await stopGenerationBatch(f.id, f.thread.id, 'cancel', f.locks); await running;
    const cancelled = await readGenerationBatch(f.id, f.thread.id);
    expect(posts).toBe(2); expect(cancelled.items.filter(item => item.state === 'cancelled')).toHaveLength(2);
    expect(cancelled.jobs.every(job => job.providerTaskId && job.status !== 'failed')).toBe(true);
    complete = true;
    const recovered = await run(f, fetchImpl);
    expect(posts).toBe(2); expect(recovered.jobs.every(job => job.status === 'downloaded')).toBe(true);
    expect(recovered.batch.status).toBe('cancelled');
  });

  it.each(['apimart', 'aihubmix'] as const)('%s video candidates preserve native parameters and apply actual video bytes', async provider => {
    const f = await fixture(2, provider, 'video'); await confirm(f);
    const mp4 = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109]);
    let posts = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      const address = String(url);
      if (address.includes('/content') || address.includes('cdn.test')) return new Response(mp4);
      if (init?.method === 'POST') {
        posts++;
        expect(JSON.parse(String(init.body))).toMatchObject({ model: f.candidates[0].model, duration: provider === 'apimart' ? 5 : 8 });
      }
      if (provider === 'apimart') return init?.method === 'POST'
        ? Response.json({ code: 200, data: [{ task_id: `video-${posts}` }] })
        : Response.json({ code: 200, data: { id: new URL(address).pathname.split('/').at(-1), status: 'completed', progress: 100, result: { videos: [{ url: 'https://cdn.test/video' }] } } });
      const id = init?.method === 'POST' ? `video-${posts}` : address.split('/').at(-1);
      return Response.json({ id, object: 'video', model: f.candidates[0].model, status: init?.method === 'POST' ? 'in_progress' : 'completed', output: init?.method === 'POST' ? [] : [{ index: 0, type: 'file', content_url: `https://aihubmix.test/ai/v1/videos/${id}/content` }] });
    });
    const state = await run(f, fetchImpl);
    expect(posts).toBe(2); expect(state.jobs.map(job => ({ status: job.status, error: job.error, kind: job.result?.kind }))).toEqual([{ status: 'downloaded', error: undefined, kind: 'video' }, { status: 'downloaded', error: undefined, kind: 'video' }]);
    for (const job of state.jobs) {
      const media = (await db.media.get(job.result!.mediaId))!;
      expect(media.mimeType).toBe('video/mp4'); expect(new Uint8Array(await media.blob.arrayBuffer())).toEqual(mp4);
    }
    await selectBatchCandidate(f.id, f.thread.id, state.items[0].id);
    expect((await applyBatchSelections(f.id, f.thread.id))[0].applied).toBe(true);
    expect((await db.shots.get(f.shot.id))?.clip.result?.kind).toBe('video');
  });
});
