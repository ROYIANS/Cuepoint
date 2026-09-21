import { db } from "./database";
import type { AgentToolCall } from "@/domain/agent";
import { nowIso } from "@/lib/ids";

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
