import { db } from "@/db/database";
import { getMemorySelection } from "@/db/memoryRetrieval";
import { toResponseInput } from "@/lib/ai/responsesStream";
import { withMemoryContext } from "@/lib/memory/retrieval";
import { frozenProjectScope } from "./projectScope";
/** Update only the upcoming independent layer. Original request and prior step snapshots stay immutable. */
export async function refreshRunMemoryContext(runId: string) {
  return db.transaction("rw", db.tables, async () => {
    const run = await db.agentRuns.get(runId);
    if (!run || run.status !== "running") throw new Error("执行已停止");
    const projectId = await frozenProjectScope({
      runId,
      threadId: run.threadId,
      callId: "memory",
      signal: new AbortController().signal,
    });
    if (!projectId) return run;
    if (!run.context) throw new Error("执行缺少独立上下文，无法安全更新记忆");
    if (
      (await db.agentToolCalls.where("runId").equals(runId).toArray()).some(
        (call) => !["completed", "failed", "rejected"].includes(call.status),
      )
    )
      throw new Error("请先处理工具步骤，再更新项目记忆");
    const task = run.taskId ? await db.agentTasks.get(run.taskId) : undefined;
    const selection = await getMemorySelection({
      projectId,
      threadId: run.threadId,
      draft: run.context.draft,
      recentUserTurns: run.context.history
        .filter((m) => m.role === "user")
        .map((m) => m.content),
      taskTitle: task?.title,
      taskGoal: task?.goal,
      capacity: run.context.capacity,
    });
    const oldBase = run.context.baseMessages,
      messages = run.continuationMessages ?? run.requestMessages;
    if (
      JSON.stringify(messages.slice(0, oldBase.length)) !==
      JSON.stringify(oldBase)
    )
      throw new Error("执行基础信封已变化，记忆未更新");
    const stripped = [...oldBase];
    if (run.context.memoryEnvelope) {
      if (
        stripped[1]?.role !== "user" ||
        stripped[1]?.content !== run.context.memoryEnvelope
      )
        throw new Error("记忆信封不匹配");
      stripped.splice(1, 1);
    }
    const baseMessages = withMemoryContext(stripped, selection);
    const oldResponseBase = toResponseInput(oldBase);
    if (
      run.responseItems &&
      JSON.stringify(run.responseItems.slice(0, oldResponseBase.length)) !==
        JSON.stringify(oldResponseBase)
    )
      throw new Error("Responses 基础信封已变化，记忆未更新");
    const next = {
      ...run,
      memorySelection: selection,
      context: {
        ...run.context,
        baseMessages,
        memoryEnvelope: selection.envelope,
      },
      continuationMessages: [
        ...baseMessages,
        ...messages.slice(oldBase.length),
      ],
      ...(run.responseItems
        ? {
            responseItems: [
              ...toResponseInput(baseMessages),
              ...run.responseItems.slice(oldResponseBase.length),
            ],
          }
        : {}),
    };
    await db.agentRuns.put(next);
    return next;
  });
}
