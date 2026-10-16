import {createId, nowIso} from '../../../platform/identity';
import {targetRevision} from '../../../platform/data/revision';
import {binaryByteLength} from '../../../platform/media/binaryTypes';
import {db as productDb} from '../../../platform/product/store';
import {StorageError} from '../../../platform/storage/errors';
import type {ProductStore} from '../../../platform/storage/types';
import {toolNamesForCall} from '../models/agentToolSelection';
import type {AgentToolCall} from '../models/agent';
import type {AgentJob, AgentJobObservation, AgentJobOutputMetadata, AgentJobPage, AgentJobReader, AgentJobResult, AgentJobResultChunk, AgentJobSelection} from '../models/agentJob';
import {parseMcpBinding, mcpBindingMatches} from '../mcp/runtime/manifest';
import {mcpJson, mcpKeys, mcpRecord} from '../mcp/runtime/validation';
import {assertThreadOwnership, type ThreadOwnership} from '../runtime/runOwnership';

export const AGENT_JOB_LIMITS = {outputBytes: 2 * 1024 * 1024, threadBytes: 16 * 1024 * 1024,
    totalBytes: 128 * 1024 * 1024, threadJobs: 128, totalJobs: 1024, metadataUnits: 16000,
    previewUnits: 8000, pageUnits: 6000} as const;
export interface AgentJobContext {runId: string; threadId: string; callId: string; projectId?: string; store?: ProductStore}
/** Known pre-producer quota refusal; does not classify storage/commit uncertainty. */
export class AgentJobAdmissionError extends Error {
    constructor(readonly kind: 'byte_quota' | 'job_limit') {
        super(kind === 'job_limit' ? '报告记录数量已满，请删除不再需要的所属对话或项目以释放记录' : '报告存储空间已满，请先清理不再需要的结果');
        this.name = 'AgentJobAdmissionError';
    }
}
const terminal = (job: AgentJob) => ['completed', 'stopped', 'failed', 'unknown'].includes(job.status);
class JobUnavailableError extends Error {}
const tables = (db: ProductStore) => [db.media, db.agentJobs, db.agentJobResultChunks, db.agentRuns, db.agentToolCalls, db.chatThreads, db.chatMessages, db.projects];
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const envelope = (call: AgentToolCall) => targetRevision({runId: call.runId, threadId: call.threadId, name: call.name,
    binding: call.binding, arguments: call.arguments, step: call.step, effect: call.effect, highRisk: call.highRisk, atomic: call.atomic,
    recovery: call.recovery, requiresConfirmation: call.requiresConfirmation, preview: call.preview,
    decision: call.decision, decidedAt: call.decidedAt, generationOverride: call.generationOverride});
