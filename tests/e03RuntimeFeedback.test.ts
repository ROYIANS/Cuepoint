import {describe, expect, it, vi} from 'vitest';
import {db} from '@/platform/product/store';
import {createChatThread} from '@/features/agent/commands/chat';
import {beginAgentRun, finishAgentRun} from '@/features/agent/commands/agentRuns';
import {executeChatRun, resumeChatRun} from '@/features/agent/runtime/runChat';
import {createExecutionFeedbackController, type ExecutionFeedbackSnapshot, type RuntimeExecutionFeedback} from '@/features/agent/runtime/executionFeedback';
import type {ConnectorConfig} from '@/features/settings/models/connector';
import {updateContextPolicy} from '@/features/agent/commands/contextSettings';
import {withExecutionOwnership, type ThreadLockManager} from '@/features/agent/runtime/runOwnership';
import {saveToolRound} from '@/features/agent/commands/agentTools';

const connector: ConnectorConfig = {id: 'cx', definitionId: 'openai-compatible', baseUrl: 'https://example.test/v1', apiKey: 'entry-key', updatedAt: '2026-10-15'};
async function begin(protocol: 'chat-completions' | 'responses' = 'chat-completions') {
    const run = await beginAgentRun({threadId: (await createChatThread()).id, connector, model: 'test', content: 'private question', interactionMode: 'conversation'});
    if (protocol === 'responses') await db.agentRuns.update(run.id, {protocol});
    return {...run, protocol};
}
const answer = (protocol: 'chat-completions' | 'responses') => protocol === 'responses'
    ? Response.json({id: 'resp-1', status: 'completed', output: [{type: 'reasoning', id: 'reason-1', summary: [{type: 'summary_text', text: 'public reasoning'}], encrypted_content: 'opaque secret'}, {type: 'message', id: 'msg-1', role: 'assistant', status: 'completed', content: [{type: 'output_text', text: 'public answer', annotations: []}]}]})
    : Response.json({choices: [{message: {content: 'public answer', reasoning_content: 'public reasoning'}, finish_reason: 'stop'}]});

