import {ModuleLayout} from "../../../app/layout/ModuleLayout";
import type {RunAction} from "../models/chatRunAction";
import {useAgentActivityNavigation} from "./AgentActivityNavigation";
import type {AgentRun} from "../models/agent";
import {Flexbox} from "@lobehub/ui";
import {ListTodo} from "../../../ui/icons";
import {type CSSProperties, lazy, Suspense, useLayoutEffect, useRef, useState} from "react";
import {AgentHeader} from "./AgentHeader";
import {useAgentTopicNavigation} from "./AgentTopicNavigation";
import type {ComposerProps} from "./composerTypes";
import {FloatingComposer} from "./FloatingComposer";
import {appendStartPrompt} from "./startPrompt";
import {CHAT_COMPOSER_SAFE, CHAT_CONTENT_MAX, CHAT_SAFE_X,} from "./agentTheme";
import type {ChatMessage, ChatThread} from "../models/chat";
import type {Id} from "../../../platform/identity";
import {SubmissionTranscriptFallback, type SubmissionAction} from "./SubmissionMessage";
import {visibleSubmissionAttempts, type ChatSubmissionAttempt} from "../models/chatSubmissionAttempt";
// Rich transcript rendering (markdown, diagrams, syntax highlighting) is needed only
// once a thread contains messages. Keep the Agent runtime and composer mounted.
const MessageList = lazy(() => import("./MessageList").then((module) => ({default: module.MessageList})));

/**
 * Chat workspace — lobehub Conversation layout:
 * collapsible TopicSidebar (md+) | message stream +
 * floating composer. Narrow topic navigation opens in the shared left overlay.
 */
export function ChatWorkspace({
                                  threads,
                                  activeThreadId,
                                  activeThread,
                                  messages,
                                  runs,
                                  retryableRunId,
                                  onRetryRun,
                                  onRunAction,
                                  composer,
                                  onSelectThread,
                                  onNewTopic,
                                  onNewTopicInProject,
                                  onRenameThread,
                                  onDeleteThread,
                                  onOpenTasks,
                                  onOpenTask,
                                  taskTitle,
                                  taskGoal,
                                  submissions = [], onSubmissionAction, onSubmissionObserved,
                              }: {
    onOpenTasks: () => void;
    onOpenTask: () => void;
    taskTitle?: string;
    taskGoal?: string;
    threads: ChatThread[];
    activeThreadId?: Id;
    activeThread?: ChatThread;
    messages: ChatMessage[] | undefined;
    submissions?: ChatSubmissionAttempt[];
    onSubmissionAction?: (id: string, action: SubmissionAction) => void;
    onSubmissionObserved?: (id: string) => void;
    runs?: AgentRun[];
    retryableRunId?: string;
    onRetryRun: (id: string) => void;
    onRunAction: (runId: string, action: RunAction, callId?: string) => void;
    composer: ComposerProps;
    onSelectThread: (id: Id) => void;
    onNewTopic: () => void;
    onNewTopicInProject?: (projectId: Id) => void;
    onRenameThread: (thread: ChatThread) => void;
    onDeleteThread: (thread: ChatThread) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const {request: activityRequest} = useAgentActivityNavigation();
    useLayoutEffect(() => {
        if (activityRequest) setExpanded(false);
    }, [activityRequest]);
    const dockRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const dock = dockRef.current;
        const column = dock?.parentElement;
        if (!dock || !column) return;
        const resize = new ResizeObserver(() => {
            if (dock.classList.contains("is-expanded")) return;
            column.style.setProperty("--agent-chat-composer-safe", `${dock.getBoundingClientRect().height + 16}px`);
        });
        resize.observe(dock);
        return () => resize.disconnect();
    }, []);
    const topics = useAgentTopicNavigation({
        threads, activeThreadId, projects: composer.projects, onNewTopicInProject, onSelect: onSelectThread,
        onNewTopic, onRename: onRenameThread, onDelete: onDeleteThread, onOpenTasks
    });
    const pending = visibleSubmissionAttempts(submissions, messages);
    const provisional = (loading: boolean) => <SubmissionTranscriptFallback attempts={submissions} busy={composer.sending}
        loading={loading} onAction={onSubmissionAction ?? (() => undefined)}/>;

    return (
        <Flexbox
            horizontal
            height="100%"
            className="agent-conversation"
            style={
                {
                    minHeight: "100%",
                    maxHeight: "100%",
                    background: "transparent",
                    overflow: "hidden",
                    "--agent-chat-safe-x": `${CHAT_SAFE_X}px`,
                    "--agent-chat-composer-safe": `${CHAT_COMPOSER_SAFE}px`,
                    "--agent-content-max": `${CHAT_CONTENT_MAX}px`,
                } as CSSProperties
            }
        >
            <AgentHeader title={activeThread?.title ?? "对话"} thread={activeThread}
                         topicToggle={topics.toggle} onRename={onRenameThread} onDelete={onDeleteThread}
                         taskTitle={taskTitle} onNewTopic={onNewTopic}
                         onOpenTask={taskTitle || (composer.projectId && !composer.blocked) ? onOpenTask : undefined}/>
            <ModuleLayout navigationLabel="话题导航" navigation={topics.navigation} mainClassName="agent-module-main">
                <Flexbox flex={1} height="100%" className="agent-chat-column min-w-0">
                    <div className="agent-transcript-container" inert={expanded}
                         style={expanded ? {visibility: "hidden"} : undefined}>
                        {taskTitle && messages?.length === 0 && !pending.length ?
                            <div className="agent-task-conversation-empty"><ListTodo size={28}/><span>准备开始</span>
                                <h2>{taskTitle}</h2><p>{taskGoal}</p>
                                <div>
                                    <button type="button" onClick={onOpenTask}>整理目标与清单</button>
                                    {!composer.blocked && <button type="button"
                                                                  onClick={() => composer.onChange(appendStartPrompt(composer.value))}>与助手一起开始</button>}
                                </div>
                                <small>也可以独立完成清单，随时回来确认成果。</small></div> : messages?.length ? <Suspense
                                    fallback={provisional(true)}><MessageList threadId={activeThreadId ?? submissions.at(-1)?.threadId}
                                                         messages={messages} runs={runs} retryableRunId={retryableRunId}
                                                         onRetryRun={onRetryRun} busy={composer.sending}
                                                         readOnly={composer.readOnly}
                                                         onRunAction={onRunAction} submissions={submissions}
                                                         onSubmissionObserved={onSubmissionObserved}
                                                         onSubmissionAction={onSubmissionAction}/></Suspense> : provisional(messages === undefined)}</div>
                    <div ref={dockRef} className={`agent-composer-dock${expanded ? " is-expanded" : ""}`}>
                        <div className="agent-content">
                            <FloatingComposer {...composer} surface="detail" expanded={expanded}
                                              onExpandedChange={setExpanded}/>
                        </div>
                    </div>
                </Flexbox>
            </ModuleLayout>
        </Flexbox>
    );
}
