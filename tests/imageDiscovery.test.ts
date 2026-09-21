import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { createProject, firstEpisode, addEpisode, addShot, patchShot, setShotSlot, createChatThread, addCharacter, deleteChatThread } from '@/db/repo';
import { beginAgentRun } from '@/db/agentRuns';
import { updateGeneralAgentConfig } from '@/db/agentSettings';
import { appendToolResults } from '@/db/agentTools';
import { discoverProjectImages, resolveDiscoveredImage } from '@/lib/agent/imageDiscovery';
import { REFERENCE_TOOLS } from '@/lib/agent/referenceTools';
import { filterProjectMemoryTools } from '@/lib/agent/memoryToolNames';
import { executeChatRun } from '@/lib/agent/runChat';
import { validateReferenceInput } from '@/lib/agent/referenceContext';
import { materializeChatMessages, materializeResponseItems } from '@/lib/ai/referenceWire';
import { toResponseInput } from '@/lib/ai/responsesStream';
import { selectContextHistory, buildContextMessages } from '@/lib/agent/contextPlanner';
import { DEFAULT_CONTEXT_POLICY } from '@/lib/agent/contextPolicy';
import type { AgentRun, AgentToolCall, AgentRequestMessage } from '@/domain/agent';
import type { AgentReferenceInput } from '@/domain/referenceInput';
import type { ImageDiscoveryResult } from '@/domain/imageDiscovery';
import { episodeLabel, type ConnectorConfig } from '@/domain/types';
import type { ProjectReference } from '@/domain/references';

const connector: ConnectorConfig = { id: 'vision', definitionId: 'openai-compatible', baseUrl: 'https://fixture.test/v1', apiKey: 'fixture-key', updatedAt: '2026-09-19' };
const discoveryArgs = { projectQuery: '雨夜', entityKind: 'shot', query: '3', slot: 'firstFrame' };
const readTool = REFERENCE_TOOLS.find((tool) => tool.name === 'read_project_image')!;
async function fixture() {
  const project = await createProject('雨夜'), episode = await firstEpisode(project.id), shot = await addShot(project.id, episode!.id);
  await patchShot(shot.id, { shotNumber: '3' });
  const media = { id: 'pixel-image', projectId: project.id, mimeType: 'image/png', filename: 'actual.png', blob: new Blob(['correct-image-pixels']) };
  await db.media.add(media);
  await setShotSlot(shot.id, 'firstFrame', { prompt: 'metadata is not a visual description', referenceImageIds: [], referenceVideoIds: [], result: { kind: 'image', mediaId: media.id } });
  return { project, episode: episode!, shot, media };
}
async function begin(projectId?: string, vision = true) {
  await updateGeneralAgentConfig({ enabledSkillIds: ['project-references'] });
  const thread = await createChatThread({ projectId });
  return beginAgentRun({ threadId: thread.id, connector, model: 'fixture-vision', content: '看看《雨夜》项目第 3 镜当前的首帧，描述画面', modelMetadata: { source: 'provider', vision } });
}
function context(run: AgentRun, callId = 'discover-ledger') { return { runId: run.id, threadId: run.threadId, projectId: run.projectId, callId, signal: new AbortController().signal }; }
async function ledger(run: AgentRun, id: string, name: string, args: unknown, value: unknown) {
  const row: AgentToolCall = { id, runId: run.id, threadId: run.threadId, providerCallId: id + '-wire', step: 1, order: name === 'read_project_image' ? 1 : 0, name, title: name, arguments: JSON.stringify(args), effect: 'read', highRisk: false, status: 'completed', result: JSON.stringify(value), createdAt: run.createdAt, updatedAt: run.createdAt };
  await db.agentToolCalls.put(row); return row;
}
async function discovered(run: AgentRun, args: unknown = discoveryArgs, id = 'discover-ledger') {
  const result = await discoverProjectImages(args, context(run, id));
  await ledger(run, id, 'discover_project_images', args, result); return result;
}
async function prepared(run: AgentRun) {
  const found = await discovered(run), args = { discoveryCallId: found.discoveryCallId, candidateId: found.candidates[0].id };
  const value = await readTool.execute(args, context(run, 'read-ledger')) as { referenceInput: AgentReferenceInput };
  await ledger(run, 'read-ledger', 'read_project_image', args, value);
  return value.referenceInput;
}
function scope(run: AgentRun) { return { runId: run.id, projectId: run.projectId, model: run.model, visionCapability: run.visionCapability, connectorDefinitionId: connector.definitionId }; }
const wire = (name: string, args: unknown) => ({ id: name, type: 'function', function: { name, arguments: JSON.stringify(args) } });
afterEach(() => vi.restoreAllMocks());

