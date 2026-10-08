import {describe, expect, it, vi} from 'vitest';
import {z} from 'zod';
import {db} from '@/db/database';
import {beginAgentRun} from '@/db/agentRuns';
import {createChatThread} from '@/db/chat';
import {updateGeneralAgentConfig} from '@/db/agentSettings';
import {resolveAgentToolApproval, saveToolRound, transitionToolCall} from '@/db/agentTools';
import {executeChatRun, resumeChatRun} from '@/lib/agent/runChat';
import type {AgentToolDefinition} from '@/lib/agent/toolDefinition';
import type {AgentPermissionMode} from '@/domain/agent';
import type {ConnectorConfig} from '@/domain/types';

const connector: ConnectorConfig = {id: 'metadata', definitionId: 'openai-compatible', baseUrl: 'https://example.test/v1', apiKey: 'fixture', updatedAt: '2026-10-08'};
const answer = () => Response.json({choices: [{message: {content: 'done'}, finish_reason: 'stop'}]});
const response = (names: string[]) => Response.json({choices: [{message: {content: '', tool_calls: names.map((name, index) => ({id: `provider-${index}`, type: 'function', function: {name, arguments: '{}'}}))}, finish_reason: 'tool_calls'}]});
function fixture(name = 'fixture'): AgentToolDefinition {
    return {
        name, title: name, description: name, parameters: {type: 'object', properties: {}, additionalProperties: false},
        effect: 'network', highRisk: () => false, parseArguments: raw => z.object({}).strict().parse(raw),
        prepare: vi.fn(async () => ({summary: name, changes: [], revision: 'revision'})),
        execute: vi.fn(async () => ({ok: true})),
    };
}
async function begin(names: string[], mode: AgentPermissionMode = 'full') {
    await updateGeneralAgentConfig({permissionMode: mode});
    const thread = await createChatThread();
    const run = await beginAgentRun({threadId: thread.id, connector, model: 'fixture', content: 'execute fixtures'});
    const toolLoading = {version: 1 as const, groups: [], foundationToolNames: names, foundationInstructions: '', loadedGroupIds: [], loadedToolNames: []};
    const offeredTools = [{step: 1, names}];
    await db.agentRuns.update(run.id, {enabledToolNames: names, toolLoading, offeredTools});
    return {...run, enabledToolNames: names, toolLoading, offeredTools};
}
const drifts: Array<[string, (tool: AgentToolDefinition) => void]> = [
    ['effect', tool => {tool.effect = 'write';}],
    ['computed highRisk', tool => {tool.highRisk = () => true;}],
    ['atomic', tool => {tool.atomic = true;}],
    ['recovery', tool => {tool.recovery = 'repeatable';}],
    ['requiresConfirmation', tool => {tool.requiresConfirmation = true;}],
];

