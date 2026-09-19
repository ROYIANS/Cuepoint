import { writeTaskRecord } from "./agentTaskRecords";
import { generationSubmitSchema } from "@/lib/agent/generationProfiles";
import { targetRevision } from "@/lib/productionRevision";
import { interruptedToolState } from "./agentToolRecovery";
import { validateTaskPlan, formatTaskPlan } from "@/lib/agent/taskState";
import { db } from "@/db/database";
import { MODEL_STEPS_PER_SEGMENT } from "@/domain/agent";
import type { AgentPlanItem, AgentResponseItem, AgentRun, AgentToolCall, AgentWireToolCall, AgentToolPreview } from "@/domain/agent";
import { toResponseInput } from "@/lib/ai/responsesStream";
import { createId, nowIso } from "@/lib/ids";

export function canResumeAgentRun(run: AgentRun): boolean {
  return !!run.hasToolCalls && ["waiting_approval", "interrupted", "failed"].includes(run.status);
}
async function requireRun(runId: string): Promise<AgentRun> {
  const run = await db.agentRuns.get(runId);
  if (!run || !(await db.chatThreads.get(run.threadId))) throw new Error("执行已删除");
  const message = await db.chatMessages.get(run.assistantMessageId);
  if (!message || message.threadId !== run.threadId || message.runId !== run.id) throw new Error("执行消息归属不匹配");
  return run;
}
async function requireProject(run: AgentRun) {
 const thread = await db.chatThreads.get(run.threadId);
 if (thread?.projectId !== run.projectId || run.projectId && !await db.projects.get(run.projectId)) throw new Error("关联项目已不存在或归属不匹配");
}
const tables = () => [db.projects, db.agentRuns, db.agentToolCalls, db.chatThreads, db.chatMessages, db.agentTasks, db.agentGenerationJobs, db.agentTaskRecords, db.agentTaskRecordVersions];
async function requireLatestRun(run: AgentRun): Promise<void> {
  const siblings = await db.agentRuns.where("threadId").equals(run.threadId).toArray();
  const history = await db.chatMessages.where("threadId").equals(run.threadId).toArray();
  if (siblings.some((other) => other.id !== run.id && other.createdAt >= run.createdAt) || history.some((message) => message.role === "user" && message.createdAt > run.createdAt)) throw new Error("只能继续当前最后一次执行");
}
/** Park at a model boundary, before context preparation can issue another request. */
export async function pauseAtModelStepLimit(runId: string): Promise<boolean> {
  return db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    if (run.status !== "running") throw new Error("执行已停止");
    if ((run.modelStep ?? 0) - (run.modelStepSegmentStart ?? 0) < MODEL_STEPS_PER_SEGMENT) return false;
    const calls = await db.agentToolCalls.where("runId").equals(runId).toArray();
    if (calls.some((call) => !["completed", "failed", "rejected"].includes(call.status))) throw new Error("请先处理尚未完成的工具步骤");
    const at = nowIso();
    const notice = `本段已达到 ${MODEL_STEPS_PER_SEGMENT} 轮模型请求，进度已保存。可继续执行下一段，或结束本次执行。`;
    await db.agentRuns.update(runId, { status: "interrupted", pauseReason: "model_step_limit", error: undefined, endedAt: undefined, updatedAt: at });
    await db.chatMessages.update(run.assistantMessageId, { status: "interrupted", error: notice });
    return true;
  });
}
export async function startModelStep(runId: string, limit: number): Promise<AgentRun> {
  return db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    await requireProject(run);
    if (run.status !== "running") throw new Error("执行已停止");
    if ((run.modelStep ?? 0) - (run.modelStepSegmentStart ?? 0) >= limit) throw new Error("本段模型请求额度已用完，请继续下一段执行");
    if(run.projectId&&!run.memorySelection)throw new Error("项目记忆尚未准备，不能提交请求");
    const next = { ...run, memoryAudit:run.memorySelection?[...(run.memoryAudit??[]),{step:(run.modelStep??0)+1,preparedAt:nowIso(),selection:structuredClone(run.memorySelection)}]:run.memoryAudit, modelStep: (run.modelStep ?? 0) + 1, usage: undefined, outputTokensPerSecond: undefined, updatedAt: nowIso() };
    await db.agentRuns.put(next);
    return next;
  });
}
export async function saveToolRound(runId: string, content: string, wireCalls: AgentWireToolCall[], details: Pick<AgentToolCall, "title" | "effect" | "highRisk" | "atomic" | "recovery" | "requiresConfirmation">[], responseOutput?: AgentResponseItem[]): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    if (run.status !== "running") throw new Error("执行已停止");
    if (wireCalls.length === 0 || wireCalls.length !== details.length) throw new Error("工具轮次格式无效");
    if (run.protocol === "responses") {
      const functions = responseOutput?.filter((item) => item.type === "function_call");
      if (!functions || functions.length !== wireCalls.length || functions.some((item, index) => item.call_id !== wireCalls[index].id || item.name !== wireCalls[index].function.name || item.arguments !== wireCalls[index].function.arguments)) throw new Error("Responses 工具信封不完整或不匹配");
    } else if (responseOutput) throw new Error("执行协议与工具信封不匹配");
    const existing = await db.agentToolCalls.where("runId").equals(runId).toArray();
    if (wireCalls.some((call) => existing.some((row) => row.providerCallId === call.id)) || new Set(wireCalls.map((call) => call.id)).size !== wireCalls.length) throw new Error("模型重复使用工具调用标识，已阻止重复执行");
    const at = nowIso();
    await db.agentToolCalls.bulkAdd(wireCalls.map((call, index): AgentToolCall => ({
      id: createId("tool"), runId, threadId: run.threadId, providerCallId: call.id, step: run.modelStep ?? 1, order: index,
      name: call.function.name, arguments: call.function.arguments, ...details[index], status: "pending", createdAt: at, updatedAt: at,
    })));
    await db.agentRuns.update(runId, { ...(responseOutput ? { responseItems: [...(run.responseItems ?? toResponseInput(run.continuationMessages ?? run.requestMessages)), ...responseOutput] } : {}), hasToolCalls: true, continuationMessages: [...(run.continuationMessages ?? run.requestMessages), { role: "assistant", content, tool_calls: wireCalls }], updatedAt: at });
  });
}
export async function transitionToolCall(runId: string, callId: string, from: AgentToolCall["status"][], to: AgentToolCall["status"], extra: { result?: string; error?: string } = {}): Promise<boolean> {
  return db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    const call = await db.agentToolCalls.get(callId);
    if (run.status !== "running" || !call || call.runId !== runId || call.threadId !== run.threadId) throw new Error("工具调用归属或执行状态不匹配");
    if (!from.includes(call.status)) return false;
    await db.agentToolCalls.update(callId, { status: to, ...extra, updatedAt: nowIso() });
    return true;
  });
}
export async function pauseForApproval(runId: string): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    if (run.status !== "running") throw new Error("执行已停止");
    await db.agentRuns.update(run.id, { status: "waiting_approval", updatedAt: nowIso() });
    await db.chatMessages.update(run.assistantMessageId, { status: "pending" });
  });
}
export async function resolveAgentToolApproval(runId: string, callId: string, decision: "approve" | "reject"): Promise<void> {
  if (decision !== "approve" && decision !== "reject") throw new Error("批准决定无效");
  await db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    const call = await db.agentToolCalls.get(callId);
    if (!canResumeAgentRun(run) || !call || call.runId !== runId || call.threadId !== run.threadId || call.status !== "awaiting_approval") throw new Error("批准请求已处理或归属不匹配");
    await requireLatestRun(run);
    const calls = await db.agentToolCalls.where("runId").equals(runId).toArray();
    if (calls.some((item) => item.status === "unknown" || item.status === "running")) throw new Error("有操作结果尚不确定，请先核实，不能批准后继续执行");
    const at = nowIso();
    await db.agentToolCalls.update(call.id, { status: decision === "approve" ? "approved" : "rejected", decision, decidedAt: at, updatedAt: at,
      ...(decision === "reject" ? { result: JSON.stringify({ error: "用户拒绝了本次操作，请尊重此决定并调整计划。" }) } : {}),
    });
  });
}
export async function resumeAgentRun(runId: string): Promise<AgentRun> {
  return db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    await requireProject(run);
    if (!canResumeAgentRun(run)) throw new Error("此执行不能继续");
    await requireLatestRun(run);
    const calls = await db.agentToolCalls.where("runId").equals(runId).toArray();
    if (calls.some((call) => call.status === "running" || call.status === "unknown")) throw new Error("有操作结果尚不确定，请先核实，不能自动继续或重跑");
    if (calls.some((call) => call.status === "awaiting_approval")) throw new Error("请先批准或拒绝待处理的操作");
    const next = { ...run, ...(run.pauseReason === "model_step_limit" ? { modelStepSegmentStart: run.modelStep ?? 0 } : {}), pauseReason: undefined, status: "running" as const, error: undefined, endedAt: undefined, updatedAt: nowIso() };
    await db.agentRuns.put(next);
    await db.chatMessages.update(run.assistantMessageId, { status: "streaming", error: undefined });
    return next;
  });
}
export async function appendToolResults(runId: string): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    if (run.status !== "running") throw new Error("执行已停止");
    const messages = [...(run.continuationMessages ?? run.requestMessages)];
    const responseItems = run.protocol === "responses" ? [...(run.responseItems ?? [])] : undefined;
    if (responseItems && !responseItems.length) throw new Error("Responses 缺少已保存的调用信封");
    const calls = (await db.agentToolCalls.where("runId").equals(runId).toArray()).sort((a, b) => a.step - b.step || a.order - b.order);
    for (const call of calls) {
      if (!["completed", "failed", "rejected"].includes(call.status) || call.result === undefined) throw new Error("工具结果尚未完整保存");
      const savedOutputs = responseItems?.filter((item) => item.type === "function_call_output" && item.call_id === call.providerCallId);
      if (savedOutputs && (savedOutputs.length > 1 || savedOutputs.some((item) => item.type === "function_call_output" && item.output !== call.result))) throw new Error("Responses 已保存的工具结果与执行记录不匹配");
      if (responseItems && !responseItems.some((item) => item.type === "function_call_output" && item.call_id === call.providerCallId)) {
        if (!responseItems.some((item) => item.type === "function_call" && item.call_id === call.providerCallId)) throw new Error("Responses 缺少对应工具调用");
        responseItems.push({ type: "function_call_output", call_id: call.providerCallId, output: call.result });
      }
      if (!messages.some((message) => message.role === "tool" && message.tool_call_id === call.providerCallId)) messages.push({ role: "tool", tool_call_id: call.providerCallId, content: call.result });
    }
    await db.agentRuns.update(runId, { continuationMessages: messages, ...(responseItems ? { responseItems } : {}), updatedAt: nowIso() });
  });
}
/** Plan changes and the successful ledger result commit together. */
export async function updateRunPlanAndComplete(runId: string, callId: string, plan: AgentPlanItem[], reason?: string): Promise<string> {
  return db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    await requireProject(run);
    const call = await db.agentToolCalls.get(callId);
    if (run.status !== "running" || !call || call.runId !== runId || call.threadId !== run.threadId || call.status !== "running" || call.name !== "update_run_plan") throw new Error("计划操作归属不匹配");
    plan = validateTaskPlan(plan);
    if (run.taskId) {
      const task = await db.agentTasks.get(run.taskId);
      if (!task || task.threadId !== run.threadId || task.lifecycle !== "open") throw new Error("关联任务不可修改");
      await writeTaskRecord(task, { kind: "progress", claim: "proposal", title: "Todo 更新", body: `${reason?.trim() || "按当前任务进展调整执行计划；勾选状态不是业务完成证据"}\n\n调整前\n${formatTaskPlan(task.plan)}\n\n调整后\n${formatTaskPlan(plan)}`, sources: [] }, { author: "ai", runId, requirementSnapshot: true });
      await db.agentTasks.update(task.id, { plan, revision: (task.revision ?? 1) + 1, updatedAt: nowIso() });
    }
    const result = JSON.stringify({ plan });
    await db.agentRuns.update(runId, { plan, updatedAt: nowIso() });
    await db.agentToolCalls.update(callId, { status: "completed", result, updatedAt: nowIso() });
    return result;
  });
}
export async function cancelAgentRun(runId: string): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    if (run.status === "completed" || run.status === "cancelled") return;
    if (run.status === "running") throw new Error("请先停止正在运行的执行");
    const at = nowIso();
    await db.agentToolCalls.where("runId").equals(runId).filter((call) => ["pending", "awaiting_approval", "approved"].includes(call.status)).modify({ status: "rejected", result: JSON.stringify({ error: "本次执行已取消" }), updatedAt: at });
    await db.agentRuns.update(runId, { status: "cancelled", pauseReason: undefined, updatedAt: at, endedAt: at, error: "本次执行已结束，已完成的步骤保留。" });
    await db.chatMessages.update(run.assistantMessageId, { status: "aborted", error: "本次执行已结束，已完成的步骤保留。" });
  });
}

