import {db} from "./database";
import type {AgentResponseItem, AgentRun, AgentRunOutput} from "@/domain/agent";
import {MODEL_STEPS_PER_SEGMENT} from "@/domain/agent";
import type {AgentFinalReview, FinalReviewClaim, FinalReviewReason} from "@/domain/agentFinalReview";
import {collectFinalReviewSnapshot, finalReviewTables} from "@/lib/agent/finalReviewEvidence";
import {finalReviewMessages, MAX_REVIEW_CONTENT} from "@/lib/agent/finalReview";
import {budgetContext} from "@/lib/agent/contextPlanner";
import {targetRevision} from "@/lib/productionRevision";
import {nowIso} from "@/lib/ids";
import {decodeResponseOutput, toResponseInput} from "@/lib/ai/responsesStream";

async function currentOwner(run: AgentRun): Promise<boolean> {
    const thread = await db.chatThreads.get(run.threadId), message = await db.chatMessages.get(run.assistantMessageId);
    if (!thread || thread.projectId !== run.projectId || !message || message.threadId !== run.threadId || message.runId !== run.id ||
        run.projectId && !await db.projects.get(run.projectId)) return false;
    if (run.taskId) {
        const task = await db.agentTasks.get(run.taskId);
        if (!task || task.threadId !== run.threadId || task.projectId !== run.projectId || task.lifecycle !== "open") return false;
    }
    const runs = await db.agentRuns.where("threadId").equals(run.threadId).toArray();
    const history = await db.chatMessages.where("threadId").equals(run.threadId).toArray();
    return !runs.some(other => other.id !== run.id && other.createdAt >= run.createdAt) &&
        !history.some(row => row.role === "user" && row.createdAt > run.createdAt);
}

/** Atomic one-use claim and request budget reservation. No reload path dispatches this record. */
export async function beginAgentFinalReview(runId: string, expectedStep: number, output: AgentRunOutput, signal: AbortSignal, responseOutput?: AgentResponseItem[]): Promise<AgentRun | undefined> {
    return db.transaction("rw", finalReviewTables(), async () => {
        signal.throwIfAborted();
        const run = await db.agentRuns.get(runId);
        if (!run || run.status !== "running" || run.modelStep !== expectedStep) return;
        if (run.protocol === "responses") {
            const decoded = decodeResponseOutput(responseOutput, []);
            if (!decoded.items.length || decoded.calls.length || decoded.content !== output.content || decoded.reasoning !== (output.reasoning ?? "") ||
                targetRevision(decoded.items) !== targetRevision(responseOutput)) throw new Error("最终回复 Responses 信封不完整");
        } else if (responseOutput !== undefined) throw new Error("最终回复协议与信封不匹配");
        const responseCheckpoint = responseOutput && run.finalResponseStep !== expectedStep ? {
            responseItems: [...(run.responseItems ?? toResponseInput(run.continuationMessages ?? run.requestMessages)), ...responseOutput],
            finalResponseStep: expectedStep
        } : {};
        if (run.finalReview) {
            signal.throwIfAborted();
            if (responseOutput && run.finalResponseStep !== expectedStep) await db.agentRuns.update(run.id, responseCheckpoint);
            return;
        }
        const snapshot = await Promise.resolve(collectFinalReviewSnapshot(run));
        const message = await db.chatMessages.get(run.assistantMessageId);
        let reason: FinalReviewReason | undefined;
        if (!await currentOwner(run) || snapshot.unresolvedCalls || run.interactionMode === "conversation" || !run.enabledToolNames?.length || !output.content.trim()) reason = "ineligible";
        else if (output.content.length > MAX_REVIEW_CONTENT) reason = "content_limit";
        else if (expectedStep - (run.modelStepSegmentStart ?? 0) >= MODEL_STEPS_PER_SEGMENT) reason = "budget";
        else if (message?.content !== output.content || message.reasoning !== output.reasoning) reason = "stale";
        else if (budgetContext(finalReviewMessages(output.content, snapshot), [], run.context?.capacity).overBudget) reason = "context_limit";
        const at = nowIso();
        const review: AgentFinalReview = {version: 1, status: reason ? "unverified" : "pending", reason,
            candidateFingerprint: targetRevision(output), candidateStep: expectedStep, createdAt: at,
            ...(reason ? {endedAt: at} : {step: expectedStep + 1}), snapshot};
        signal.throwIfAborted();
        const next: AgentRun = {...run, finalReview: review, updatedAt: at,
            ...responseCheckpoint,
            ...(reason ? {} : {
            modelStep: expectedStep + 1, usage: undefined, outputTokensPerSecond: undefined,
            ...(run.toolLoading ? {offeredTools: [...(run.offeredTools ?? []), {step: expectedStep + 1, names: []}]} : {})
        })};
        // Final timing can settle after the last streamed checkpoint; preserve exact public output.
        if (message && message.content === output.content && message.reasoning === output.reasoning) await db.chatMessages.update(message.id, {...output});
        await db.agentRuns.put(next);
        return reason ? undefined : next;
    });
}

export async function finishAgentFinalReview(runId: string, candidateFingerprint: string, claims?: FinalReviewClaim[], reason?: FinalReviewReason): Promise<void> {
    await db.transaction("rw", finalReviewTables(), async () => {
        const run = await db.agentRuns.get(runId), review = run?.finalReview;
        if (!run || !review || review.status !== "pending" || review.candidateFingerprint !== candidateFingerprint) return;
        const message = await db.chatMessages.get(run.assistantMessageId);
        const unchanged = run.status === "running" && run.modelStep === review.step && await currentOwner(run) && !!message &&
            targetRevision({content: message.content, reasoning: message.reasoning, reasoningDurationMs: message.reasoningDurationMs}) === candidateFingerprint &&
            (await Promise.resolve(collectFinalReviewSnapshot(run))).fingerprint === review.snapshot.fingerprint;
        const finalReason = unchanged ? reason : "stale";
        await db.agentRuns.update(runId, {finalReview: {...review, status: finalReason || !claims ? "unverified" : "checked",
            reason: finalReason ?? (!claims ? "invalid" : undefined), claims: finalReason ? undefined : claims, endedAt: nowIso()}});
    });
}
