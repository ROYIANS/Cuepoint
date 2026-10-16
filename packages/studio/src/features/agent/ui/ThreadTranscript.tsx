import {lazy, Suspense} from "react";
import {ListTodo} from "../../../ui/icons";
import {useProductQueryState} from "../../../platform/product/queries";
import {prepareThreadActivityKey} from "../commands/threadActivity";
import {readThreadTranscript} from "../queries/threadReading";
import {visibleSubmissionAttempts, type ChatSubmissionAttempt} from "../models/chatSubmissionAttempt";
import type {RunAction} from "../models/chatRunAction";
import type {ComposerProps} from "./composerTypes";
import {SubmissionTranscriptFallback, type SubmissionAction} from "./SubmissionMessage";
import {appendStartPrompt} from "./startPrompt";
import {ThreadExecutionFeedbackProvider} from "./ExecutionFeedback";

const MessageList = lazy(() => import("./MessageList").then(module => ({default: module.MessageList})));

export function ThreadTranscript({threadId, ownerId, taskTitle, taskGoal, composer, submissions,
    onOpenTask, onRetryRun, onRunAction, onSubmissionAction, onSubmissionObserved}: {
    threadId?: string; ownerId: string; taskTitle?: string; taskGoal?: string;
    composer: ComposerProps; submissions: ChatSubmissionAttempt[]; onOpenTask: () => void;
    onRetryRun: (id: string) => void; onRunAction: (id: string, action: RunAction, callId?: string) => void;
    onSubmissionAction?: (id: string, action: SubmissionAction) => void;
    onSubmissionObserved?: (id: string) => void;
}) {
    // Identity preparation is synchronous and outside the adapter's readonly transaction.
    const identity = threadId ? prepareThreadActivityKey(threadId) : undefined;
    const state = useProductQueryState(tx => readThreadTranscript(identity, tx), [threadId]);
    const reading = state.value?.threadId === threadId ? state.value : undefined;
    const messages = reading?.messages;
    const pending = visibleSubmissionAttempts(submissions, messages);
    const provisional = (loading: boolean) => <SubmissionTranscriptFallback attempts={submissions} busy={composer.sending}
        loading={loading} onAction={onSubmissionAction ?? (() => undefined)}/>;
    return <ThreadExecutionFeedbackProvider ownerId={ownerId}>
        {state.error && <p role="alert">对话读取失败，请重新打开后检查。未读记录仍保留。</p>}
        {taskTitle && messages?.length === 0 && !pending.length ?
            <div className="agent-task-conversation-empty"><ListTodo size={28}/><span>准备开始</span>
                <h2>{taskTitle}</h2><p>{taskGoal}</p><div>
                    <button type="button" onClick={onOpenTask}>整理目标与清单</button>
                    {!composer.blocked && <button type="button" onClick={() => composer.onChange(appendStartPrompt(composer.value))}>与助手一起开始</button>}
                </div><small>也可以独立完成清单，随时回来确认成果。</small></div> : reading && messages?.length ?
                <Suspense fallback={provisional(true)}><MessageList threadId={threadId ?? submissions.at(-1)?.threadId}
                    messages={messages} runs={reading.runs} calls={reading.calls} observedRevision={reading.observedRevision}
                    retryableRunId={composer.sending || composer.readOnly ? undefined : reading.retryableRunId}
                    onRetryRun={onRetryRun} busy={composer.sending} readOnly={composer.readOnly} onRunAction={onRunAction}
                    submissions={submissions} onSubmissionObserved={onSubmissionObserved} onSubmissionAction={onSubmissionAction}/></Suspense> :
                provisional(messages === undefined)}
    </ThreadExecutionFeedbackProvider>;
}
