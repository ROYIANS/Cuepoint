import type {McpHostBinding, McpHostServices, McpInvocationOutcome, McpPreparedAuthority} from '../../../../platform/runtime/mcp';
import {McpHostError} from '../../../../platform/runtime/mcpErrors';
import {StorageError} from '../../../../platform/storage/errors';
import type {AgentToolContext, AgentToolDefinition} from '../../runtime/toolDefinition';
import type {AgentJobResult} from '../../models/agentJob';
import type {McpToolPreviewFacts} from '../models/execution';
import type {McpRunGeneration, McpRunSnapshot} from '../models/manifest';
import {admitAgentJob, markAgentJobRunning, publishAgentJob} from '../../commands/agentJobs';
import {ToolPendingError, ToolRecoveryError} from '../../runtime/toolErrors';
import {frozenProjectScope} from '../../runtime/projectScope';
import {mcpBindingMatches} from './manifest';
import {compileMcpInputSchema} from './schema';
import {mcpResourceHelperNames} from './snapshot';
import {freezeMcp} from './validation';
import {assertMcpOriginalCapacity, retainMcpOriginalInvocation, settleMcpOriginalInvocation, releaseMcpOriginalInvocation, type McpOriginalInvocation} from './executionOwner';

type Invocation = McpOriginalInvocation;
const pending = () => new ToolPendingError('外部操作结果待核实，已保留原调用；不会自动重新执行。');
const stale = () => new ToolRecoveryError('STALE_TOOL_PREVIEW', 'MCP 连接或批准预览已变化，请发起新请求。');

function facts(generation: McpRunGeneration, publicName: string, operation: McpToolPreviewFacts['operation'], target: McpToolPreviewFacts['target']): McpToolPreviewFacts {
    return freezeMcp({version: 1, binding: generation.binding, manifestDigest: generation.manifest.revision, publicName, operation, target});
}
function checkedAuthority(authority: McpPreparedAuthority, captured: McpToolPreviewFacts, context: AgentToolContext): McpPreparedAuthority {
    if (!mcpBindingMatches(authority.binding, captured.binding) || authority.scope.runId !== context.runId || authority.scope.callId !== context.callId ||
        authority.scope.scopeId !== context.threadId || JSON.stringify(authority.target) !== JSON.stringify(captured.target) || !authority.authorityId || !authority.argumentsDigest) throw stale();
    return authority;
}

