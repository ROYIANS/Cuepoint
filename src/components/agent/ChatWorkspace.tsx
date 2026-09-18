import { ActionIcon, Flexbox } from "@lobehub/ui";
import { ChatHeader, ChatHeaderTitle } from "@lobehub/ui/chat";
import { Dropdown } from "antd";
import {
  Columns2,
  MoreHorizontal,
  PanelRight,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { useCallback, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import type { ComposerProps } from "@/components/agent/composerTypes";
import { FloatingComposer } from "@/components/agent/FloatingComposer";
import { MessageList } from "@/components/agent/MessageList";
import { TopicSidebar } from "@/components/agent/TopicSidebar";
import {
  CHAT_COMPOSER_SAFE,
  CHAT_CONTENT_MAX,
  CHAT_HEADER_HEIGHT,
  CHAT_SAFE_X,
  SIDEBAR_COLLAPSED_KEY,
} from "@/components/agent/agentTheme";
import type { ChatMessage, ChatThread, Id } from "@/domain/types";

function readCollapsed(): boolean {
  try {
    return sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    sessionStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

function popupRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".agent-chat-root") ?? document.body;
}

/**
 * Chat workspace — lobehub Conversation layout:
 * collapsible TopicSidebar | ChatHeader (absolute 52px) + message stream +
 * floating composer in the bottom safe area.
 */
export function ChatWorkspace({
  threads,
  activeThreadId,
  activeThread,
  messages,
  composer,
  onSelectThread,
  onNewTopic,
  onRenameThread,
  onDeleteThread,
}: {
  threads: ChatThread[];
  activeThreadId?: Id;
  activeThread?: ChatThread;
  messages: ChatMessage[] | undefined;
  composer: ComposerProps;
  onSelectThread: (id: Id) => void;
  onNewTopic: () => void;
  onRenameThread: (thread: ChatThread) => void;
  onDeleteThread: (thread: ChatThread) => void;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  return (
    <Flexbox
      horizontal
      height="100%"
      className="agent-conversation"
      style={
        {
          minHeight: "100%",
          maxHeight: "100vh",
          background: "transparent",
          overflow: "hidden",
          "--agent-chat-header-height": `${CHAT_HEADER_HEIGHT}px`,
          "--agent-chat-safe-x": `${CHAT_SAFE_X}px`,
          "--agent-chat-composer-safe": `${CHAT_COMPOSER_SAFE}px`,
          "--agent-content-max": `${CHAT_CONTENT_MAX}px`,
        } as CSSProperties
      }
    >
      <TopicSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onSelect={onSelectThread}
        onNewTopic={onNewTopic}
        onRename={onRenameThread}
        onDelete={onDeleteThread}
      />
      <Flexbox flex={1} height="100%" className="agent-chat-column">
        <ChatHeader
          className="agent-chat-header"
          left={
            <ChatHeaderTitle
              title={activeThread?.title ?? "对话"}
              tag={
                activeThread ? (
                  <Dropdown
                    trigger={["click"]}
                    getPopupContainer={popupRoot}
                    menu={{
                      items: [
                        {
                          key: "rename",
                          label: "重命名",
                          icon: <Pencil size={14} />,
                          onClick: () => onRenameThread(activeThread),
                        },
                        {
                          key: "delete",
                          label: "删除",
                          icon: <Trash2 size={14} />,
                          danger: true,
                          onClick: () => onDeleteThread(activeThread),
                        },
                      ],
                    }}
                  >
                    <span>
                      <ActionIcon icon={MoreHorizontal} title="更多" size="small" />
                    </span>
                  </Dropdown>
                ) : undefined
              }
            />
          }
          right={
            <Flexbox horizontal gap={4}>
              <ActionIcon icon={Share2} title="分享" onClick={() => toast.info("分享即将开放")} />
              <ActionIcon
                icon={Columns2}
                title="分栏"
                onClick={() => toast.info("分栏布局即将开放")}
              />
              <ActionIcon icon={PanelRight} title="侧栏" onClick={toggleCollapsed} />
            </Flexbox>
          }
        />
        <MessageList messages={messages} />
        <div className="agent-composer-dock">
          <div className="agent-content">
            <FloatingComposer {...composer} />
          </div>
        </div>
      </Flexbox>
    </Flexbox>
  );
}
