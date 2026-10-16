import type {ChatSubmissionAttempt} from "../models/chatSubmissionAttempt";
import {ReferenceAttachments} from "./ReferenceAttachments";
import {type ReactNode, useLayoutEffect, useRef} from "react";
import {ProvisionalCommitProbe} from "./ExecutionFeedback";
import "./submissionMessage.css";

/** Handler vocabulary for a frozen attempt; the visible controls live in the composer notice. */
export type SubmissionAction = "retry" | "check" | "recover" | "confirm";

/**
 * Eager plain-text echo: deliberately independent of rich transcript dependencies. It carries no status
 * text or buttons; unsent/unconfirmed outcomes are told once, in the bubble above the composer.
 */
export function SubmissionMessage({attempt}: {attempt: ChatSubmissionAttempt}) {
    const {phase, admission, submitted} = attempt;
    return <ProvisionalCommitProbe messageId={admission.userMessageId}><div className="agent-transcript-item agent-transcript-user" data-turn-anchor={admission.userMessageId}
                data-submission-phase={phase}>
        <div className="agent-user-bubble">
            <ReferenceAttachments projectId={attempt.projectId} attachments={submitted.attachments}/>
            {submitted.text.trim() && <div className="agent-submission-text">{submitted.text.trim()}</div>}
        </div>
    </div></ProvisionalCommitProbe>;
}

export function SubmissionTranscriptFallback({attempts, loading, footer}: {
    attempts: ChatSubmissionAttempt[]; loading?: boolean; footer?: ReactNode;
}) {
    const list = useRef<HTMLDivElement>(null);
    const lastId = attempts.at(-1)?.admission.userMessageId;
    useLayoutEffect(() => {if (list.current) list.current.scrollTop = list.current.scrollHeight;}, [lastId]);
    return <div ref={list} className="agent-message-list"><div className="agent-content">
        {loading && <div role="status">正在加载对话…</div>}
        {attempts.map(attempt => <SubmissionMessage key={attempt.admission.userMessageId} attempt={attempt}/>)}{footer}</div></div>;
}