describe('actual Studio runtime feedback', () => {
    it.each(['chat-completions', 'responses'] as const)('observes %s selected dispatch, public callbacks and confirmed settlement without another request', async protocol => {
        const run = await begin(protocol);
        const events: Parameters<RuntimeExecutionFeedback>[0][] = [];
        const observe: RuntimeExecutionFeedback = event => { events.push(event); };
        const controller = new AbortController();
        const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(events.at(-1)?.type).toBe('requestInvoked');
            expect(init?.signal).toBe(controller.signal);
            expect(new Headers(init?.headers).get('authorization')).toBe('Bearer entry-key');
            expect(init?.method).toBe('POST');
            return answer(protocol);
        });
        await executeChatRun(run, connector.apiKey, controller, fetcher, undefined, db, undefined, observe);
        expect(fetcher).toHaveBeenCalledTimes(1);
        const types = events.map(event => event.type);
        expect(types[0]).toBe('started');
        expect(types.indexOf('preparing')).toBeLessThan(types.indexOf('requestInvoked'));
        expect(types.indexOf('requestInvoked')).toBeLessThan(types.indexOf('publicReceived'));
        expect(types.indexOf('publicReceived')).toBeLessThan(types.indexOf('checkpoint'));
        expect(types.at(-1)).toBe('settled');
        expect(events.filter(event => event.type === 'publicReceived').map(event => event.kind)).toEqual(expect.arrayContaining(['content', 'reasoning']));
        expect(events.filter(event => event.type === 'settled')).toEqual([expect.objectContaining({confirmed: true, status: 'completed'})]);
        expect(events.every(event => event.runId === run.id && event.executionId === events[0].executionId)).toBe(true);
        expect((await db.chatMessages.get(run.assistantMessageId))?.content).toBe('public answer');
        expect(JSON.stringify(events)).not.toContain('opaque secret');
    });

    it('contains observer exceptions and preserves the request and durable result', async () => {
        const run = await begin();
        const fetcher = vi.fn(async () => answer('chat-completions'));
        const observer = vi.fn(() => { throw new Error('diagnostic failure'); });
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, undefined, db, undefined, observer);
        expect(observer).toHaveBeenCalled();
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
    });

    it('keeps production current-credential policy when feedback adds a selected transport wrapper', async () => {
        const run = await begin();
        const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => answer('chat-completions'));
        const events: Parameters<RuntimeExecutionFeedback>[0][] = [];
        // No saved connector exists. Passing a diagnostic wrapper must not permit the stale entry key.
        await executeChatRun(run, connector.apiKey, new AbortController(), undefined, undefined, db, undefined, event => { events.push(event); });
        expect(fetcher).not.toHaveBeenCalled();
        expect(events.some(event => event.type === 'requestInvoked')).toBe(false);
        expect((await db.agentRuns.get(run.id))?.status).toBe('failed');
        fetcher.mockRestore();
    });

    it('does not fabricate public receipt or display for an empty answer', async () => {
        const run = await begin();
        const mark = vi.fn();
        const timing = {mark, measure: vi.fn(), clearMarks: vi.fn(), clearMeasures: vi.fn()};
        const owner = createExecutionFeedbackController({timing});
        const invocation = owner.begin('local-invocation', run.threadId);
        invocation.admitted(run);
        const fetcher = vi.fn(async () => Response.json({choices: [{message: {content: ''}, finish_reason: 'stop'}]}));
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, undefined, db, undefined, invocation.runtime);
        invocation.publicCommitted({runId: run.id, assistantMessageId: run.assistantMessageId, kind: 'content', text: 'saved unrelated output'});
        invocation.release();
        expect(mark.mock.calls.map(([name]) => name)).not.toEqual(expect.arrayContaining([expect.stringMatching(/firstPublicReceived|firstPublicCommitted/)]));
        expect(fetcher).toHaveBeenCalledTimes(1);
        owner.dispose();
    });

    it('keeps auxiliary summary dispatch separate and reads the rotated current key for the main request', async () => {
        await db.connectors.put(connector);
        const thread = await createChatThread();
        await updateContextPolicy(thread.id, {autoCompress: true, limitHistory: false, historyMessageCount: 20, customContextTokens: 4096});
        await db.chatMessages.bulkAdd(Array.from({length: 8}, (_value, index) => ({id: `e03-history-${index}`, threadId: thread.id, role: index % 2 ? 'assistant' as const : 'user' as const, content: 'x'.repeat(900), status: 'complete' as const, createdAt: new Date(index + 1).toISOString()})));
        const run = await beginAgentRun({threadId: thread.id, connector, model: 'unknown', content: 'continue', interactionMode: 'conversation'});
        const events: Parameters<RuntimeExecutionFeedback>[0][] = [];
        const keys: string[] = [];
        const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            keys.push(new Headers(init?.headers).get('authorization')!);
            if (keys.length === 1) {
                expect(events.some(event => event.type === 'requestInvoked')).toBe(false);
                expect(await db.contextCompactions.where('runId').equals(run.id).count()).toBe(1);
                await db.connectors.update(connector.id, {apiKey: 'rotated-after-summary'});
                return Response.json({choices: [{message: {content: 'short factual summary'}, finish_reason: 'stop'}]});
            }
            expect(events.at(-1)?.type).toBe('requestInvoked');
            return answer('chat-completions');
        });
        await executeChatRun(run, 'obsolete-entry-key', new AbortController(), fetcher, undefined, db, undefined, event => { events.push(event); });
        expect(keys).toEqual(['Bearer entry-key', 'Bearer rotated-after-summary']);
        expect(events.filter(event => event.type === 'requestInvoked')).toHaveLength(1);
        expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
    });

    it('retains completed truth and held ownership when Stop arrives after terminal commit before acknowledgement', async () => {
        const run = await begin();
        const controller = new AbortController();
        const held = new Set<string>();
        const locks: ThreadLockManager = {async request(name, _options, callback) {
            if (held.has(name)) return callback(null);
            held.add(name);
            try { return await callback({name}); } finally { held.delete(name); }
        }};
        let acknowledge!: () => void;
        let entered!: () => void;
        const gate = new Promise<void>(resolve => { acknowledge = resolve; });
        const terminalCommitted = new Promise<void>(resolve => { entered = resolve; });
        let heldAcknowledgement = false;
        const original = db.transaction.bind(db);
        const transaction = vi.spyOn(db, 'transaction').mockImplementation(async (mode, scope, callback) => {
            const result = await original(mode, scope, callback);
            if (!heldAcknowledgement && mode === 'rw' && (await db.agentRuns.get(run.id))?.status === 'completed') {
                heldAcknowledgement = true;
                entered();
                await gate;
            }
            return result;
        });
        let snapshot: ExecutionFeedbackSnapshot | undefined;
        const owner = createExecutionFeedbackController({onChange: next => { snapshot = next; }});
        const invocation = owner.begin('terminal-race', run.threadId);
        invocation.admitted(run);
        const events: Parameters<RuntimeExecutionFeedback>[0][] = [];
        const fetcher = vi.fn(async () => answer('chat-completions'));
        const execution = withExecutionOwnership(run.threadId, async ownership => {
            await executeChatRun(run, connector.apiKey, controller, fetcher, undefined, db, ownership, event => { events.push(event); invocation.runtime(event); });
        }, locks);
        await terminalCommitted;
        expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
        expect(events.some(event => event.type === 'settled')).toBe(false);
        expect(snapshot?.phase).toBe('receiving');
        expect(invocation.requestStop()).toBe(true);
        controller.abort();
        expect(snapshot?.phase).toBe('stopping');
        await expect(withExecutionOwnership(run.threadId, async () => undefined, locks)).rejects.toThrow('另一个页面');
        acknowledge();
        await execution;
        expect(events.at(-1)).toMatchObject({type: 'settled', confirmed: true, status: 'completed'});
        expect((await db.chatMessages.get(run.assistantMessageId))?.status).toBe('complete');
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(held.size).toBe(0);
        invocation.release(); owner.dispose(); transaction.mockRestore();
    });

    it('correlates a resumed invocation with its new checkpoint rather than already-saved output', async () => {
        const run = await begin();
        await saveToolRound(run.id, 'saved previous output', [{id: 'unoffered-call', type: 'function', function: {name: 'unavailable_tool', arguments: '{}'}}],
            [{title: 'Unavailable tool', effect: 'read', highRisk: false, failure: {error: 'unavailable', result: '{"error":"unavailable"}'}}]);
        await finishAgentRun(run.id, 'interrupted', {content: 'saved previous output'});
        await db.agentRuns.update(run.id, {pauseReason: 'model_step_limit', modelStep: 32, modelStepSegmentStart: 0});
        const mark = vi.fn();
        let snapshot: ExecutionFeedbackSnapshot | undefined;
        const owner = createExecutionFeedbackController({timing: {mark, measure: vi.fn(), clearMarks: vi.fn(), clearMeasures: vi.fn()},
            onChange: next => {snapshot = next;}});
        const invocation = owner.begin('resumed-invocation', run.threadId);
        let release!: () => void;
        let entered!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const requested = new Promise<void>(resolve => { entered = resolve; });
        const fetcher = vi.fn(async () => { entered(); await gate; return answer('chat-completions'); });
        const execution = resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, undefined, db, undefined, invocation.runtime);
        await Promise.race([requested, execution.then(() => { throw new Error('Runtime ended before the held request'); })]);
        invocation.publicCommitted({runId: run.id, assistantMessageId: run.assistantMessageId, kind: 'content', text: 'saved previous output'});
        expect(mark.mock.calls.some(([name]) => String(name).endsWith('firstPublicCommitted'))).toBe(false);
        release(); await execution;
        expect(snapshot?.phase).toBe('receiving');
        invocation.release();
        invocation.publicCommitted({runId: run.id, assistantMessageId: run.assistantMessageId, kind: 'content', text: 'public answer'});
        expect(mark.mock.calls.filter(([name]) => String(name).endsWith('firstPublicCommitted'))).toHaveLength(1);
        expect((await db.agentRuns.get(run.id))?.modelStep).toBe(33);
        expect(fetcher).toHaveBeenCalledTimes(1);
        owner.dispose();
    });
});