function boundary(text: string, offset: number): number {
    const n = Math.max(0, Math.min(text.length, offset));
    return n > 0 && n < text.length && /[\uD800-\uDBFF]/.test(text[n - 1]) && /[\uDC00-\uDFFF]/.test(text[n]) ? n - 1 : n;
}
function boundedJson<T extends {text?: string; output?: {preview: string}}>(value: T): T {
    while (JSON.stringify(value).length > AGENT_JOB_LIMITS.metadataUnits) {
        const text = value.output?.preview ?? value.text;
        if (!text?.length) throw new Error('报告元数据超过保存限制');
        const shortened = text.slice(0, boundary(text, Math.max(0, text.length - 1000)));
        if (value.output) value.output.preview = shortened; else value.text = shortened;
    }
    return value;
}
type JobAccess = AgentJobReader & Partial<Pick<AgentJobContext, 'runId' | 'callId'>>;
async function owner(reader: JobAccess, db: ProductStore, current = false) {
    const thread = await db.chatThreads.get(reader.threadId);
    if (!thread || thread.projectId !== reader.projectId || reader.projectId && !await db.projects.get(reader.projectId)) throw new JobUnavailableError('报告所属对话或项目已不存在或变化');
    const identity = current ? {runId: reader.runId, callId: reader.callId} : reader.caller;
    if (!identity?.runId || !identity.callId) {if (current || !reader.original) throw new JobUnavailableError('报告操作缺少执行身份'); return undefined;}
    const run = await db.agentRuns.get(identity.runId), call = await db.agentToolCalls.get(identity.callId);
    const message = run && await db.chatMessages.get(run.assistantMessageId);
    if (!run || run.threadId !== thread.id || run.projectId !== thread.projectId || !message || message.threadId !== thread.id || message.runId !== run.id ||
        !call || call.runId !== run.id || call.threadId !== thread.id || call.step !== (run.modelStep ?? 1) || run.status !== 'running' || !['running', 'completed'].includes(call.status) ||
        !toolNamesForCall(run, call.step).includes(call.name)) throw new JobUnavailableError('报告执行归属或可用范围已变化');
    return {run, call};
}
async function ownedJob(reader: JobAccess, id: string, db: ProductStore, current = false): Promise<AgentJob> {
    const caller = await owner(reader, db, current), job = await db.agentJobs.get(id);
    if (!job || job.threadId !== reader.threadId || job.projectId !== reader.projectId || reader.original && (job.runId !== reader.original.runId || job.callId !== reader.original.callId)) throw new JobUnavailableError('报告不可用');
    const run = await db.agentRuns.get(job.runId), call = await db.agentToolCalls.get(job.callId);
    if (!run || run.threadId !== job.threadId || run.projectId !== job.projectId || !call || call.runId !== run.id || call.threadId !== job.threadId ||
        !selectionMatchesCall(job.selection, call) || envelope(call) !== job.callRevision || current && (caller?.call.id !== call.id || caller.run.id !== run.id)) throw new JobUnavailableError('报告原始调用或范围已变化');
    return job;
}
/** Job kinds are finite; an MCP public tool name is a separate captured identity. */
export function selectionMatchesCall(selection: AgentJobSelection, call: AgentToolCall): boolean {
    if (selection.kind !== 'mcp') return call.name === selection.kind;
    const facts = selection.execution;
    return facts.publicName === call.name && selection.operationId === call.id &&
        call.binding?.capabilityId === `mcp/${facts.binding.serverId}` && call.binding.version === facts.manifestDigest &&
        call.binding.registrationId === facts.binding.registrationId &&
        !!call.preview?.mcp && targetRevision(call.preview.mcp) === targetRevision(facts);
}
function validateMcpSelection(selection: Extract<AgentJobSelection, {kind: 'mcp'}>): void {
    mcpJson(selection, AGENT_JOB_LIMITS.metadataUnits, 16, 128);
    mcpKeys(mcpRecord(selection), ['kind', 'execution', 'operationId']);
    const facts = selection.execution;
    mcpKeys(mcpRecord(facts), ['version', 'binding', 'manifestDigest', 'publicName', 'operation', 'target']);
    mcpKeys(mcpRecord(facts.target), facts.operation === 'tool' ? ['kind', 'rawName'] : ['kind', 'handleId']);
    const binding = parseMcpBinding(facts.binding);
    if (facts.version !== 1 || !mcpBindingMatches(binding, facts.binding) || !facts.publicName || facts.publicName.length > 64 || !facts.manifestDigest || facts.manifestDigest.length > 128 ||
        !selection.operationId || selection.operationId.length > 128 || !['tool', 'resource_read'].includes(facts.operation) ||
        facts.operation === 'tool' && (facts.target.kind !== 'tool' || !facts.target.rawName || facts.target.rawName.length > 256) ||
        facts.operation === 'resource_read' && (facts.target.kind !== 'resource' || !facts.target.handleId || facts.target.handleId.length > 128)) throw new Error('MCP 作业范围无效');
}
function validateSelection(selection: AgentJobSelection): void {
    if (JSON.stringify(selection).length > AGENT_JOB_LIMITS.metadataUnits) throw new Error('检查范围超过限制');
    if (selection.kind === 'web_read') {
        if (selection.urls.length !== 1 || selection.urls.some(url => !url || url.length > 2048)) throw new Error('网页读取范围无效');
    } else if (selection.kind === 'mcp') validateMcpSelection(selection);
    else if (selection.media.length > 64 || new Set(selection.media.map(item => item.id)).size !== selection.media.length ||
        selection.media.some(item => !item.id || !item.name || !item.mimeType.startsWith('video/') || !Number.isSafeInteger(item.size) || item.size < 0 || item.size > 512 * 1024 * 1024 || !item.revision) ||
        selection.media.reduce((total, item) => total + item.size, 0) > 2 * 1024 * 1024 * 1024) throw new Error('视频检查范围无效或超过限制');
}
function requireRevision(job: AgentJob, expected: number) {if (job.revision !== expected) throw new Error('作业状态已变化，请重新读取');}
function resultOf(job: AgentJob): AgentJobResult {
    if (!terminal(job)) throw new Error('作业尚未结束');
    return {jobId: job.id, kind: job.kind, status: job.status as AgentJobResult['status'], selected: job.selected, completed: job.completed,
        ...(job.output ? {output: job.output} : {}), ...(job.error ? {error: job.error} : {}), ...(job.serviceMayHaveRun !== undefined ? {serviceMayHaveRun: job.serviceMayHaveRun} : {})};
}

