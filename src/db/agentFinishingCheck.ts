import { db } from "./database";
import { MODEL_STEPS_PER_SEGMENT, type AgentPlanItem, type AgentResponseItem, type AgentRunOutput } from "@/domain/agent";
import { decodeResponseOutput, toResponseInput } from "@/lib/ai/responsesStream";
import { validateTaskPlan } from "@/lib/agent/taskState";
import { targetRevision } from "@/lib/productionRevision";
import { toolNamesForCall } from "@/lib/agent/toolLoading";
import { buildFinishingCheckPrompt } from "@/lib/agent/finishingCheck";
import { nowIso } from "@/lib/ids";

function parsePlan(raw: unknown): AgentPlanItem[] | undefined {
  try {
    if (!Array.isArray(raw)) return;
    const parsed = validateTaskPlan(raw);
    if (targetRevision(raw) !== targetRevision(parsed)) return;
    return parsed;
  } catch { return; }
}

/** Saves a single local finishing checkpoint at a successful no-tool boundary.
 * Does not complete the run, force tools, change permissions or perform network work.
 */
export async function saveAgentFinishingCheck(
  runId: string, expectedStep: number, output: AgentRunOutput, responseOutput?: AgentResponseItem[], signal?: AbortSignal,
): Promise<boolean> {
  return db.transaction("rw", [db.agentRuns, db.agentToolCalls, db.chatThreads, db.chatMessages, db.projects, db.agentTasks], async () => {
    signal?.throwIfAborted();
    const run = await db.agentRuns.get(runId);
    if (!run || run.status !== "running" || run.finishingCheck || run.interactionMode === "conversation" || !run.enabledToolNames?.length ||
        !Number.isSafeInteger(expectedStep) || expectedStep < 1 || run.modelStep !== expectedStep ||
        expectedStep - (run.modelStepSegmentStart ?? 0) >= MODEL_STEPS_PER_SEGMENT) return false;
    const thread = await db.chatThreads.get(run.threadId), message = await db.chatMessages.get(run.assistantMessageId);
    if (!thread || thread.projectId !== run.projectId || !message || message.threadId !== thread.id || message.runId !== run.id ||
        run.projectId && !await db.projects.get(run.projectId)) throw new Error("收尾检查的执行或项目归属已变化");
    if (run.taskId) {
      const task = await db.agentTasks.get(run.taskId);
      if (!task || task.threadId !== thread.id || task.projectId !== run.projectId || task.lifecycle !== "open") return false;
    }
    const siblings = await db.agentRuns.where("threadId").equals(thread.id).toArray();
    const history = await db.chatMessages.where("threadId").equals(thread.id).toArray();
    if (siblings.some(row => row.id !== runId && row.createdAt >= run.createdAt) || history.some(row => row.role === "user" && row.createdAt > run.createdAt)) return false;
    const plan = parsePlan(run.plan);
    if (!plan?.some(item => item.status !== "completed")) return false;
    const calls = (await db.agentToolCalls.where("runId").equals(runId).toArray()).sort((a, b) => a.step - b.step || a.order - b.order);
    if (!calls.length || calls.some(call => call.threadId !== run.threadId || call.status !== "completed" || call.step >= expectedStep)) return false;
    const saved = calls.filter(call => call.name === "update_run_plan").at(-1);
    if (!saved?.atomic || saved.effect !== "bookkeeping" || !saved.result || saved.result.length > 65536 ||
        !toolNamesForCall(run, saved.step).includes("update_run_plan")) return false;
    try {
      const result = JSON.parse(saved.result);
      const written = parsePlan(result.plan);
      const requested = parsePlan(JSON.parse(saved.arguments).steps);
      if (!written || !requested || targetRevision(written) !== targetRevision(plan) || targetRevision(requested) !== targetRevision(plan)) return false;
    } catch { return false; }
    if (typeof output.content !== "string" || output.content.length > 4_194_304 || typeof (output.reasoning ?? "") !== "string" || (output.reasoning?.length ?? 0) > 4_194_304 ||
        output.reasoningDurationMs !== undefined && (!Number.isFinite(output.reasoningDurationMs) || output.reasoningDurationMs < 0)) throw new Error("收尾回复内容无效或超出限制");
    let responseItems: AgentResponseItem[] | undefined;
    if (run.protocol === "responses") {
      const decoded = decodeResponseOutput(responseOutput, []);
      if (!decoded.items.length || decoded.calls.length || decoded.content !== output.content || decoded.reasoning !== (output.reasoning ?? "")) throw new Error("Responses 收尾信封不完整或与公开回复不匹配");
      if (targetRevision(decoded.items) !== targetRevision(responseOutput)) throw new Error("Responses 收尾信封包含未验证内容");
      // Keep opaque reasoning and item identity exactly as the validated transport returned.
      responseItems = responseOutput;
    } else if (responseOutput !== undefined) throw new Error("收尾检查协议与回复信封不匹配");
    const notice = { role: "system" as const, content: buildFinishingCheckPrompt(run, calls) };
    const previous = run.continuationMessages ?? run.requestMessages;
    const at = nowIso();
    signal?.throwIfAborted();
    await db.agentRuns.update(run.id, {
      finishingCheck: { step: expectedStep, createdAt: at },
      activitySteps: [...(run.activitySteps ?? []), { step: expectedStep, content: output.content, reasoning: output.reasoning, reasoningDurationMs: output.reasoningDurationMs }],
      continuationMessages: [...previous, { role: "assistant", content: output.content }, notice],
      ...(responseItems ? { responseItems: [...(run.responseItems ?? toResponseInput(previous)), ...responseItems, ...toResponseInput([notice])] } : {}),
      updatedAt: at,
    });
    signal?.throwIfAborted();
    return true;
  });
}
