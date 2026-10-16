import {afterEach, describe, expect, it, vi} from 'vitest';
import {db} from '@/platform/product/store';
import type {McpHostServices, McpInvocationOutcome} from '@/platform/runtime/mcp';
import {McpHostError} from '@/platform/runtime/mcpErrors';
import {UnknownCommitError} from '@/platform/storage/errors';
import {createChatThread} from '@/features/agent/commands/chat';
import {beginAgentRun} from '@/features/agent/commands/agentRuns';
import {transitionToolCall} from '@/features/agent/commands/agentTools';
import {deleteChatThread} from '@/features/agent/commands/lifecycle';
import {readAgentJobPage, clearAgentJobResult, recoverAgentJobs} from '@/features/agent/commands/agentJobs';
import {reconcileOriginalMcpInvocation, canReconcileOriginalMcpInvocation} from '@/features/agent/mcp/runtime/executionOwner';
import {createMcpTools} from '@/features/agent/mcp/runtime/tools';
import {normalizeMcpManifest} from '@/features/agent/mcp/runtime/manifest';
import {composeMcpRunSnapshot, mcpResourceHelperNames} from '@/features/agent/mcp/runtime/snapshot';
import {mcpRetainedResult} from '@/features/agent/mcp/runtime/results';
import {ToolPendingError} from '@/features/agent/runtime/toolErrors';
import {withExecutionOwnership} from '@/features/agent/runtime/runOwnership';
import {executeChatRun, resumeChatRun} from '@/features/agent/runtime/runChat';
import {updateGeneralAgentConfig} from '@/features/agent/commands/agentSettings';
import {installMcpHostServices, clearMcpHostServices} from '@/platform/runtime/mcpServices';
import {mcpRuntimeOwner} from '@/features/agent/mcp/runtime/owner';
import {requiresToolApproval} from '@/features/agent/runtime/tools';
import type {AgentToolContext} from '@/features/agent/runtime/toolDefinition';
import type {AgentJobResult} from '@/features/agent/models/agentJob';
import type {ConnectorConfig} from '@/features/settings/models/connector';
import {saveFixtureToolRound} from './helpers/toolDispatch';

const connector: ConnectorConfig = {id: 'cx', definitionId: 'openai-compatible', protocol: 'openai-compatible', baseUrl: 'https://model.test/v1', apiKey: 'secret', updatedAt: 'now'};
const binding = {serverId: 'server_one', configRevision: 1, manifestRevision: 'raw_manifest', registrationId: 'registration_one', hostSessionId: 'host_one', principalRevision: 'principal_one'};
const manifest = normalizeMcpManifest(binding.serverId, {tools: [{name: 'effect', description: 'external effect', inputSchema: {type: 'object', properties: {value: {type: 'string', maxLength: 20}}, required: ['value'], additionalProperties: false}}], resources: [{uri: 'fixture://item/one', name: 'One'}]});
const snapshot = composeMcpRunSnapshot([{binding, label: 'Fixture', manifest}], ['workspace_overview', 'update_run_plan']);
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(done => {resolve = done;}); return {promise, resolve};}
const completed = (operationId: string, text = 'original reply'): McpInvocationOutcome => ({status: 'completed', operationId, result: {content: [{type: 'text', text}]}});
function hostFixture() {
    let active = true;
    const host: McpHostServices = {
        get active() {return active;}, capabilities: {host: 'desktop', stdio: true, streamableHttp: true, oauth: true, rememberedCredentials: true},
        async initialize() {return this.capabilities;},
        preparePrivateRevision: vi.fn(async () => {throw new Error('unused');}), privateRevisionStatus: vi.fn(async () => ({status: 'unknown' as const})),
        discardPrivateRevision: vi.fn(async () => undefined), confirmPrivateRevision: vi.fn(async () => undefined), retireServer: vi.fn(async () => ({status: 'drained' as const})),
        oauthBegin: vi.fn(async () => {throw new Error('unused');}), oauthStatus: vi.fn(async () => {throw new Error('unused');}), oauthCancel: vi.fn(async () => undefined),
        connect: vi.fn(async () => {throw new Error('unused');}), disconnect: vi.fn(async () => ({status: 'drained' as const})),
        prepare: vi.fn(async input => ({authorityId: `authority_${input.scope.callId}`, binding: input.binding, scope: input.scope, target: input.target, argumentsDigest: 'native_digest'})),
        invoke: vi.fn(async input => completed(input.operationId)), invocationStatus: vi.fn(async input => ({status: 'unknown' as const, operationId: input.operationId, code: 'reply_lost' as const})),
        stop: vi.fn(async input => ({status: 'unknown' as const, operationId: input.operationId, code: 'stopped' as const})),
        dispose: vi.fn(async () => {active = false; return {status: 'drained' as const};}),
    };
    return {host};
}
async function fixture(options: {resource?: boolean; current?: () => Promise<void>} = {}) {
    const {host} = hostFixture(), current = vi.fn(options.current ?? (async () => undefined));
    const tools = createMcpTools(snapshot, host, current), name = options.resource ? mcpResourceHelperNames(binding.serverId)[1] : manifest.tools[0].name;
    const tool = tools.find(tool => tool.name === name)!;
    const args = tool.parseArguments(options.resource ? {handleId: manifest.resources[0].handleId} : {value: 'one'});
    const thread = await createChatThread();
    const run = await beginAgentRun({threadId: thread.id, connector, model: 'fixture', content: 'invoke'});
    await db.agentRuns.update(run.id, {toolLoading: undefined, mcpSnapshot: snapshot, enabledToolNames: [name, 'read_job_result']});
    await saveFixtureToolRound(run.id, '', [{id: 'wire_one', type: 'function', function: {name, arguments: JSON.stringify(args)}}], [{title: tool.title, binding: tool.binding, effect: tool.effect, highRisk: tool.highRisk(args)}]);
    const call = (await db.agentToolCalls.where('runId').equals(run.id).first())!;
    const controller = new AbortController();
    const context: AgentToolContext = {runId: run.id, threadId: thread.id, callId: call.id, signal: controller.signal};
    const preview = await tool.prepare!(args, context);
    await db.agentToolCalls.update(call.id, {preview});
    await transitionToolCall(run.id, call.id, ['pending'], 'running');
    return {host, current, tools, tool, args, run, thread, call, controller, context: {...context, preview}, reader: {threadId: thread.id, original: {runId: run.id, callId: call.id}}};
}
afterEach(() => vi.restoreAllMocks());

