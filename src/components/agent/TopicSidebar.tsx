import { ActionIcon, Avatar, Flexbox, Text } from "@lobehub/ui";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ListTodo,
  MessageSquare,
  MessageSquarePlus,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { filterThreadsByTitle } from "@/components/agent/filterThreadsByTitle";
import { groupThreadsByTime } from "@/components/agent/timeGroups";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "@/components/agent/agentTheme";
import type { ChatThread, Id } from "@/domain/types";
import { LOGO_SRC, PRODUCT_NAME_ZH } from "@/lib/brand";

/**
 * Topic sidebar — lobehub AgentSidebar: brand row + collapse, ghost nav
 * (开启新话题 / 搜索 / 话题…), date-grouped topic list, settings footer.
 * Shared list body also powers the mobile topic Sheet.
 */
export function TopicSidebar({
  threads,
  activeThreadId,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onNewTopic,
  onRename,
  onDelete,
}: {
  threads: ChatThread[];
  activeThreadId?: Id;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (id: Id) => void;
  onNewTopic: () => void;
  onRename: (thread: ChatThread) => void;
  onDelete: (thread: ChatThread) => void;
}) {
  const navigate = useNavigate();

  if (collapsed) {
    return (
      <Flexbox
        width={SIDEBAR_COLLAPSED_WIDTH}
        height="100%"
        padding={8}
        gap={8}
        className="agent-topic-sidebar is-collapsed"
      >
        <ActionIcon icon={PanelLeft} title="展开侧栏" onClick={onToggleCollapsed} />
        <ActionIcon icon={MessageSquarePlus} title="开启新话题" onClick={onNewTopic} />
      </Flexbox>
    );
  }

  return (
    <Flexbox width={SIDEBAR_WIDTH} height="100%" className="agent-topic-sidebar">
      <Flexbox
        horizontal
        align="center"
        padding={12}
        gap={8}
        style={{ flex: "none" }}
      >
        <Avatar avatar={LOGO_SRC} background="transparent" shape="square" size={28} />
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {PRODUCT_NAME_ZH}
        </Text>
        <ActionIcon icon={PanelLeftClose} title="收起侧栏" onClick={onToggleCollapsed} />
      </Flexbox>

      <TopicListBody
        threads={threads}
        activeThreadId={activeThreadId}
        onSelect={onSelect}
        onNewTopic={onNewTopic}
        onRename={onRename}
        onDelete={onDelete}
        footer={
          <Flexbox padding={8} style={{ flex: "none" }}>
            <ActionIcon
              icon={Settings}
              title="连接"
              onClick={() => void navigate({ to: "/connectors" })}
            />
          </Flexbox>
        }
      />
    </Flexbox>
  );
}

/** Shared nav + searchable topic list for desktop sidebar and mobile drawer. */
export function TopicListBody({
  threads,
  activeThreadId,
  onSelect,
  onNewTopic,
  onRename,
  onDelete,
  footer,
}: {
  threads: ChatThread[];
  activeThreadId?: Id;
  onSelect: (id: Id) => void;
  onNewTopic: () => void;
  onRename: (thread: ChatThread) => void;
  onDelete: (thread: ChatThread) => void;
  footer?: ReactNode;
}) {
  const [topicsOpen, setTopicsOpen] = useState(true);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => filterThreadsByTitle(threads, query),
    [threads, query],
  );
  const groups = useMemo(() => groupThreadsByTime(filtered), [filtered]);

  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus();
    }
  }, [searchOpen]);

  const openSearch = () => {
    setSearchOpen(true);
    setTopicsOpen(true);
  };

  const clearSearch = () => {
    setQuery("");
    setSearchOpen(false);
  };

  return (
    <>
      <Flexbox paddingInline={8} gap={2} style={{ flex: "none" }}>
        <SidebarNavItem icon={MessageSquarePlus} label="开启新话题" onClick={onNewTopic} />
        <SidebarNavItem icon={Search} label="搜索" onClick={openSearch} />
        <SidebarNavItem
          icon={MessageSquare}
          label="话题"
          active={!searchOpen}
          onClick={() => {
            clearSearch();
            setTopicsOpen(true);
          }}
        />
        <SidebarNavItem icon={ListTodo} label="任务" onClick={() => toast.info("任务看板即将开放")} />
      </Flexbox>

      {searchOpen ? (
        <Flexbox paddingInline={8} paddingBlock={4} style={{ flex: "none" }}>
          <div className="agent-topic-search">
            <Search size={14} aria-hidden className="agent-topic-search-icon" />
            <input
              ref={searchRef}
              type="search"
              className="agent-topic-search-input"
              placeholder="搜索话题标题"
              value={query}
              aria-label="搜索话题标题"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="button"
              className="agent-topic-search-clear"
              aria-label="关闭搜索"
              onClick={clearSearch}
            >
              <X size={14} />
            </button>
          </div>
        </Flexbox>
      ) : null}

      <Flexbox flex={1} gap={4} style={{ overflowY: "auto", minHeight: 0, padding: "8px 8px 12px" }}>
        <button
          type="button"
          className="agent-sidebar-section"
          onClick={() => setTopicsOpen((open) => !open)}
        >
          <span>
            话题 {searchOpen && query.trim() ? `${filtered.length}/${threads.length}` : threads.length}
          </span>
          <ChevronDown
            size={14}
            className={topicsOpen ? "agent-sidebar-chevron" : "agent-sidebar-chevron is-closed"}
            aria-hidden
          />
        </button>

        {filtered.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12, padding: 8 }}>
            {threads.length === 0
              ? "还没有话题，发一条消息开始。"
              : "没有匹配的话题标题。"}
          </Text>
        ) : topicsOpen ? (
          groups.map((group) => {
            const closed = folded[group.label];
            return (
              <Flexbox key={group.label} gap={1}>
                <button
                  type="button"
                  className="agent-sidebar-group"
                  onClick={() =>
                    setFolded((prev) => ({ ...prev, [group.label]: !prev[group.label] }))
                  }
                >
                  {group.label}
                  <ChevronDown
                    size={12}
                    className={closed ? "agent-sidebar-chevron is-closed" : "agent-sidebar-chevron"}
                    aria-hidden
                  />
                </button>
                {closed
                  ? null
                  : group.threads.map((thread) => (
                      <TopicRow
                        key={thread.id}
                        thread={thread}
                        active={thread.id === activeThreadId}
                        onSelect={() => onSelect(thread.id)}
                        onRename={() => onRename(thread)}
                        onDelete={() => onDelete(thread)}
                      />
                    ))}
              </Flexbox>
            );
          })
        ) : null}
      </Flexbox>

      {footer}
    </>
  );
}

function SidebarNavItem({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={active ? "agent-sidebar-nav is-active" : "agent-sidebar-nav"}
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}

function TopicRow({
  thread,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  thread: ChatThread;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={active ? "agent-topic-row is-active" : "agent-topic-row"}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="agent-topic-row-title">{thread.title}</span>
      {hovered || active ? (
        <span className="agent-topic-row-actions" onClick={(event) => event.stopPropagation()}>
          <ActionIcon icon={Pencil} size="small" title="重命名" onClick={onRename} />
          <ActionIcon icon={Trash2} size="small" title="删除" onClick={onDelete} />
        </span>
      ) : null}
    </div>
  );
}
