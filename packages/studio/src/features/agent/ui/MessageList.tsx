import {ReferenceMessageSources} from "./ReferenceAttachments";
import {ModelIcon} from "./ModelIcons";
import {Coins, Gauge} from "../../../ui/icons";
import {formatTokenCount} from "../runtime/contextUsage";
import {AgentRunDetails, type RunAction} from "./AgentRunDetails";
import type {AgentRun, AgentToolCall} from "../models/agent";
import {useProductQuery} from "../../../platform/product/queries";
import {isPersistedToolRound} from "../runtime/runPresentation";
import {useAgentActivityNavigation} from "./AgentActivityNavigation";
import {Button} from "../../../ui/button";
import {CopyButton, Markdown, Text} from "@lobehub/ui";
import {memo, useCallback, useLayoutEffect, useRef} from "react";
import type {ChatMessage} from "../models/chat";
import {isChatNearBottom, snapChatToBottom} from "../presentation/chatScroll";
import {ThinkingMatrix} from "./ThinkingMatrix";
import {ThinkingPanel} from "./ThinkingPanel";
import {MemoryRunHistory} from "./MemoryContextDetails";
import {TurnNavigation} from "./TurnNavigation";

/** One quiet status line, only for outcomes the reader must notice. */
export function presentMessageStatus(message: Pick<ChatMessage, "status" | "error">, run?: Pick<AgentRun, "pauseReason">): {
    text: string;
    tone: "error" | "muted"
} | undefined {
    if (message.status === "error") return {text: message.error || "生成失败", tone: "error"};
    if (message.status === "aborted") return {text: "已停止", tone: "muted"};
    if (message.status === "interrupted") return {
        text: message.error || (run?.pauseReason === "model_step_limit" ? "执行已暂停" : "生成中断"),
        tone: "muted"
    };
    return undefined;
}

const EMPTY_CALLS: AgentToolCall[] = [];
const MARKDOWN_PROPS = {variant: "chat"} as const;

/**
 * Message list — assistant text is drawn directly (no avatar/title/bubble); users keep a right bubble.
 * Stick with `scrollTop` on this element (not `scrollIntoView` smooth).
 * History rows are memoized so Dexie liveQuery ticks only paint the streaming item.
 */
export function MessageList({messages, runs, retryableRunId, onRetryRun, busy, readOnly, onRunAction}: {
    messages: ChatMessage[] | undefined;
    runs?: AgentRun[];
    busy: boolean;
    readOnly?: boolean;
    onRunAction: (runId: string, action: RunAction, callId?: string) => void;
    retryableRunId?: string;
    onRetryRun: (id: string) => void;
}) {
    const {request} = useAgentActivityNavigation();
    const listRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const stickToBottom = useRef(true);
    const manuallyNavigated = useRef(false);
    const pauseFollowing = useCallback(() => {
        manuallyNavigated.current = true;
        stickToBottom.current = false;
    }, []);
    const list = messages ?? [];
    const threadKey = list[0]?.threadId ?? "";
    const userMessages = list.filter((message) => message.role === "user");
    const lastUserId = userMessages.at(-1)?.id;
    useLayoutEffect(() => {
        stickToBottom.current = true;
        manuallyNavigated.current = false;
        const el = listRef.current;
        if (!el) return;
        snapChatToBottom(el);
        const frame = requestAnimationFrame(() => snapChatToBottom(el));
        return () => cancelAnimationFrame(frame);
    }, [threadKey]);

    useLayoutEffect(() => {
        // A new user turn resumes following; streaming updates to an existing turn do not.
        manuallyNavigated.current = false;
        stickToBottom.current = true;
        if (listRef.current) snapChatToBottom(listRef.current);
    }, [lastUserId]);

    useLayoutEffect(() => {
        if (request) pauseFollowing();
    }, [request, pauseFollowing]);

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
        <div className={`agent-message-navigation-shell${userMessages.length >= 5 ? " has-turn-navigation" : ""}`}>
            <div
                ref={listRef}
                className="agent-message-list"
                onPointerDownCapture={(event) => {
                    if (event.target === listRef.current) manuallyNavigated.current = false;
                    if (event.target instanceof Element && event.target.closest(".agent-execution-activity button, .agent-execution-activity summary")) pauseFollowing();
                }}
                onKeyDownCapture={(event) => {
                    if (["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp"].includes(event.key)) manuallyNavigated.current = false;
                    if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest(".agent-execution-activity")) pauseFollowing();
                }}
                onWheel={() => {
                    manuallyNavigated.current = false;
                }}
                onTouchStart={() => {
                    manuallyNavigated.current = false;
                }}
                onScroll={() => {
                    const el = listRef.current;
                    if (el && !manuallyNavigated.current) stickToBottom.current = isChatNearBottom(el);
                }}
            >
                <div ref={contentRef} className="agent-content">
                    {messages === undefined ? (
                        <Text type="secondary">加载中…</Text>
                    ) : (
                        list.map((message) => {
                            if (message.role === "system") return null;
                            return (
                                <AgentChatMessageItem key={message.id} message={message}
                                                      run={runs?.find((run) => run.id === message.runId)} busy={busy}
                                                      readOnly={readOnly} onRunAction={onRunAction}
                                                      retryable={Boolean(message.runId && message.runId === retryableRunId)}
                                                      onRetryRun={onRetryRun}/>
                            );
                        })
                    )}
                </div>
            </div>
            <TurnNavigation messages={list} listRef={listRef} contentRef={contentRef} onNavigate={pauseFollowing}/>
        </div>
    );
}

