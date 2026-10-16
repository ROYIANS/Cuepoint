import {sha256Bytes} from "../../../platform/media/sha256";
import {nowIso} from "../../../platform/identity";
import {db as productDb} from "../../../platform/product/store";
import type {ProductStore, StoreTx} from "../../../platform/storage/types";
import type {AgentRun} from "../models/agent";
import type {AgentJob} from "../models/agentJob";
import {isActivityRevision, parseThreadActivity, THREAD_REPORT_LIMIT} from "../models/threadActivity";
import type {ThreadActivityIdentity, ThreadActivityRecord, ThreadReportActivity} from "../models/threadActivity";

const identities = new Map<string, ThreadActivityIdentity>();
/** Prepare before entering the initiating write/observation transaction. */
export function prepareThreadActivityKey(threadId: string): ThreadActivityIdentity {
    if (typeof threadId !== "string" || !threadId) throw new Error("对话标识无效");
    const cached = identities.get(threadId);
    if (cached) return cached;
    const identity = Object.freeze({threadId, key: `agent.thread-activity.${sha256Bytes(new TextEncoder().encode(JSON.stringify(threadId)))}`});
    if (identities.size >= 512) identities.delete(identities.keys().next().value!);
    identities.set(threadId, identity);
    return identity;
}
export async function prepareRunActivityKey(runId: string, db: ProductStore): Promise<ThreadActivityIdentity | undefined> {
    const run = await db.agentRuns.get(runId);
    if (!run) return;
    if ("transactionId" in db) throw new Error("请从发起事务的调用传入已准备的对话阅读标识");
    return prepareThreadActivityKey(run.threadId);
}
export async function readThreadActivity(identity: ThreadActivityIdentity, tx: StoreTx): Promise<ThreadActivityRecord | null> {
    const row = await tx.deviceSettings.get(identity.key);
    return row === undefined ? null : parseThreadActivity(row.value, identity.threadId);
}
function empty(threadId: string): ThreadActivityRecord {
    return {version: 1, threadId, publicRevision: 0, readRevision: 0, reports: []};
}
async function write(identity: ThreadActivityIdentity, value: ThreadActivityRecord, tx: StoreTx): Promise<void> {
    await tx.deviceSettings.put({key: identity.key, value, updatedAt: nowIso()});
}
function requireReportRevision(revision: number): void {
    if (!isActivityRevision(revision) || revision < 1) throw new Error("报告公开版本无效");
}
/** The source transaction has already accepted the exact public change. */
export async function publishAssistantActivity(identity: ThreadActivityIdentity, run: AgentRun, tx: StoreTx): Promise<void> {
    const thread = await tx.chatThreads.get(identity.threadId), message = await tx.chatMessages.get(run.assistantMessageId);
    if (!thread || run.threadId !== identity.threadId || !message || message.threadId !== thread.id || message.runId !== run.id || message.role !== "assistant") throw new Error("公开回复归属已变化");
    const current = await readThreadActivity(identity, tx) ?? empty(thread.id);
    if (current.publicRevision === Number.MAX_SAFE_INTEGER) throw new Error("对话阅读版本已达到上限");
    const revision = current.publicRevision + 1;
    await tx.chatMessages.update(message.id, {publicRevision: revision});
    await write(identity, {...current, publicRevision: revision}, tx);
}
/** E07's accepted job revision is separate from the ordinary transcript cursor. */
export async function publishAgentReportActivity(identity: ThreadActivityIdentity, job: AgentJob, run: AgentRun, tx: StoreTx): Promise<void> {
    requireReportRevision(job.revision);
    if (job.threadId !== identity.threadId || run.threadId !== identity.threadId || job.runId !== run.id || !await tx.chatThreads.get(identity.threadId) || job.output?.retention === "cleared") throw new Error("报告公开归属已变化");
    const message = await tx.chatMessages.get(run.assistantMessageId);
    if (!message || message.runId !== run.id || message.threadId !== job.threadId) throw new Error("报告回复已不存在");
    const current = await readThreadActivity(identity, tx) ?? empty(job.threadId);
    const previous = current.reports.find(report => report.jobId === job.id);
    if (previous && previous.assistantMessageId !== message.id) throw new Error("报告公开归属已变化");
    if (previous && previous.publicRevision >= job.revision) return;
    if (!previous && current.reports.length >= THREAD_REPORT_LIMIT) throw new Error("报告阅读记录已达到上限");
    const report = {jobId: job.id, assistantMessageId: message.id, publicRevision: job.revision, readRevision: previous?.readRevision ?? 0};
    await write(identity, {...current, reports: [...current.reports.filter(item => item.jobId !== job.id), report]}, tx);
}
export async function clearAgentReportActivity(identity: ThreadActivityIdentity, jobId: string, tx: StoreTx): Promise<void> {
    const current = await readThreadActivity(identity, tx);
    if (!current || !current.reports.some(report => report.jobId === jobId)) return;
    await write(identity, {...current, reports: current.reports.filter(report => report.jobId !== jobId)}, tx);
}
export async function acknowledgeThreadRead(input: Readonly<{threadId: string; observedRevision: number}>, store?: ProductStore): Promise<void> {
    input = {...input};
    if (!isActivityRevision(input.observedRevision)) throw new Error("已读版本无效");
    const identity = prepareThreadActivityKey(input.threadId), db = store ?? productDb;
    await db.transaction("rw", [db.chatThreads, db.deviceSettings], async tx => {
        if (!await tx.chatThreads.get(identity.threadId)) return;
        const current = await readThreadActivity(identity, tx);
        if (!current || input.observedRevision <= current.readRevision) return;
        if (input.observedRevision > current.publicRevision) throw new Error("已读版本尚未发布");
        await write(identity, {...current, readRevision: input.observedRevision}, tx);
    });
}
async function originalReportMessage(job: AgentJob, report: ThreadReportActivity, identity: ThreadActivityIdentity, tx: StoreTx): Promise<boolean> {
    if (job.threadId !== identity.threadId || job.output?.retention === "cleared") return false;
    const run = await tx.agentRuns.get(job.runId), message = await tx.chatMessages.get(report.assistantMessageId);
    return Boolean(run && run.threadId === identity.threadId && run.assistantMessageId === report.assistantMessageId && message && message.runId === run.id && message.threadId === identity.threadId);
}
export async function acknowledgeAgentReportRead(input: Readonly<{threadId: string; jobId: string; observedRevision: number}>, store?: ProductStore): Promise<void> {
    input = {...input};
    if (!isActivityRevision(input.observedRevision)) throw new Error("报告已读版本无效");
    const identity = prepareThreadActivityKey(input.threadId), db = store ?? productDb;
    const {readAgentJob} = await import("./agentJobs");
    await db.transaction("rw", [db.projects, db.media, db.agentJobResultChunks, db.chatThreads, db.chatMessages, db.agentRuns, db.agentToolCalls, db.agentJobs, db.deviceSettings], async tx => {
        const thread = await tx.chatThreads.get(identity.threadId);
        if (!thread) return;
        const current = await readThreadActivity(identity, tx), report = current?.reports.find(item => item.jobId === input.jobId);
        if (!current || !report) return;
        const job = await tx.agentJobs.get(input.jobId);
        if (!job || !await originalReportMessage(job, report, identity, tx)) return;
        const owned = await readAgentJob({threadId: identity.threadId, projectId: thread.projectId, original: {runId: job.runId, callId: job.callId}}, job.id, tx);
        if (!owned) return;
        if (input.observedRevision <= report.readRevision) return;
        if (input.observedRevision > report.publicRevision || input.observedRevision > job.revision) throw new Error("报告已读版本尚未发布");
        await write(identity, {...current, reports: current.reports.map(item => item.jobId === job.id ? {...item, readRevision: input.observedRevision} : item)}, tx);
    });
}
