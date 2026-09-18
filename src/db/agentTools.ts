import { db } from "@/db/database";
import type { AgentPlanItem, AgentResponseItem, AgentRun, AgentToolCall, AgentWireToolCall } from "@/domain/agent";
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
const tables = () => [db.agentRuns, db.agentToolCalls, db.chatThreads, db.chatMessages];
async function requireLatestRun(run: AgentRun): Promise<void> {
  const siblings = await db.agentRuns.where("threadId").equals(run.threadId).toArray();
  const history = await db.chatMessages.where("threadId").equals(run.threadId).toArray();
  if (siblings.some((other) => other.id !== run.id && other.createdAt >= run.createdAt) || history.some((message) => message.role === "user" && message.createdAt > run.createdAt)) throw new Error("只能继续当前最后一次执行");
}
export async function startModelStep(runId: string, limit: number): Promise<AgentRun> {
  return db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    if (run.status !== "running") throw new Error("执行已停止");
    if ((run.modelStep ?? 0) >= limit) throw new Error("已达到本次执行的模型步骤上限，请结束本次执行后调整任务");
    const next = { ...run, modelStep: (run.modelStep ?? 0) + 1, usage: undefined, outputTokensPerSecond: undefined, updatedAt: nowIso() };
    await db.agentRuns.put(next);
    return next;
  });
}
export async function saveToolRound(runId: string, content: string, wireCalls: AgentWireToolCall[], details: Pick<AgentToolCall, "title" | "effect" | "highRisk">[], responseOutput?: AgentResponseItem[]): Promise<void> {
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
    await db.agentRuns.update(runId, { ...(responseOutput ? { responseItems: [...(run.responseItems ?? toResponseInput(run.requestMessages)), ...responseOutput] } : {}), hasToolCalls: true, continuationMessages: [...(run.continuationMessages ?? run.requestMessages), { role: "assistant", content, tool_calls: wireCalls }], updatedAt: at });
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
    if (!canResumeAgentRun(run)) throw new Error("此执行不能继续");
    await requireLatestRun(run);
    const calls = await db.agentToolCalls.where("runId").equals(runId).toArray();
    if (calls.some((call) => call.status === "running" || call.status === "unknown")) throw new Error("有操作结果尚不确定，请先核实，不能自动继续或重跑");
    if (calls.some((call) => call.status === "awaiting_approval")) throw new Error("请先批准或拒绝待处理的操作");
    const next = { ...run, status: "running" as const, error: undefined, endedAt: undefined, updatedAt: nowIso() };
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
export async function updateRunPlanAndComplete(runId: string, callId: string, plan: AgentPlanItem[]): Promise<string> {
  return db.transaction("rw", tables(), async () => {
    const run = await requireRun(runId);
    const call = await db.agentToolCalls.get(callId);
    if (run.status !== "running" || !call || call.runId !== runId || call.threadId !== run.threadId || call.status !== "running" || call.name !== "update_run_plan") throw new Error("计划操作归属不匹配");
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
    await db.agentRuns.update(runId, { status: "cancelled", updatedAt: at, endedAt: at, error: "本次执行已结束，已完成的步骤保留。" });
    await db.chatMessages.update(run.assistantMessageId, { status: "aborted", error: "本次执行已结束，已完成的步骤保留。" });
  });
}

export async function markRunningToolsUnknown(runId: string): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    if (!(await db.agentRuns.get(runId))) return;
    await db.agentToolCalls.where("runId").equals(runId).filter((call) => call.status === "running").modify({ status: "unknown", error: "操作结果尚不确定，不能自动重跑。", updatedAt: nowIso() });
  });
}
