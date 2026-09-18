import type { RunAction } from "./AgentRunDetails";
import type { AgentRun } from "@/domain/agent";
import { ActionIcon, Flexbox } from "@lobehub/ui";
import { ChatHeader, ChatHeaderTitle } from "@lobehub/ui/chat";
import { Dropdown } from "antd";
import {
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCallback, useState, useLayoutEffect, useRef, type CSSProperties } from "react";
import { TopicListBody, TopicSidebar } from "@/components/agent/TopicSidebar";
import type { ComposerProps } from "@/components/agent/composerTypes";
import { FloatingComposer } from "@/components/agent/FloatingComposer";
import { MessageList } from "@/components/agent/MessageList";
import {
  CHAT_COMPOSER_SAFE,
  CHAT_CONTENT_MAX,
  CHAT_HEADER_HEIGHT,
  CHAT_SAFE_X,
  SIDEBAR_COLLAPSED_KEY,
} from "@/components/agent/agentTheme";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
 * collapsible TopicSidebar (md+) | ChatHeader + message stream +
 * floating composer. Below md, topics open in a left Sheet.
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
  onRenameThread,
  onDeleteThread,
}: {
  threads: ChatThread[];
  activeThreadId?: Id;
  activeThread?: ChatThread;
  messages: ChatMessage[] | undefined;
  runs?: AgentRun[];
  retryableRunId?: string;
  onRetryRun: (id: string) => void;
  onRunAction: (runId: string, action: RunAction, callId?: string) => void;
  composer: ComposerProps;
  onSelectThread: (id: Id) => void;
  onNewTopic: () => void;
  onRenameThread: (thread: ChatThread) => void;
  onDeleteThread: (thread: ChatThread) => void;
}) {
  const [expanded, setExpanded] = useState(false);
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
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [topicsOpen, setTopicsOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  const selectAndClose = useCallback(
    (id: Id) => {
      onSelectThread(id);
      setTopicsOpen(false);
    },
    [onSelectThread],
  );

  const newTopicAndClose = useCallback(() => {
    onNewTopic();
    setTopicsOpen(false);
  }, [onNewTopic]);

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
      <div className="hidden h-full min-h-0 shrink-0 md:flex">
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
      </div>

      <Sheet open={topicsOpen} onOpenChange={setTopicsOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="agent-chat-root agent-topic-sheet flex h-full w-[min(280px,85vw)] flex-col gap-0 border-[#202020] bg-[#0d0d0d] p-0 text-white sm:max-w-[280px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>话题</SheetTitle>
          </SheetHeader>
          <Flexbox
            direction="vertical"
            height="100%"
            width="100%"
            className="agent-topic-sidebar"
            style={{ minHeight: 0, borderInlineEnd: "none" }}
          >
            <TopicListBody
              threads={threads}
              activeThreadId={activeThreadId}
              onSelect={selectAndClose}
              onNewTopic={newTopicAndClose}
              onRename={onRenameThread}
              onDelete={onDeleteThread}
            />
          </Flexbox>
        </SheetContent>
      </Sheet>

      <Flexbox flex={1} height="100%" className="agent-chat-column min-w-0">
        <ChatHeader
          className="agent-chat-header" style={expanded ? { visibility: "hidden" } : undefined}
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
              <span className="md:hidden">
                <ActionIcon
                  icon={PanelLeft}
                  title="话题列表"
                  onClick={() => setTopicsOpen(true)}
                />
              </span>
              <span className="hidden md:inline-flex">
                <ActionIcon
                  icon={collapsed ? PanelRight : PanelLeft}
                  title="侧栏"
                  onClick={toggleCollapsed}
                />
              </span>
            </Flexbox>
          }
        />
        <div className="agent-transcript-container" inert={expanded} style={expanded ? { visibility: "hidden" } : undefined}><MessageList messages={messages} runs={runs} retryableRunId={retryableRunId} onRetryRun={onRetryRun} busy={composer.sending} onRunAction={onRunAction} /></div>
        <div ref={dockRef} className={`agent-composer-dock${expanded ? " is-expanded" : ""}`}>
          <div className="agent-content">
            <FloatingComposer {...composer} surface="detail" expanded={expanded} onExpandedChange={setExpanded} />
          </div>
        </div>
      </Flexbox>
    </Flexbox>
  );
}
