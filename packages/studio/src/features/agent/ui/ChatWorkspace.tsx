import {ModuleLayout} from "../../../app/layout/ModuleLayout";
import type {RunAction} from "../models/chatRunAction";
import {useAgentActivityNavigation} from "./AgentActivityNavigation";
import {Flexbox} from "@lobehub/ui";
import {type CSSProperties, useLayoutEffect, useRef, useState} from "react";
import {AgentHeader} from "./AgentHeader";
import {useAgentTopicNavigation} from "./AgentTopicNavigation";
import type {ComposerProps} from "./composerTypes";
import {FloatingComposer} from "./FloatingComposer";
import {CHAT_COMPOSER_SAFE, CHAT_CONTENT_MAX, CHAT_SAFE_X,} from "./agentTheme";
import type {ChatThread} from "../models/chat";
import type {Id} from "../../../platform/identity";
import {type SubmissionAction} from "./SubmissionMessage";
import {type ChatSubmissionAttempt} from "../models/chatSubmissionAttempt";
import {ThreadTranscript} from "./ThreadTranscript";

/**
 * Chat workspace — lobehub Conversation layout:
 * collapsible TopicSidebar (md+) | message stream +
 * floating composer. Narrow topic navigation opens in the shared left overlay.
 */
export function ChatWorkspace({
                                  threads,
                                  activeThreadId,
                                  activeThread,
                                  ownerId,
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
    ownerId: string;
    submissions?: ChatSubmissionAttempt[];
    onSubmissionAction?: (id: string, action: SubmissionAction) => void;
    onSubmissionObserved?: (id: string) => void;
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
        setExpanded(false);
    }, [activityRequest, activeThreadId]);
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
                        <ThreadTranscript threadId={activeThreadId} ownerId={ownerId} taskTitle={taskTitle} taskGoal={taskGoal}
                            composer={composer} submissions={submissions} onOpenTask={onOpenTask} onRetryRun={onRetryRun}
                            onRunAction={onRunAction} onSubmissionAction={onSubmissionAction} onSubmissionObserved={onSubmissionObserved}/>
                    </div>
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
