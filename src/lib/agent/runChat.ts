import { getOfferedToolNames, refreshRunToolLoading, toolNamesForCall } from "./toolLoading";
import { upgradeLegacyPlanCalls } from "@/db/agentToolRecovery";
import { budgetContext } from "./contextPlanner";
import { continuationExtraTokens } from "./contextCompaction";
import { refreshRunMemoryContext } from "./memoryContext";
import { refreshRunProjectContext } from "./projectContext";
import { frozenProjectScope } from "./projectScope";
import { ToolPendingError, ToolValidationError } from "./toolErrors";
import { prepareRunContext } from "./contextCompaction";
import { streamResponses, type ResponsesResult } from "@/lib/ai/responsesStream";
import { db } from "@/db/database";
import { AtomicToolRollbackError, saveToolPreview, appendToolResults, markRunningToolsUnknown, pauseForApproval, pauseAtModelStepLimit, resumeAgentRun, saveToolRound, startModelStep, transitionToolCall } from "@/db/agentTools";
import { MODEL_STEPS_PER_SEGMENT } from "@/domain/agent";
import { BUILTIN_TOOLS, requiresToolApproval, toolSchemas, validateToolCall, type AgentToolDefinition } from "@/lib/agent/tools";
import { checkpointAgentRun, finishAgentRun, recordAgentModelMetrics } from "@/db/agentRuns";
import type { AgentRun, AgentRunOutput, AgentToolCall } from "@/domain/agent";
import { accumulateStreamDelta, createReasoningAccum, finalizeReasoningAccum, streamChatCompletions, type StreamDelta, type ReasoningAccum } from "@/lib/ai/chatStream";

/** Coalesce bursts and serialize writes. A failed write stops further streaming. */
export function createRunWriter(persist: (sequence: number, output: AgentRunOutput) => Promise<void>, onFailure: () => void, initialSequence = 0) {
  let sequence = initialSequence;
  let pending: { sequence: number; output: AgentRunOutput } | undefined;
  let draining: Promise<void> | undefined;
  let failure: unknown;
  function drain() {
    if (draining || !pending || failure) return;
    draining = (async () => {
      while (pending) {
        const next = pending;
        pending = undefined;
        await persist(next.sequence, next.output);
      }
    })().catch((error: unknown) => { failure = error; pending = undefined; onFailure(); }).finally(() => { draining = undefined; if (pending) drain(); });
  }
  function push(output: AgentRunOutput) {
    if (failure) return;
    pending = { sequence: ++sequence, output: { ...output } };
    drain();
  }
  return { push, async flush() { while (draining) await draining; if (failure) throw failure; } };
}

export const MAX_MODEL_STEPS = MODEL_STEPS_PER_SEGMENT;

/** Only user review may supply an execution override; wire arguments remain untouched. */
function effectiveToolInput(call: AgentToolCall) {
  if (!call.generationOverride) return { arguments: call.arguments, preview: call.preview };
  if (call.name !== "submit_generation" || !call.requiresConfirmation || call.decision !== "approve") throw new Error("工具覆盖参数没有有效的用户确认");
  return call.generationOverride;
}