function mediaReport(job: AgentJob, observations: AgentJobObservation[]): string {
    if (job.selection.kind !== 'project_media_check') throw new Error('检查类型不匹配');
    const lines = job.selection.media.map(item => {
        const observed = observations.find(value => value.mediaId === item.id);
        return `${item.name} (${item.id}): ${observed ? observed.status : '未检查'}${observed?.detail ? ` (${observed.detail})` : ''}`;
    });
    return [`可用性检查不代表已观看或验证编码；浏览器就绪仅证明 Blob 可用，不证明内容哈希。`, `已检查 ${observations.length}/${job.selected}`, ...lines].join('\n');
}

function savedResult(call: AgentToolCall, job: AgentJob): AgentJobResult {
    if (!(call.status === 'completed' || job.kind === 'mcp' && call.status === 'unknown') || !call.result) throw new Error('原始报告完成记录不可用');
    const value: unknown = JSON.parse(call.result);
    if (!value || typeof value !== 'object' || !('jobId' in value) || value.jobId !== job.id || !('kind' in value) || value.kind !== job.kind ||
        !('status' in value) || !['completed', 'stopped', 'failed', 'unknown'].includes(String(value.status)) ||
        !('selected' in value) || typeof value.selected !== 'number' || !('completed' in value) || typeof value.completed !== 'number' || call.result.length > AGENT_JOB_LIMITS.metadataUnits) throw new Error('原始报告完成记录格式无效');
    // This exact envelope was produced by the single publication owner, and remains
    // original even after local retained chunks are explicitly cleared.
    return value as AgentJobResult;
}

