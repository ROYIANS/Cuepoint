import type {ProductStore} from "@/lib/storage/types";
import {StorageError} from "@/lib/storage/errors";
import {toolMetadataMatches} from './toolDefinition';
import {getOfferedToolNames, refreshRunToolLoading, toolNamesForCall} from "./toolLoading";
import {saveAgentFinishingCheck} from "@/db/agentFinishingCheck";
import {upgradeLegacyPlanCalls} from "@/db/agentToolRecovery";
import {budgetContext} from "./contextPlanner";
import {continuationExtraTokens, prepareRunContext} from "./contextCompaction";
import {refreshRunMemoryContext} from "./memoryContext";
import {refreshRunProjectContext} from "./projectContext";
import {frozenProjectScope} from "./projectScope";
import {toolFailureResult, ToolPendingError, ToolUnavailableError} from "./toolErrors";
import {redactCredentials} from "@/lib/ai/safeError";
import {type ResponsesResult, streamResponses} from "@/lib/ai/responsesStream";
import {db as productDb} from "@/db/database";
import {
    appendToolResults,
    AtomicToolRollbackError,
    markRunningToolsUnknown,
    pauseAtModelStepLimit,
    pauseForApproval,
    resumeAgentRun,
    saveToolPreview,
    saveToolRound,
    startModelStep,
    transitionToolCall
} from "@/db/agentTools";
import type {AgentRun, AgentRunOutput, AgentToolCall} from "@/domain/agent";
import {MODEL_STEPS_PER_SEGMENT} from "@/domain/agent";
import {
    type AgentToolDefinition,
    BUILTIN_TOOLS,
    requiresToolApproval,
    toolSchemas,
    validateToolCall
} from "@/lib/agent/tools";
import {checkpointAgentRun, finishAgentRun, recordAgentModelMetrics} from "@/db/agentRuns";
import {
    accumulateStreamDelta,
    createReasoningAccum,
    finalizeReasoningAccum,
    type ReasoningAccum,
    streamChatCompletions,
    type StreamDelta
} from "@/lib/ai/chatStream";

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
        })().catch((error: unknown) => {
            failure = error;
            pending = undefined;
            onFailure();
        }).finally(() => {
            draining = undefined;
            if (pending) drain();
        });
    }

    function push(output: AgentRunOutput) {
        if (failure) return;
        pending = {sequence: ++sequence, output: {...output}};
        drain();
    }

    return {
        push, async flush() {
            while (draining) await draining;
            if (failure) throw failure;
        }
    };
}

const MAX_MODEL_STEPS = MODEL_STEPS_PER_SEGMENT;

/** A failed completion lookup cannot certify that an atomic operation rolled back. */
class UnresolvedToolOutcomeError extends Error {
}

/** A name the registry does not own has no real title; keep the bounded display label neutral. */
function unavailableToolTitle(name: string): string {
    return `不可用的工具 ${name.slice(0, 60)}`;
}

/** Only user review may supply an execution override; wire arguments remain untouched. */
function effectiveToolInput(call: AgentToolCall) {
    if (!call.generationOverride) return {arguments: call.arguments, preview: call.preview};
    if (call.name !== "submit_generation" || !call.requiresConfirmation || call.decision !== "approve") throw new Error("工具覆盖参数没有有效的用户确认");
    return call.generationOverride;
}

