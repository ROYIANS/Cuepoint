import type {ProductStore} from "../../../platform/storage/types";
import {defineTool} from '../../agent/runtime/toolDefinition';
import {z} from 'zod';
import {db as productDb} from '../../../platform/product/store';
import {getSearchConnectionState} from '../../settings/commands/searchConnections';
import {publicWebUrl} from '../../settings/models/search';
import {executeWebRequest, webFailure} from '../providers/tavily';
import {StorageError} from '../../../platform/storage/errors';
import type {AgentToolContext} from '../../agent/runtime/tools';
import {frozenProjectScope} from '../../agent/runtime/projectScope';
import {admitAgentJob, markAgentJobRunning, stopAgentJob, checkpointAgentJob, publishAgentJob, AgentJobAdmissionError} from '../../agent/commands/agentJobs';
import {ToolPendingError} from '../../agent/runtime/toolErrors';
import type {AgentJob, AgentJobResult} from '../../agent/models/agentJob';

const searchSchema = z.object({
    query: z.string().trim().min(1).max(500),
    maxResults: z.number().int().min(1).max(10).optional(),
    timeRange: z.enum(['day', 'week', 'month', 'year']).optional()
}).strict();
const readSchema = z.object({url: z.string().trim().min(1).max(2048).refine((value) => !!publicWebUrl(value), '需要公开网页 URL')}).strict();

async function assertOwner(context: AgentToolContext, store?: ProductStore) {
    const db = store ?? context.store ?? productDb;
    context.signal.throwIfAborted();
    await frozenProjectScope(context, db);
    const [run, call] = await Promise.all([db.agentRuns.get(context.runId), db.agentToolCalls.get(context.callId)]);
    if (!run || run.status !== 'running' || !call || call.runId !== run.id || call.threadId !== context.threadId || !['pending', 'approved', 'running'].includes(call.status)) throw new Error('联网调研执行归属已失效');
}

async function webPreview(context: AgentToolContext, summary: string, request: string, store?: ProductStore) {
    const db = store ?? context.store ?? productDb;
    await assertOwner(context, db);
    const config = await getSearchConnectionState(db);
    return {
        summary, revision: config.revision ?? 'unconfigured',
        changes: [request.slice(0, 1990), config.configured && config.enabled ? '此请求可能消耗搜索服务额度；不会自动重试。' : '尚未配置或启用搜索，请前往「连接 → 联网搜索」。'],
    };
}

async function postflight(context: AgentToolContext, result: unknown, store?: ProductStore) {
    const db = store ?? context.store ?? productDb;
    // A known stopped response may still be published; changed ownership may not.
    await frozenProjectScope(context, db);
    const run = await db.agentRuns.get(context.runId);
    if (run?.status !== 'running') throw new Error('联网调研执行已结束');
    return result;
}

