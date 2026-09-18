import { CopyButton, Text } from "@lobehub/ui";
import { ChatItem } from "@lobehub/ui/chat";
import Avatar from "boring-avatars";
import { memo, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import type { ChatMessage } from "@/domain/types";
import { LOGO_SRC, PRODUCT_NAME_EN, PRODUCT_NAME_ZH } from "@/lib/brand";
import { isChatNearBottom, snapChatToBottom } from "@/lib/chatScroll";
import { ThinkingMatrix } from "./ThinkingMatrix";

const MARKDOWN_PROPS = { variant: "chat" } as const;

/** Stable callback so ChatItem does not String() a React node as `message`. */
function renderThinkingMessage() {
  return <ThinkingMatrix />;
}

const ASSISTANT_AVATAR = {
  avatar: LOGO_SRC,
  backgroundColor: "transparent",
  title: PRODUCT_NAME_ZH,
};

/**
 * Message list — ChatItem `message` must be a string.
 * Stick with `scrollTop` on this element (not `scrollIntoView` smooth).
 * History rows are memoized so Dexie liveQuery ticks only paint the streaming item.
 */
export function MessageList({ messages }: { messages: ChatMessage[] | undefined }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const list = messages ?? [];
  const threadKey = list[0]?.threadId ?? "";
  const userAvatar = useMemo(() => <Avatar name={PRODUCT_NAME_EN} size={40} />, []);
  const userMeta = useMemo(
    () => ({
      avatar: userAvatar,
      backgroundColor: "transparent",
      title: "我",
    }),
    [userAvatar],
  );

  useLayoutEffect(() => {
    stickToBottom.current = true;
    const el = listRef.current;
    if (!el) return;
    snapChatToBottom(el);
    const frame = requestAnimationFrame(() => snapChatToBottom(el));
    return () => cancelAnimationFrame(frame);
  }, [threadKey]);

  useLayoutEffect(() => {
    const el = listRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) snapChatToBottom(el);
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [threadKey]);

  return (
    <div
      ref={listRef}
      className="agent-message-list"
      onScroll={() => {
        const el = listRef.current;
        if (el) stickToBottom.current = isChatNearBottom(el);
      }}
    >
      <div ref={contentRef} className="agent-content">
        {messages === undefined ? (
          <Text type="secondary">加载中…</Text>
        ) : (
          list.map((message) => {
            if (message.role === "system") return null;
            return (
              <AgentChatMessageItem key={message.id} message={message} userMeta={userMeta} />
            );
          })
        )}
      </div>
    </div>
  );
}

const AgentChatMessageItem = memo(
  function AgentChatMessageItem({
    message,
    userMeta,
  }: {
    message: ChatMessage;
    userMeta: { avatar: ReactNode; backgroundColor: string; title: string };
  }) {
    const isUser = message.role === "user";
    const showThinking =
      !isUser && message.status === "streaming" && !message.content;
    const showCopy = !isUser && Boolean(message.content) && message.status !== "streaming";
    const text = showThinking
      ? ""
      : message.content ||
        (message.status === "aborted" ? "（已停止）" : "");

    return (
      <ChatItem
        placement={isUser ? "right" : "left"}
        primary={isUser}
        variant={isUser ? "bubble" : "docs"}
        showTitle={!isUser}
        loading={message.status === "streaming" && !message.content}
        time={new Date(message.createdAt).getTime()}
        avatar={isUser ? userMeta : ASSISTANT_AVATAR}
        avatarProps={{ shape: isUser ? "circle" : "square" }}
        markdownProps={MARKDOWN_PROPS}
        actions={
          showCopy ? <CopyButton content={message.content} title="复制" size="small" /> : undefined
        }
        message={text}
        renderMessage={showThinking ? renderThinkingMessage : undefined}
      />
    );
  },
  (prev, next) =>
    prev.userMeta === next.userMeta &&
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.status === next.message.status &&
    prev.message.role === next.message.role &&
    prev.message.createdAt === next.message.createdAt,
);