describe('MCP execution and finite retained original result owner', () => {
    it('constructs offline schemas, uses risk matrix, validates arguments and never persists authority', async () => {
        const tools = createMcpTools(snapshot, undefined, async () => undefined), tool = tools.find(item => item.name === manifest.tools[0].name)!;
        expect(tool.parseArguments({value: 'one'})).toEqual({value: 'one'});
        expect(() => tool.parseArguments({value: 'one', approved: true})).toThrow();
        expect(() => tool.parseArguments({value: 'x'.repeat(30)})).toThrow();
        for (const mode of ['ask', 'assist', 'full'] as const) expect(requiresToolApproval(mode, tool, {value: 'one'})).toBe(mode !== 'full');
        expect(tool.atomic).toBeUndefined(); expect(tool.recovery).toBeUndefined();
        const f = await fixture();
        const result = await f.tool.execute(f.args, f.context) as AgentJobResult;
        expect(result).toMatchObject({kind: 'mcp', status: 'completed', selected: 1, completed: 1});
        expect(f.host.prepare).toHaveBeenCalledTimes(1); // Preview and execution share ephemeral authority.
        expect(f.host.invoke).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(await db.agentToolCalls.get(f.call.id))).not.toContain('authority_');
        expect(JSON.stringify(await db.agentJobs.toArray())).not.toContain('authority_');
        expect(await readAgentJobPage(f.reader, result.jobId)).toMatchObject({available: true, text: expect.stringContaining('original reply')});
        expect(await f.tool.execute(f.args, f.context)).toEqual(result);
        expect(f.host.invoke).toHaveBeenCalledTimes(1);
    });
    it('admits before external IO and reconciles lost invoke reply through only the original status', async () => {
        const f = await fixture();
        vi.spyOn(f.host, 'invoke').mockImplementation(async input => {
            const job = await db.agentJobs.where('callId').equals(f.call.id).first();
            expect(job).toMatchObject({status: 'running', kind: 'mcp', serviceMayHaveRun: true});
            expect(input).toMatchObject({operationId: f.call.id, authority: {scope: {runId: f.run.id, callId: f.call.id, scopeId: f.thread.id}}});
            throw new McpHostError('reply_lost', 'unknown', input.operationId);
        });
        vi.spyOn(f.host, 'invocationStatus').mockImplementation(async input => completed(input.operationId, 'read back original'));
        const result = await f.tool.execute(f.args, f.context) as AgentJobResult;
        expect(result.status).toBe('completed'); expect(f.host.invoke).toHaveBeenCalledTimes(1); expect(f.host.invocationStatus).toHaveBeenCalledTimes(1);
        expect(await readAgentJobPage(f.reader, result.jobId)).toMatchObject({available: true, text: expect.stringContaining('read back original')});
    });
    it('retains readable unknown evidence while original call remains unknown, then settles original readback without replay', async () => {
        const f = await fixture();
        vi.spyOn(f.host, 'invoke').mockImplementation(async input => ({status: 'unknown', operationId: input.operationId, code: 'reply_lost'}));
        await expect(f.tool.execute(f.args, f.context)).rejects.toBeInstanceOf(ToolPendingError);
        const call = (await db.agentToolCalls.get(f.call.id))!, job = (await db.agentJobs.where('callId').equals(call.id).first())!;
        expect(call.status).toBe('unknown'); expect(JSON.parse(call.result!)).toMatchObject({status: 'unknown', jobId: job.id});
        expect(await readAgentJobPage(f.reader, job.id)).toMatchObject({available: true, text: expect.stringContaining('不会自动重新执行')});
        await db.agentRuns.update(f.run.id, {status: 'interrupted'});
        vi.spyOn(f.host, 'invocationStatus').mockImplementation(async input => completed(input.operationId, 'verified late original'));
        expect(await f.tool.execute(f.args, f.context)).toMatchObject({status: 'completed', jobId: job.id});
        expect(f.host.invoke).toHaveBeenCalledTimes(1);
        expect(await readAgentJobPage(f.reader, job.id)).toMatchObject({available: true, text: expect.stringContaining('verified late original')});
    });
    it('keeps unknown publication ACK loss unresolved and reads back only the already committed descriptor', async () => {
        const f = await fixture();
        vi.spyOn(f.host, 'invoke').mockImplementation(async input => ({status: 'unknown', operationId: input.operationId, code: 'reply_lost'}));
        const transaction = db.transaction.bind(db); let lost = false;
        const fault = vi.spyOn(db, 'transaction').mockImplementation(async (mode, tables, callback) => {
            const value = await transaction(mode, tables, callback);
            if (mode === 'rw' && !lost && value && typeof value === 'object' && 'jobId' in value) {lost = true; throw new UnknownCommitError('commit_lost', 'workspace_one');}
            return value;
        });
        await expect(f.tool.execute(f.args, f.context)).rejects.toBeInstanceOf(ToolPendingError); fault.mockRestore();
        expect(lost).toBe(true); expect((await db.agentToolCalls.get(f.call.id))!.status).toBe('unknown');
        expect(f.host.invoke).toHaveBeenCalledTimes(1); expect(await db.agentJobResultChunks.count()).toBe(1);
    });
    it.each(['admission', 'start'] as const)('does not issue on lost %s ACK and recovers only the provable durable boundary', async phase => {
        const f = await fixture();
        const transaction = db.transaction.bind(db); let lost = false;
        const fault = vi.spyOn(db, 'transaction').mockImplementation(async (mode, tables, callback) => {
            const value = await transaction(mode, tables, callback);
            if (mode === 'rw' && !lost && value && typeof value === 'object' &&
                (phase === 'admission' ? 'admitted' in value && value.admitted === true : 'status' in value && value.status === 'running')) {
                lost = true; throw new UnknownCommitError('original_commit', 'workspace_one');
            }
            return value;
        });
        await expect(f.tool.execute(f.args, f.context)).rejects.toThrow(); fault.mockRestore();
        expect(lost).toBe(true); expect(f.host.invoke).not.toHaveBeenCalled();
        const before = (await db.agentJobs.where('callId').equals(f.call.id).first())!;
        expect(before.status).toBe(phase === 'admission' ? 'accepted' : 'running');
        await withExecutionOwnership(f.thread.id, ownership => recoverAgentJobs(f.thread.id, ownership));
        const recovered = (await db.agentJobs.get(before.id))!;
        expect(recovered.status).toBe(phase === 'admission' ? 'stopped' : 'unknown');
        expect((await db.agentToolCalls.get(f.call.id))!.status).toBe(phase === 'admission' ? 'completed' : 'unknown');
        if (phase === 'admission') expect(recovered.serviceMayHaveRun).toBe(false);
    });
    it('publishes known late reply after stop and retirement but never resurrects deleted owner', async () => {
        const f = await fixture(), started = deferred<void>(), reply = deferred<McpInvocationOutcome>();
        vi.spyOn(f.host, 'invoke').mockImplementation(async () => {started.resolve(); return reply.promise;});
        const execution = f.tool.execute(f.args, f.context); await started.promise;
        f.controller.abort(); await db.agentRuns.update(f.run.id, {status: 'interrupted'}); await db.agentToolCalls.update(f.call.id, {status: 'unknown'});
        f.current.mockRejectedValue(new Error('retired'));
        reply.resolve(completed(f.call.id, 'known after stop'));
        expect(await execution).toMatchObject({status: 'completed'}); expect(f.host.stop).toHaveBeenCalledTimes(1);
        expect((await db.agentToolCalls.get(f.call.id))!.status).toBe('completed');
        const gone = await fixture(), entered = deferred<void>(), late = deferred<McpInvocationOutcome>();
        vi.spyOn(gone.host, 'invoke').mockImplementation(async () => {entered.resolve(); return late.promise;});
        const deleted = gone.tool.execute(gone.args, gone.context); await entered.promise; await deleteChatThread(gone.thread.id);
        late.resolve(completed(gone.call.id)); await expect(deleted).rejects.toThrow();
        expect(await db.agentToolCalls.get(gone.call.id)).toBeUndefined(); expect(await db.agentJobs.where('callId').equals(gone.call.id).count()).toBe(0);
    });
    it('records known predispatch retirement and host refusal as not started with zero effect', async () => {
        const f = await fixture(); f.current.mockRejectedValue(new Error('retired'));
        expect(await f.tool.execute(f.args, f.context)).toMatchObject({status: 'failed', serviceMayHaveRun: false});
        expect(f.host.invoke).not.toHaveBeenCalled(); expect((await db.agentToolCalls.get(f.call.id))!.status).toBe('completed');
        const denied = await fixture(); vi.spyOn(denied.host, 'invoke').mockRejectedValue(new McpHostError('retired', 'not_started', denied.call.id));
        expect(await denied.tool.execute(denied.args, denied.context)).toMatchObject({status: 'failed', serviceMayHaveRun: false});
        expect(denied.host.invocationStatus).not.toHaveBeenCalled();
    });
    it('refuses cross-scope binding/preview drift and does not restore explicitly cleared unknown evidence', async () => {
        const f = await fixture();
        await db.agentToolCalls.update(f.call.id, {binding: {...f.tool.binding!, registrationId: 'different'}});
        await expect(f.tool.execute(f.args, f.context)).rejects.toThrow(); expect(f.host.invoke).not.toHaveBeenCalled();
        const unknown = await fixture(); vi.spyOn(unknown.host, 'invoke').mockImplementation(async input => ({status: 'unknown', operationId: input.operationId, code: 'reply_lost'}));
        await expect(unknown.tool.execute(unknown.args, unknown.context)).rejects.toBeInstanceOf(ToolPendingError);
        const job = (await db.agentJobs.where('callId').equals(unknown.call.id).first())!;
        await clearAgentJobResult(unknown.reader, job.id);
        vi.spyOn(unknown.host, 'invocationStatus').mockImplementation(async input => completed(input.operationId));
        await expect(unknown.tool.execute(unknown.args, unknown.context)).rejects.toThrow();
        expect(await readAgentJobPage(unknown.reader, job.id)).toEqual({available: false, reason: 'cleared'});
        expect(unknown.host.invoke).toHaveBeenCalledTimes(1);
    });
    it('reads captured resource handles only and treats binary/links as unsupported data', async () => {
        const f = await fixture({resource: true});
        expect(() => f.tool.parseArguments({handleId: 'arbitrary_url'})).toThrow();
        vi.spyOn(f.host, 'invoke').mockImplementation(async input => ({status: 'completed', operationId: input.operationId, result: {contents: [{uri: 'fixture://item/one', mimeType: 'application/json', text: '{"ok":true}'}]}}));
        const result = await f.tool.execute(f.args, f.context) as AgentJobResult;
        expect(f.host.prepare).toHaveBeenCalledWith(expect.objectContaining({target: {kind: 'resource', handleId: manifest.resources[0].handleId}, arguments: {}}));
        expect(await readAgentJobPage(f.reader, result.jobId)).toMatchObject({available: true, text: expect.stringContaining('{"ok":true}')});
        expect(mcpRetainedResult({content: [{type: 'resource_link', uri: 'https://external.test'}, {type: 'image', data: 'secret-binary'}]}, false)).toEqual({failed: true, text: expect.stringContaining('暂不支持')});
        expect(mcpRetainedResult({content: [{type: 'resource_link', uri: 'https://external.test'}]}, false).text).not.toContain('external.test');
    });
    it('paginates maximum-size frozen resource directory below the core result limit without host IO', async () => {
        const escaped = String.fromCharCode(92);
        const resources = Array.from({length: 48}, (_, i) => ({uri: `fixture://${i}/${escaped.repeat(2000)}`, name: escaped.repeat(256), description: escaped.repeat(2048)}));
        const large = normalizeMcpManifest(binding.serverId, {tools: [], resources});
        const captured = composeMcpRunSnapshot([{binding, label: 'Large', manifest: large}], []);
        const {host} = hostFixture(), tools = createMcpTools(captured, host, async () => undefined), tool = tools.find(item => item.name === mcpResourceHelperNames(binding.serverId)[0])!;
        let offset = 0, count = 0;
        do {
            const result = await tool.execute({offset}, {} as AgentToolContext) as {resources: unknown[]; nextOffset?: number};
            expect(JSON.stringify(result).length).toBeLessThan(65_536); count += result.resources.length;
            if (result.nextOffset === undefined) break; offset = result.nextOffset;
        } while (true);
        expect(count).toBe(48); expect(host.prepare).not.toHaveBeenCalled(); expect(host.invoke).not.toHaveBeenCalled();
    });
});