describe('project image discovery and source identity', () => {
  it('unbound reference skill exposes only scoped discovery/reader, while conversation has no tools', async () => {
    const run = await begin();
    expect(run.enabledToolNames).toEqual(['discover_project_images', 'read_project_image', 'load_tool_groups']);
    expect(filterProjectMemoryTools(['memory_read', 'project_reference_read', 'discover_project_images', 'read_project_image'], undefined)).toEqual(['discover_project_images', 'read_project_image']);
    expect(filterProjectMemoryTools(run.enabledToolNames!, undefined, 'conversation')).toEqual([]);
    expect(run.skillInstructions).toContain('project-references');
    expect(run.toolLoading?.loadedToolNames).toEqual([]);
  });
  it('requires a named project, rejects studio and bound foreign projects, and handles duplicate names without grants', async () => {
    const { project } = await fixture(), run = await begin();
    await expect(discoverProjectImages({}, context(run))).rejects.toThrow('项目名称');
    expect((await discoverProjectImages({ projectId: 'studio' }, context(run))).candidates).toEqual([]);
    await createProject('雨夜');
    const ambiguous = await discoverProjectImages(discoveryArgs, context(run));
    expect(ambiguous).toMatchObject({ status: 'ambiguous_project', projectCount: 2, candidates: [] });
    const bound = await begin(project.id);
    await expect(discoverProjectImages({ projectId: 'foreign' }, context(bound))).rejects.toThrow('绑定项目');
    expect((await discoverProjectImages(discoveryArgs, context(bound))).projectCount).toBe(1);
  });
  it('prefers exact project names, exact shot numbers, exposes missing current slots instead of substituting references', async () => {
    const { project, episode, shot } = await fixture(), run = await begin();
    await createProject('雨夜续集'); const other = await addShot(project.id, episode.id); await patchShot(other.id, { shotNumber: '30' });
    const result = await discovered(run);
    expect(result.candidates).toHaveLength(1); expect(result.candidates[0]).toMatchObject({ entityId: shot.id, source: 'current', mediaId: 'pixel-image', available: true });
    await setShotSlot(shot.id, 'firstFrame', { prompt: '', referenceImageIds: ['pixel-image'], referenceVideoIds: [] });
    const missing = await discoverProjectImages(discoveryArgs, context(run));
    expect(missing.candidates[0]).toMatchObject({ available: false }); expect(missing.candidates[0].mediaId).toBeUndefined();
    const reference = await discoverProjectImages({ ...discoveryArgs, source: 'reference' }, context(run));
    expect(reference.candidates[0]).toMatchObject({ source: 'reference', mediaId: 'pixel-image', available: true });
  });
  it('keeps repeated shot numbers and separate slots explicit with stable pagination', async () => {
    const { project } = await fixture(), episode = await addEpisode(project.id), shot = await addShot(project.id, episode.id), run = await begin();
    await patchShot(shot.id, { shotNumber: '3' });
    const first = await discoverProjectImages({ ...discoveryArgs, limit: 1 }, context(run));
    const second = await discoverProjectImages({ ...discoveryArgs, limit: 1, offset: 1 }, context(run));
    expect(first).toMatchObject({ total: 2, hasMore: true }); expect(second).toMatchObject({ total: 2, hasMore: false });
    expect(first.candidates[0].episodeId).not.toBe(second.candidates[0].episodeId);
    expect(second.candidates[0].episodeTitle).toBe(episodeLabel(episode));
    expect((await discoverProjectImages({ ...discoveryArgs, episodeQuery: episodeLabel(episode) }, context(run))).candidates).toHaveLength(1);
    expect((await discoverProjectImages({ ...discoveryArgs, episodeQuery: episode.id }, context(run))).candidates).toHaveLength(1);
    expect((await discoverProjectImages({ ...discoveryArgs, slot: undefined }, context(run))).total).toBe(4);
  });
  it('finds assets without business skill and marks saved candidates separately from current applied image', async () => {
    const { project, shot } = await fixture(), run = await begin();
    const character = await addCharacter(project.id); await db.characters.update(character.id, { name: '小雨', slots: { front: { prompt: '', referenceImageIds: [], referenceVideoIds: [], result: { mediaId: 'pixel-image', kind: 'image' } } } });
    const asset = await discoverProjectImages({ projectQuery: '雨夜', entityKind: 'character', query: '小雨', slot: '正面' }, context(run));
    expect(asset.candidates[0]).toMatchObject({ entityId: character.id, slot: 'front', available: true });
    await db.agentGenerationJobs.add({ version: 1, id: 'job1', callId: 'gen1', runId: run.id, threadId: run.threadId, projectId: project.id, connectorId: 'c', provider: 'apimart', baseUrl: 'https://example.com/v1', model: 'gpt-image-2', kind: 'image', target: { kind: 'shot', entityId: shot.id, projectId: project.id, episodeId: shot.episodeId, slot: 'firstFrame' }, baseRevision: '', sourceRevisions: [], parameters: {}, inputs: [], fingerprint: '', status: 'downloaded', result: { mediaId: 'pixel-image', kind: 'image' }, createdAt: run.createdAt, updatedAt: run.createdAt });
    const candidates = await discoverProjectImages({ ...discoveryArgs, source: 'candidate' }, context(run));
    expect(candidates.candidates[0]).toMatchObject({ source: 'candidate', currentlyApplied: true, mediaId: 'pixel-image' });
    await db.shots.update(shot.id, { firstFrame: { prompt: '', referenceImageIds: [], referenceVideoIds: [] } });
    expect((await discoverProjectImages({ ...discoveryArgs, source: 'candidate' }, context(run))).candidates[0].currentlyApplied).toBe(false);
  });
  it('rejects stale replacement, absent/foreign/cross-run discovery IDs and raw unbound media access', async () => {
    const { shot } = await fixture(), run = await begin(), found = await discovered(run);
    await expect(readTool.execute({ mediaId: 'pixel-image' }, context(run))).rejects.toThrow('先用 discover');
    expect(() => readTool.parseArguments({ mediaId: 'pixel-image', discoveryCallId: 'd', candidateId: 'c' })).toThrow();
    await expect(resolveDiscoveredImage(run.id, 'missing', found.candidates[0].id)).rejects.toThrow('来源无效');
    const other = await begin(); await expect(resolveDiscoveredImage(other.id, found.discoveryCallId, found.candidates[0].id)).rejects.toThrow('来源无效');
    await db.shots.update(shot.id, { firstFrame: { prompt: '', referenceImageIds: [], referenceVideoIds: [] } });
    await expect(resolveDiscoveredImage(run.id, found.discoveryCallId, found.candidates[0].id)).rejects.toThrow('已变化');
  });
  it('requires the completed read envelope, exact image identity and same run before pixels', async () => {
    await fixture(); const run = await begin(), input = await prepared(run);
    await expect(validateReferenceInput(input, undefined, run.id)).resolves.toBeUndefined();
    await expect(validateReferenceInput({ ...input, discovery: undefined }, undefined, run.id)).rejects.toThrow('归属');
    await expect(validateReferenceInput({ ...input, references: [{ referenceId: 'fake', revision: 1 }] }, undefined, run.id)).rejects.toThrow('身份');
    await db.agentToolCalls.update('read-ledger', { status: 'running' });
    await expect(validateReferenceInput(input, undefined, run.id)).rejects.toThrow('读取来源');
    await db.agentToolCalls.update('read-ledger', { status: 'completed' });
    const other = await begin(); await expect(validateReferenceInput(input, undefined, other.id)).rejects.toThrow('读取来源');
  });
  it.each(['replacement', 'same-id-bytes', 'media', 'project', 'thread', 'withdrawal'] as const)('blocks %s during asynchronous materialization before dispatch', async (change) => {
    const { project, shot, media } = await fixture(), run = await begin();
    if (change === 'withdrawal') {
      const ref: ProjectReference = { id: 'ref1', projectId: project.id, mediaId: media.id, filename: media.filename, mimeType: media.mimeType, size: media.blob.size, digest: 'hash', kind: 'image', revision: 1, status: 'ready', operationId: 'done', coverage: { totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: 0, truncated: false }, warnings: [], createdAt: run.createdAt, updatedAt: run.createdAt };
      await db.projectReferences.add(ref);
    }
    const input = await prepared(run), messages: AgentRequestMessage[] = [{ role: 'user', content: 'read', referenceInput: input }];
    const original = Blob.prototype.arrayBuffer; let reads = 0;
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(async function (this: Blob) {
      const result = await original.call(this); reads++;
      // First read validates digest; second is actual encoding.
      if (reads === 2) {
        if (change === 'replacement') await db.shots.update(shot.id, { firstFrame: { prompt: '', referenceImageIds: [], referenceVideoIds: [] } });
        if (change === 'same-id-bytes') await db.media.put({ ...media, blob: new Blob(['different-image-data']) });
        if (change === 'media') await db.media.delete(media.id);
        if (change === 'project') await db.projects.delete(project.id);
        if (change === 'thread') await deleteChatThread(run.threadId);
        if (change === 'withdrawal') await db.projectReferences.update('ref1', { status: 'unavailable' });
      }
      return result;
    });
    await expect(materializeChatMessages(messages, scope(run))).rejects.toThrow();
  });
  it('blocks slot replacement during the final asynchronous digest validation', async () => {
    const { shot } = await fixture(), run = await begin(), input = await prepared(run);
    const original = Blob.prototype.arrayBuffer; let reads = 0;
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(async function (this: Blob) {
      const bytes = await original.call(this);
      // Digest before encoding, encoding, then digest after encoding.
      if (++reads === 3) await db.shots.update(shot.id, { firstFrame: { prompt: '', referenceImageIds: [], referenceVideoIds: [] } });
      return bytes;
    });
    await expect(materializeChatMessages([{ role: 'user', content: 'read', referenceInput: input }], scope(run))).rejects.toThrow('已变化');
  });
  it('registered image reference requires explicit reference search and refuses withdrawn sources', async () => {
    const { project, media } = await fixture(), run = await begin();
    await db.projectReferences.add({ id: 'library', projectId: project.id, mediaId: media.id, digest: 'hash', kind: 'image', filename: '雨景参考.png', mimeType: media.mimeType, size: media.blob.size, revision: 1, status: 'ready', operationId: 'done', coverage: { totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: 0, truncated: false }, warnings: [], createdAt: run.createdAt, updatedAt: run.createdAt });
    const result = await discovered(run, { projectId: project.id, source: 'reference', query: '雨景参考' });
    expect(result.candidates[0]).toMatchObject({ entityKind: 'reference', source: 'reference', available: true });
    await db.projectReferences.update('library', { status: 'unavailable' });
    await expect(resolveDiscoveredImage(run.id, result.discoveryCallId, result.candidates[0].id)).rejects.toThrow('已变化');
  });
  it('unsupported model provides a model-switch error with no alternate model request', async () => {
    await fixture(); const run = await begin(undefined, false), found = await discovered(run);
    await expect(readTool.execute({ discoveryCallId: found.discoveryCallId, candidateId: found.candidates[0].id }, context(run, 'read'))).rejects.toThrow('模型');
  });
});

