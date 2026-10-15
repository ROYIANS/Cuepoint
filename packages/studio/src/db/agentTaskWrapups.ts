import type {ProductStore} from "../lib/storage/types";
import {db as productDb} from "./database";
import {isTaskBusy} from "../lib/agent/taskState";
import {collectWrapupSnapshot} from "../lib/agent/wrapupEvidence";
import {emptyWrapupContent, validateWrapupContent} from "../lib/agent/wrapupSchema";
import type {AgentTask} from "../domain/agent";
import type {AgentTaskWrapup, TaskWrapupState, WrapupContent} from "../domain/agentTaskWrapup";
import {createId, nowIso} from "../lib/ids";
import {ownedTaskAudioGenerationJob} from "./taskAudioGenerationEvidence";
import {readAudioGenerationBatch} from "./audioGenerationBatches";

async function owned(taskId: string, store?: ProductStore) {
    const db = store ?? productDb;
    const task = await db.agentTasks.get(taskId);
    if (!task || !await db.chatThreads.get(task.threadId)) throw new Error('任务或关联对话不存在');
    return task;
}

async function ready(taskId: string, except?: string, store?: ProductStore) {
    const db = store ?? productDb;
    const task = await owned(taskId, db);
    if (!task.projectId || !await db.projects.get(task.projectId)) throw new Error('关联项目已不存在，无法整理总结');
    if (task.lifecycle !== 'open') throw new Error('请先重新打开任务');
    if (isTaskBusy(await db.agentRuns.where('threadId').equals(task.threadId).toArray())) throw new Error('请先处理当前执行，再整理总结');
    if ((await db.agentTaskWrapups.where('taskId').equals(taskId).toArray()).some(w => w.status === 'preparing' && w.id !== except)) throw new Error('总结正在整理，请先等待或停止');
    return task;
}

async function saveVersion(record: AgentTaskWrapup, store?: ProductStore) {
    const db = store ?? productDb;
    await db.agentTaskWrapups.put(record);
    await db.agentTaskWrapupVersions.add({...record, versionId: `${record.id}:${record.revision}`});
    return record;
}

