import { ModelIcon } from "@lobehub/icons";
import { Coins, Gauge } from "lucide-react";
import { formatTokenCount } from "@/lib/agent/contextUsage";
import { AgentRunDetails, type RunAction } from "./AgentRunDetails";
import type { AgentRun } from "@/domain/agent";
import { Button } from "@/components/ui/button";
import { CopyButton, Text } from "@lobehub/ui";
import { ChatItem } from "@lobehub/ui/chat";
import Avatar from "boring-avatars";
import { memo, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import type { ChatMessage } from "@/domain/types";
import { LOGO_SRC, PRODUCT_NAME_EN, PRODUCT_NAME_ZH } from "@/lib/brand";
import { isChatNearBottom, snapChatToBottom } from "@/lib/chatScroll";
import { ThinkingMatrix } from "./ThinkingMatrix";
import { ThinkingPanel } from "./ThinkingPanel";

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
export function MessageList({ messages, runs, retryableRunId, onRetryRun, busy, onRunAction }: {
  messages: ChatMessage[] | undefined;
  runs?: AgentRun[];
  busy: boolean;
  onRunAction: (runId: string, action: RunAction, callId?: string) => void;
  retryableRunId?: string;
  onRetryRun: (id: string) => void;
}) {
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
              <AgentChatMessageItem key={message.id} message={message} userMeta={userMeta}
                run={runs?.find((run) => run.id === message.runId)} busy={busy} onRunAction={onRunAction}
                retryable={Boolean(message.runId && message.runId === retryableRunId)} onRetryRun={onRetryRun} />
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
    run,
    busy,
    onRunAction,
    retryable,
    onRetryRun,
  }: {
    message: ChatMessage;
    run?: AgentRun;
    busy: boolean;
    onRunAction: (runId: string, action: RunAction, callId?: string) => void;
    retryable: boolean;
    onRetryRun: (id: string) => void;
    userMeta: { avatar: ReactNode; backgroundColor: string; title: string };
  }) {
    const isUser = message.role === "user";
    const reasoningText = message.reasoning?.trim() ?? "";
    const hasReasoning = reasoningText.length > 0;
    const reasoningActive =
      !isUser &&
      message.status === "streaming" &&
      hasReasoning &&
      !message.content;
    const showMatrix =
      !isUser &&
      message.status === "streaming" &&
      !message.content &&
      !hasReasoning;
    const showCopy = !isUser && Boolean(message.content) && message.status !== "streaming";
    const text = showMatrix
      ? ""
      : message.content ||
        (message.status === "aborted" ? "（已停止）" : "");

    const statusLabel = message.status === "error" ? "生成失败" : message.status === "interrupted" ? run?.pauseReason === "model_step_limit" ? "执行已暂停" : "生成中断" : message.status === "aborted" ? "已停止" : undefined;
    return (
      <ChatItem
        className="agent-transcript-item"
        placement={isUser ? "right" : "left"}
        primary={isUser}
        variant={isUser ? "bubble" : "docs"}
        showTitle={!isUser}
        loading={message.status === "streaming" && !message.content}
        time={new Date(message.createdAt).getTime()}
        avatar={isUser ? userMeta : ASSISTANT_AVATAR}
        avatarProps={{ shape: isUser ? "circle" : "square" }}
        markdownProps={MARKDOWN_PROPS}
        placeholderMessage=""
        aboveMessage={!isUser ? <>
          {run && <AgentRunDetails run={run} busy={busy} onAction={onRunAction} />}
          {hasReasoning && <ThinkingPanel reasoning={message.reasoning ?? ""} active={reasoningActive} durationMs={message.reasoningDurationMs} />}
        </> : undefined}
        belowMessage={!isUser ? <div className="agent-message-footer">
          <div className="agent-message-meta">
            {run?.model && <span className="agent-model-attribution" title={run.model}><ModelIcon model={run.model} size={14} />{run.model}</span>}
            {run?.outputTokensPerSecond !== undefined && <span className="agent-model-attribution" title="生成速度：供应商返回的输出 token ÷ 流式生成耗时（不含工具和审批等待）"><Gauge size={12} />{run.outputTokensPerSecond.toFixed(1)} tok/s</span>}
            {run?.usage?.totalTokens !== undefined && <span className="agent-model-attribution" title={`本次执行累计 ${run.usage.totalTokens.toLocaleString()} tokens；输入 ${run.usage.inputTokens?.toLocaleString() ?? "未知"}，输出 ${run.usage.outputTokens?.toLocaleString() ?? "未知"}`}><Coins size={12} />{formatTokenCount(run.usage.totalTokens)}</span>}
            {showCopy && <CopyButton content={message.content} title="复制" size="small" />}
          </div>
          {statusLabel && <div role="status">{statusLabel} · {message.error || "已保留收到的内容"}</div>}
          {retryable && message.runId && <Button size="sm" variant="outline" onClick={() => onRetryRun(message.runId!)}>重新生成</Button>}
        </div> : undefined}
        message={text}
        renderMessage={showMatrix ? renderThinkingMessage : undefined}
      />

    );
  },
  (prev, next) =>
    prev.userMeta === next.userMeta &&
    prev.run?.id === next.run?.id &&
    prev.run?.updatedAt === next.run?.updatedAt &&
    prev.run?.status === next.run?.status &&
    prev.run?.pauseReason === next.run?.pauseReason &&
    prev.run?.usage?.totalTokens === next.run?.usage?.totalTokens &&
    prev.run?.usage?.inputTokens === next.run?.usage?.inputTokens &&
    prev.run?.usage?.outputTokens === next.run?.usage?.outputTokens &&
    prev.run?.outputTokensPerSecond === next.run?.outputTokensPerSecond &&
    prev.busy === next.busy &&
    prev.onRunAction === next.onRunAction &&
    prev.retryable === next.retryable &&
    prev.onRetryRun === next.onRetryRun &&
    prev.message.error === next.message.error &&
    prev.message.runId === next.message.runId &&
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.status === next.message.status &&
    prev.message.role === next.message.role &&
    prev.message.createdAt === next.message.createdAt &&
    prev.message.reasoning === next.message.reasoning &&
    prev.message.reasoningDurationMs === next.message.reasoningDurationMs,
);