/** Pending calls are immutable. Only code-owned definitions decide their effect and risk. */
async function executePendingTools(run: AgentRun, controller: AbortController, registry: readonly AgentToolDefinition[], store?: ProductStore): Promise<boolean> {
    const db = store ?? productDb;
    await upgradeLegacyPlanCalls(run.id, db);
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
        if (call.status === "awaiting_approval") {
            waiting = true;
            continue;
        }
        let validated: ReturnType<typeof validateToolCall>;
        try {
            await frozenProjectScope({
                runId: run.id,
                threadId: run.threadId,
                callId: call.id,
                signal: controller.signal,
                projectId: run.projectId
            }, db);
            validated = validateToolCall(call.name, effectiveToolInput(call).arguments, toolNamesForCall(run, call.step), registry);
        } catch (error) {
            const message = error instanceof Error ? error.message : "工具参数无效";
            await transitionToolCall(run.id, call.id, ["pending", "approved"], "failed", {
                error: message,
                result: JSON.stringify(toolFailureResult(error, "not_started") ?? {error: message})
            }, db);
            continue;
        }
        const {tool, args} = validated;
        if (!toolMetadataMatches(tool, args, call)) throw new Error("工具定义已变化，请结束本次执行后重新发起任务");
        if (tool.prepare && !call.preview) {
            try {
                if (call.status !== "pending") throw new Error("操作缺少批准前预览，请重新发起");
                const preview = await tool.prepare(args, {
                    projectId: run.projectId,
                    runId: run.id,
                    threadId: run.threadId,
                    callId: call.id,
                    signal: controller.signal,
                    store: db
                });
                await saveToolPreview(run.id, call.id, preview, db);
            } catch (error) {
                controller.signal.throwIfAborted();
                const message = error instanceof Error ? error.message : "无法准备操作预览";
                await transitionToolCall(run.id, call.id, ["pending", "approved"], "failed", {
                    error: message,
                    result: JSON.stringify(toolFailureResult(error, "not_started") ?? {error: message})
                }, db);
                continue;
            }
        }
        if (call.status !== "approved" && requiresToolApproval(run.permissionMode ?? "ask", tool, args)) {
            await transitionToolCall(run.id, call.id, ["pending"], "awaiting_approval", undefined, db);
            waiting = true;
        }
    }
    if (waiting) {
        await pauseForApproval(run.id, db);
        return false;
    }
    for (const saved of calls) {
        controller.signal.throwIfAborted();
        // Current tool commands preserve settled history; reread every possible execution candidate.
        if (["completed", "failed", "rejected"].includes(saved.status)) continue;
        const call = await db.agentToolCalls.get(saved.id);
        if (!call || ["completed", "failed", "rejected"].includes(call.status)) continue;
        const currentRun = await db.agentRuns.get(run.id);
        if (!currentRun || currentRun.status !== "running") throw new Error("执行已停止");
        const {
            tool,
            args
        } = validateToolCall(call.name, effectiveToolInput(call).arguments, toolNamesForCall(currentRun, call.step), registry);
        if (!toolMetadataMatches(tool, args, call)) throw new Error("工具定义已变化，请结束本次执行后重新发起任务");
        // Recheck permission immediately before the claim. A global setting cannot change this run's mode.
        if (requiresToolApproval(run.permissionMode ?? "ask", tool, args) && call.status !== "approved") throw new Error("工具尚未获得批准");
        if (!await transitionToolCall(run.id, call.id, ["pending", "approved"], "running", undefined, db)) throw new Error("工具已被其他执行领取");
        controller.signal.throwIfAborted();
        try {
            const value = await tool.execute(args, {
                projectId: currentRun.projectId,
                runId: run.id,
                threadId: run.threadId,
                callId: call.id,
                signal: controller.signal,
                preview: effectiveToolInput(call).preview,
                store: db
            });
            const result = JSON.stringify(value);
            if (result === undefined || result.length > 65_536) throw new Error("工具结果无效或超过大小限制");
            // Save a known completed result even if Stop was clicked while the operation settled.
            await transitionToolCall(run.id, call.id, ["running"], "completed", {result}, db);
        } catch (cause) {
            // An atomic tool may already have committed its result before a later failure.
            let persisted: AgentToolCall | undefined;
            try {
                persisted = await db.agentToolCalls.get(call.id);
            } catch (lookupError) {
                if (tool.effect !== "read") throw new UnresolvedToolOutcomeError("无法核实已保存的工具结果，不能自动重跑。", {cause: lookupError});
                throw lookupError;
            }
            if (persisted?.status === "completed") continue;
            if (cause instanceof ToolPendingError || controller.signal.aborted && call.recovery) {
                await markRunningToolsUnknown(run.id, db);
                throw cause instanceof ToolPendingError ? cause : new ToolPendingError("生成任务已保存，请继续查询已有任务。");
            }
            // Exceptions from side effects cannot certify that nothing happened.
            const ambiguous = !(cause instanceof AtomicToolRollbackError) && (tool.effect === "write" || tool.effect === "network" || tool.effect === "bookkeeping");
            const error = ambiguous ? "操作结果尚不确定，请先核实，不能自动重跑。" : cause instanceof Error ? cause.message : "工具执行失败。";
            const certainty = cause instanceof AtomicToolRollbackError ? "rolled_back" : tool.effect === "read" ? "not_started" : "unknown";
            try {
                await transitionToolCall(run.id, call.id, ["running"], ambiguous ? "unknown" : "failed", {
                    error,
                    ...(!ambiguous ? {result: JSON.stringify(toolFailureResult(cause, certainty) ?? {error})} : {})
                }, db);
            } catch (saveError) {
                if (ambiguous) throw new UnresolvedToolOutcomeError(error, {cause: saveError});
                throw saveError;
            }
            if (ambiguous) throw new UnresolvedToolOutcomeError(error, {cause});
        }
        controller.signal.throwIfAborted();
    }
    await appendToolResults(run.id, db);
    return true;
}

