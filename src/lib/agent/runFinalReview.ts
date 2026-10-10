import type {AgentResponseItem, AgentRunOutput} from "@/domain/agent";
import type {FinalReviewReason} from "@/domain/agentFinalReview";
import {beginAgentFinalReview, finishAgentFinalReview} from "@/db/agentFinalReview";
import {recordAgentModelMetrics} from "@/db/agentRuns";
import {streamChatCompletions} from "@/lib/ai/chatStream";
import {streamResponses} from "@/lib/ai/responsesStream";
import {finalReviewMessages, parseFinalReview} from "./finalReview";

const REVIEW_TIMEOUT_MS = 30_000;

/** One fresh zero-tool request. Its answer never enters the public reply or business continuation. */
export async function reviewFinalReply(runId: string, expectedStep: number, output: AgentRunOutput, apiKey: string,
    signal: AbortSignal, fetchImpl?: typeof fetch, responseOutput?: AgentResponseItem[]): Promise<void> {
    const run = await beginAgentFinalReview(runId, expectedStep, output, signal, responseOutput);
    if (!run?.finalReview) return;
    const review = run.finalReview;
    const messages = finalReviewMessages(output.content, review.snapshot);
    const controller = new AbortController();
    let reason: FinalReviewReason | undefined;
    const stopped = () => { reason = "stopped"; controller.abort(); };
    signal.addEventListener("abort", stopped, {once: true});
    const timer = setTimeout(() => { reason = "timeout"; controller.abort(); }, REVIEW_TIMEOUT_MS);
    if (signal.aborted) stopped();
    let length = 0;
    let rejectAbort: (() => void) | undefined;
    try {
        signal.throwIfAborted();
        const transport = run.protocol === "responses" ? streamResponses : streamChatCompletions;
        const interrupted = new Promise<never>((_, reject) => {
            rejectAbort = () => reject(new Error("只读检查已中断"));
            controller.signal.addEventListener("abort", rejectAbort, {once: true});
        });
        const result = await Promise.race([interrupted, transport({baseUrl: run.connector.baseUrl, apiKey, model: run.model,
            connectorDefinitionId: run.connector.definitionId, reasoningEffort: run.reasoningEffort,
            messages, tools: [], maxOutputTokens: 4096}, {
            signal: controller.signal, fetchImpl,
            onDelta: delta => { length += delta.length; if (length > 24_000) { reason = "invalid"; controller.abort(); } }
        })]);
        if (result.metrics) await recordAgentModelMetrics(run.id, {...result.metrics, step: run.modelStep!, purpose: "final_review"});
        if (!result.ok || result.toolCalls?.length || controller.signal.aborted) {
            await finishAgentFinalReview(runId, review.candidateFingerprint, undefined, reason ?? "transport");
            return;
        }
        let claims;
        try { claims = parseFinalReview(result.content, output.content, review.snapshot); }
        catch { await finishAgentFinalReview(runId, review.candidateFingerprint, undefined, "invalid"); return; }
        await finishAgentFinalReview(runId, review.candidateFingerprint, claims);
    } catch {
        await finishAgentFinalReview(runId, review.candidateFingerprint, undefined, reason ?? "transport");
    } finally {
        clearTimeout(timer);
        if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
        signal.removeEventListener("abort", stopped);
    }
}