/** Pending calls are immutable. Only code-owned definitions decide their effect and risk. */
async function executePendingTools(run: AgentRun, controller: AbortController, registry: readonly AgentToolDefinition[]): Promise<boolean> {
  await upgradeLegacyPlanCalls(run.id);
  const calls = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).sort((a, b) => a.step - b.step || a.order - b.order);
  if (run.protocol === "responses") {
    const savedCalls = run.responseItems?.filter((item) => item.type === "function_call");
    if (!savedCalls || savedCalls.length !== calls.length || calls.some((call) => !savedCalls.some((item) => item.call_id === call.providerCallId && item.name === call.name && item.arguments === call.arguments))) throw new Error("Responses 调用信封与执行记录不匹配，已阻止继续执行");
  }
  let waiting = false;
  for (const call of calls) {
    controller.signal.throwIfAborted();
    if (["completed", "failed", "rejected"].includes(call.status)) continue;
    if (call.status === "unknown" || call.status === "running") throw new Error("有工具结果不确定，不能重跑");
    if (call.status === "awaiting_approval") { waiting = true; continue; }
    let validated: ReturnType<typeof validateToolCall>;
    try { await frozenProjectScope({runId:run.id,threadId:run.threadId,callId:call.id,signal:controller.signal,projectId:run.projectId}); validated = validateToolCall(call.name, effectiveToolInput(call).arguments, toolNamesForCall(run, call.step), registry); }
    catch (error) {
      const message = error instanceof Error ? error.message : "工具参数无效";
      await transitionToolCall(run.id, call.id, ["pending", "approved"], "failed", { error: message, result: JSON.stringify(error instanceof ToolValidationError ? error.failure : { error: message }) });
      continue;
    }
    const { tool, args } = validated;
    if (tool.effect !== call.effect || tool.highRisk(args) !== call.highRisk || Boolean(tool.atomic) !== Boolean(call.atomic) || tool.recovery !== call.recovery || Boolean(tool.requiresConfirmation) !== Boolean(call.requiresConfirmation)) throw new Error("工具定义已变化，请结束本次执行后重新发起任务");
    if (tool.prepare && !call.preview) {
      try {
        if (call.status !== "pending") throw new Error("操作缺少批准前预览，请重新发起");
        const preview = await tool.prepare(args, { projectId: run.projectId, runId: run.id, threadId: run.threadId, callId: call.id, signal: controller.signal });
        await saveToolPreview(run.id, call.id, preview);
      } catch (error) {
        controller.signal.throwIfAborted();
        const message = error instanceof Error ? error.message : "无法准备操作预览";
        await transitionToolCall(run.id, call.id, ["pending", "approved"], "failed", { error: message, result: JSON.stringify({ error: message }) });
        continue;
      }
    }
    if (call.status !== "approved" && requiresToolApproval(run.permissionMode ?? "ask", tool, args)) {
      await transitionToolCall(run.id, call.id, ["pending"], "awaiting_approval");
      waiting = true;
    }
  }
  if (waiting) { await pauseForApproval(run.id); return false; }
  for (const saved of calls) {
    controller.signal.throwIfAborted();
    const call = await db.agentToolCalls.get(saved.id);
    if (!call || ["completed", "failed", "rejected"].includes(call.status)) continue;
    const { tool, args } = validateToolCall(call.name, effectiveToolInput(call).arguments, toolNamesForCall(run, call.step), registry);
    if (tool.effect !== call.effect || tool.highRisk(args) !== call.highRisk || Boolean(tool.atomic) !== Boolean(call.atomic) || tool.recovery !== call.recovery || Boolean(tool.requiresConfirmation) !== Boolean(call.requiresConfirmation)) throw new Error("工具定义已变化，请结束本次执行后重新发起任务");
    // Recheck permission immediately before the claim. A global setting cannot change this run's mode.
    if (requiresToolApproval(run.permissionMode ?? "ask", tool, args) && call.status !== "approved") throw new Error("工具尚未获得批准");
    if (!await transitionToolCall(run.id, call.id, ["pending", "approved"], "running")) throw new Error("工具已被其他执行领取");
    controller.signal.throwIfAborted();
    try {
      const value = await tool.execute(args, { projectId: run.projectId, runId: run.id, threadId: run.threadId, callId: call.id, signal: controller.signal, preview: effectiveToolInput(call).preview });
      const result = JSON.stringify(value);
      if (result === undefined || result.length > 65_536) throw new Error("工具结果无效或超过大小限制");
      // Save a known completed result even if Stop was clicked while the operation settled.
      await transitionToolCall(run.id, call.id, ["running"], "completed", { result });
    } catch (cause) {
      // An atomic tool may already have committed its result before a later failure.
      const persisted = await db.agentToolCalls.get(call.id);
      if (persisted?.status === "completed") continue;
      if (cause instanceof ToolPendingError || controller.signal.aborted && call.recovery) {
        await markRunningToolsUnknown(run.id);
        throw cause instanceof ToolPendingError ? cause : new ToolPendingError("生成任务已保存，请继续查询已有任务。");
      }
      // Exceptions from side effects cannot certify that nothing happened.
      const ambiguous = !(cause instanceof AtomicToolRollbackError) && (tool.effect === "write" || tool.effect === "network" || tool.effect === "bookkeeping");
      const error = ambiguous ? "操作结果尚不确定，请先核实，不能自动重跑。" : cause instanceof Error ? cause.message : "工具执行失败。";
      await transitionToolCall(run.id, call.id, ["running"], ambiguous ? "unknown" : "failed", { error, ...(!ambiguous ? { result: JSON.stringify({ error }) } : {}) });
      if (ambiguous) throw new Error(error);
    }
    controller.signal.throwIfAborted();
  }
  await appendToolResults(run.id);
  return true;
}

/** Caller holds withThreadRunLock across resume, all requests, tools, and final persistence. */
export async function resumeChatRun(runId: string, apiKey: string, controller: AbortController, fetchImpl?: typeof fetch, registry: readonly AgentToolDefinition[] = BUILTIN_TOOLS): Promise<void> {
  controller.signal.throwIfAborted();
  const run = await resumeAgentRun(runId);
  await executeChatRun(run, apiKey, controller, fetchImpl, registry);
}

