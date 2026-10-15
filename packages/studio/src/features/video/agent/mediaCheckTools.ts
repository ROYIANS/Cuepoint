import {z} from 'zod';
import {db as productDb} from '../../../platform/product/store';
import {binaryAvailability} from '../../../platform/storage/binary';
import {binaryByteLength} from '../../../platform/media/binaryTypes';
import type {ProductStore} from '../../../platform/storage/types';
import {StorageError} from '../../../platform/storage/errors';
import type {MediaRecord} from '../../library/models/media';
import {getProjectKind} from '../../projects/models/project';
import type {AgentJobMediaSelection, AgentJobObservation} from '../../agent/models/agentJob';
import type {AgentJob, AgentJobResult} from '../../agent/models/agentJob';
import type {AgentToolContext} from '../../agent/runtime/tools';
import {defineTool} from '../../agent/runtime/toolDefinition';
import {requireBoundProjectScope, frozenProjectScope} from '../../agent/runtime/projectScope';
import {ToolPendingError} from '../../agent/runtime/toolErrors';
import {admitAgentJob, markAgentJobRunning, stopAgentJob, checkpointAgentJob, publishAgentJob} from '../../agent/commands/agentJobs';

const mediaSchema = z.object({mediaIds: z.array(z.string().min(1).max(160)).max(64).optional()}).strict()
    .refine(args => !args.mediaIds || new Set(args.mediaIds).size === args.mediaIds.length, '素材标识必须唯一');
const MAX_ITEM_BYTES = 512 * 1024 * 1024;
const MAX_SELECTION_BYTES = 2 * 1024 * 1024 * 1024;

function selectionItem(media: MediaRecord): AgentJobMediaSelection {
    const size = binaryByteLength(media.blob);
    return {id: media.id, name: media.filename, mimeType: media.mimeType, size,
        // This is a metadata revision. It is not a hash of the retained bytes.
        revision: JSON.stringify([media.filename, media.mimeType, size])};
}

async function selectMedia(context: AgentToolContext, mediaIds?: string[]) {
    const db = context.store ?? productDb;
    return db.transaction('r', [db.agentRuns, db.chatThreads, db.projects, db.media], async tx => {
        const projectId = await requireBoundProjectScope(context, undefined, tx);
        const project = (await tx.projects.get(projectId))!;
        if (getProjectKind(project) !== 'video') throw new Error('此检查用于当前绑定的视频项目');
        const media = mediaIds ? await tx.media.bulkGet(mediaIds) :
            (await tx.media.where('projectId').equals(projectId).toArray()).filter(item => item.mimeType.startsWith('video/'));
        if (media.length > 64) throw new Error('一次最多检查 64 个视频，请明确选择部分素材');
        const selected: {record: MediaRecord; item: AgentJobMediaSelection}[] = [];
        let total = 0;
        for (const record of media) {
            if (!record || record.projectId !== projectId || !record.mimeType.startsWith('video/')) throw new Error('所选视频不存在或不属于当前项目，检查尚未开始');
            const item = selectionItem(record);
            if (!Number.isSafeInteger(item.size) || item.size < 0 || item.size > MAX_ITEM_BYTES) throw new Error('每个视频最多 512 MiB，请选择较小的素材');
            total += item.size;
            selected.push({record, item});
        }
        if (total > MAX_SELECTION_BYTES) throw new Error('一次检查的视频合计最多 2 GiB，请缩小选择范围');
        return {projectId, selected};
    });
}

async function unchanged(context: AgentToolContext, projectId: string, selected: AgentJobMediaSelection, db: ProductStore): Promise<boolean> {
    return db.transaction('r', [db.agentRuns, db.chatThreads, db.projects, db.agentToolCalls, db.media], async tx => {
        if (await frozenProjectScope(context, tx) !== projectId) throw new Error('视频检查的项目归属已变化');
        const [run, call] = await Promise.all([tx.agentRuns.get(context.runId), tx.agentToolCalls.get(context.callId)]);
        if (run?.status !== 'running' || call?.status !== 'running' || call.runId !== context.runId || call.threadId !== context.threadId) throw new Error('视频检查执行归属已失效');
        const current = await tx.media.get(selected.id);
        return !!current && current.projectId === projectId && selectionItem(current).revision === selected.revision;
    });
}