/** Acknowledged admission is the only permission to start this call's producer. */
export async function admitAgentJob(context: AgentJobContext, input: AgentJobSelection): Promise<{job: AgentJob; admitted: boolean; result?: AgentJobResult}> {
    const db = context.store ?? productDb, selection = structuredClone(input); validateSelection(selection);
    const reconcile = async () => db.transaction('r', tables(db), async tx => {
        const existing = await tx.agentJobs.where('callId').equals(context.callId).first();
        if (!existing) return undefined;
        const job = await ownedJob(selection.kind === 'mcp' ? {...context, original: {runId: context.runId, callId: context.callId}} : context, existing.id, tx, selection.kind !== 'mcp');
        if (job.output?.retention !== 'cleared' && targetRevision(job.selection) !== targetRevision(selection)) throw new Error('原作业范围不可替换');
        const call = await tx.agentToolCalls.get(job.callId);
        return {job, admitted: false, ...(call && (call.status === 'completed' || job.kind === 'mcp' && call.status === 'unknown') && job.output ? {result: savedResult(call, job)} : {})};
    });
    try {
        return await db.transaction('rw', tables(db), async tx => {
            const existing = await tx.agentJobs.where('callId').equals(context.callId).first();
            if (existing) {
                const job = await ownedJob(selection.kind === 'mcp' ? {...context, original: {runId: context.runId, callId: context.callId}} : context, existing.id, tx, selection.kind !== 'mcp');
                if (job.output?.retention !== 'cleared' && targetRevision(job.selection) !== targetRevision(selection)) throw new Error('原作业范围不可替换');
                const call = (await tx.agentToolCalls.get(job.callId))!;
                return {job, admitted: false, ...((call.status === 'completed' || job.kind === 'mcp' && call.status === 'unknown') && job.output ? {result: savedResult(call, job)} : {})};
            }
            const {call} = (await owner(context, tx, true))!;
            if (call.status !== 'running' || !selectionMatchesCall(selection, call)) throw new Error('工具尚未领取或检查类型不匹配');
            if (selection.kind === 'project_media_check') {
                const project = context.projectId && await tx.projects.get(context.projectId);
                if (!project || project.kind !== undefined && project.kind !== 'video') throw new Error('检查需要当前绑定的视频项目');
                for (const selected of selection.media) {
                    const media = await tx.media.get(selected.id);
                    if (!media || media.projectId !== project.id || JSON.stringify([media.filename, media.mimeType, binaryByteLength(media.blob)]) !== selected.revision)
                        throw new Error('所选视频在受理前已经变化，请重新选择');
                }
            }
            const rows = await tx.agentJobs.toArray(), threadRows = rows.filter(row => row.threadId === context.threadId);
            if (rows.length >= AGENT_JOB_LIMITS.totalJobs || threadRows.length >= AGENT_JOB_LIMITS.threadJobs) throw new AgentJobAdmissionError('job_limit');
            if (rows.reduce((n, row) => n + row.reservedBytes, 0) + AGENT_JOB_LIMITS.outputBytes > AGENT_JOB_LIMITS.totalBytes ||
                threadRows.reduce((n, row) => n + row.reservedBytes, 0) + AGENT_JOB_LIMITS.outputBytes > AGENT_JOB_LIMITS.threadBytes) throw new AgentJobAdmissionError('byte_quota');
            const at = nowIso(), job: AgentJob = {id: createId('ajob'), threadId: context.threadId, runId: context.runId, callId: context.callId,
                projectId: context.projectId, kind: selection.kind, revision: 1, status: 'accepted', callRevision: envelope(call), selection,
                selected: selection.kind === 'project_media_check' ? selection.media.length : 1, completed: 0, observations: [],
                reservedBytes: AGENT_JOB_LIMITS.outputBytes, createdAt: at, updatedAt: at};
            await tx.agentJobs.add(job); return {job, admitted: true};
        });
    } catch (cause) {
        if (cause instanceof StorageError && cause.certainty === 'unknown') {try {const saved = await reconcile(); if (saved) return saved;} catch { /* Unknown acknowledgement stays unknown when lookup cannot establish it. */ }}
        throw cause;
    }
}

export async function markAgentJobRunning(context: AgentJobContext, jobId: string, expectedRevision: number, options: {serviceMayHaveRun?: boolean} = {}): Promise<AgentJob> {
    const db = context.store ?? productDb;
    return db.transaction('rw', tables(db), async tx => {
        const job = await ownedJob(context, jobId, tx, true); requireRevision(job, expectedRevision);
        if (job.status !== 'accepted') throw new Error('作业已经开始或结束，不可重复执行');
        const next: AgentJob = {...job, status: 'running', revision: job.revision + 1, updatedAt: nowIso(), ...(options.serviceMayHaveRun ? {serviceMayHaveRun: true} : {})};
        await tx.agentJobs.put(next); return next;
    });
}
export async function stopAgentJob(context: AgentJobContext, jobId: string): Promise<AgentJob> {
    const db = context.store ?? productDb;
    return db.transaction('rw', tables(db), async tx => {
        const job = await ownedJob(context, jobId, tx, true);
        if (terminal(job) || job.status === 'stopping') return job;
        const next: AgentJob = {...job, status: 'stopping', revision: job.revision + 1, updatedAt: nowIso()};
        await tx.agentJobs.put(next); return next;
    });
}
export async function checkpointAgentJob(context: AgentJobContext, jobId: string, expectedRevision: number, progress: {completed: number; observation?: AgentJobObservation}): Promise<AgentJob> {
    const db = context.store ?? productDb;
    return db.transaction('rw', tables(db), async tx => {
        const job = await ownedJob(context, jobId, tx, true); requireRevision(job, expectedRevision);
        if (!['running', 'stopping'].includes(job.status) || !Number.isInteger(progress.completed) || progress.completed < job.completed || progress.completed > job.selected) throw new Error('检查进度无效');
        const observations = [...job.observations];
        if (progress.observation) {
            const observation = {...progress.observation};
            if (job.selection.kind !== 'project_media_check' || !job.selection.media.some(item => item.id === observation.mediaId) || observation.detail && observation.detail.length > 500) throw new Error('检查记录不属于本次选择');
            const index = observations.findIndex(item => item.mediaId === observation.mediaId);
            if (index < 0) observations.push(observation); else observations[index] = observation;
        }
        if (job.kind === 'project_media_check' && observations.length !== progress.completed) throw new Error('检查数量与已保存记录不一致');
        const next = {...job, completed: progress.completed, observations, revision: job.revision + 1, updatedAt: nowIso()};
        await tx.agentJobs.put(next); return next;
    });
}

