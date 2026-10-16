import {useCallback, useSyncExternalStore} from "react";
import {agentExecution} from "../runtime/agentExecution";

/** Per-view observation only; navigation never cancels or releases an owner. */
export function useChatExecutionSession(threadId: string | undefined, scope: string) {
    const scopedAttempts = useSyncExternalStore(
        useCallback(listener => agentExecution.subscribeScope(scope, listener), [scope]),
        useCallback(() => agentExecution.attemptsForScope(scope), [scope]));
    const executionThread = threadId ?? [...scopedAttempts].reverse().find(attempt => attempt.phase === "preparing")?.threadId;
    const ownerId = executionThread ?? `compose:${scope}`;
    const snapshot = useSyncExternalStore(
        useCallback(listener => agentExecution.subscribe(ownerId, listener), [ownerId]),
        useCallback(() => agentExecution.snapshot(ownerId), [ownerId]));
    const feedback = snapshot.token ? agentExecution.feedback(ownerId, snapshot.token) : undefined;
    return {snapshot, sending: snapshot.active, stopping: snapshot.stopping, feedback,
        feedbackSnapshot: snapshot.feedback,
        provisionalMessageId: [...snapshot.attempts].reverse().find(attempt => attempt.phase === "preparing")?.admission.userMessageId,
        attempts: threadId ? snapshot.attempts : scopedAttempts};
}