async function inspect(context: AgentToolContext, projectId: string, selected: {record: MediaRecord; item: AgentJobMediaSelection}, db: ProductStore): Promise<AgentJobObservation> {
    if (!await unchanged(context, projectId, selected.item, db)) return {mediaId: selected.item.id, status: 'changed', detail: '素材已删除、变更或不再属于当前项目，未读取'};
    let observation: AgentJobObservation;
    try {
        // The current native availability operation has no cancellation handle.
        // Deliberately drain this one await; the producer stops before the next.
        const status = await binaryAvailability(selected.record.blob);
        observation = {mediaId: selected.item.id, status, detail: selected.record.blob instanceof Blob ?
            '浏览器保留的 Blob 可用；未验证哈希、编码或视频内容' : '托管素材可用性检查；未解码或观看视频'};
    } catch {
        observation = {mediaId: selected.item.id, status: 'read_error', detail: '素材读取检查失败；没有重试'};
    }
    if (!await unchanged(context, projectId, selected.item, db)) return {mediaId: selected.item.id, status: 'changed', detail: '检查期间素材已删除、变更或不再属于当前项目'};
    return observation;
}

async function executeMediaCheck(args: z.infer<typeof mediaSchema>, context: AgentToolContext): Promise<AgentJobResult> {
    const db = context.store ?? productDb;
    const {projectId, selected} = await selectMedia(context, args.mediaIds);
    const owned = {...context, projectId, store: db};
    const selection = {kind: 'project_media_check' as const, media: selected.map(value => value.item)};
    context.signal.throwIfAborted();
    const admitted = await admitAgentJob(owned, selection).catch((cause: unknown) => {
        if (cause instanceof StorageError && cause.certainty === 'unknown') throw new ToolPendingError('无法确认视频检查是否已受理，请先核对已有报告；不会自动重新检查。', {cause});
        throw cause;
    });
    if (!admitted.admitted) {
        if (admitted.result) return admitted.result;
        throw new ToolPendingError('已有检查的结果尚未确认，不会重复读取素材；请先核对已保存报告。');
    }
    let job = admitted.job;
    let queue: Promise<void> = Promise.resolve();
    let stopping = false, published = false;
    const update = (operation: (current: AgentJob) => Promise<AgentJob>) => {
        queue = queue.then(async () => {job = await operation(job);});
        return queue;
    };
    const stop = () => {
        if (stopping || published) return;
        stopping = true;
        // One producer queue orders Stop with acknowledged checkpoints/publication.
        // The attached catch prevents an unhandled listener promise; the owning
        // invocation still awaits the same rejected queue before any next item.
        void update(current => stopAgentJob(owned, current.id)).catch(() => undefined);
    };
    try {
        job = await markAgentJobRunning(owned, job.id, job.revision);
        context.signal.addEventListener('abort', stop, {once: true});
        if (context.signal.aborted) stop();
        for (const item of selected) {
            await queue;
            if (context.signal.aborted) break;
            const observation = await inspect(context, projectId, item, db);
            await update(current => checkpointAgentJob(owned, current.id, current.revision, {completed: current.completed + 1, observation}));
        }
        await queue;
        for (const observation of [...job.observations]) {
            const item = selection.media.find(value => value.id === observation.mediaId)!;
            if (!await unchanged(context, projectId, item, db) && observation.status !== 'changed') {
                await update(current => checkpointAgentJob(owned, current.id, current.revision, {completed: current.completed,
                    observation: {mediaId: item.id, status: 'changed', detail: '报告保存前素材已删除、变更或不再属于当前项目'}}));
            }
        }
        let result!: AgentJobResult;
        queue = queue.then(async () => {
            result = await publishAgentJob(owned, job.id, job.revision, {status: stopping ? 'stopped' : 'completed',
                // The publication owner renders findings after its own final
                // source checks, in the same transaction as chunks/completion.
                metadata: {coverage: 'selected_video_availability'}});
            published = true;
        });
        await queue;
        return result;
    } catch (cause) {
        // A read-only backend does not make an uncertain local publication safe
        // to repeat. Core reconciles an already completed call before parking it.
        throw new ToolPendingError('视频检查的保存结果尚未确认，请先核对已有报告；不会自动重新检查。', {cause});
    } finally {
        context.signal.removeEventListener('abort', stop);
        await queue.catch(() => undefined);
    }
}

export const MEDIA_CHECK_TOOLS = [defineTool({schema: mediaSchema, json: {
    type: 'object', additionalProperties: false, properties: {
        mediaIds: {type: 'array', maxItems: 64, uniqueItems: true, items: {type: 'string', minLength: 1, maxLength: 160}}
    }
}}, {
    name: 'project_media_check', title: '检查项目视频素材',
    description: '检查当前绑定视频项目的现有视频可用性并保存报告。省略mediaIds检查全部现有视频；明确选择最多64个，每项最多512MiB、合计2GiB。逐个检查，停止后等当前读取结束，不检查下一项。浏览器仅确认Blob可用，不证明编码、哈希或已观看。',
    effect: 'read', highRisk: () => false,
    execute: executeMediaCheck
})];