/** Caller holds withThreadRunLock across resume, all requests, tools, and final persistence. */
export async function resumeChatRun(runId: string, apiKey: string, controller: AbortController, fetchImpl?: typeof fetch, registry: readonly AgentToolDefinition[] = BUILTIN_TOOLS, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    controller.signal.throwIfAborted();
    const run = await resumeAgentRun(runId, db);
    await executeChatRun(run, apiKey, controller, fetchImpl, registry, db);
}

export async function executeChatRun(initialRun: AgentRun, apiKey: string, controller: AbortController, fetchImpl?: typeof fetch, registry: readonly AgentToolDefinition[] = BUILTIN_TOOLS, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    let run = initialRun;
    const savedOutput = await db.chatMessages.get(run.assistantMessageId);
    let accum: ReasoningAccum = {
        ...createReasoningAccum(),
        content: savedOutput?.content ?? "",
        reasoning: savedOutput?.reasoning ?? "",
        reasoningDurationMs: savedOutput?.reasoningDurationMs
    };
    let saveFailed = false;
    const onWriteFailure = () => {
        saveFailed = true;
        controller.abort();
    };
    let sequence = run.checkpoint;
    const output = (): AgentRunOutput => ({
        content: accum.content,
        reasoning: accum.reasoning,
        reasoningDurationMs: accum.reasoningDurationMs
    });
    let writer = createRunWriter((seq, next) => {
        sequence = seq;
        return checkpointAgentRun(run.id, seq, next, db);
    }, onWriteFailure, sequence);
    try {
        if (run.hasToolCalls && !await executePendingTools(run, controller, registry, db)) return;
        while (true) {
            controller.signal.throwIfAborted();
            if (await pauseAtModelStepLimit(run.id, db)) return;
            run = await refreshRunToolLoading(run.id, db);
            run = await refreshRunProjectContext(run.id, db);
            run = await refreshRunMemoryContext(run.id, db);
            run = await prepareRunContext(run.id, toolSchemas(getOfferedToolNames(run), registry), apiKey, controller.signal, fetchImpl, db);
            // Compaction may await network; re-read memory once more at the final dispatch boundary.
            run = await refreshRunMemoryContext(run.id, db);
            if (budgetContext(run.continuationMessages ?? run.requestMessages, toolSchemas(getOfferedToolNames(run), registry), run.context?.capacity, !!run.context?.summaryId, continuationExtraTokens(run)).overBudget) throw new Error("记忆更新后上下文超出安全预算，请减少历史或调整输入后继续");
            run = await startModelStep(run.id, MAX_MODEL_STEPS, db);
            controller.signal.throwIfAborted();
            accum = createReasoningAccum();
            writer = createRunWriter((seq, next) => {
                sequence = seq;
                return checkpointAgentRun(run.id, seq, next, db);
            }, onWriteFailure, sequence);
            const onDelta = (delta: StreamDelta) => {
                if (controller.signal.aborted) return;
                accum = accumulateStreamDelta(accum, delta, Date.now());
                writer.push(output());
            };
            const transport = run.protocol === "responses" ? streamResponses : streamChatCompletions;
            const result: ResponsesResult = await transport({
                projectId: run.projectId,
                runId: run.id,
                visionCapability: run.visionCapability,
                responseItems: run.responseItems,
                baseUrl: run.connector.baseUrl,
                apiKey,
                model: run.model,
                connectorDefinitionId: run.connector.definitionId,
                reasoningEffort: run.reasoningEffort,
                messages: run.continuationMessages ?? run.requestMessages,
                tools: toolSchemas(getOfferedToolNames(run), registry)
            }, {
                signal: controller.signal, fetchImpl,
                onDelta: (content) => onDelta({content}), onReasoning: (reasoning) => onDelta({reasoning}),
            });
            accum = finalizeReasoningAccum(accum, Date.now());
            await writer.flush();
            if (result.metrics) await recordAgentModelMetrics(run.id, {...result.metrics, step: run.modelStep!}, db);
            if (controller.signal.aborted || (!result.ok && result.aborted)) {
                await finishAgentRun(run.id, run.hasToolCalls ? "interrupted" : "cancelled", output(), "已停止，已收到的内容与完成的步骤保留。", undefined, db);
                return;
            }
            if (!result.ok) {
                await finishAgentRun(run.id, "failed", output(), result.message, result.finishReason, db);
                return;
            }
            if (!result.toolCalls?.length) {
                if (await saveAgentFinishingCheck(run.id, run.modelStep!, output(), result.responseOutput, controller.signal, db)) continue;
                controller.signal.throwIfAborted();
                await finishAgentRun(run.id, "completed", output(), undefined, result.finishReason, db);
                return;
            }
            const offeredNames = getOfferedToolNames(run);
            const details = result.toolCalls.map((call) => {
                const tool = registry.find((item) => item.name === call.function.name);
                // A name this request never offered is stored as an already-failed call and
                // fed back to the model, exactly like invalid arguments. It never executes,
                // never carries a preview and never requests approval.
                if (!tool || !offeredNames.includes(call.function.name)) {
                    const failure = new ToolUnavailableError(call.function.name, offeredNames);
                    return {
                        title: unavailableToolTitle(call.function.name),
                        effect: "read" as const,
                        highRisk: false,
                        failure: {
                            error: failure.message,
                            result: JSON.stringify(toolFailureResult(failure, "not_started"))
                        }
                    };
                }
                let highRisk = tool.effect !== "read";
                try {
                    highRisk = tool.highRisk(tool.parseArguments(JSON.parse(call.function.arguments)));
                } catch { /* Invalid arguments are recorded then rejected before execution. */
                }
                return {
                    title: tool.title,
                    effect: tool.effect,
                    highRisk, ...(tool.atomic ? {atomic: true} : {}), ...(tool.recovery ? {recovery: tool.recovery} : {}), ...(tool.requiresConfirmation ? {requiresConfirmation: true} : {})
                };
            });
            await saveToolRound(run.id, result.content, result.toolCalls, details, result.responseOutput, output(), db);
            run = (await db.agentRuns.get(run.id))!;
            controller.signal.throwIfAborted();
            if (!await executePendingTools(run, controller, registry, db)) return;
        }
    } catch (error) {
        await writer.flush().catch(() => undefined);
        const aborted = controller.signal.aborted;
        controller.abort();
        // Close claimed calls conservatively on unexpected interruption. Completed calls remain immutable.
        await markRunningToolsUnknown(run.id, db, error instanceof UnresolvedToolOutcomeError || error instanceof StorageError && error.certainty === "unknown");
        // Shared redaction: an empty key must not explode the message into characters.
        const message = error instanceof Error ? redactCredentials(error.message, apiKey).slice(0, 300) : "执行或本地保存失败";
        // One fresh read decides whether preserved work needs an explicit resume. The
        // in-memory run may already be stale after saveToolRound refreshed durable state.
        const latest = await db.agentRuns.get(run.id);
        const interrupted = Boolean(latest?.hasToolCalls);
        run = latest ?? run;
        await finishAgentRun(run.id, saveFailed ? "failed" : error instanceof ToolPendingError || interrupted && aborted ? "interrupted" : aborted ? "cancelled" : "failed", output(), saveFailed ? "执行或本地保存失败，最后一段内容可能尚未保存。" : aborted ? "已停止，已完成的步骤保留。" : message, undefined, db);
        if (saveFailed) throw new Error("执行或本地保存失败，最后一段内容可能尚未保存");
    }
}