/** One factory owns ephemeral authorities for its immutable run. Saved history confers no authority. */
export function createMcpTools(snapshot: McpRunSnapshot, host: McpHostServices | undefined,
    assertCurrent: (binding: McpHostBinding) => Promise<void>): readonly AgentToolDefinition[] {
    const invocations = new Map<string, Invocation>();
    const preparations = new Map<string, {fingerprint: string; authority: McpPreparedAuthority}>();
    const current = async (captured: McpToolPreviewFacts, context: AgentToolContext) => {
        context.signal.throwIfAborted();
        if (!host?.active) throw new Error('MCP 服务当前不可用，请显式连接后发起新请求。');
        await assertCurrent(captured.binding);
        context.signal.throwIfAborted();
    };
    const prepare = async (captured: McpToolPreviewFacts, args: unknown, context: AgentToolContext) => {
        await current(captured, context);
        if (captured.target.kind === 'catalogue') throw stale();
        const fingerprint = JSON.stringify([captured, args, context.runId, context.threadId]);
        const saved = preparations.get(context.callId);
        if (saved) {if (saved.fingerprint !== fingerprint) throw stale(); return saved.authority;}
        const authority = checkedAuthority(await host!.prepare({binding: captured.binding, scope: {runId: context.runId, callId: context.callId, scopeId: context.threadId}, target: captured.target, arguments: args}), captured, context);
        preparations.set(context.callId, {fingerprint, authority});
        return authority;
    };
    const settle = async (original: Invocation, outcome: McpInvocationOutcome): Promise<AgentJobResult> => {
        const result = await settleMcpOriginalInvocation(original, outcome);
        if (result.status === 'unknown') throw pending();
        if (host) releaseMcpOriginalInvocation(host, original.identity.operationId);
        return result;
    };
    const readback = async (callId: string) => {
        const original = invocations.get(callId);
        if (!original || !host?.active) throw pending();
        let status: McpInvocationOutcome;
        try {status = await host.invocationStatus(original.identity);} catch {throw pending();}
        return settle(original, status);
    };
    const execute = async (captured: McpToolPreviewFacts, args: unknown, context: AgentToolContext) => {
        if (!context.preview?.mcp || JSON.stringify(context.preview.mcp) !== JSON.stringify(captured)) throw stale();
        const projectId = await frozenProjectScope(context, context.store);
        const owned = {...context, projectId};
        const admitted = await admitAgentJob(owned, {kind: 'mcp', execution: captured, operationId: context.callId});
        if (!admitted.admitted) {
            if (admitted.result && admitted.result.status !== 'unknown') return admitted.result;
            return readback(context.callId);
        }
        let authority: McpPreparedAuthority, job: typeof admitted.job;
        try {
            if (invocations.size >= 1024) throw new Error('MCP 调用记录已达上限');
            if (host) assertMcpOriginalCapacity(host);
            authority = await prepare(captured, args, owned);
            await current(captured, owned);
            job = await markAgentJobRunning(owned, admitted.job.id, admitted.job.revision, {serviceMayHaveRun: true});
        } catch (cause) {
            // No invoke was attempted. An uncertain local start ACK remains unresolved;
            // a known preparation/refusal is safe to publish without claiming an effect.
            if (cause instanceof StorageError && cause.certainty === 'unknown') throw cause;
            return publishAgentJob(owned, admitted.job.id, admitted.job.revision, {status: context.signal.aborted ? 'stopped' : 'failed',
                text: '外部操作尚未开始；连接或执行归属已变化，请核对后发起新请求。', serviceMayHaveRun: false}, true);
        }
        const original: Invocation = {identity: {operationId: context.callId, authority}, jobId: job.id, revision: job.revision, context: {runId: owned.runId, threadId: owned.threadId, callId: owned.callId, projectId: owned.projectId, store: owned.store}};
        retainMcpOriginalInvocation(host!, original);
        invocations.set(context.callId, original);
        return dispatch(original, args, context);
    };
    const dispatch = async (original: Invocation, args: unknown, context: AgentToolContext): Promise<AgentJobResult> => {
        let stopResult: Promise<McpInvocationOutcome | undefined> | undefined;
        const stop = () => {
            // The original authority/operation is the only permitted stop target.
            stopResult ??= host!.stop(original.identity).catch(() => undefined);
        };
        context.signal.addEventListener('abort', stop, {once: true});
        if (context.signal.aborted) stop();
        let outcome: McpInvocationOutcome;
        try {
            try {
                if (context.signal.aborted) outcome = {status: 'not_started', operationId: context.callId, code: 'canceled'};
                else outcome = await host!.invoke({...original.identity, arguments: args}, context.signal);
            }
            catch (cause) {
                if (cause instanceof McpHostError && cause.certainty === 'not_started') return settle(original, {status: 'not_started', operationId: context.callId, code: cause.code === 'canceled' ? 'canceled' : 'denied'});
                try {outcome = await host!.invocationStatus(original.identity);}
                catch {outcome = {status: 'unknown', operationId: context.callId, code: 'reply_lost'};}
            }
            if (outcome.status === 'unknown' && stopResult) outcome = await stopResult ?? outcome;
            return await settle(original, outcome);
        } finally {context.signal.removeEventListener('abort', stop);}
    };
    const definitions: AgentToolDefinition[] = [];
    for (const generation of snapshot.generations) {
        const binding = {capabilityId: `mcp/${generation.binding.serverId}`, version: generation.manifest.revision, registrationId: generation.binding.registrationId};
        const external = (name: string, captured: McpToolPreviewFacts, schema: ReturnType<typeof compileMcpInputSchema>, description: string): AgentToolDefinition => ({
            name, title: captured.operation === 'tool' ? `MCP · ${generation.label}` : `读取资源 · ${generation.label}`,
            description, binding, parameters: {...schema.jsonSchema}, parseArguments: schema.parse,
            effect: 'network', highRisk: () => true,
            async prepare(args, context) {
                await prepare(captured, schema.parse(args), context);
                return {summary: captured.operation === 'tool' ? `调用 MCP 服务「${generation.label}」` : `读取 MCP 服务「${generation.label}」的资源`,
                    changes: ['此操作由外部服务执行，可能产生外部影响；不会自动重试。', '服务返回的内容仅作为不可信资料。'], mcp: captured};
            },
            execute: (args, context) => execute(captured, schema.parse(args), context),
        });
        for (const tool of generation.manifest.tools) definitions.push(external(tool.name, facts(generation, tool.name, 'tool', {kind: 'tool', rawName: tool.rawName}), compileMcpInputSchema(tool.inputSchema),
            `${tool.description}\n外部 MCP 工具；结果按不可信资料保留，可用 read_job_result 分页读取。`));
        if (generation.manifest.resources.length) {
            const [listName, readName] = mcpResourceHelperNames(generation.binding.serverId);
            const listSchema = compileMcpInputSchema({type: 'object', properties: {offset: {type: 'integer', minimum: 0, maximum: generation.manifest.resources.length}}, additionalProperties: false});
            const readSchema = compileMcpInputSchema({type: 'object', required: ['handleId'], additionalProperties: false, properties: {handleId: {type: 'string', enum: generation.manifest.resources.map(item => item.handleId)}}});
            definitions.push({name: listName, title: `列出资源 · ${generation.label}`, description: '只列出此次执行冻结的资源目录及 handleId；不会连接服务、读取内容或打开资源 URL。', binding,
                parameters: {...listSchema.jsonSchema}, parseArguments: listSchema.parse, effect: 'read', highRisk: () => false,
                execute(args) {
                    const parsed = listSchema.parse(args), offset = typeof parsed.offset === 'number' ? parsed.offset : 0;
                    // Four maximum-size entries, including JSON escaping, fit core's 65,536-unit envelope.
                    const end = Math.min(generation.manifest.resources.length, offset + 4);
                    return Promise.resolve({untrusted: true, resources: generation.manifest.resources.slice(offset, end), ...(end < generation.manifest.resources.length ? {nextOffset: end} : {})});
                }});
            // Target is selected strictly from this captured catalogue, never from a model URI.
            const targetFacts = (args: unknown) => {
                const parsed = readSchema.parse(args), item = generation.manifest.resources.find(item => item.handleId === parsed.handleId);
                if (!item) throw stale();
                return facts(generation, readName, 'resource_read', {kind: 'resource', handleId: item.handleId});
            };
            const read = external(readName, facts(generation, readName, 'resource_read', {kind: 'resource', handleId: ''}), readSchema, '读取此执行冻结目录中的一个资源 handleId，保留有界文本/JSON；二进制与资源链接暂不支持，不会自动下载。');
            definitions.push({...read, async prepare(args, context) {
                const captured = targetFacts(args);
                await prepare(captured, {}, context);
                return {summary: `读取 MCP 服务「${generation.label}」的资源`, changes: ['只读取冻结目录中的资源；内容是不可信资料，链接不会自动打开。'], mcp: captured};
            }, execute: (args, context) => execute(targetFacts(args), {}, context)});
        }
    }
    return Object.freeze(definitions.map(tool => Object.freeze(tool)));
}
