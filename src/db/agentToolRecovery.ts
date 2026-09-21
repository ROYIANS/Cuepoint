import { db } from "./database";
import type { AgentToolCall } from "@/domain/agent";
import { nowIso } from "@/lib/ids";

/** This exact built-in only prepares local drafts with an atomic result ledger. */
export function isUnknownBatchPreparation(call: AgentToolCall): boolean {
  return call.name === "prepare_generation_batch" && call.effect === "bookkeeping" &&
    call.atomic === true && !call.highRisk && !call.requiresConfirmation &&
    call.recovery === undefined && call.status === "unknown" && call.result === undefined;
}

/** Reconcile old misclassified preflight failures without executing tools or HTTP.
 * Caller holds the thread lock. Inconsistent evidence remains unknown.
 */
export async function recoverBatchPreparationCalls(runId: string): Promise<void> {
  await db.transaction("rw", db.agentRuns, db.agentToolCalls, db.agentGenerationBatches,
    db.agentGenerationBatchItems, db.agentGenerationJobs, async () => {
      const run = await db.agentRuns.get(runId);
      if (!run || !["running", "interrupted", "failed", "waiting_approval"].includes(run.status)) return;
      const calls = await db.agentToolCalls.where("runId").equals(runId).filter(isUnknownBatchPreparation).toArray();
      for (const call of calls) {
        if (call.threadId !== run.threadId) continue;
        // A paid-job record contradicts this tool's local-only contract.
        if (await db.agentGenerationJobs.where("callId").equals(call.id).count()) continue;
        const batches = await db.agentGenerationBatches.where("sourceCallId").equals(call.id).toArray();
        if (batches.length > 1) continue;
        const batch = batches[0];
        if (batch) {
          const items = await db.agentGenerationBatchItems.where("batchId").equals(batch.id).toArray();
          if (batch.runId !== run.id || batch.threadId !== run.threadId || batch.originCallId !== call.id ||
              batch.taskId !== run.taskId || run.projectId && batch.projectId !== run.projectId ||
              !items.length || items.length !== batch.itemIds.length || new Set(batch.itemIds).size !== items.length ||
              items.some(item => !batch.itemIds.includes(item.id) || item.threadId !== run.threadId || item.projectId !== batch.projectId)) continue;
          await db.agentToolCalls.update(call.id, { status: "completed", error: undefined, updatedAt: nowIso(),
            result: JSON.stringify({ batchId: batch.id, status: batch.status, targetCount: new Set(items.map(item => item.targetKey)).size,
              candidateCount: items.length, submitted: false, recovered: true }) });
        } else {
          const error = '已核实本地没有此次操作创建的批量草稿，未提交生成。原失败原因未保存，请检查参数后重新准备草稿；图片比例使用 size，不要传 aspectRatio 或 mode。';
          await db.agentToolCalls.update(call.id, { status: "failed", error, updatedAt: nowIso(),
            result: JSON.stringify({ error, code: "BATCH_PREPARATION_NOT_COMMITTED", submitted: false, recovered: true }) });
        }
      }
    });
}

/** Only this historic built-in already committed its mutation and result atomically.
 * Never infer repeatability for arbitrary bookkeeping/network tools. Caller owns the thread lock. */
export function isLegacyAtomicPlanCall(call: AgentToolCall): boolean {
  return call.name === "update_run_plan" && call.effect === "bookkeeping" && !call.highRisk &&
    call.atomic === undefined && call.recovery === undefined && !call.requiresConfirmation &&
    call.result === undefined && ["pending", "approved", "running", "unknown"].includes(call.status);
}
export async function upgradeLegacyPlanCalls(runId: string): Promise<void> {
  await db.transaction("rw", db.agentToolCalls, async () => {
    const calls = await db.agentToolCalls.where("runId").equals(runId).toArray();
    for (const call of calls) {
      if (!isLegacyAtomicPlanCall(call)) continue;
      await db.agentToolCalls.update(call.id, { atomic: true,
        ...(call.status === "unknown" ? { status: call.decision === "approve" ? "approved" : "pending", error: undefined } : {}),
        updatedAt: nowIso(),
      });
    }
  });
}

/** Caller holds the thread Web Lock and includes generation jobs in its transaction. */
export async function interruptedToolState(call: AgentToolCall): Promise<Pick<AgentToolCall, "status" | "error" | "updatedAt">> {
  let resumable = Boolean(call.atomic) || call.recovery === "repeatable";
  if (call.recovery === "generation") {
    const job = await db.agentGenerationJobs.where("callId").equals(call.id).first();
    resumable = Boolean(job && job.runId === call.runId && job.threadId === call.threadId &&
      job.status !== "unknown" && (job.providerTaskId || job.result || job.status === "failed"));
  }
  return {
    status: resumable ? (call.decision === "approve" ? "approved" : "pending") : "unknown",
    error: resumable ? undefined : "操作结果尚不确定，不能自动重跑。",
    updatedAt: nowIso(),
  };
}
