import type {ReactNode} from "react";
import {TopicSidebar} from "@/components/agent/TopicSidebar";
import type {ChatThread, Id} from "@/domain/types";

/** The shared frame owns collapse and narrow left-overlay presentation. */
export function useAgentTopicNavigation({threads, activeThreadId, onSelect, onNewTopic, onRename, onDelete, onOpenTasks}: {
    threads: ChatThread[]; activeThreadId?: Id; onSelect: (id: Id) => void;
    onNewTopic: () => void; onRename: (thread: ChatThread) => void;
    onDelete: (thread: ChatThread) => void; onOpenTasks: () => void;
}): {toggle: ReactNode; navigation: ReactNode} {
    return {toggle: null, navigation: <TopicSidebar threads={threads} activeThreadId={activeThreadId}
        onSelect={onSelect} onNewTopic={onNewTopic} onRename={onRename} onDelete={onDelete} onOpenTasks={onOpenTasks}/>};
}
