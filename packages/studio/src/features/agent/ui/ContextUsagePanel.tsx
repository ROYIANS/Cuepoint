import {getOfferedToolNames} from "../runtime/toolLoading";
import type {ReferenceAttachment} from "../../references/models/references";
import {withMemoryContext} from "../../memory/services/retrieval";
import {MemoryContextDetails} from "./MemoryContextDetails";
import type {AgentInteractionMode, AgentReasoningEffort} from "../models/agent";
import {ContextCompactionDetails} from "./ContextCompactionDetails";
import {normalizeContextPolicy, resolveContextCapacity,} from "../runtime/contextPolicy";
import {
    budgetContext,
    buildContextMessages,
    findApplicableSummary,
    runBudgetMeasure,
    selectContextHistory,
    summaryCandidates,
} from "../runtime/contextPlanner";
import {agentExecution} from "../runtime/agentExecution";
import {continuationExtraTokens} from "../runtime/contextCompaction";
import type {ChatModelMetadata} from "../../settings/models/modelMetadata";
import type {ContextCompaction} from "../models/context";
import type {ConnectorConfig} from "../../settings/models/connector";
import {createPortal} from "react-dom";
import {type RefObject, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {contextPreviewIdentity, prepareAgentContextPreview, readPreparedAgentContextPreview, type ContextPreviewRead} from "../commands/agentContextPreview";
import {useProductQuery} from "../../../platform/product/queries";
import * as Popover from "@radix-ui/react-popover";
import {mcpRuntimeOwner} from "../mcp/runtime/owner";
import {estimateContextUsage, formatTokenCount, summarizeContextRows,} from "../runtime/contextUsage";
import {popupCollisionPadding} from "../../../ui/popupCollision";
import {Info, Minimize2, X} from "../../../ui/icons";

const EMPTY_ATTACHMENTS: ReferenceAttachment[] = [];

type ContextProps = {
    attachments?: readonly Readonly<ReferenceAttachment>[];
    threadId?: string;
    projectId?: string;
    interactionMode?: AgentInteractionMode;
    draft: string;
    model: string;
    connector?: ConnectorConfig;
    modelMetadata?: Record<string, ChatModelMetadata>;
    reasoningEffort?: AgentReasoningEffort;
};

function useContextUsage(props: ContextProps) {
    const {
        threadId,
        projectId,
        interactionMode,
        draft,
        attachments = EMPTY_ATTACHMENTS,
        model,
        connector,
        modelMetadata
    } = props;
    const requestDraft = draft.trim() || (attachments.length ? "请结合附加的参考资料协助我。" : "");
    const input = useMemo(() => ({
            threadId, projectId, interactionMode, draft: requestDraft, attachments: attachments.map(item => ({...item})),
            model, providerId: connector?.definitionId, metadata: modelMetadata?.[model]
        }),
        [threadId, projectId, interactionMode, requestDraft, attachments, model, connector?.definitionId, modelMetadata]);
    const identity = contextPreviewIdentity(input);
    const [preparation, setPreparation] = useState<Awaited<ReturnType<typeof prepareAgentContextPreview>> | {identity: string; error: string}>();
    useEffect(() => {
        let attached = true;
        void prepareAgentContextPreview(input).then(value => {if (attached) setPreparation(value);},
            cause => {if (attached) setPreparation({identity, error: cause instanceof Error ? cause.message : "上下文准备失败"});});
        return () => {attached = false;};
    }, [input, identity]);
    const connections = mcpRuntimeOwner()?.connections;
    const connectionRevision = useSyncExternalStore(connections ? listener => connections.subscribe(listener) : () => () => undefined,
        () => connections?.revision ?? 0, () => 0);
    const prepared = preparation?.identity === identity ? preparation : undefined;
    const loaded = useProductQuery<ContextPreviewRead | undefined>(db => !prepared ? undefined : "error" in prepared ?
        {identity, status: "error", message: prepared.error} : readPreparedAgentContextPreview(input, prepared, db), [input, prepared, connectionRevision]);
    const snapshot = loaded?.identity === identity ? loaded : undefined;
    return useMemo(() => {
        if (!snapshot || snapshot.status !== "ready") {
            let error: string | undefined;
            if (snapshot?.status === "error" || snapshot?.status === "unavailable") error = snapshot.message;
            if (snapshot?.status === "missing") error = {
                agent: "助手配置不存在",
                thread: "对话不存在",
                project: "关联项目已不存在"
            }[snapshot.entity];
            return {identity, status: snapshot?.status ?? "loading", model, error} as const;
        }
        const {messages, records, taskContext, activeRun, previewPolicy} = snapshot.facts;
        const policy = activeRun ? normalizeContextPolicy(activeRun.context?.policy) : previewPolicy;
        const selected = selectContextHistory(
            messages.filter((message) => message.threadId === threadId),
            policy,
        );
        const summary = !activeRun
            ? findApplicableSummary(selected, summaryCandidates(records, policy))
            : undefined;
        const resolved =
            activeRun ? (activeRun.context ?? {
                capacity: undefined,
                capacitySource: "unknown" as const
            }) : resolveContextCapacity(
                model,
                modelMetadata?.[model],
                connector?.definitionId,
                policy,
            );
        const {capacity, capacitySource: source} = resolved;
        const instructions = activeRun ? activeRun.agentSnapshot.instructions : taskContext?.instructions ?? "";
        const {enabledToolNames, toolLoading: loading, skillInstructions} = snapshot.facts.skillSurface;
        const offeredNames = getOfferedToolNames(activeRun ?? {enabledToolNames, toolLoading: loading,
            interactionMode: interactionMode ?? snapshot.facts.thread?.interactionMode ?? "smart"});
        const memorySelection =
            activeRun ? activeRun.memorySelection : snapshot.facts.memorySelection;
        const selectedReferences = activeRun ? activeRun.context?.selectedReferences : snapshot.facts.selectedReferences;
        const request = activeRun
            ? (activeRun.continuationMessages ?? activeRun.requestMessages)
            : withMemoryContext(
                buildContextMessages(
                    instructions,
                    skillInstructions,
                    selected,
                    requestDraft,
                    summary,
                    undefined,
                    selectedReferences,
                ),
                memorySelection,
            );
        const tools = snapshot.facts.toolSchemas;
        // The same figure the compaction trigger compares: provider-reported baseline + estimated delta when
        // the last request still describes this one, otherwise a whole-request estimate.
        const lastAnchor = snapshot.facts.lastRun?.contextAnchor;
        const anchorProtocol = lastAnchor?.protocol ?? "chat-completions";
        const measure = activeRun ? runBudgetMeasure(activeRun) : {
            protocol: anchorProtocol, anchor: lastAnchor,
            scope: {model, definitionId: connector?.definitionId, protocol: anchorProtocol, summaryId: summary?.id},
        };
        const budget = budgetContext(
            request,
            tools,
            capacity,
            activeRun ? !!activeRun.context?.summaryId : !!summary,
            activeRun ? continuationExtraTokens(activeRun) : 0,
            measure,
        );
        const usage = estimateContextUsage({
            instructions,
            skillInstructions,
            messages: request,
            tools,
            protocol: measure.protocol,
        });
        const projectContext =
            activeRun ? activeRun.projectContext : taskContext?.projectContext;
        if (projectContext) usage.categories[0].label = "助手指令与项目事实";
        const overhead = Math.max(0, budget.requestEstimate - usage.total);
        usage.categories.push({
            id: "envelope",
            label: "请求结构与续接状态",
            tokens: overhead,
            color: "#888888",
        });
        usage.total += overhead;
        if (budget.source === "reported" && usage.total > 0) {
            // Composition is always an estimate; scale it so the bar sums to the reported-based total.
            const factor = budget.usedTokens / usage.total;
            for (const category of usage.categories) category.tokens = Math.round(category.tokens * factor);
        }
        usage.total = budget.usedTokens;
        const percent = capacity
            ? Math.min(100, (usage.total / capacity) * 100)
            : undefined;
        return {
            toolCount: offeredNames.length,
            capabilityCount: loading?.groups.length ?? 0,
            loadedCapabilities: loading?.groups.filter(group => loading.loadedGroupIds.includes(group.id)).map(group => group.name) ?? [],
            projectContext,
            memorySelection,
            selectedReferences,
            identity, status: "ready" as const, model, threadId,
            available: snapshot.facts.available,
            referencesLoading: false,
            error: undefined,
            usage,
            capacity,
            percent,
            activeRun,
            source,
            policy,
            budget,
            selectedCount: activeRun ? activeRun.context?.history.length ?? 0 : selected.length,
            lastRecord: activeRun ? records.find(record => record.id === activeRun.context?.summaryId) : records.at(-1),
        };
    }, [snapshot, identity, threadId, requestDraft, interactionMode, model, modelMetadata, connector]);
}

/** One footer action: compress now, with progress, Cancel and a one-line request-level result. */
export function CompactAction({threadId, connector, model, modelMetadata, reasoningEffort, blocked, lastRecord, detailsOpen, onToggleDetails}: {
    detailsOpen?: boolean;
    onToggleDetails?: () => void;
    threadId?: string;
    connector?: ConnectorConfig;
    model: string;
    modelMetadata?: ChatModelMetadata;
    reasoningEffort?: AgentReasoningEffort;
    blocked?: string;
    lastRecord?: ContextCompaction;
}) {
    const execution = useSyncExternalStore(
        listener => threadId ? agentExecution.subscribe(threadId, listener) : () => undefined,
        () => threadId ? agentExecution.snapshot(threadId) : undefined, () => undefined);
    const [requested, setRequested] = useState(false);
    const [failure, setFailure] = useState<string>();
    const compacting = execution?.active && execution.kind === "contextCompaction";
    const otherWork = execution?.active && !compacting;
    const reason = blocked ?? compactBlockReason({otherWork: !!otherWork, threadId, connector, model});
    const start = () => {
        if (!threadId || !connector || reason) return;
        setFailure(undefined);
        setRequested(true);
        try {
            agentExecution.compactContext({threadId, connectorId: connector.id, model, reasoningEffort, modelMetadata});
        } catch (cause) {
            setFailure(cause instanceof Error ? cause.message : "无法压缩");
        }
    };
    const stop = () => {
        if (threadId && execution?.token) agentExecution.requestStop({threadId, token: execution.token});
    };
    const message = failure ?? (requested && !compacting ? execution?.error : undefined);
    const manual = lastRecord?.origin === "manual" && lastRecord.status === "completed" ? lastRecord : undefined;
    const result = manual?.requestBefore !== undefined && manual.requestAfter !== undefined
        ? `${formatTokenCount(manual.requestBefore)} → ${formatTokenCount(manual.requestAfter)}` : undefined;
    const note = result ?? (compacting ? undefined : reason);
    return <div className="agent-context-footer">
        <div className="agent-context-footer-row">
            <span className="agent-context-footer-note" role={result ? "status" : undefined}>{note}</span>
            <span className="agent-context-footer-actions">
                {compacting
                    ? <button type="button" className="agent-context-icon-button" onClick={stop} disabled={execution?.stopping}
                              aria-label={execution?.stopping ? "正在取消…" : "取消压缩"} title={execution?.stopping ? "正在取消…" : "取消压缩"}><X size={14} aria-hidden/></button>
                    : <button type="button" className="agent-context-icon-button" onClick={start} disabled={!!reason}
                              aria-label="压缩上下文" title={reason ?? "压缩上下文"}><Minimize2 size={14} aria-hidden/></button>}
                {onToggleDetails ? <button type="button" className="agent-context-icon-button" onClick={onToggleDetails}
                                           aria-label="详情" aria-expanded={detailsOpen} title="详情"><Info size={14} aria-hidden/></button> : null}
            </span>
        </div>
        {message && !compacting && <p role="alert">{message}</p>}
    </div>;
}

function compactBlockReason(input: {otherWork: boolean; threadId?: string; connector?: ConnectorConfig; model: string}): string | undefined {
    if (input.otherWork) return "对话正忙，稍后可压缩";
    if (!input.threadId) return "发送消息后可压缩";
    if (!input.connector || !input.model) return "请先选择模型";
    return undefined;
}

function percentLabel(percent: number): string {
    return percent > 0 && percent < 1 ? "<1%" : `${Math.round(percent)}%`;
}

function ContextDetails({snapshot, onMemoryOpen}: {
    snapshot: Extract<ReturnType<typeof useContextUsage>, {status: "ready"}>;
    onMemoryOpen?: () => void;
}) {
    const {lastRecord, memorySelection} = snapshot;
    if (!memorySelection && !lastRecord) return null;
    return <div className="agent-context-details">
        <div className="agent-context-details-body">
            {memorySelection && onMemoryOpen && <button type="button" className="agent-context-memory-link" onClick={onMemoryOpen}><span>项目记忆 · {memorySelection.selectedCount} 条</span><span>查看引用与排除 →</span></button>}
            {lastRecord && <ContextCompactionDetails record={lastRecord}/>}
        </div>
    </div>;
}

export function ContextUsagePanel({snapshot, onMemoryOpen, connector, modelMetadata, reasoningEffort}: {
    snapshot: ReturnType<typeof useContextUsage>;
    onMemoryOpen?: () => void;
    connector?: ConnectorConfig;
    modelMetadata?: ChatModelMetadata;
    reasoningEffort?: AgentReasoningEffort;
}) {
    const [detailsOpen, setDetailsOpen] = useState(false);
    if (snapshot.status !== "ready" || !("usage" in snapshot)) return snapshot.error ? <div className="agent-context-panel" role="region" aria-label="上下文用量">
        <p role="alert">{snapshot.error}</p>
    </div> : null;
    const {usage, capacity, percent, activeRun, lastRecord, error, model} = snapshot;
    const rows = summarizeContextRows(usage.categories);
    const scale = capacity ?? usage.total;
    return (
        <div className="agent-context-panel" role="region" aria-label="上下文用量">
            <div className="agent-context-head">
                <strong>{percent !== undefined ? `已用 ${percentLabel(percent)}` : "已用"}</strong>
                <span>
                    <span>≈ {formatTokenCount(usage.total)}{capacity ? ` / ${formatTokenCount(capacity)}` : ""}</span>
                </span>
            </div>
            <div className="agent-context-bar" aria-hidden>
                {rows.map(item => <span key={item.id} style={{width: `${scale ? Math.min(100, (item.tokens / scale) * 100) : 0}%`, background: item.color}}/>)}
            </div>
            {!snapshot.available && <p role="alert">当前范围不可用，已保存的上下文仅供查看。</p>}
            {error && <p role="status">{error}</p>}
            <ul className="agent-context-rows">
                {rows.map(item => <li key={item.id}>
                    <span><i style={{background: item.color}}/>{item.label}</span>
                    <span title={`${item.tokens.toLocaleString()} tokens`}>{formatTokenCount(item.tokens)}</span>
                </li>)}
            </ul>
            <CompactAction threadId={snapshot.threadId} connector={connector} model={model}
                           modelMetadata={modelMetadata} reasoningEffort={reasoningEffort}
                           blocked={activeRun ? "执行中，结束后可压缩" : !snapshot.available ? "当前范围不可用" : undefined}
                           lastRecord={lastRecord} detailsOpen={detailsOpen}
                           onToggleDetails={() => setDetailsOpen(open => !open)}/>
            {detailsOpen ? <ContextDetails snapshot={snapshot} onMemoryOpen={onMemoryOpen}/> : null}
        </div>
    );
}

export function ContextUsageTrigger({
                                        open,
                                        onOpenChange,
                                        sheetHost,
                                        ...props
                                    }: ContextProps & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When set, the breakdown is a full-width card above the composer instead of a floating popover. */
    sheetHost?: RefObject<HTMLDivElement | null>;
}) {
    const snapshot = useContextUsage(props);
    const ready = snapshot.status === "ready" && "usage" in snapshot ? snapshot : undefined;
    const {percent, usage, capacity, memorySelection, activeRun} = ready ?? {};
    const [memoryOpen, setMemoryOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const docked = Boolean(sheetHost);
    useEffect(() => {
        if (!open || !docked) return;
        const dismiss = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (sheetRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
            onOpenChange(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            onOpenChange(false);
            triggerRef.current?.focus();
        };
        document.addEventListener("pointerdown", dismiss, true);
        document.addEventListener("keydown", escape, true);
        return () => {
            document.removeEventListener("pointerdown", dismiss, true);
            document.removeEventListener("keydown", escape, true);
        };
    }, [open, docked, onOpenChange]);
    const panel = <ContextUsagePanel
        snapshot={snapshot}
        connector={props.connector}
        modelMetadata={props.modelMetadata?.[props.model]}
        reasoningEffort={props.reasoningEffort}
        onMemoryOpen={() => {
            onOpenChange(false);
            setMemoryOpen(true);
        }}
    />;
    const sheet = open && docked && sheetHost?.current ? createPortal(
        <div ref={sheetRef} className="agent-composer-sheet agent-context-sheet" aria-label="上下文明细">{panel}</div>,
        sheetHost.current,
    ) : null;
    return (
        <>
            {sheet}
            {docked ? <button
                ref={triggerRef}
                type="button"
                className="agent-chip agent-control-icon agent-context-trigger"
                aria-label="上下文明细"
                aria-expanded={open}
                title={capacity && usage ? `上下文预计占用 ${((usage.total / capacity) * 100).toFixed(1)}%` : "上下文明细"}
                onClick={() => onOpenChange(!open)}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3"/>
                    {percent !== undefined ? (
                        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3"
                                strokeDasharray={`${Math.max(0.5, (percent / 100) * 50.265)} 50.265`}
                                transform="rotate(-90 12 12)"/>
                    ) : <circle cx="12" cy="4" r="2" fill="currentColor"/>}
                </svg>
            </button> : <Popover.Root open={open} onOpenChange={onOpenChange}>
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        className="agent-chip agent-control-icon agent-context-trigger"
                        aria-label="上下文明细"
                        title={
                            capacity && usage
                                ? `上下文预计占用 ${((usage.total / capacity) * 100).toFixed(1)}%`
                                : "上下文明细"
                        }
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                            <circle
                                cx="12"
                                cy="12"
                                r="8"
                                fill="none"
                                stroke="currentColor"
                                strokeOpacity=".3"
                                strokeWidth="3"
                            />
                            {percent !== undefined ? (
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="8"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeDasharray={`${Math.max(0.5, (percent / 100) * 50.265)} 50.265`}
                                    transform="rotate(-90 12 12)"
                                />
                            ) : (
                                <circle cx="12" cy="4" r="2" fill="currentColor"/>
                            )}
                        </svg>
                    </button>
                </Popover.Trigger>
                <Popover.Portal
                    container={document.querySelector<HTMLElement>(".agent-chat-root")}
                >
                    <Popover.Content
                        side="top"
                        align="end"
                        sideOffset={10}
                        collisionPadding={popupCollisionPadding(16)}
                        className="agent-context-popover"
                        aria-label="上下文明细"
                    >
                        <ContextUsagePanel
                            snapshot={snapshot}
                            connector={props.connector}
                            modelMetadata={props.modelMetadata?.[props.model]}
                            reasoningEffort={props.reasoningEffort}
                            onMemoryOpen={() => {
                                onOpenChange(false);
                                setMemoryOpen(true);
                            }}
                        />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>}
            <MemoryContextDetails
                open={memoryOpen}
                onOpenChange={setMemoryOpen}
                selection={memorySelection}
                threadId={props.threadId}
                run={activeRun}
                readOnly={!ready?.available}
            />
        </>
    );
}
