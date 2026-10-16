import {useCallback, useMemo, useSyncExternalStore} from "react";
import {agentExecution} from "../runtime/agentExecution";
import type {AgentExecutionSnapshot} from "../runtime/agentExecutionService";

/** Feedback's output revision belongs to the transcript, never to the page/composer. */
function controlOwner(ownerId: string) {
    let previous: AgentExecutionSnapshot | undefined;
    let selected: AgentExecutionSnapshot;
    return () => {
        const next = agentExecution.snapshot(ownerId);
        const feedback = next.feedback;
        if (!previous || previous.active !== next.active || previous.stopping !== next.stopping ||
            previous.token !== next.token || previous.kind !== next.kind || previous.work !== next.work ||
            previous.error !== next.error || previous.wrapupId !== next.wrapupId || previous.attempts.length !== next.attempts.length ||
            previous.attempts.some((attempt, index) => attempt !== next.attempts[index]) ||
            previous.feedback?.phase !== feedback?.phase || previous.feedback?.threadId !== feedback?.threadId ||
            previous.feedback?.runId !== feedback?.runId) {
            selected = Object.freeze({...next, feedback: feedback ? Object.freeze({...feedback, outputRevision: 0}) : undefined});
        }
        previous = next;
        return selected;
    };
}

/** Per-view observation only; navigation never cancels or releases an owner. */
export function useChatExecutionSession(threadId: string | undefined, scope: string) {
    const scopedAttempts = useSyncExternalStore(
        useCallback(listener => agentExecution.subscribeScope(scope, listener), [scope]),
        useCallback(() => agentExecution.attemptsForScope(scope), [scope]));
    const executionThread = threadId ?? [...scopedAttempts].reverse().find(attempt => attempt.phase === "preparing")?.threadId;
    const ownerId = executionThread ?? `compose:${scope}`;
    const readControl = useMemo(() => controlOwner(ownerId), [ownerId]);
    const snapshot = useSyncExternalStore(
        useCallback(listener => agentExecution.subscribe(ownerId, listener), [ownerId]),
        readControl);
    return {snapshot, ownerId, sending: snapshot.active, stopping: snapshot.stopping,
        feedbackSnapshot: snapshot.feedback,
        provisionalMessageId: [...snapshot.attempts].reverse().find(attempt => attempt.phase === "preparing")?.admission.userMessageId,
        attempts: threadId ? snapshot.attempts : scopedAttempts};
}
