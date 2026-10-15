/** One provisional chunk may carry answer text, reasoning text, or both. */
export type StreamDelta = {content?: string; reasoning?: string};

/**
 * Accumulate reasoning/content deltas and close reasoning on first answer token
 * (LobeHub lifecycle without an operation store).
 */
export type ReasoningAccum = {
    content: string;
    reasoning: string;
    reasoningActive: boolean;
    reasoningStartedAt: number | null;
    reasoningDurationMs?: number;
};

export function createReasoningAccum(): ReasoningAccum {
    return {
        content: "",
        reasoning: "",
        reasoningActive: false,
        reasoningStartedAt: null,
    };
}

export function accumulateStreamDelta(
    state: ReasoningAccum,
    delta: StreamDelta,
    nowMs: number,
): ReasoningAccum {
    let content = state.content;
    let reasoning = state.reasoning;
    let reasoningActive = state.reasoningActive;
    let reasoningStartedAt = state.reasoningStartedAt;
    let reasoningDurationMs = state.reasoningDurationMs;

    if (delta.reasoning) {
        if (reasoningStartedAt == null) {
            reasoningStartedAt = nowMs;
        }
        reasoning += delta.reasoning;
        if (!content) reasoningActive = true;
    }

    if (delta.content) {
        if (reasoningActive && reasoningStartedAt != null && reasoningDurationMs == null) {
            reasoningDurationMs = Math.max(0, nowMs - reasoningStartedAt);
            reasoningActive = false;
        }
        content += delta.content;
    }

    return {
        content,
        reasoning,
        reasoningActive,
        reasoningStartedAt,
        reasoningDurationMs,
    };
}

/** End reasoning on abort/complete so the panel can collapse. */
export function finalizeReasoningAccum(
    state: ReasoningAccum,
    nowMs: number,
): ReasoningAccum {
    if (!state.reasoningActive) return state;
    const started = state.reasoningStartedAt;
    return {
        ...state,
        reasoningActive: false,
        reasoningDurationMs:
            state.reasoningDurationMs ??
            (started != null ? Math.max(0, nowMs - started) : undefined),
    };
}