/** Local publication commits retained text and the original bounded completion together; never wraps producer IO. */
export async function publishAgentJob(context: AgentJobContext, jobId: string, expectedRevision: number, publication: {
    status: AgentJobResult['status']; text?: string; metadata?: AgentJobOutputMetadata; error?: string; serviceMayHaveRun?: boolean;
}, originalMcp = false): Promise<AgentJobResult> {
    const db = context.store ?? productDb;
    const publicationReader = originalMcp ? {...context, original: {runId: context.runId, callId: context.callId}} : context;
    const suppliedText = publication.text ?? '';
    // The descriptor is also serialized into the original completion. Freeze only
    // its finite JSON fields so omitted/undefined metadata has one durable shape.
    const metadata: AgentJobOutputMetadata | undefined = publication.metadata && {
        ...(publication.metadata.urls !== undefined ? {urls: [...publication.metadata.urls]} : {}),
        ...(publication.metadata.retrievedAt !== undefined ? {retrievedAt: publication.metadata.retrievedAt} : {}),
        ...(publication.metadata.requestId !== undefined ? {requestId: publication.metadata.requestId} : {}),
        ...(publication.metadata.coverage !== undefined ? {coverage: publication.metadata.coverage} : {}),
    };
    if (bytes(suppliedText) > AGENT_JOB_LIMITS.outputBytes || publication.error && publication.error.length > 1000 ||
        JSON.stringify(metadata ?? {}).length > 5000) throw new Error('报告内容超过保存限制');
    const chunks: AgentJobResultChunk[] = [];
    for (let offset = 0; offset < suppliedText.length;) {
        const end = boundary(suppliedText, offset + 12000), text = suppliedText.slice(offset, end);
        chunks.push({id: `${jobId}:${chunks.length}`, jobId, ordinal: chunks.length, offset, text, byteLength: bytes(text)}); offset = end;
    }
    try {
        return await db.transaction('rw', tables(db), async tx => {
            const job = await ownedJob(publicationReader, jobId, tx, !originalMcp), call = (await tx.agentToolCalls.get(job.callId))!;
            if (originalMcp && job.kind !== 'mcp') throw new Error('MCP 原始报告类型不匹配');
            if (call.status === 'completed' && job.output || job.kind === 'mcp' && call.status === 'unknown' && job.output && publication.status === 'unknown') return savedResult(call, job);
            const lateKnown = originalMcp && job.kind === 'mcp' && publication.status !== 'unknown' && ['running', 'unknown'].includes(call.status) && job.output?.retention !== 'cleared';
            if (job.kind === 'web_read' && typeof publication.text !== 'string') throw new Error('网页报告缺少正文');
            if (!lateKnown) requireRevision(job, expectedRevision);
            if (!lateKnown && (terminal(job) || call.status !== 'running' || job.status === 'stopping' && publication.status === 'completed')) throw new Error('作业已经结束或停止');
            if (!lateKnown && publication.status === 'completed' && job.completed !== job.selected) throw new Error('检查覆盖尚未完成');
            // Publication rechecks the same frozen metadata inside its write snapshot.
            // These textual observations do not claim a browser byte/hash identity.
            const observations = [...job.observations];
            if (job.selection.kind === 'project_media_check') for (const selected of job.selection.media) {
                const index = observations.findIndex(item => item.mediaId === selected.id);
                if (index < 0) continue;
                const media = await tx.media.get(selected.id);
                const size = media && binaryByteLength(media.blob);
                if (!media || media.projectId !== job.projectId || JSON.stringify([media.filename, media.mimeType, size]) !== selected.revision)
                    observations[index] = {mediaId: selected.id, status: 'changed', detail: '素材已删除或发生变化'};
            }
            const retainedText = job.kind === 'project_media_check'
                ? mediaReport(job, observations)
                : suppliedText;
            const savedChunks = job.kind === 'project_media_check' ? [{id: `${jobId}:0`, jobId, ordinal: 0, offset: 0, text: retainedText, byteLength: bytes(retainedText)}] : chunks;
            const revision = job.revision + 1;
            const next: AgentJob = {...job, ...(lateKnown && publication.status === 'completed' ? {completed: job.selected} : {}), observations, status: publication.status, revision, reservedBytes: bytes(retainedText), updatedAt: nowIso(),
                error: publication.error, serviceMayHaveRun: publication.serviceMayHaveRun ?? job.serviceMayHaveRun,
                output: {version: 1, jobId, revision, retention: 'retained', length: retainedText.length, byteLength: bytes(retainedText),
                    preview: retainedText.slice(0, boundary(retainedText, AGENT_JOB_LIMITS.previewUnits)), ...(metadata ? {metadata} : {})}};
            const result = boundedJson(resultOf(next)); next.output = result.output;
            if (lateKnown) await tx.agentJobResultChunks.where('jobId').equals(jobId).delete();
            await tx.agentJobResultChunks.bulkAdd(savedChunks);
            await tx.agentJobs.put(next);
            await tx.agentToolCalls.update(call.id, {status: job.kind === 'mcp' && publication.status === 'unknown' ? 'unknown' : 'completed', result: JSON.stringify(result), error: job.kind === 'mcp' && publication.status === 'unknown' ? '外部操作结果待核实，不会自动重试。' : undefined, updatedAt: nowIso()});
            return result;
        });
    } catch (cause) {
        if (cause instanceof StorageError && cause.certainty === 'unknown') {
            try {
                const saved = await db.transaction('r', tables(db), async tx => {
                    const job = await ownedJob(publicationReader, jobId, tx, !originalMcp), call = await tx.agentToolCalls.get(context.callId);
                    return call && (call.status === 'completed' || job.kind === 'mcp' && call.status === 'unknown') && job.output ? savedResult(call, job) : undefined;
                });
                if (saved) return saved;
            } catch { /* An unreadable completion cannot establish rollback or permission to replay. */ }
        }
        throw cause;
    }
}

