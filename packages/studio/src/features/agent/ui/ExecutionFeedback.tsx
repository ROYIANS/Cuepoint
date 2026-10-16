import {createContext, useCallback, useContext, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode} from "react";
import type {ExecutionFeedbackInvocation, ExecutionFeedbackSnapshot} from "../runtime/executionFeedback";
import {agentExecution} from "../runtime/agentExecution";
import type {AgentExecutionToken} from "../runtime/agentExecutionService";

type PublicOutputIdentity = {runId: string; assistantMessageId: string};
type FeedbackValue = {
    invocation?: ExecutionFeedbackInvocation;
    snapshot?: ExecutionFeedbackSnapshot;
    provisionalMessageId?: string;
};
export const ExecutionFeedbackContext = createContext<FeedbackValue>({});

/** Full streaming observation stays underneath the workspace/page boundary. */
export function ThreadExecutionFeedbackProvider({ownerId, children}: {ownerId: string; children: ReactNode}) {
    const snapshot = useSyncExternalStore(useCallback(listener => agentExecution.subscribe(ownerId, listener), [ownerId]),
        useCallback(() => agentExecution.snapshot(ownerId), [ownerId]));
    const lastToken = useRef<{ownerId: string; token?: AgentExecutionToken}>({ownerId});
    if (lastToken.current.ownerId !== ownerId) lastToken.current = {ownerId};
    if (snapshot.token) lastToken.current.token = snapshot.token;
    const token = lastToken.current.token;
    const invocation = token ? agentExecution.feedback(ownerId, token) : undefined;
    const provisionalMessageId = [...snapshot.attempts].reverse().find(attempt => attempt.phase === "preparing")?.admission.userMessageId;
    return <ExecutionFeedbackContext value={{invocation, snapshot: snapshot.feedback, provisionalMessageId}}>{children}</ExecutionFeedbackContext>;
}

/** DOM eligibility only: this does not claim compositor paint or remote receipt. */
function visible(element: HTMLElement) {
    if (!element.isConnected || document.visibilityState === "hidden") return false;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.hidden || ancestor.hasAttribute("inert") || ancestor.getAttribute("aria-hidden") === "true") return false;
        const style = getComputedStyle(ancestor);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") return false;
    }
    const body = element.firstElementChild ?? element;
    return body.getClientRects().length > 0 && Boolean(element.textContent?.trim());
}

export function usePublicOutputCommit(output: PublicOutputIdentity | undefined, kind: "content" | "reasoning", text: string, enabled = true) {
    const {invocation, snapshot} = useContext(ExecutionFeedbackContext);
    const ref = useRef<HTMLDivElement>(null);
    const sampledInvocation = useRef<ExecutionFeedbackInvocation | undefined>(undefined);
    const runId = output?.runId;
    const assistantMessageId = output?.assistantMessageId;
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element || !enabled || !text || !runId || !assistantMessageId || !invocation || sampledInvocation.current === invocation || snapshot?.runId !== runId ||
            snapshot.assistantMessageId !== assistantMessageId ||
            // No DOM/CSS sampling or observers until a confirmed checkpoint can make the commit possible.
            snapshot.outputRevision < 1) return;
        const mutations = new MutationObserver(() => check());
        const cleanup = () => {mutations.disconnect(); document.removeEventListener("visibilitychange", check);};
        const check = () => {
            if (sampledInvocation.current === invocation) return;
            if (visible(element) && invocation.publicCommitted({runId, assistantMessageId, kind, text})) {
                sampledInvocation.current = invocation;
                cleanup();
            }
        };
        check();
        if (sampledInvocation.current === invocation) return;
        // Retained chat can become visible without new content (detail return / disclosure).
        mutations.observe(element, {childList: true, subtree: true, characterData: true});
        for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
            mutations.observe(ancestor, {attributes: true, attributeFilter: ["hidden", "inert", "aria-hidden", "style", "class"]});
        }
        document.addEventListener("visibilitychange", check);
        return cleanup;
    }, [invocation, snapshot?.runId, snapshot?.assistantMessageId, snapshot?.outputRevision, runId,
        assistantMessageId, kind, text, enabled]);
    return ref;
}

export function PublicOutputCommit({output, text, children}: {
    output: PublicOutputIdentity; text: string; children: ReactNode;
}) {
    const ref = usePublicOutputCommit(output, "content", text);
    return <div ref={ref} style={{display: "contents"}}>{children}</div>;
}

export function ProvisionalCommitProbe({messageId, children}: {messageId: string; children: ReactNode}) {
    const {invocation, provisionalMessageId} = useContext(ExecutionFeedbackContext);
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (messageId === provisionalMessageId && invocation && ref.current && visible(ref.current)) invocation.provisionalCommitted();
    }, [messageId, provisionalMessageId, invocation]);
    return <div ref={ref} style={{display: "contents"}}>{children}</div>;
}
