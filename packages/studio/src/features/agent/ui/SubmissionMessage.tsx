import type {ChatSubmissionAttempt} from "./chatSubmissionAttempts";
import {ReferenceAttachments} from "./ReferenceAttachments";
import {useLayoutEffect, useRef} from "react";
import {ProvisionalCommitProbe} from "./ExecutionFeedback";
import "./submissionMessage.css";

export type SubmissionAction = "retry" | "restore" | "check" | "recover";

/** Eager plain-text echo: deliberately independent of rich transcript dependencies. */
export function SubmissionMessage({attempt, busy, onAction}: {
    attempt: ChatSubmissionAttempt;
    busy: boolean;
    onAction: (id: string, action: SubmissionAction) => void;
}) {
    const {phase, admission, submitted} = attempt;
    return <ProvisionalCommitProbe messageId={admission.userMessageId}><div className="agent-transcript-item agent-transcript-user" data-turn-anchor={admission.userMessageId}
                data-submission-phase={phase}>
        <div className="agent-user-bubble">
            <ReferenceAttachments projectId={attempt.projectId} attachments={submitted.attachments}/>
            {submitted.text.trim() && <div className="agent-submission-text">{submitted.text.trim()}</div>}
        </div>
        <SubmissionStatus attempt={attempt} busy={busy} onAction={onAction}/>
    </div></ProvisionalCommitProbe>;
}

export function SubmissionStatus({attempt, busy, onAction}: {
    attempt: ChatSubmissionAttempt; busy: boolean; onAction: (id: string, action: SubmissionAction) => void;
}) {
    const {phase, admission} = attempt;
    if (phase === "preparing" || (phase === "accepted" && !attempt.recoveryRequired)) return null;
    return <div className="agent-submission-status" role="status">
            <span>{phase === "accepted" ? attempt.error ?? "消息已保存，可查看恢复选项" :
                phase === "checking" ? "正在核对发送状态…" : attempt.error ?? "发送未完成"}</span>
            {phase === "failed" && <><button type="button" disabled={busy} onClick={() => onAction(admission.userMessageId, "retry")}>重试发送</button>
                <button type="button" disabled={busy} onClick={() => onAction(admission.userMessageId, "restore")}>
                    {attempt.originThreadId ? "恢复草稿" : "恢复到首页草稿"}</button></>}
            {phase === "uncertain" && <button type="button" disabled={busy} onClick={() => onAction(admission.userMessageId, "check")}>核对发送状态</button>}
            {phase === "accepted" && attempt.recoveryRequired && <button type="button" disabled={busy}
                onClick={() => onAction(admission.userMessageId, "recover")}>查看恢复选项</button>}
        </div>;
}

export function SubmissionTranscriptFallback({attempts, busy, loading, onAction}: {
    attempts: ChatSubmissionAttempt[]; busy: boolean; loading?: boolean;
    onAction: (id: string, action: SubmissionAction) => void;
}) {
    const list = useRef<HTMLDivElement>(null);
    const lastId = attempts.at(-1)?.admission.userMessageId;
    useLayoutEffect(() => {if (list.current) list.current.scrollTop = list.current.scrollHeight;}, [lastId]);
    return <div ref={list} className="agent-message-list"><div className="agent-content">
        {loading && <div role="status">正在加载对话…</div>}
        {attempts.map(attempt => <SubmissionMessage key={attempt.admission.userMessageId} attempt={attempt}
            busy={busy} onAction={onAction}/>)}</div></div>;
}