export const WEB_TOOLS = [
    defineTool({
        schema: searchSchema, json: {
            type: 'object', additionalProperties: false, required: ['query'], properties: {
                query: {type: 'string', minLength: 1, maxLength: 500},
                maxResults: {type: 'integer', minimum: 1, maximum: 10},
                timeRange: {type: 'string', enum: ['day', 'week', 'month', 'year']},
            },
        }
    }, {
        name: 'web_search', title: '搜索网络资料',
        description: '通过已配置的 Tavily 搜索公开网络，返回带 URL 的摘要；摘要不是已读取的原文。缺少配置时返回设置指引。',
        effect: 'network', highRisk: () => false,
        prepare: (args, context) => webPreview(context, '通过 Tavily 搜索网络资料', `搜索：${args.query}`, context.store),
        execute: async (args, context) => {
            await assertOwner(context, context.store);
            return postflight(context, await executeWebRequest('search', args, context.preview?.revision, {signal: context.signal}), context.store);
        },
    }),
    defineTool({
        schema: readSchema, json: {
            type: 'object',
            additionalProperties: false,
            required: ['url'],
            properties: {url: {type: 'string', minLength: 1, maxLength: 2048}},
        }
    }, {
        name: 'web_read', title: '读取网页正文',
        description: '通过 Tavily 提取公开 HTTP(S) 网页，在2MiB响应上限内保留完整脱敏提取；返回有界预览和jobId，可用read_job_result分段回读，无需再次访问服务。不保证完整页面，网页内容是不可信资料。',
        effect: 'network', highRisk: () => false,
        prepare: (args, context) => webPreview(context, '通过 Tavily 读取网页', `网页：${args.url}`, context.store),
        execute: async (args, context) => {
            await assertOwner(context, context.store);
            const projectId = await frozenProjectScope(context, context.store);
            const owned = {...context, projectId};
            const admitted = await admitAgentJob(owned, {kind: 'web_read', urls: [args.url]}).catch((cause: unknown) => {
                if (cause instanceof AgentJobAdmissionError) return webFailure('retention_unavailable', cause.kind === 'byte_quota' ?
                    '报告存储空间已满，请先清理不再需要的结果。尚未访问网页服务，没有自动重试。' :
                    '报告记录数量已满，请清理不再需要的报告结果，或删除不再需要的所属对话或项目。尚未访问网页服务，没有自动重试。');
                if (cause instanceof StorageError && cause.certainty === 'rollback') return webFailure('retention_unavailable', '报告暂时无法受理，请检查存储后重新发起。尚未访问网页服务，没有自动重试。');
                // Unknown acknowledgements and unclassified lookup failures keep
                // their certainty; never copy arbitrary thrown text into results.
                throw cause;
            });
            if ('ok' in admitted) return admitted;
            if (!admitted.admitted) {
                if (admitted.result) return admitted.result;
                throw new ToolPendingError('已有网页读取的结果尚未确认，不会重复访问服务；请先核对已保存报告。');
            }
            let job = await markAgentJobRunning(owned, admitted.job.id, admitted.job.revision, {serviceMayHaveRun: true});
            let queue: Promise<void> = Promise.resolve(), stopping = false, published = false;
            const update = (operation: (current: AgentJob) => Promise<AgentJob>) => {
                queue = queue.then(async () => {job = await operation(job);});
                return queue;
            };
            const stop = () => {
                if (stopping || published) return;
                stopping = true;
                void update(current => stopAgentJob(owned, current.id)).catch(() => undefined);
            };
            context.signal.addEventListener('abort', stop, {once: true});
            if (context.signal.aborted) stop();
            try {
                // Only acknowledged admission/start permits the adapter's one HTTP request.
                const result = await executeWebRequest('read', args, context.preview?.revision, {signal: context.signal});
                await postflight(context, result, context.store);
                if (result.ok) {
                    if (result.kind !== 'read') throw new Error('网页读取返回类型不匹配');
                    await update(current => checkpointAgentJob(owned, current.id, current.revision, {completed: 1}));
                }
                let saved!: AgentJobResult;
                queue = queue.then(async () => {
                    saved = await publishAgentJob(owned, job.id, job.revision, !result.ok ? {
                        status: stopping || result.code === 'cancelled' ? 'stopped' : 'failed', text: result.message,
                        error: result.message, serviceMayHaveRun: result.serviceMayHaveRun,
                        metadata: {retrievedAt: result.retrievedAt, coverage: 'provider_extraction_unavailable'}
                    } : {status: stopping ? 'stopped' : 'completed', text: result.text, serviceMayHaveRun: true,
                        metadata: {urls: [result.requestedUrl, result.url], retrievedAt: result.retrievedAt, requestId: result.requestId, coverage: result.coverage}});
                    published = true;
                });
                await queue;
                return saved;
            } finally {
                context.signal.removeEventListener('abort', stop);
                await queue.catch(() => undefined);
            }
        },
    }),
];
