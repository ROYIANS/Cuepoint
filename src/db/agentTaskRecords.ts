import {
    inspectTaskGenerationOutput,
    ownedTaskGenerationJob,
    PICTURE_GENERATION_TOOLS,
    provesCompletedGeneration,
    taskGenerationToolSource
} from "./taskGenerationEvidence";
import {db} from "./database";
import {editableAgentTask} from "./agentTaskGuards";
import type {AgentTaskRecord, TaskRecordInput, TaskRecordSource} from "@/domain/agentTaskRecords";
import {TASK_RECORD_CLAIMS, TASK_RECORD_KINDS} from "@/domain/agentTaskRecords";
import type {AgentTask, AgentToolCall} from "@/domain/agent";
import {createId, nowIso} from "@/lib/ids";
import {targetRevision} from "@/lib/productionRevision";
import {
    ownedTaskAudioGenerationJob,
    SOUND_GENERATION_TOOLS,
    taskAudioGenerationSource,
    taskAudioToolSource
} from "./taskAudioGenerationEvidence";

export async function listTaskRecords(taskId: string): Promise<AgentTaskRecord[]> {
    return db.agentTaskRecords.where("taskId").equals(taskId).sortBy("updatedAt");
}

export async function listTaskRecordVersions(taskId: string, recordId: string) {
    const record = await db.agentTaskRecords.get(recordId);
    if (!record || record.taskId !== taskId) throw new Error("记录不属于当前任务");
    return db.agentTaskRecordVersions.where("recordId").equals(recordId).sortBy("revision");
}

