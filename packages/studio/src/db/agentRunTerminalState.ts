import type {StoreTx} from "../lib/storage/types";
import type {AgentRun, AgentRunOutput, AgentRunStatus} from "../domain/agent";
import {nowIso} from "../lib/ids";

const SETTLED_MESSAGE_STATUS = {
    completed: "complete",
    failed: "error",
    cancelled: "aborted",
    interrupted: "interrupted"
} as const;

/**
 * The one writer for a run's terminal state, shared by every caller that ends an
 * execution. Callers supply their own transaction so the ledger mutation, the run
 * record and the assistant message settle together; nothing else may write these
 * fields by hand.
 */
export async function settleRun(db: StoreTx, runId: string, status: Exclude<AgentRunStatus, "running" | "waiting_approval">, options: {
    output?: AgentRunOutput;
    error?: string;
    finishReason?: string;
    pauseReason?: AgentRun["pauseReason"];
    /** Keep the visible answer text and reasoning instead of overwriting it with `output`. */
    preserveOutput?: boolean;
    /** A notice addressed to the reader only; the run record keeps `error` unchanged. */
    messageError?: string;
    /** Source states this transition accepts. Resumable runs may also be ended explicitly. */
    allowedFrom?: readonly AgentRunStatus[];
} = {}): Promise<boolean> {
    const run = await db.agentRuns.get(runId);
    if (!run || !(options.allowedFrom ?? ["running", "waiting_approval"]).includes(run.status)) return false;
    const message = await db.chatMessages.get(run.assistantMessageId);
    if (!message || message.runId !== run.id) throw new Error("执行消息不存在");
    const at = nowIso();
    // A caller that supplies output owns the answer text and the closing reasoning timing.
    // An empty final attempt must not erase already-visible text from an earlier step.
    const content = options.output?.content ?? "";
    const outputPatch = options.preserveOutput ? {} : {content: content || message.content, error: undefined};
    const timingPatch = options.preserveOutput || options.output === undefined
        ? {} : {
            reasoning: options.output.reasoning || message.reasoning,
            reasoningDurationMs: options.output.reasoningDurationMs ?? message.reasoningDurationMs
        };
    await db.chatMessages.update(message.id, {
        ...outputPatch, ...timingPatch,
        status: SETTLED_MESSAGE_STATUS[status],
        error: options.messageError ?? options.error,
    });
    await db.agentRuns.update(run.id, {
        status,
        error: options.error,
        finishReason: options.finishReason,
        // Only an explicit pause keeps a pause reason; every terminal state clears it.
        ...(options.pauseReason === undefined ? {pauseReason: undefined} : {pauseReason: options.pauseReason}),
        updatedAt: at,
        endedAt: at,
    });
    return true;
}