describe.each(drifts)('%s metadata agreement', (_field, drift) => {
    it('rejects before initial preparation or approval using the actual parser/loop', async () => {
        const tool = fixture(), run = await begin([tool.name]);
        const originalParse = tool.parseArguments;
        let parses = 0;
        tool.parseArguments = raw => {const args = originalParse(raw); if (++parses === 2) drift(tool); return args;};
        const fetcher = vi.fn(async () => response([tool.name]));
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, [tool]);
        expect(parses).toBe(2);
        expect(tool.prepare).not.toHaveBeenCalled(); expect(tool.execute).not.toHaveBeenCalled();
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(await db.agentRuns.get(run.id)).toMatchObject({status: 'failed', error: expect.stringContaining('定义已变化')});
        const calls = await db.agentToolCalls.where('runId').equals(run.id).toArray();
        expect(calls).toHaveLength(1); expect(calls[0].status).toBe('pending'); expect(calls[0].preview).toBeUndefined(); expect(calls[0].decision).toBeUndefined(); expect(Object.hasOwn(calls[0], 'preview')).toBe(false); expect(Object.hasOwn(calls[0], 'decision')).toBe(false);
    });
    it('rejects an approved resume before execution without reusing approval for drifted metadata', async () => {
        const tool = fixture(), run = await begin([tool.name], 'ask');
        await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => response([tool.name])), [tool]);
        const call = (await db.agentToolCalls.where('runId').equals(run.id).toArray())[0];
        expect(call.status).toBe('awaiting_approval'); expect(tool.prepare).toHaveBeenCalledTimes(1);
        await resolveAgentToolApproval(run.id, call.id, 'approve'); drift(tool);
        const fetcher = vi.fn(async () => answer());
        await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [tool]);
        expect(tool.execute).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
        expect(await db.agentToolCalls.get(call.id)).toMatchObject({status: 'approved', decision: 'approve'});
        expect(await db.agentRuns.get(run.id)).toMatchObject({status: 'failed', error: expect.stringContaining('定义已变化')});
    });
    it('rechecks earlier preflighted definitions after a later awaited preparation and before claim', async () => {
        const tool = fixture(), later = fixture('later'), run = await begin([tool.name, later.name]);
        later.prepare = vi.fn(async () => {
            expect(tool.prepare).toHaveBeenCalledTimes(1);
            const earlier = (await db.agentToolCalls.where('runId').equals(run.id).toArray()).find(call => call.name === tool.name);
            expect(earlier).toMatchObject({status: 'pending', preview: {revision: 'revision'}});
            await Promise.resolve(); drift(tool);
            return {summary: 'later', changes: [], revision: 'revision'};
        });
        const fetcher = vi.fn(async () => response([tool.name, later.name]));
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, [tool, later]);
        expect(later.prepare).toHaveBeenCalledTimes(1);
        expect(tool.execute).not.toHaveBeenCalled(); expect(later.execute).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1);
        const calls = await db.agentToolCalls.where('runId').equals(run.id).toArray();
        expect(calls).toHaveLength(2); expect(calls.every(call => call.status === 'pending' && call.preview?.revision === 'revision')).toBe(true);
        expect(await db.agentRuns.get(run.id)).toMatchObject({status: 'failed', error: expect.stringContaining('定义已变化')});
    });
});
it('normalizes absent versus false legacy flags at both checks without granting new permissions', async () => {
    const tool = fixture(), later = fixture('later'), run = await begin([tool.name, later.name]);
    const originalParse = tool.parseArguments;
    let parses = 0;
    tool.parseArguments = raw => {const args = originalParse(raw); if (++parses === 2) {tool.atomic = false; tool.requiresConfirmation = false;} return args;};
    later.prepare = vi.fn(async () => {
        const earlier = (await db.agentToolCalls.where('runId').equals(run.id).toArray()).find(call => call.name === tool.name);
        expect(earlier?.status).toBe('pending'); expect(earlier?.preview?.revision).toBe('revision');
        expect(earlier && Object.hasOwn(earlier, 'atomic')).toBe(false);
        expect(earlier && Object.hasOwn(earlier, 'requiresConfirmation')).toBe(false);
        expect(tool.atomic).toBe(false); expect(tool.requiresConfirmation).toBe(false);
        delete tool.atomic; delete tool.requiresConfirmation; return {summary: 'later', changes: [], revision: 'revision'};
    });
    let round = 0;
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => ++round === 1 ? response([tool.name, later.name]) : answer()), [tool, later]);
    expect(parses).toBe(3); expect(later.prepare).toHaveBeenCalledTimes(1);
    expect(tool.execute).toHaveBeenCalledTimes(1); expect(later.execute).toHaveBeenCalledTimes(1);
    const calls = await db.agentToolCalls.where('runId').equals(run.id).toArray();
    expect(calls).toHaveLength(2); expect(calls.every(call => call.status === 'completed')).toBe(true);
    expect(await db.agentRuns.get(run.id)).toMatchObject({status: 'completed'});
});
it('keeps actual ledger identity guards for foreign runs and duplicate provider call IDs', async () => {
    const tool = fixture(), run = await begin([tool.name]), other = await begin([tool.name]);
    const call = {id: 'same-provider', type: 'function' as const, function: {name: tool.name, arguments: '{}'}};
    const metadata = {title: tool.title, effect: tool.effect, highRisk: false};
    await expect(saveToolRound(run.id, '', [call, call], [metadata, metadata])).rejects.toThrow();
    expect(await db.agentToolCalls.where('runId').equals(run.id).count()).toBe(0);
    await saveToolRound(run.id, '', [call], [metadata]);
    const saved = (await db.agentToolCalls.where('runId').equals(run.id).toArray())[0];
    await expect(resolveAgentToolApproval(other.id, saved.id, 'approve')).rejects.toThrow();
    await expect(transitionToolCall(other.id, saved.id, ['pending'], 'running')).rejects.toThrow();
    expect(await db.agentToolCalls.get(saved.id)).toMatchObject({status: 'pending', providerCallId: 'same-provider', runId: run.id});
    expect(tool.execute).not.toHaveBeenCalled();
});