const AgentChatMessageItem = memo(
    function AgentChatMessageItem({
                                      message,
                                      run,
                                      busy,
                                      readOnly,
                                      onRunAction,
                                      retryable,
                                      onRetryRun,
                                  }: {
        message: ChatMessage;
        run?: AgentRun;
        busy: boolean;
        readOnly?: boolean;
        onRunAction: (runId: string, action: RunAction, callId?: string) => void;
        retryable: boolean;
        onRetryRun: (id: string) => void;
    }) {
        const calls = useProductQuery((db) => run ? db.agentToolCalls.where("runId").equals(run.id).toArray() : Promise.resolve(EMPTY_CALLS), [run?.id]) ?? EMPTY_CALLS;
        const isUser = message.role === "user";
        const processOwnsContent = !isUser && !!run && (run.status === "running" || isPersistedToolRound(run, message, calls));
        const reasoningText = message.reasoning?.trim() ?? "";
        const hasReasoning = reasoningText.length > 0;
        const reasoningActive =
            !isUser &&
            message.status === "streaming" &&
            hasReasoning &&
            !message.content;
        const showMatrix =
            !isUser && !run &&
            message.status === "streaming" &&
            !message.content &&
            !hasReasoning;
        const showCopy = !isUser && !processOwnsContent && Boolean(message.content) && message.status !== "streaming";
        const text = showMatrix || processOwnsContent ? "" : message.content;
        const statusLine = presentMessageStatus(message, run);
        const time = new Date(message.createdAt);
        const timeLabel = Number.isNaN(time.getTime()) ? undefined : time.toLocaleString();

        if (isUser) {
            return (
                <div className="agent-transcript-item agent-transcript-user" data-turn-anchor={message.id}
                     title={timeLabel}>
                    <div className="agent-user-bubble">
                        <ReferenceMessageSources context={message.referenceContext} content={message.content}/>
                        <Markdown {...MARKDOWN_PROPS}>{message.content}</Markdown>
                    </div>
                </div>
            );
        }
        return (
            <div className="agent-transcript-item agent-assistant-transcript">
                {run && <AgentRunDetails run={run} message={message} calls={calls} busy={busy} readOnly={readOnly}
                                         onAction={onRunAction}/>}
                {!run && hasReasoning && <ThinkingPanel reasoning={message.reasoning ?? ""} active={reasoningActive}
                                                        durationMs={message.reasoningDurationMs}/>}
                {showMatrix && <ThinkingMatrix/>}
                {text && <Markdown {...MARKDOWN_PROPS}>{text}</Markdown>}
                <div className="agent-message-footer">
                    <ReferenceMessageSources run={run} content={processOwnsContent ? "" : message.content}/>
                    <div className="agent-message-meta">
                        {showCopy && <CopyButton content={message.content} title="复制" size="small"/>}
                        {run && <MemoryRunHistory run={run} readOnly={readOnly}/>}
                        <span className="agent-message-hover-info">
                            {timeLabel && <span>{timeLabel}</span>}
                            {run?.model && <span className="agent-model-attribution" title={run.model}><ModelIcon
                                model={run.model} size={14}/>{run.model}</span>}
                            {run?.outputTokensPerSecond !== undefined && <span className="agent-model-attribution"
                                                                               title="生成速度：供应商返回的输出 token ÷ 流式生成耗时（不含工具和审批等待）"><Gauge
                                size={12}/>{run.outputTokensPerSecond.toFixed(1)} tok/s</span>}
                            {run?.usage?.totalTokens !== undefined && <span className="agent-model-attribution"
                                                                            title={`输入 ${run.usage.inputTokens?.toLocaleString() ?? "未知"}，输出 ${run.usage.outputTokens?.toLocaleString() ?? "未知"}`}><Coins
                                size={12}/>{formatTokenCount(run.usage.totalTokens)}</span>}
                        </span>
                    </div>
                    {(statusLine || (retryable && message.runId)) && <div className="agent-message-status">
                        {statusLine && <span role="status"
                                             className={statusLine.tone === "error" ? "agent-message-error" : undefined}>{statusLine.text}</span>}
                        {retryable && message.runId && <Button size="sm" variant="outline"
                                                               onClick={() => onRetryRun(message.runId!)}>重新生成</Button>}
                    </div>}
                </div>
            </div>
        );
    },
    (prev, next) =>
        prev.run?.id === next.run?.id &&
        prev.run?.updatedAt === next.run?.updatedAt &&
        prev.run?.status === next.run?.status &&
        prev.run?.pauseReason === next.run?.pauseReason &&
        prev.run?.usage?.totalTokens === next.run?.usage?.totalTokens &&
        prev.run?.usage?.inputTokens === next.run?.usage?.inputTokens &&
        prev.run?.usage?.outputTokens === next.run?.usage?.outputTokens &&
        prev.run?.outputTokensPerSecond === next.run?.outputTokensPerSecond &&
        prev.busy === next.busy &&
        prev.readOnly === next.readOnly &&
        prev.onRunAction === next.onRunAction &&
        prev.retryable === next.retryable &&
        prev.onRetryRun === next.onRetryRun &&
        prev.run?.referenceAudit?.length === next.run?.referenceAudit?.length &&
        prev.run?.referenceAudit?.at(-1)?.preparedAt === next.run?.referenceAudit?.at(-1)?.preparedAt &&
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