export async function executeChatRun(initialRun: AgentRun, apiKey: string, controller: AbortController, fetchImpl?: typeof fetch, registry: readonly AgentToolDefinition[] = BUILTIN_TOOLS): Promise<void> {
  let run = initialRun;
  const savedOutput = await db.chatMessages.get(run.assistantMessageId);
  let accum: ReasoningAccum = { ...createReasoningAccum(), content: savedOutput?.content ?? "", reasoning: savedOutput?.reasoning ?? "", reasoningDurationMs: savedOutput?.reasoningDurationMs };
  let saveFailed = false;
  const onWriteFailure = () => { saveFailed = true; controller.abort(); };
  let sequence = run.checkpoint;
  const output = (): AgentRunOutput => ({ content: accum.content, reasoning: accum.reasoning, reasoningDurationMs: accum.reasoningDurationMs });
  let writer = createRunWriter((seq, next) => { sequence = seq; return checkpointAgentRun(run.id, seq, next); }, onWriteFailure, sequence);
  try {
    if (run.hasToolCalls && !await executePendingTools(run, controller, registry)) return;
    while (true) {
      controller.signal.throwIfAborted();
      if (await pauseAtModelStepLimit(run.id)) return;
      run = await refreshRunToolLoading(run.id);
      run = await refreshRunProjectContext(run.id);
      run = await refreshRunMemoryContext(run.id);
      run = await prepareRunContext(run.id, toolSchemas(getOfferedToolNames(run), registry), apiKey, controller.signal, fetchImpl);
      // Compaction may await network; re-read memory once more at the final dispatch boundary.
      run = await refreshRunMemoryContext(run.id);
      if (budgetContext(run.continuationMessages ?? run.requestMessages, toolSchemas(getOfferedToolNames(run), registry), run.context?.capacity, !!run.context?.summaryId, continuationExtraTokens(run)).overBudget) throw new Error("记忆更新后上下文超出安全预算，请减少历史或调整输入后继续");
      run = await startModelStep(run.id, MAX_MODEL_STEPS);
      controller.signal.throwIfAborted();
      accum = createReasoningAccum();
      writer = createRunWriter((seq, next) => { sequence = seq; return checkpointAgentRun(run.id, seq, next); }, onWriteFailure, sequence);
      const onDelta = (delta: StreamDelta) => {
        if (controller.signal.aborted) return;
        accum = accumulateStreamDelta(accum, delta, Date.now());
        writer.push(output());
      };
      const transport = run.protocol === "responses" ? streamResponses : streamChatCompletions;
      const result: ResponsesResult = await transport({ projectId: run.projectId, runId: run.id, visionCapability: run.visionCapability, responseItems: run.responseItems, baseUrl: run.connector.baseUrl, apiKey, model: run.model, connectorDefinitionId: run.connector.definitionId, reasoningEffort: run.reasoningEffort, messages: run.continuationMessages ?? run.requestMessages, tools: toolSchemas(getOfferedToolNames(run), registry) }, {
        signal: controller.signal, fetchImpl,
        onDelta: (content) => onDelta({ content }), onReasoning: (reasoning) => onDelta({ reasoning }),
      });
      accum = finalizeReasoningAccum(accum, Date.now());
      await writer.flush();
      if (result.metrics) await recordAgentModelMetrics(run.id, { ...result.metrics, step: run.modelStep! });
      if (controller.signal.aborted || (!result.ok && result.aborted)) {
        await finishAgentRun(run.id, run.hasToolCalls ? "interrupted" : "cancelled", output(), "已停止，已收到的内容与完成的步骤保留。");
        return;
      }
      if (!result.ok) { await finishAgentRun(run.id, "failed", output(), result.message, result.finishReason); return; }
      if (!result.toolCalls?.length) { await finishAgentRun(run.id, "completed", output(), undefined, result.finishReason); return; }
      const details = result.toolCalls.map((call) => {
        const tool = registry.find((item) => item.name === call.function.name);
        if (!tool) throw new Error("未知工具");
        let highRisk = tool.effect !== "read";
        try { highRisk = tool.highRisk(tool.parseArguments(JSON.parse(call.function.arguments))); } catch { /* Invalid arguments are recorded then rejected before execution. */ }
        return { title: tool.title, effect: tool.effect, highRisk, ...(tool.atomic ? { atomic: true } : {}), ...(tool.recovery ? { recovery: tool.recovery } : {}), ...(tool.requiresConfirmation ? { requiresConfirmation: true } : {}) };
      });
      await saveToolRound(run.id, result.content, result.toolCalls, details, result.responseOutput, output());
      run = (await db.agentRuns.get(run.id))!;
      controller.signal.throwIfAborted();
      if (!await executePendingTools(run, controller, registry)) return;
    }
  } catch (error) {
    await writer.flush().catch(() => undefined);
    const aborted = controller.signal.aborted;
    controller.abort();
    // Close claimed calls conservatively on unexpected interruption. Completed calls remain immutable.
    await markRunningToolsUnknown(run.id);
    const message = error instanceof Error ? error.message.split(apiKey).join("[已隐藏]").slice(0, 300) : "执行或本地保存失败";
    const latest = await db.agentRuns.get(run.id);
    await finishAgentRun(run.id, saveFailed ? "failed" : error instanceof ToolPendingError ? "interrupted" : aborted ? (latest?.hasToolCalls ? "interrupted" : "cancelled") : "failed", output(), saveFailed ? "执行或本地保存失败，最后一段内容可能尚未保存。" : aborted ? "已停止，已完成的步骤保留。" : message);
    if (saveFailed) throw new Error("执行或本地保存失败，最后一段内容可能尚未保存");
  }
}
