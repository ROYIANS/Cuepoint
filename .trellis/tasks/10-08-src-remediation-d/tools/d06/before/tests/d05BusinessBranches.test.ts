import {afterEach, expect, it, vi} from 'vitest';
import {db} from '@/db/database';
import {createProject} from '@/db/projects';
import {addCharacter, addScene, addProp, addStyle} from '@/db/assets';
import {addShot} from '@/db/shots';
import {createChatThread} from '@/db/chat';
import {beginAgentRun} from '@/db/agentRuns';
import {AtomicToolRollbackError} from '@/db/agentTools';
import {BUILTIN_TOOLS, validateToolCall} from '@/lib/agent/tools';
import * as store from '@/lib/agent/businessStore';
import type {AgentToolContext} from '@/lib/agent/toolDefinition';
import type {ConnectorConfig} from '@/domain/types';

const connector: ConnectorConfig = {id: 'branches', definitionId: 'openai-compatible', baseUrl: 'https://example.test/v1', apiKey: 'fixture', updatedAt: 'now'};
afterEach(() => vi.restoreAllMocks());
async function prepared() {
    const project = await createProject('slot scope'), character = await addCharacter(project.id), thread = await createChatThread();
    const initial = await beginAgentRun({threadId: thread.id, connector, model: 'fixture', content: 'slot update'});
    const run = {...initial, toolLoading: undefined, permissionMode: 'full' as const};
    await db.agentRuns.put(run);
    const raw = {kind: 'character', ownerId: project.id, id: character.id, slot: 'front', patch: {prompt: 'native typed prompt'}};
    const {tool, args} = validateToolCall('slot_update', JSON.stringify(raw), ['slot_update']);
    const context: AgentToolContext = {runId: run.id, threadId: thread.id, callId: 'branch-call', signal: new AbortController().signal};
    context.preview = await tool.prepare?.(args, context);
    await db.agentToolCalls.add({id: context.callId, runId: run.id, threadId: thread.id, providerCallId: 'branch-provider', step: 1, order: 0, name: tool.name, title: tool.title, arguments: JSON.stringify(raw), effect: tool.effect, highRisk: tool.highRisk(args), atomic: tool.atomic, preview: context.preview, status: 'running', createdAt: 'now', updatedAt: 'now'});
    return {project, character, tool, args, context};
}
it.each(['project', 'episode', 'beat', 'media'])('rejects advertised unsupported %s arguments before preparing or executing', kind => {
    const tool = BUILTIN_TOOLS.find(tool => tool.name === 'slot_update');
    if (!tool) throw new Error('slot tool missing');
    const prepare = vi.spyOn(tool, 'prepare'), execute = vi.spyOn(tool, 'execute');
    expect(() => validateToolCall(tool.name, JSON.stringify({kind, ownerId: 'p', id: 'x', slot: 'front', patch: {prompt: 'p'}}), [tool.name])).toThrow('参数无效');
    expect(prepare).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled();
});
it.each(['project', 'episode', 'beat', 'media'] as const)('retains the execution rejection/rollback for an unexpected owned %s record', async kind => {
    const fixture = await prepared();
    const episode = await db.episodes.where('projectId').equals(fixture.project.id).first();
    if (!episode) throw new Error('episode missing');
    const record: store.OwnedBusinessRecord = kind === 'project' ? {kind, row: fixture.project} : kind === 'episode' ? {kind, row: episode} : kind === 'beat' ? {kind, row: {id: 'beat', title: '', content: '', timeOfDay: '', characterIds: [], projectId: fixture.project.id, episodeId: episode.id}} : {kind, row: {id: 'media', projectId: fixture.project.id, filename: 'fixture.png', mimeType: 'image/png', size: 1}};
    const original = await db.characters.get(fixture.character.id), ledger = await db.agentToolCalls.get(fixture.context.callId);
    const owned = vi.spyOn(store, 'readBusinessRecord').mockResolvedValue(record);
    const error = await fixture.tool.execute(fixture.args, fixture.context).catch(error => error);
    expect(error).toBeInstanceOf(AtomicToolRollbackError); expect(error.message).toBe('素材槽位不属于此实体类型');
    expect(owned).toHaveBeenCalledWith('character', fixture.character.id, fixture.project.id, undefined);
    expect(await db.characters.get(fixture.character.id)).toEqual(original);
    expect(await db.agentToolCalls.get(fixture.context.callId)).toEqual(ledger);
});
it('keeps all five supported kind parsers and real slot writes with committed ledgers', async () => {
    const {project} = await prepared();
    const episode = await db.episodes.where('projectId').equals(project.id).first();
    if (!episode) throw new Error('episode missing');
    const targets = [
        {kind: 'character', row: await addCharacter(project.id), slot: 'front'},
        {kind: 'scene', row: await addScene(project.id), slot: 'wide'},
        {kind: 'prop', row: await addProp(project.id), slot: 'hero'},
        {kind: 'style', row: await addStyle(project.id), slot: 'look'},
        {kind: 'shot', row: await addShot(project.id, episode.id), slot: 'firstFrame'},
    ];
    const tool = BUILTIN_TOOLS.find(tool => tool.name === 'slot_update');
    if (!tool) throw new Error('slot tool missing');
    for (const target of targets) {
        const thread = await createChatThread(), initial = await beginAgentRun({threadId: thread.id, connector, model: 'fixture', content: 'slot'});
        const run = {...initial, toolLoading: undefined, permissionMode: 'full' as const}; await db.agentRuns.put(run);
        const raw = {kind: target.kind, ownerId: project.id, id: target.row.id, ...(target.kind === 'shot' ? {episodeId: episode.id} : {}), slot: target.slot, patch: {prompt: 'saved ' + target.kind}};
        const args = tool.parseArguments(raw), context: AgentToolContext = {runId: run.id, threadId: thread.id, callId: 'positive-' + target.kind, signal: new AbortController().signal};
        context.preview = await tool.prepare?.(args, context);
        await db.agentToolCalls.add({id: context.callId, runId: run.id, threadId: thread.id, providerCallId: context.callId, step: 1, order: 0, name: tool.name, title: tool.title, arguments: JSON.stringify(raw), effect: tool.effect, highRisk: tool.highRisk(args), atomic: tool.atomic, preview: context.preview, status: 'running', createdAt: 'now', updatedAt: 'now'});
        const result = await tool.execute(args, context);
        expect(result).toMatchObject({slot: target.slot, value: {prompt: 'saved ' + target.kind}});
        const record = await store.readBusinessRecord(target.kind === 'character' ? 'character' : target.kind === 'scene' ? 'scene' : target.kind === 'prop' ? 'prop' : target.kind === 'style' ? 'style' : 'shot', target.row.id, project.id, target.kind === 'shot' ? episode.id : undefined);
        expect(JSON.stringify(record.row)).toContain('saved ' + target.kind);
        expect(await db.agentToolCalls.get(context.callId)).toMatchObject({status: 'completed', result: JSON.stringify(result)});
    }
});
