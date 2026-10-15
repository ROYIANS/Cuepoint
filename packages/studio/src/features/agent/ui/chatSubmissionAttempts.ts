import type {ChatAdmissionIdentity} from "../models/chatSubmission";
import type {AgentRun, AgentReasoningEffort} from "../models/agent";
import type {ChatMessage, ChatThread} from "../models/chat";
import type {DraftRecovery, SubmittedDraft} from "./useReferenceDraft";
import type {AgentInteractionMode} from "./composerTypes";
import {createId, nowIso} from "../../../platform/identity";

/** Page-local presentation and frozen intent; never persisted or used as history. */
export type ChatSubmissionAttempt = {
    admission: ChatAdmissionIdentity;
    originThreadId?: string;
    threadId: string;
    projectId?: string;
    submitted: SubmittedDraft;
    recovery: DraftRecovery;
    connector: AgentRun["connector"];
    model: string;
    taskMode: boolean;
    interactionMode: AgentInteractionMode;
    reasoningEffort?: AgentReasoningEffort;
    createdAt: string;
    phase: "preparing" | "accepted" | "failed" | "uncertain" | "checking";
    error?: string;
    createdThread?: ChatThread;
    destinationReserved?: boolean;
    recoveryRequired?: boolean;
};

export function createSubmissionAttempt(input: Omit<ChatSubmissionAttempt, "admission" | "threadId" | "createdAt" | "phase">): ChatSubmissionAttempt {
    return {...input, admission: {runId: createId("run"), userMessageId: createId("msg"), assistantMessageId: createId("msg")},
        threadId: input.originThreadId ?? createId("thread"), createdAt: nowIso(), phase: "preparing"};
}

export function visibleSubmissionAttempts(attempts: ChatSubmissionAttempt[], messages: ChatMessage[] | undefined): ChatSubmissionAttempt[] {
    return attempts.filter(attempt => !messages?.some(message => message.id === attempt.admission.userMessageId &&
        message.threadId === attempt.threadId && message.role === "user"));
}

export type SubmissionTranscriptEntry = {kind: "message"; message: ChatMessage} | {kind: "attempt"; attempt: ChatSubmissionAttempt};

export function submissionTranscript(messages: ChatMessage[] | undefined, attempts: ChatSubmissionAttempt[]): SubmissionTranscriptEntry[] {
    const entries: SubmissionTranscriptEntry[] = (messages ?? []).map(message => ({kind: "message", message}));
    for (const attempt of visibleSubmissionAttempts(attempts, messages)) {
        const next = entries.findIndex(entry => (entry.kind === "message" ? entry.message.createdAt : entry.attempt.createdAt) > attempt.createdAt);
        entries.splice(next < 0 ? entries.length : next, 0, {kind: "attempt", attempt});
    }
    return entries;
}

/** Give the already-published echo a bounded rendering opportunity before preparation/HTTP. */
export function yieldSubmissionPaint(): Promise<void> {
    if (typeof requestAnimationFrame !== "function" || typeof document === "undefined") return Promise.resolve();
    return new Promise(resolve => {
        let first = 0, second = 0;
        const finish = () => {clearTimeout(fallback); cancelAnimationFrame(first); cancelAnimationFrame(second); resolve();};
        // Hidden/throttled documents must not indefinitely hold an execution lock.
        const fallback = setTimeout(finish, 80);
        if (document.visibilityState !== "hidden") first = requestAnimationFrame(() => {second = requestAnimationFrame(finish);});
    });
}