export async function readAgentJob(reader: AgentJobReader, jobId: string, store?: ProductStore): Promise<AgentJob | undefined> {
    const db = store ?? productDb;
    return db.transaction('r', tables(db), async tx => {
        try {return await ownedJob(reader, jobId, tx);} catch (cause) {if (cause instanceof JobUnavailableError) return undefined; throw cause;}
    });
}
export async function readAgentJobPage(reader: AgentJobReader, jobId: string, offset = 0, limit: number = AGENT_JOB_LIMITS.pageUnits, store?: ProductStore): Promise<AgentJobPage> {
    const db = store ?? productDb;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > AGENT_JOB_LIMITS.pageUnits) throw new Error('报告分页范围无效');
    return db.transaction('r', tables(db), async tx => {
        let job: AgentJob;
        try {job = await ownedJob(reader, jobId, tx);} catch (cause) {if (cause instanceof JobUnavailableError) return {available: false, reason: 'unavailable'}; throw cause;}
        if (!terminal(job) || !job.output || job.output.retention === 'cleared') return {available: false, reason: job.output?.retention === 'cleared' ? 'cleared' : 'unavailable'};
        const original = await tx.agentToolCalls.get(job.callId);
        if (!original || !(original.status === 'completed' || job.kind === 'mcp' && original.status === 'unknown') || !original.result) return {available: false, reason: 'unavailable'};
        if (targetRevision(savedResult(original, job).output) !== targetRevision(job.output)) throw new Error('报告完成记录与保存内容不一致');
        const chunks = (await tx.agentJobResultChunks.where('jobId').equals(jobId).toArray()).sort((a, b) => a.ordinal - b.ordinal);
        let expectedOffset = 0;
        for (const [ordinal, chunk] of chunks.entries()) {
            if (chunk.ordinal !== ordinal || chunk.offset !== expectedOffset || chunk.byteLength !== bytes(chunk.text)) throw new Error('已保存报告分段不完整');
            expectedOffset += chunk.text.length;
        }
        const text = chunks.map(chunk => chunk.text).join('');
        if (text.length !== job.output.length || bytes(text) !== job.output.byteLength) throw new Error('已保存报告不完整');
        const start = boundary(text, offset), end = boundary(text, start + limit);
        if (start < text.length && end === start) throw new Error('分页长度不足以容纳当前字符，请使用至少 2 个字符');
        const page = boundedJson({available: true as const, jobId, revision: job.output.revision, status: job.status as AgentJobResult['status'], offset: start,
            text: text.slice(start, end), length: text.length, byteLength: job.output.byteLength, selected: job.selected, completed: job.completed});
        const nextOffset = start + page.text.length;
        return {...page, ...(nextOffset < text.length ? {nextOffset} : {})};
    });
}
function clearedSelection(selection: AgentJobSelection): AgentJobSelection {
    if (selection.kind === 'mcp') return selection;
    return selection.kind === 'web_read' ? {kind: 'web_read', urls: []} : {kind: 'project_media_check', media: []};
}
export async function clearAgentJobResult(reader: AgentJobReader, jobId: string, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction('rw', tables(db), async tx => {
        const job = await ownedJob(reader, jobId, tx);
        if (!terminal(job)) throw new Error('请先停止作业，再清理结果');
        await tx.agentJobResultChunks.where('jobId').equals(jobId).delete();
        await tx.agentJobs.put({...job, reservedBytes: 0, observations: [], selection: clearedSelection(job.selection),
            revision: job.revision + 1, output: {version: 1, jobId, revision: job.revision + 1, retention: 'cleared', length: 0, byteLength: 0, preview: ''}, updatedAt: nowIso()});
    });
}

