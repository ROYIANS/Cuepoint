import { db } from "./database";
import type { AgentGenerationJob } from "@/domain/agentGeneration";
import type { MediaRecord } from "@/domain/types";
import { nowIso } from "@/lib/ids";

export async function claimGenerationJob(job: AgentGenerationJob): Promise<{ job: AgentGenerationJob; claimed: boolean }> {
  return db.transaction("rw", [db.agentGenerationJobs, db.projects, db.agentRuns, db.agentToolCalls, db.chatThreads], async () => {
    if (!job.callId) throw new Error("批量任务必须通过批量队列认领");
    const existing = await db.agentGenerationJobs.where("callId").equals(job.callId).first();
    if (existing) return { job: existing, claimed: false };
    const duplicates = await db.agentGenerationJobs.where("fingerprint").equals(job.fingerprint).toArray();
    const active = duplicates.find((item) => !["failed", "applied", "downloaded", "conflict"].includes(item.status));
    if (active) throw new Error(`相同生成请求尚未确认，请继续查询已有任务 ${active.id}，不会重复付费提交`);
    const run = await db.agentRuns.get(job.runId);
    const call = await db.agentToolCalls.get(job.callId);
    const thread = await db.chatThreads.get(job.threadId);
    if (run?.projectId !== thread?.projectId || run?.projectId && run.projectId !== job.projectId) throw new Error("生成项目归属不匹配");
    if (!run || run.threadId !== job.threadId || run.status !== "running" || !await db.chatThreads.get(job.threadId) ||
        !call || call.runId !== job.runId || call.threadId !== job.threadId || call.status !== "running") throw new Error("生成执行已停止或归属不匹配");
    if (job.projectId !== "studio" && !await db.projects.get(job.projectId)) throw new Error("项目已删除");
    await db.agentGenerationJobs.add(job);
    return { job, claimed: true };
  });
}

/** Updates never reinsert a removed job/project; late network responses cannot resurrect work. */
export async function updateGenerationJob(id: string, patch: Partial<Pick<AgentGenerationJob,
  "status" | "providerTaskId" | "providerTaskIds" | "providerStatus" | "progress" | "error" | "result">>): Promise<AgentGenerationJob> {
  return db.transaction("rw", [db.agentGenerationJobs, db.agentGenerationBatches, db.projects, db.agentRuns, db.chatThreads], async () => {
    const job = await db.agentGenerationJobs.get(id);
    if (!job || !await db.agentRuns.get(job.runId) || !await db.chatThreads.get(job.threadId) || job.projectId !== "studio" && !await db.projects.get(job.projectId)) throw new Error("生成记录或项目已删除");
    if (job.result && patch.status === undefined && patch.error !== undefined) return job;
    // A late parallel query cannot regress a locally saved/applied result.
    if (["applied", "downloaded", "conflict"].includes(job.status) && ["submitted", "running", "remote_completed", "downloading", "failed"].includes(patch.status ?? "")) return job;
    const next = { ...job, ...patch, updatedAt: nowIso() };
    await db.agentGenerationJobs.put(next);
    if (next.batchId && next.status === "unknown") {
      const batch = await db.agentGenerationBatches.get(next.batchId);
      if (batch) await db.agentGenerationBatches.update(batch.id, { status: batch.status === "cancelled" ? "cancelled" : "paused", pauseReason: "提交结果未知，请核实供应商记录；已暂停后续发送", revision: batch.revision + 1, updatedAt: nowIso() });
    }
    return next;
  });
}

export async function storeGenerationMedia(jobId: string, media: MediaRecord): Promise<AgentGenerationJob> {
  return db.transaction("rw", [db.agentGenerationJobs, db.projects, db.media, db.agentRuns, db.chatThreads], async () => {
    const job = await db.agentGenerationJobs.get(jobId);
    if (!job || !await db.agentRuns.get(job.runId) || !await db.chatThreads.get(job.threadId) || job.projectId !== "studio" && !await db.projects.get(job.projectId)) throw new Error("生成记录或项目已删除，结果未写入");
    if (job.result) return job;
    if (job.status !== "downloading" || media.projectId !== job.projectId || !media.blob.size || !media.mimeType.startsWith(`${job.kind}/`)) throw new Error("生成结果与目标类型不匹配");
    await db.media.add(media);
    const next: AgentGenerationJob = { ...job, result: { mediaId: media.id, kind: job.kind }, status: "downloaded", error: undefined, updatedAt: nowIso() };
    await db.agentGenerationJobs.put(next);
    return next;
  });
}

export function generationJobSummary(job: AgentGenerationJob) {
  return { jobId: job.id, status: job.status, projectId: job.projectId, target: job.target, provider: job.provider,
    model: job.model, providerTaskId: job.providerTaskId, providerTaskIds: job.providerTaskIds, providerStatus: job.providerStatus, progress: job.progress,
    result: job.result, error: job.error, updatedAt: job.updatedAt,
    applied: job.status === "applied", note: "远端生成、下载到本地和写入目标分别处理；停止本地查询不会取消远端任务。" };
}