export async function markRunningToolsUnknown(runId: string): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    if (!(await db.agentRuns.get(runId))) return;
    const running = await db.agentToolCalls.where("runId").equals(runId).filter((call) => call.status === "running").toArray();
    for (const call of running) await db.agentToolCalls.update(call.id, await interruptedToolState(call));
  });
}


/** A local transaction rolled back: unlike a lost network reply, it had no effect. */
export class AtomicToolRollbackError extends Error {}

export async function saveToolPreview(runId: string, callId: string, preview: AgentToolPreview): Promise<void> {
  if (!preview.summary.trim() || preview.summary.length > 1000 || preview.changes.length > 100 || preview.changes.some((item) => item.length > 2000) || JSON.stringify(preview).length > 32768) throw new Error("操作预览超出限制");
  await db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    const call = await db.agentToolCalls.get(callId);
    if (run.status !== "running" || !call || call.runId !== runId || call.threadId !== run.threadId || call.status !== "pending") throw new Error("操作预览状态已变化");
    if (call.preview) throw new Error("不能替换已保存的操作预览");
    await db.agentToolCalls.update(callId, { preview, updatedAt: nowIso() });
  });
}

/** Business mutations and their tool result either commit together or both roll back.
 * Callbacks must only perform local database work, never fetch or other external effects.
 */
