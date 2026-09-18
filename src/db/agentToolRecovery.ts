import { db } from "./database";
import type { AgentToolCall } from "@/domain/agent";
import { nowIso } from "@/lib/ids";

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
