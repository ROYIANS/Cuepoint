import {ActionIcon} from "@lobehub/ui/base-ui";
import {PanelLeft, PanelLeftClose} from "@/components/ui/remixIcons";
import {type ReactNode, useCallback, useState} from "react";
import {TopicListBody, TopicSidebar} from "@/components/agent/TopicSidebar";
import {SIDEBAR_COLLAPSED_KEY} from "@/components/agent/agentTheme";
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle} from "@/components/ui/sheet";
import type {ChatThread, Id} from "@/domain/types";

function readCollapsed(): boolean {
    try {return sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";} catch {return false;}
}

/** Shared presentation state for the home and conversation topic navigation. */
export function useAgentTopicNavigation({threads, activeThreadId, onSelect, onNewTopic, onRename, onDelete, onOpenTasks}: {
    threads: ChatThread[];
    activeThreadId?: Id;
    onSelect: (id: Id) => void;
    onNewTopic: () => void;
    onRename: (thread: ChatThread) => void;
    onDelete: (thread: ChatThread) => void;
    onOpenTasks: () => void;
}): {toggle: ReactNode; navigation: ReactNode} {
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const [topicsOpen, setTopicsOpen] = useState(false);
    const toggleCollapsed = useCallback(() => {
        setCollapsed(previous => {
            const next = !previous;
            try {sessionStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");} catch {/* private mode */}
            return next;
        });
    }, []);
    const callbacks = {threads, activeThreadId, onSelect, onNewTopic, onRename, onDelete, onOpenTasks};
    return {
        toggle: <>
            <span className="md:hidden"><ActionIcon icon={PanelLeft} title="话题列表" aria-label="话题列表"
                aria-expanded={topicsOpen} aria-haspopup="dialog" onClick={() => setTopicsOpen(true)}/></span>
            <span className="hidden md:inline-flex"><ActionIcon icon={collapsed ? PanelLeft : PanelLeftClose}
                title={collapsed ? "展开话题侧栏" : "收起话题侧栏"} aria-label={collapsed ? "展开话题侧栏" : "收起话题侧栏"}
                aria-expanded={!collapsed} onClick={toggleCollapsed}/></span>
        </>,
        navigation: <>
            <div className={`agent-topic-navigation hidden h-full min-h-0 shrink-0 md:flex${collapsed ? " is-collapsed" : ""}`} inert={collapsed}>
                <TopicSidebar {...callbacks}/>
            </div>
            <Sheet open={topicsOpen} onOpenChange={setTopicsOpen}>
                <SheetContent side="right" className="agent-chat-root agent-topic-sheet flex h-full w-[min(280px,85vw)] flex-col gap-0 border-border bg-[var(--surface-panel)] p-0 text-foreground sm:max-w-[280px]">
                    <SheetHeader className="border-b px-4 py-3 pr-12"><SheetTitle>话题</SheetTitle>
                        <SheetDescription className="sr-only">查找或切换创作助手的话题</SheetDescription>
                    </SheetHeader>
                    <div className="agent-topic-sidebar flex min-h-0 flex-1 flex-col">
                        <TopicListBody {...callbacks} onSelect={id => {onSelect(id); setTopicsOpen(false);}}
                            onNewTopic={() => {onNewTopic(); setTopicsOpen(false);}}/>
                    </div>
                </SheetContent>
            </Sheet>
        </>,
    };
}