it('keeps an MCP unknown outcome behind the actual production core continuation barrier', async () => {
    const {host} = hostFixture();
    const reference = {kind: 'native_vault' as const, ownerId: 'vault_one', revisionId: 'revision_one'};
    vi.spyOn(host, 'preparePrivateRevision').mockResolvedValue(reference);
    vi.spyOn(host, 'connect').mockResolvedValue({binding, discovery: {tools: [{name: 'effect', inputSchema: manifest.tools[0].inputSchema}], resources: []}});
    vi.spyOn(host, 'invoke').mockImplementation(async input => ({status: 'unknown', operationId: input.operationId, code: 'reply_lost'}));
    installMcpHostServices(host);
    try {
        await updateGeneralAgentConfig({enabledSkillIds: ['workspace', 'planning'], permissionMode: 'full'});
        const owner = mcpRuntimeOwner()!.connections;
        await owner.save({operationId: 'save_one', serverId: binding.serverId, catalogueRevision: 0, expectedConfigRevision: 0, label: 'Fixture', enabled: true,
            privateConfig: {transport: 'stdio', executable: '/private/fixture', args: [], environment: {}}});
        await owner.connect({operationId: 'connect_one', serverId: binding.serverId, configRevision: 1});
        const thread = await createChatThread(), run = await beginAgentRun({threadId: thread.id, connector, model: 'fixture', content: 'Use external tool'});
        const publicName = run.mcpSnapshot!.generations[0].manifest.tools[0].name;
        const fetcher = vi.fn(async () => {
            const first = fetcher.mock.calls.length === 1;
            const name = first ? 'load_tool_groups' : publicName;
            const args = first ? {groupIds: [run.mcpSnapshot!.groups[0].id]} : {value: 'one'};
            return Response.json({choices: [{message: {content: '', tool_calls: [{id: first ? 'load_one' : 'effect_one', type: 'function', function: {name, arguments: JSON.stringify(args)}}]}, finish_reason: 'tool_calls'}]});
        });
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
        const call = (await db.agentToolCalls.where('runId').equals(run.id).toArray()).find(item => item.name === publicName)!;
        expect(call.status).toBe('unknown'); expect(JSON.parse(call.result!)).toMatchObject({status: 'unknown', kind: 'mcp'});
        expect(fetcher).toHaveBeenCalledTimes(2); expect(host.invoke).toHaveBeenCalledTimes(1);
        const savedRun = (await db.agentRuns.get(run.id))!;
        expect(savedRun.continuationMessages?.filter(item => item.role === 'tool').map(item => item.tool_call_id)).not.toContain(call.providerCallId);
        const job = (await db.agentJobs.where('callId').equals(call.id).first())!;
        expect(await readAgentJobPage({threadId: thread.id, original: {runId: run.id, callId: call.id}}, job.id)).toMatchObject({available: true});
        await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher)).rejects.toThrow();
        expect(fetcher).toHaveBeenCalledTimes(2); expect(host.invoke).toHaveBeenCalledTimes(1);
        const originalContext = {threadId: thread.id, runId: run.id, callId: call.id};
        expect(canReconcileOriginalMcpInvocation(originalContext)).toBe(true);
        vi.spyOn(host, 'invocationStatus').mockImplementation(async identity => completed(identity.operationId, 'verified original via report'));
        expect(await reconcileOriginalMcpInvocation(originalContext)).toMatchObject({status: 'completed', jobId: job.id});
        expect((await db.agentToolCalls.get(call.id))!.status).toBe('completed');
        expect(canReconcileOriginalMcpInvocation(originalContext)).toBe(false);
        expect(host.invocationStatus).toHaveBeenCalledTimes(1);
        expect(fetcher).toHaveBeenCalledTimes(2); expect(host.invoke).toHaveBeenCalledTimes(1);
    } finally {await clearMcpHostServices(host);}
});