/** Existing exclusive thread recovery only; no producer/model dispatch, no timeout-based lease. */
export async function recoverAgentJobs(threadId: string, ownership: ThreadOwnership, store?: ProductStore): Promise<void> {
    assertThreadOwnership(ownership, threadId);
    const db = store ?? productDb;
    await db.transaction('rw', tables(db), async tx => {
        assertThreadOwnership(ownership, threadId);
        const jobs = await tx.agentJobs.where('threadId').equals(threadId).toArray();
        for (const job of jobs) {
            if (terminal(job)) continue;
            const call = await tx.agentToolCalls.get(job.callId), run = await tx.agentRuns.get(job.runId), thread = await tx.chatThreads.get(threadId);
            if (!call || !run || !thread || run.threadId !== threadId || call.runId !== run.id || call.threadId !== threadId || thread.projectId !== job.projectId || run.projectId !== job.projectId ||
                job.projectId && !await tx.projects.get(job.projectId) || envelope(call) !== job.callRevision) continue;
            assertThreadOwnership(ownership, threadId);
            if (call.status === 'completed') continue;
            if (job.kind === 'mcp' && job.status === 'accepted' && !job.serviceMayHaveRun) {
                // The producer requires an acknowledged running transition first.
                // A durable accepted row therefore cannot have issued its invocation.
                await publishAgentJob({runId: run.id, threadId, callId: call.id, projectId: job.projectId, store: tx}, job.id, job.revision,
                    {status: 'stopped', text: '此调用在访问外部服务之前中断，未自动重试。', serviceMayHaveRun: false}, true);
            } else if (job.kind === 'mcp' || job.kind === 'web_read' && job.serviceMayHaveRun) {
                await tx.agentJobs.put({...job, status: 'unknown', error: '服务可能已经执行，未收到可确认的完整结果；不会自动重新请求。', revision: job.revision + 1, updatedAt: nowIso()});
                await tx.agentToolCalls.update(call.id, {status: 'unknown', error: '服务可能已经执行，请核对后发起新请求，不能自动重跑。', updatedAt: nowIso()});
            } else {
                // Reuse the same local publication transaction after re-establishing a conservative current owner.
                const context = {runId: run.id, threadId, callId: call.id, projectId: job.projectId, store: tx};
                if (run.status !== 'running' || call.status !== 'running') continue;
                await publishAgentJob(context, job.id, job.revision, {status: 'stopped', ...(job.kind === 'web_read' ? {text: ''} : {}), error: '上次检查已中断，仅保留已确认的检查记录。'});
            }
        }
        assertThreadOwnership(ownership, threadId);
    });
}