export async function executeAtomicTool(
  context: { runId: string; threadId: string; callId: string; signal: AbortSignal },
  execute: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await db.transaction("rw", db.tables, async () => {
      context.signal.throwIfAborted();
      const run = await requireRun(context.runId);
      await requireProject(run);
      const call = await db.agentToolCalls.get(context.callId);
      if (run.status !== "running" || run.threadId !== context.threadId || !call || call.runId !== run.id || call.threadId !== run.threadId) throw new Error("操作归属或执行状态不匹配");
      if (call.status === "completed" && call.result) return JSON.parse(call.result);
      if (call.status !== "running") throw new Error("工具尚未开始执行");
      const value = await execute();
      context.signal.throwIfAborted();
      const result = JSON.stringify(value);
      if (result === undefined || result.length > 65536) throw new Error("工具结果超过大小限制");
      await db.agentToolCalls.update(call.id, { status: "completed", result, updatedAt: nowIso() });
      return value;
    });
  } catch (error) {
    throw new AtomicToolRollbackError(error instanceof Error ? error.message : "本地操作已回滚");
  }
}

export interface GenerationReviewExpected { arguments: string; revision: string }
async function requireGenerationReviewCall(runId: string, callId: string, expected: GenerationReviewExpected): Promise<AgentToolCall> {
  const run=await requireRun(runId);
    await requireProject(run);
  const call=await db.agentToolCalls.get(callId);
  if (!canResumeAgentRun(run) || !call || call.runId!==runId || call.threadId!==run.threadId || call.name!=="submit_generation" ||
    call.status!=="awaiting_approval" || !call.requiresConfirmation || call.decision || call.generationOverride) throw new Error("生成确认已处理或执行归属不匹配");
  if (run.interactionMode === "conversation" || !run.enabledToolNames?.includes("submit_generation")) throw new Error("当前执行未启用生成工具");
  if (!expected.revision || expected.arguments!==call.arguments || expected.revision!==call.preview?.revision) throw new Error("生成预览已经变化，请重新查看后确认");
  await requireLatestRun(run);
  const calls=await db.agentToolCalls.where("runId").equals(runId).toArray();
  if (calls.some((item)=>item.status === "unknown" || item.status === "running")) throw new Error("有操作结果尚不确定，不能确认新的生成请求");
  if (await db.agentGenerationJobs.where("callId").equals(callId).first()) throw new Error("此生成请求已有任务记录，不能修改或重复提交");
  return call;
}
export async function readGenerationReviewCall(runId: string,callId: string,expected: GenerationReviewExpected): Promise<AgentToolCall> {
  return db.transaction("r",tables(),()=>requireGenerationReviewCall(runId,callId,expected));
}
/** Final CAS commits the reviewed request, preview and approval together. */
export async function commitGenerationReview(
  runId:string,callId:string,override:{arguments:string;preview:AgentToolPreview},expected:GenerationReviewExpected,
):Promise<void> {
  if (override.arguments.length>32768 || !override.preview.revision || !override.preview.summary.trim() || override.preview.summary.length>1000 ||
      override.preview.changes.length>100 || override.preview.changes.some((item)=>item.length>2000) || JSON.stringify(override.preview).length>32768) throw new Error("生成确认参数或预览超出限制");
  await db.transaction("rw",tables(),async()=>{
    const call=await requireGenerationReviewCall(runId,callId,expected);
    const original=generationSubmitSchema.parse(JSON.parse(call.arguments));
    const reviewed=generationSubmitSchema.parse(JSON.parse(override.arguments));
    if (targetRevision({target:original.target,inputs:original.inputs})!==targetRevision({target:reviewed.target,inputs:reviewed.inputs})) throw new Error("确认时不能变更生成目标或输入素材，请重新发起任务");
    const at=nowIso();
    await db.agentToolCalls.update(callId,{generationOverride:{arguments:JSON.stringify(reviewed),preview:override.preview},status:"approved",decision:"approve",decidedAt:at,updatedAt:at});
  });
}
