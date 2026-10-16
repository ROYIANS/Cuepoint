import type {McpHostServices, McpInvocationIdentity, McpInvocationOutcome} from '../../../../platform/runtime/mcp';
import {mcpHostServices} from '../../../../platform/runtime/mcpServices';
import {db as productDb} from '../../../../platform/product/store';
import type {ProductStore} from '../../../../platform/storage/types';
import {publishAgentJob, readAgentJob, type AgentJobContext} from '../../commands/agentJobs';
import type {AgentJobResult} from '../../models/agentJob';
import {mcpRetainedResult} from './results';

/** Foreground-only original receipt. No args, preview, AbortSignal or running factory is retained. */
export interface McpOriginalInvocation {
    readonly identity: McpInvocationIdentity;
    readonly jobId: string;
    readonly revision: number;
    readonly context: AgentJobContext;
}
interface Receipt {readonly original: McpOriginalInvocation; pending?: Promise<AgentJobResult>}
const owners = new WeakMap<McpHostServices, Map<string, Receipt>>();
const MAX_ORIGINAL_RECEIPTS = 1024;
export function assertMcpOriginalCapacity(host: McpHostServices): void {
    if ((owners.get(host)?.size ?? 0) >= MAX_ORIGINAL_RECEIPTS) throw new Error('此会话的 MCP 待核实记录已达上限，尚未访问外部服务。');
}
export function retainMcpOriginalInvocation(host: McpHostServices, original: McpOriginalInvocation): void {
    let receipts = owners.get(host);
    if (!receipts) {receipts = new Map(); owners.set(host, receipts);}
    if (receipts.has(original.identity.operationId)) throw new Error('原 MCP 调用不可替换');
    assertMcpOriginalCapacity(host);
    receipts.set(original.identity.operationId, {original});
}
function receiptFor(context: AgentJobContext, host: McpHostServices | undefined): Receipt | undefined {
    const receipt = host && owners.get(host)?.get(context.callId), owner = receipt?.original.context;
    return owner && owner.callId === context.callId && owner.runId === context.runId && owner.threadId === context.threadId && owner.projectId === context.projectId &&
        (owner.store ?? productDb) === (context.store ?? productDb) ? receipt : undefined;
}
/** Availability only controls a foreground readback button; durable owner checks still gate every query. */
export function canReconcileOriginalMcpInvocation(context: AgentJobContext): boolean {
    return !!receiptFor(context, mcpHostServices());
}
export async function settleMcpOriginalInvocation(original: McpOriginalInvocation, outcome: McpInvocationOutcome): Promise<AgentJobResult> {
    if (outcome.operationId !== original.identity.operationId) throw new Error('MCP 原调用回执不匹配');
    let publication: Parameters<typeof publishAgentJob>[3];
    if (outcome.status === 'completed') {
        try {
            const retained = mcpRetainedResult(outcome.result, original.identity.authority.target.kind === 'resource');
            publication = {status: retained.failed ? 'failed' : 'completed', text: retained.text, serviceMayHaveRun: true, metadata: {coverage: 'untrusted_mcp_reply'}};
        } catch {
            publication = {status: 'failed', text: '服务返回了不支持或超出限制的内容；未自动重试。', serviceMayHaveRun: true, error: 'MCP 回复无法安全保存。'};
        }
    } else if (outcome.status === 'unknown') publication = {status: 'unknown', text: '原外部操作可能已经执行，尚未收到可核实的完整回复。请核对外部服务；不会自动重新执行。', serviceMayHaveRun: true};
    else publication = {status: outcome.status === 'not_started' && outcome.code === 'canceled' ? 'stopped' : 'failed',
        text: outcome.status === 'not_started' ? '外部操作未开始；此调用不会自动重新执行。' : '服务返回了协议错误；此调用不会自动重新执行。', serviceMayHaveRun: outcome.status !== 'not_started'};
    return publishAgentJob(original.context, original.jobId, original.revision, publication, true);
}
/** Query the original native receipt only. Reload/disposal loses authority and cannot replay a producer. */
export async function reconcileOriginalMcpInvocation(context: AgentJobContext, store: ProductStore = context.store ?? productDb): Promise<AgentJobResult> {
    const host = mcpHostServices(), receipt = receiptFor({...context, store}, host);
    if (!host || !receipt) throw new Error('此页面没有原 MCP 调用回执，请核对外部服务；不会重新执行。');
    if (receipt.pending) return receipt.pending;
    const original = receipt.original;
    const pending = (async () => {
        const job = await readAgentJob({threadId: context.threadId, projectId: context.projectId, original: {runId: context.runId, callId: context.callId}}, original.jobId, store);
        if (!job || job.kind !== 'mcp' || job.output?.retention === 'cleared') throw new Error('原 MCP 报告已不存在或清理。');
        const result = await settleMcpOriginalInvocation(original, await host.invocationStatus(original.identity));
        if (result.status !== 'unknown') owners.get(host)?.delete(context.callId);
        return result;
    })();
    receipt.pending = pending;
    try {return await pending;} finally {receipt.pending = undefined;}
}
/** Confirmed results no longer need a foreground bearer receipt. */
export function releaseMcpOriginalInvocation(host: McpHostServices, callId: string): void {owners.get(host)?.delete(callId);}