async function recordFor(taskId: string, id: string, revision: number, store?: ProductStore) {
    const db = store ?? productDb;
    const task = await owned(taskId, db), record = await db.agentTaskWrapups.get(id);
    if (!record || record.taskId !== taskId || record.threadId !== task.threadId) throw new Error('总结不属于当前任务');
    if (record.revision !== revision) throw new Error('总结已更新，请重新读取后操作');
    const latest = (await db.agentTaskWrapups.where('taskId').equals(taskId).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
    if (latest?.id !== record.id) throw new Error('已有新的总结草稿，请重新读取；当前编辑内容仍可保留');
    return {task, record};
}

export async function getTaskWrapupState(taskId: string, store?: ProductStore): Promise<TaskWrapupState> {
    const db = store ?? productDb;
    return db.transaction('r', db.tables, async (db) => {
        const task = await owned(taskId, db), snapshot = await collectWrapupSnapshot(task, true, db);
        const records = (await db.agentTaskWrapups.where('taskId').equals(taskId).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const latest = records.at(-1),
            confirmed = records.filter(w => !!w.confirmedAt).sort((a, b) => a.confirmedAt!.localeCompare(b.confirmedAt!) || a.createdAt.localeCompare(b.createdAt)).at(-1);
        const history = (await db.agentTaskWrapupVersions.where('taskId').equals(taskId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.revision - a.revision);
        return {
            latest,
            confirmed,
            history,
            stale: !!latest && latest.snapshot.fingerprint !== snapshot.fingerprint,
            currentEvidence: snapshot.evidence,
            completionBlockers: await completionBlockers(task, confirmed, snapshot.fingerprint, db)
        };
    });
}

async function completionBlockers(task: AgentTask, confirmed: AgentTaskWrapup | undefined, fingerprint: string, store?: ProductStore) {
    const db = store ?? productDb;
    const reasons: string[] = [];
    if (!task.projectId || !await db.projects.get(task.projectId)) reasons.push("关联项目已不存在");
    if (isTaskBusy(await db.agentRuns.where('threadId').equals(task.threadId).toArray())) reasons.push('请先处理当前执行');
    if ((await db.agentTaskWrapups.where('taskId').equals(task.id).toArray()).some(w => w.status === 'preparing')) reasons.push('总结仍在整理');
    if (task.plan.some(p => p.status !== 'completed')) reasons.push('还有未完成的 Todo');
    for (const job of await db.audioGenerationJobs.where("projectId").equals(task.projectId).toArray()) {
        if (["submitting", "uncertain", "submitted", "running", "remote-completed", "downloading"].includes(job.status) && await Promise.resolve(ownedTaskAudioGenerationJob(task, job, db))) {
            reasons.push("声音生成仍有进行中或待核实结果");
            break;
        }
    }
    const audioBatches = await db.audioGenerationBatches.where("owner.threadId").equals(task.threadId).toArray();
    for (const batch of audioBatches) {
        if (batch.owner.kind !== "agent" || batch.owner.taskId !== task.id || batch.projectId !== task.projectId || batch.dormant) continue;
        const view = await readAudioGenerationBatch(batch.projectId, batch.id, db);
        if (batch.status === "draft" || view.rows.some(row => ["queued", "submitting", "pending", "uncertain", "recovery"].includes(row.state))) {
            reasons.push("批量配音还有未确认草稿、排队或待核实结果");
            break;
        }
    }
    const ownedBatches = await db.agentGenerationBatches.where('taskId').equals(task.id).toArray();
    for (const batch of ownedBatches) {
        const items = await db.agentGenerationBatchItems.where('batchId').equals(batch.id).toArray();
        const jobs = await db.agentGenerationJobs.where('batchId').equals(batch.id).toArray();
        if (batch.status === 'draft' || items.some(item => item.state === 'queued') || jobs.some(job => ['submitting', 'submitted', 'running', 'downloading', 'remote_completed', 'unknown'].includes(job.status))) {
            reasons.push('批量生成还有未确认草稿、排队或待核实结果');
            break;
        }
    }
    const latest = (await db.agentTaskWrapups.where('taskId').equals(task.id).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
    if (latest?.id !== confirmed?.id) reasons.push('请先检查最新总结草稿，旧版确认不能代表本次验收');
    if (!confirmed?.confirmedAt) reasons.push('请先保存并确认任务总结');
    else {
        if (confirmed.snapshot.fingerprint !== fingerprint) reasons.push('总结依据已变化，请重新整理并确认');
        if (confirmed.content.acceptance.some(a => a.status !== 'met')) reasons.push('验收要求尚未全部确认通过');
        if (confirmed.content.unresolved.length) reasons.push('总结仍有未解决事项');
        const runIds = new Set((await db.agentRuns.where("taskId").equals(task.id).toArray()).map(run => run.id));
        if ((await db.agentToolCalls.where("threadId").equals(task.threadId).toArray()).some(call => runIds.has(call.runId) && ["unknown", "running", "pending", "awaiting_approval", "approved"].includes(call.status)) || (await db.agentGenerationJobs.where("threadId").equals(task.threadId).toArray()).some(job => runIds.has(job.runId) && ["unknown", "submitting", "submitted", "running", "remote_completed", "downloading"].includes(job.status))) reasons.push("执行或生成仍有待核实结果");
    }
    return reasons;
}

export async function assertTaskWrapupCompletion(task: AgentTask, expected?: {
    id: string;
    revision: number
}, store?: ProductStore) {
    const db = store ?? productDb;
    if (!expected) throw new Error('请从当前已确认总结完成任务');
    const record = await db.agentTaskWrapups.get(expected.id);
    if (!record || record.taskId !== task.id || record.threadId !== task.threadId || record.revision !== expected.revision || !record.confirmedAt) throw new Error('已确认总结已变化，请重新检查');
    const records = await db.agentTaskWrapups.where('taskId').equals(task.id).toArray();
    const newest = records.filter(r => !!r.confirmedAt).sort((a, b) => a.confirmedAt!.localeCompare(b.confirmedAt!) || a.createdAt.localeCompare(b.createdAt)).at(-1);
    if (newest?.id !== record.id) throw new Error('有更新的确认版本，请重新检查');
    const blockers = await completionBlockers(task, record, (await collectWrapupSnapshot(task, undefined, db)).fingerprint, db);
    if (blockers.length) throw new Error(blockers.join('；'));
}

export async function startTaskWrapup(taskId: string, author: 'ai' | 'user', store?: ProductStore): Promise<AgentTaskWrapup> {
    const db = store ?? productDb;
    return db.transaction('rw', db.tables, async (db) => {
        const task = await ready(taskId, undefined, db), snapshot = await collectWrapupSnapshot(task, undefined, db);
        const earlier = (await db.agentTaskWrapups.where('taskId').equals(taskId).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const previous = [...earlier].reverse().find(r => r.status === 'draft');
        const at = new Date(Math.max(Date.now(), ...earlier.map(r => Date.parse(r.createdAt) + 1))).toISOString();
        const content = emptyWrapupContent(snapshot.criteria);
        if (author === 'user' && previous) {
            const sources = new Map(snapshot.evidence.map(e => [e.id, e]));
            content.overview = previous.content.overview;
            for (const key of ['decisions', 'lessons', 'unresolved'] as const) content[key] = previous.content[key].map(item => ({
                ...item,
                sourceIds: item.sourceIds.filter(id => sources.has(id))
            }));
            for (const item of previous.content.results) {
                if (item.sourceIds.every(id => sources.get(id)?.available && sources.get(id)?.outcome !== 'unresolved')) content.results.push({...item});
                else content.unresolved.push({
                    text: `重新核实原成果：${item.text}`.slice(0, 2400),
                    sourceIds: item.sourceIds.filter(id => sources.has(id))
                });
            }
            // Never silently discard an unresolved concern while refreshing its evidence.
            if (content.unresolved.length > 30) throw new Error('原稿有较多待核实成果，请先保留并整理原稿后重试');
        }
        return saveVersion({
            id: createId('wrap'),
            taskId,
            threadId: task.threadId,
            revision: 1,
            status: author === 'ai' ? 'preparing' : 'draft',
            author,
            content,
            snapshot,
            createdAt: at,
            updatedAt: at
        }, db);
    });
}

export async function createManualWrapup(taskId: string, store?: ProductStore) {
    const db = store ?? productDb;
    return startTaskWrapup(taskId, 'user', db);
}

export async function saveWrapup(taskId: string, id: string, content: WrapupContent, expectedRevision: number, store?: ProductStore) {
    const db = store ?? productDb;
    return db.transaction('rw', db.tables, async (db) => {
        await ready(taskId, undefined, db);
        const {task, record} = await recordFor(taskId, id, expectedRevision, db);
        if (record.status !== 'draft' || record.confirmedAt) throw new Error('已确认总结保留为历史，请建立新草稿');
        if (record.snapshot.fingerprint !== (await collectWrapupSnapshot(task, undefined, db)).fingerprint) throw new Error('总结依据已变化，请重新整理；原草稿已保留');
        return saveVersion({
            ...record,
            content: validateWrapupContent(content, record.snapshot, 'user'),
            author: 'user',
            revision: record.revision + 1,
            updatedAt: nowIso()
        }, db);
    });
}

export async function confirmWrapup(taskId: string, id: string, expectedRevision: number, store?: ProductStore) {
    const db = store ?? productDb;
    return db.transaction('rw', db.tables, async (db) => {
        const existing = await db.agentTaskWrapups.get(id);
        if (existing?.taskId === taskId && existing.confirmedAt && (existing.revision === expectedRevision || existing.revision === expectedRevision + 1)) {
            await owned(taskId, db);
            return existing;
        }
        const {task, record} = await recordFor(taskId, id, expectedRevision, db);
        await ready(taskId, undefined, db);
        if (record.status !== 'draft') throw new Error('请先生成或保存总结草稿');
        if (!record.content.overview.trim()) throw new Error('请先填写总结概述');
        if (record.snapshot.fingerprint !== (await collectWrapupSnapshot(task, undefined, db)).fingerprint) throw new Error('总结依据已变化，请重新整理');
        const content = validateWrapupContent(record.content, record.snapshot, 'user');
        return saveVersion({
            ...record,
            content,
            confirmedAt: nowIso(),
            revision: record.revision + 1,
            updatedAt: nowIso()
        }, db);
    });
}

export async function publishTaskWrapup(id: string, content: unknown, signal: AbortSignal, store?: ProductStore) {
    const db = store ?? productDb;
    return db.transaction('rw', db.tables, async (db) => {
        signal.throwIfAborted();
        const record = await db.agentTaskWrapups.get(id);
        if (!record || record.status !== 'preparing') throw new Error('整理已停止或任务已删除');
        const task = await ready(record.taskId, id, db);
        if (record.snapshot.fingerprint !== (await collectWrapupSnapshot(task, undefined, db)).fingerprint) throw new Error('整理期间依据发生变化，请重新准备总结');
        return saveVersion({
            ...record,
            content: validateWrapupContent(content, record.snapshot, 'ai'),
            status: 'draft',
            revision: record.revision + 1,
            updatedAt: nowIso()
        }, db);
    });
}

export async function stopTaskWrapup(taskId: string, id: string, status: 'failed' | 'interrupted', error: string, store?: ProductStore) {
    const db = store ?? productDb;
    return db.transaction('rw', [db.agentTaskWrapups, db.agentTaskWrapupVersions, db.agentTasks, db.chatThreads], async (db) => {
        const record = await db.agentTaskWrapups.get(id);
        if (!record || record.taskId !== taskId || record.status !== 'preparing') return;
        await owned(taskId, db);
        await saveVersion({
            ...record,
            status,
            error: error.slice(0, 300),
            revision: record.revision + 1,
            updatedAt: nowIso()
        }, db);
    });
}

export async function cancelTaskWrapup(taskId: string, id: string, store?: ProductStore) {
    const db = store ?? productDb;
    await stopTaskWrapup(taskId, id, 'interrupted', '整理已停止，原有总结仍保留；重新整理需要你明确操作。', db);
}