/** A completed ledger entry may describe a failed remote job or an apply conflict. */
export function provesCompletedEffect(call: AgentToolCall): boolean {
    if ((PICTURE_GENERATION_TOOLS as readonly string[]).includes(call.name)) return provesCompletedGeneration(call);
    let value: unknown;
    try {
        value = JSON.parse(call.result ?? "null");
    } catch {
        return false;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const result = value as Record<string, unknown>;
    if (result.error || result.ok === false || result.success === false) return false;
    // Other network tools can report a check without producing a business result.
    return call.effect === "write" && result.applied !== false;
}

export async function validateTaskSources(task: Pick<AgentTask, "id" | "threadId">, sources: TaskRecordSource[], claim: TaskRecordInput["claim"], author: "ai" | "user") {
    if (!Array.isArray(sources) || sources.length > 12) throw new Error("来源最多 12 项");
    let userEvidence = false, completedEffect = false;
    for (const source of sources) {
        if (!source.id || source.id.length > 120) throw new Error("来源标识无效");
        if (source.resultKey !== undefined && (source.type !== "generation" || typeof source.resultKey !== "string" || !source.resultKey.trim() || source.resultKey.length > 512)) throw new Error("结果键只能用于声音生成来源，且最多 512 字");
        if (source.type === "message") {
            const message = await db.chatMessages.get(source.id);
            if (!message || message.threadId !== task.threadId || message.role !== "user" || (!message.content.trim() && !message.attachments?.length)) throw new Error("只能引用当前对话真实的用户消息");
            userEvidence = true;
        } else if (source.type === "tool") {
            const call = await db.agentToolCalls.get(source.id);
            const run = call && await db.agentRuns.get(call.runId);
            if (!call || !run || call.threadId !== task.threadId || run.threadId !== task.threadId || run.taskId !== task.id || call.status !== "completed" || !call.result || call.effect === "bookkeeping") throw new Error("来源不是当前任务已完成的业务工具结果");
            if ((SOUND_GENERATION_TOOLS as readonly string[]).includes(call.name)) {
                const evidence = await Promise.resolve(taskAudioToolSource(task, call));
                completedEffect ||= evidence?.supportsResult === true;
            } else if ((PICTURE_GENERATION_TOOLS as readonly string[]).includes(call.name)) {
                const evidence = await Promise.resolve(taskGenerationToolSource(task, call));
                completedEffect ||= evidence?.supportsResult === true;
            } else completedEffect ||= provesCompletedEffect(call);
        } else if (source.type === "generation") {
            const evidence = await Promise.resolve(taskGenerationSource(task, source.id, source.resultKey));
            completedEffect ||= evidence.supportsResult;
        } else throw new Error("来源类型无效");
    }
    if (author === "ai" && claim === "decision" && !userEvidence) throw new Error("确认决策必须引用用户消息");
    if (author === "ai" && claim === "result" && !completedEffect) throw new Error("完成结果必须引用已完成的实际业务操作");
    if (author === "ai" && claim === "observation" && sources.length === 0) throw new Error("调研观察必须附真实来源；未核实内容请记为方案或待解决问题");
}

/** Transaction-internal write, shared by guarded manual saves and ledger-atomic tools. */
export async function writeTaskRecord(task: AgentTask, input: TaskRecordInput, options: {
    id?: string;
    expectedRevision?: number;
    author: "user" | "ai";
    runId?: string;
    requirementSnapshot?: boolean
}): Promise<AgentTaskRecord> {
    if (task.lifecycle !== "open") throw new Error("请先重新打开任务");
    if (!TASK_RECORD_KINDS.includes(input.kind) || !TASK_RECORD_CLAIMS.includes(input.claim) || !input.title.trim() || input.title.length > 120 || !input.body.trim() || input.body.length > (options.requirementSnapshot ? 100_000 : 12_000)) throw new Error("记录类型或内容无效：标题最多 120 字，正文最多 12,000 字");
    if (input.todoId && !task.plan.some((item) => item.id === input.todoId)) throw new Error("关联 Todo 不存在");
    await Promise.resolve(validateTaskSources(task, input.sources, input.claim, options.author));
    const existing = options.id ? await db.agentTaskRecords.get(options.id) : undefined;
    if (options.id && (!existing || existing.taskId !== task.id)) throw new Error("记录不属于当前任务");
    if (existing && options.expectedRevision !== existing.revision) throw new Error("记录已更新，请重新读取后修改");
    if (!existing && options.expectedRevision !== undefined) throw new Error("新记录不应指定旧版本");
    if (!existing && options.runId) {
        const duplicate = (await listTaskRecords(task.id)).find((record) => record.runId === options.runId && record.author === options.author && record.kind === input.kind && record.claim === input.claim && record.title === input.title.trim() && record.body === input.body.trim() && record.todoId === input.todoId && JSON.stringify(record.sources) === JSON.stringify(input.sources));
        if (duplicate) return duplicate;
    }
    const at = nowIso();
    const record: AgentTaskRecord = {
        ...input,
        title: input.title.trim(),
        body: input.body.trim(),
        id: existing?.id ?? createId("trec"),
        taskId: task.id,
        revision: (existing?.revision ?? 0) + 1,
        author: options.author,
        runId: options.runId,
        createdAt: existing?.createdAt ?? at,
        updatedAt: at
    };
    await db.agentTaskRecords.put(record);
    await db.agentTaskRecordVersions.add({
        ...record,
        recordId: record.id,
        versionId: `${record.id}:${record.revision}`
    });
    await db.agentTasks.update(task.id, {updatedAt: at});
    return record;
}

export async function saveTaskRecord(taskId: string, input: TaskRecordInput, options: {
    id?: string;
    expectedRevision?: number
} = {}): Promise<AgentTaskRecord> {
    return db.transaction("rw", db.tables, async () => writeTaskRecord(await editableAgentTask(taskId), input, {
        ...options,
        author: "user"
    }));
}

/** Genuine generation evidence is owned by the task and reflects current local media/slot state. */
export async function taskGenerationSource(task: Pick<AgentTask, "id" | "threadId">, jobId: string, resultKey?: string) {
    const soundJob = await db.audioGenerationJobs.get(jobId);
    if (soundJob) return taskAudioGenerationSource(task, soundJob, resultKey);
    if (resultKey !== undefined) throw new Error("结果键只能用于声音生成来源");
    const job = await db.agentGenerationJobs.get(jobId);
    if (!job || !job.batchId || !await Promise.resolve(ownedTaskGenerationJob(task, job))) throw new Error("生成结果不属于当前任务批次");
    const {available, applied} = await Promise.resolve(inspectTaskGenerationOutput(job));
    return {
        id: job.id,
        resultKey: undefined,
        batchId: job.batchId,
        status: job.status,
        result: job.result,
        label: `${job.kind === 'image' ? '图片' : '视频'} · ${job.model}`,
        available,
        applied,
        supportsResult: available,
        body: JSON.stringify({
            jobId: job.id,
            batchId: job.batchId,
            status: job.status,
            target: job.target,
            result: available ? job.result : undefined,
            available,
            applied,
            error: job.error
        })
    };
}

/** Keep legacy aggregate catalog IDs; hash exact result keys to fit the existing source-ID bound. */
export function taskGenerationEvidenceId(jobId: string, resultKey?: string): string {
    return resultKey === undefined ? `generation:${jobId}` : `generation:${jobId}:result:${targetRevision(resultKey)}`;
}

/** Shared source inventory; no remote refresh and no attribution to reading runs. */
export async function listTaskGenerationSourceInventory(task: AgentTask, options: {offset?: number; limit?: number} = {}) {
    return db.transaction("r", db.tables, async () => {
        const identities: Array<{id: string; resultKey?: string}> = [];
        const runs = await db.agentRuns.where("taskId").equals(task.id).toArray();
        const runIds = new Set(runs.filter(run => run.threadId === task.threadId).map(run => run.id));
        const jobs = await db.agentGenerationJobs.where("threadId").equals(task.threadId).toArray();
        for (const job of jobs.filter(job => job.batchId && runIds.has(job.runId))) {
            if (await Promise.resolve(ownedTaskGenerationJob(task, job))) identities.push({id: job.id});
        }
        const soundJobs = await db.audioGenerationJobs.where("projectId").equals(task.projectId).toArray();
        for (const job of soundJobs) {
            if (!await Promise.resolve(ownedTaskAudioGenerationJob(task, job))) continue;
            identities.push({id: job.id});
            const counts = new Map<string, number>();
            for (const result of job.results) counts.set(result.key, (counts.get(result.key) ?? 0) + 1);
            for (const result of job.results) {
                if (counts.get(result.key) === 1 && result.key.trim() && result.key.length <= 512) identities.push({id: job.id, resultKey: result.key});
            }
        }
        const offset = Math.max(0, options.offset ?? 0), limit = Math.min(100, Math.max(1, options.limit ?? 100));
        const sources: Awaited<ReturnType<typeof taskGenerationSource>>[] = [];
        for (const identity of identities.slice(offset, offset + limit)) sources.push(await Promise.resolve(taskGenerationSource(task, identity.id, identity.resultKey)));
        return {sources, coverage: {
            total: identities.length, included: sources.length, omitted: identities.length - sources.length,
            offset, nextOffset: offset + sources.length < identities.length ? offset + sources.length : null
        }};
    });
}

/** Compatibility array view. New consumers use the explicit coverage-bearing inventory. */
export async function listTaskGenerationSources(task: AgentTask) {
    return (await listTaskGenerationSourceInventory(task)).sources;
}
