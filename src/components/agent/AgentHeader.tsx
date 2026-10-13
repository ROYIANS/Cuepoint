import {ActionIcon} from "@lobehub/ui/base-ui";
import {Dropdown} from "antd";
import {ListTodo, MessageSquarePlus, MoreHorizontal, Pencil, Trash2} from "@/components/ui/icons";
import type {ReactNode} from "react";
import {AppHeaderPortal} from "@/components/layout/AppHeaderPortal";
import type {ChatThread} from "@/domain/types";
import "./agentHeader.css";

function headerPopupRoot(trigger: HTMLElement): HTMLElement {
    return trigger.closest<HTMLElement>("[data-agent-header]")?.querySelector<HTMLElement>("[data-agent-header-popup]") ?? document.body;
}

/** The portal keeps Agent providers; its explicit popup host stays outside surface clipping. */
export function AgentHeader({title, thread, topicToggle: _topicToggle, onRename, onDelete, onOpenTask, taskTitle, onNewTopic}: {
    title: string;
    thread?: ChatThread;
    topicToggle: ReactNode;
    onRename?: (thread: ChatThread) => void;
    onDelete?: (thread: ChatThread) => void;
    onOpenTask?: () => void;
    taskTitle?: string;
    onNewTopic?: () => void;
}) {
    return <AppHeaderPortal>
        <div className="agent-header-theme css-var-agent-chat agent-chat-header" data-agent-header="">
            <div className="agent-header-title-group">
                <h1 className="agent-conversation-title" title={title}>{title}</h1>
                {thread && onRename && onDelete && <Dropdown trigger={["click"]} getPopupContainer={headerPopupRoot}
                    menu={{items: [
                        {key: "rename", label: "重命名", icon: <Pencil size={14}/>, onClick: () => onRename(thread)},
                        {key: "delete", label: "删除", icon: <Trash2 size={14}/>, danger: true, onClick: () => onDelete(thread)},
                    ]}}>
                    <span data-tauri-drag-region="false"><ActionIcon icon={MoreHorizontal} title="更多"
                        aria-label="话题更多操作" aria-haspopup="menu" size="small"/></span>
                </Dropdown>}
            </div>
            <div className="agent-header-actions" data-tauri-drag-region="false">
                {onOpenTask && <ActionIcon icon={ListTodo} title={taskTitle ? "任务详情" : "创建关联任务"}
                    aria-label={taskTitle ? "任务详情" : "创建关联任务"} onClick={onOpenTask}/>}
                {onNewTopic && <ActionIcon icon={MessageSquarePlus} title="开启新话题" aria-label="开启新话题" onClick={onNewTopic}/>}
            </div>
            <div className="agent-header-popup-host" data-agent-header-popup="" data-tauri-drag-region="false"/>
        </div>
    </AppHeaderPortal>;
}
