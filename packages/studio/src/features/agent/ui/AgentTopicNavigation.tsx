import type {ReactNode} from "react";
import {TopicSidebar} from "./TopicSidebar";
import type {ChatThread} from "../models/chat";
import type {Id} from "../../../platform/identity";
import type {Project} from "../../projects/models/project";

/** The shared frame owns collapse and narrow left-overlay presentation. */
export function useAgentTopicNavigation({
                                            threads,
                                            activeThreadId,
                                            onSelect,
                                            onNewTopic,
                                            onRename,
                                            onDelete,
                                            onOpenTasks,
                                            projects,
                                            onNewTopicInProject
                                        }: {
    onNewTopicInProject?: (projectId: Id) => void;
    projects?: Project[]; threads: ChatThread[]; activeThreadId?: Id; onSelect: (id: Id) => void;
    onNewTopic: () => void; onRename: (thread: ChatThread) => void;
    onDelete: (thread: ChatThread) => void; onOpenTasks: () => void;
}): { toggle: ReactNode; navigation: ReactNode } {
    return {
        toggle: null,
        navigation: <TopicSidebar threads={threads} projects={projects} onNewTopicInProject={onNewTopicInProject}
                                  activeThreadId={activeThreadId}
                                  onSelect={onSelect} onNewTopic={onNewTopic} onRename={onRename} onDelete={onDelete}
                                  onOpenTasks={onOpenTasks}/>
    };
}