describe('natural-language discovery to actual current-model pixels', () => {
  it.each(['chat-completions', 'responses'] as const)('sends exact target pixels via %s without attachment or rebinding and pairs only once', async (protocol) => {
    await fixture(); const run = await begin(); await db.agentRuns.update(run.id, { protocol });
    const bodies: string[] = [];
    const model = vi.fn(async (_url, init) => {
      bodies.push(String(init?.body)); let call;
      if (bodies.length === 1) call = wire('load_tool_groups', { groupIds: ['project-references'] });
      if (bodies.length === 2) call = wire('discover_project_images', discoveryArgs);
      if (bodies.length === 3) {
        const saved = (await db.agentToolCalls.toArray()).find((call) => call.name === 'discover_project_images')!;
        const result = JSON.parse(saved.result!) as ImageDiscoveryResult;
        call = wire('read_project_image', { discoveryCallId: saved.id, candidateId: result.candidates[0].id });
      }
      if (protocol === 'responses') return Response.json({ status: 'completed', output: call ? [{ type: 'reasoning', summary: [], encrypted_content: 'opaque-kept' }, { type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments }] : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '看到了画面', annotations: [] }] }] });
      return Response.json({ choices: [{ message: call ? { content: '', tool_calls: [call] } : { content: '看到了画面' }, finish_reason: call ? 'tool_calls' : 'stop' }] });
    });
    await executeChatRun((await db.agentRuns.get(run.id))!, connector.apiKey, new AbortController(), model);
    expect(model).toHaveBeenCalledTimes(4);
    expect(bodies[0]).not.toContain('data:image'); expect(bodies[1]).not.toContain('data:image');
    expect(bodies[2]).not.toContain('data:image');
    expect(bodies[3]).toContain('data:image/png;base64,Y29ycmVjdC1pbWFnZS1waXhlbHM=');
    expect((await db.chatThreads.get(run.threadId))?.projectId).toBeUndefined();
    expect((await db.chatMessages.get(run.userMessageId))?.attachments?.length ?? 0).toBe(0);
    expect(JSON.stringify([await db.agentRuns.toArray(), await db.agentToolCalls.toArray()])).not.toContain('data:image');
    await db.agentRuns.update(run.id, { status: 'running' }); await appendToolResults(run.id); await appendToolResults(run.id);
    const latest = (await db.agentRuns.get(run.id))!;
    expect(latest.continuationMessages?.filter((m) => m.referenceInput?.images?.length)).toHaveLength(1);
    if (protocol === 'responses') { expect(JSON.stringify(latest.responseItems)).toContain('opaque-kept'); expect(latest.responseItems?.filter((item) => item.referenceInput?.images?.length)).toHaveLength(1); }
    const history = selectContextHistory(await db.chatMessages.where('threadId').equals(run.threadId).toArray(), DEFAULT_CONTEXT_POLICY);
    const messages = buildContextMessages('', '', history, '再问一个问题');
    expect(messages.some((item) => item.referenceInput?.images?.length)).toBe(false);
    const noPixels = await materializeResponseItems(toResponseInput(messages), { model: run.model, visionCapability: run.visionCapability });
    expect(JSON.stringify(noPixels)).not.toContain('data:image');
  });
});
