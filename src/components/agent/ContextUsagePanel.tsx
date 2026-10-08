import {
    createToolLoading,
    DISCOVERY_TOOL_NAME,
    getOfferedToolNames,
    toolLoadingInstructions
} from "@/lib/agent/toolLoading";
import type {ReferenceAttachment} from "@/domain/references";
import {withMemoryContext} from "@/lib/memory/retrieval";
import {filterProjectMemoryTools} from "@/lib/agent/memoryToolNames";
import {MemoryContextDetails} from "./MemoryContextDetails";
import type {AgentInteractionMode} from "@/domain/agent";
import {ContextCompactionDetails} from "./ContextCompactionDetails";
import {normalizeContextPolicy, resolveContextCapacity,} from "@/lib/agent/contextPolicy";
import {
    budgetContext,
    buildContextMessages,
    findApplicableSummary,
    selectContextHistory,
} from "@/lib/agent/contextPlanner";
import {continuationExtraTokens} from "@/lib/agent/contextCompaction";
import type {ChatModelMetadata} from "@/lib/ai/modelMetadata";
import type {ConnectorConfig} from "@/domain/types";
import {useMemo, useState} from "react";
import {contextPreviewIdentity, readAgentContextPreview} from "@/db/agentContextPreview";
import {useLiveQuery} from "dexie-react-hooks";
import * as Popover from "@radix-ui/react-popover";
import {X} from "lucide-react";
import {assembleSkills, DEFAULT_SKILL_IDS} from "@/lib/agent/skills";
import {toolSchemas} from "@/lib/agent/tools";
import {estimateContextUsage, formatTokenCount,} from "@/lib/agent/contextUsage";

const EMPTY_ATTACHMENTS: ReferenceAttachment[] = [];

type ContextProps = {
    attachments?: ReferenceAttachment[];
    threadId?: string;
    projectId?: string;
    interactionMode?: AgentInteractionMode;
    draft: string;
    model: string;
    connector?: ConnectorConfig;
    modelMetadata?: Record<string, ChatModelMetadata>;
};

function useContextUsage(props: ContextProps) {
    const {threadId, projectId, interactionMode, draft, attachments = EMPTY_ATTACHMENTS, model, connector, modelMetadata} = props;
    const requestDraft = draft.trim() || (attachments.length ? "请结合附加的参考资料协助我。" : "");
    const input = useMemo(() => ({threadId, projectId, interactionMode, draft: requestDraft, attachments,
        model, providerId: connector?.definitionId, metadata: modelMetadata?.[model]}),
        [threadId, projectId, interactionMode, requestDraft, attachments, model, connector?.definitionId, modelMetadata]);
    const identity = contextPreviewIdentity(input);
    const loaded = useLiveQuery(() => readAgentContextPreview(input), [input]);
    const snapshot = loaded?.identity === identity ? loaded : undefined;
    return useMemo(() => {
        if (!snapshot || snapshot.status !== "ready") {
            let error: string | undefined;
            if (snapshot?.status === "error" || snapshot?.status === "unavailable") error = snapshot.message;
            if (snapshot?.status === "missing") error = {agent: "助手配置不存在", thread: "对话不存在", project: "关联项目已不存在"}[snapshot.entity];
            return {identity, status: snapshot?.status ?? "loading", model, error} as const;
        }
        const {config, messages, records, taskContext, activeRun, previewPolicy} = snapshot.facts;
        const policy = activeRun ? normalizeContextPolicy(activeRun.context?.policy) : previewPolicy;
        const selected = selectContextHistory(
            messages.filter((message) => message.threadId === threadId),
            policy,
        );
        const summary = !activeRun && policy.autoCompress
            ? findApplicableSummary(
                selected,
                records,
            )
            : undefined;
        const resolved =
            activeRun ? (activeRun.context ?? {capacity: undefined, capacitySource: "unknown" as const}) : resolveContextCapacity(
                model,
                modelMetadata?.[model],
                connector?.definitionId,
                policy,
            );
        const {capacity, capacitySource: source} = resolved;
        const skills = assembleSkills(
            interactionMode === "conversation"
                ? []
                : (config?.enabledSkillIds ?? DEFAULT_SKILL_IDS),
        );
        const instructions =
            activeRun ? activeRun.agentSnapshot.instructions : taskContext?.instructions ?? "";
        const allowedNames = activeRun ? activeRun.enabledToolNames ?? [] : filterProjectMemoryTools([...new Set([...skills.enabledToolNames, ...(taskContext?.taskToolNames ?? [])])], taskContext?.projectContext?.projectId, interactionMode);
        const loading = activeRun ? activeRun.toolLoading : createToolLoading(interactionMode === "conversation" ? [] : config?.enabledSkillIds ?? DEFAULT_SKILL_IDS, allowedNames, taskContext?.projectKind);
        const offeredNames = activeRun ? getOfferedToolNames(activeRun) : getOfferedToolNames({
            enabledToolNames: loading ? [...allowedNames, DISCOVERY_TOOL_NAME] : allowedNames,
            toolLoading: loading,
            interactionMode
        });
        const skillInstructions = activeRun
            ? (activeRun.skillInstructions ?? "")
            : loading ? toolLoadingInstructions(loading) : skills.skillInstructions;
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
        const tools = toolSchemas(offeredNames);
        const budget = budgetContext(
            request,
            tools,
            capacity,
            activeRun ? !!activeRun.context?.summaryId : !!summary,
            activeRun ? continuationExtraTokens(activeRun) : 0,
        );
        const usage = estimateContextUsage({
            instructions,
            skillInstructions,
            messages: request,
            tools,
        });
        const projectContext =
            activeRun ? activeRun.projectContext : taskContext?.projectContext;
        if (projectContext) usage.categories[0].label = "助手指令与项目事实";
        const overhead = Math.max(0, budget.estimatedTokens - usage.total);
        usage.categories.push({
            id: "envelope",
            label: "请求结构与续接状态",
            tokens: overhead,
            color: "#888888",
        });
        usage.total += overhead;
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
            identity, status: "ready" as const, model,
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

export function ContextUsagePanel({snapshot, onClose, onMemoryOpen}: {
    snapshot: ReturnType<typeof useContextUsage>;
    onClose: () => void;
    onMemoryOpen?: () => void;
}) {
    if (snapshot.status !== "ready" || !("usage" in snapshot)) return <div className="agent-context-panel" role="region" aria-label="上下文明细">
        <button type="button" aria-label="关闭上下文明细" onClick={onClose}><X size={16}/></button>
        <p role={snapshot.error ? "alert" : "status"}>{snapshot.error ?? "正在读取上下文…"}</p>
    </div>;
    const {usage, capacity, percent, activeRun, source, policy, budget, selectedCount, lastRecord,
        projectContext, memorySelection, selectedReferences, referencesLoading, toolCount, capabilityCount,
        loadedCapabilities, error, model} = snapshot;
    return (
        <div className="agent-context-panel" role="region" aria-label="上下文明细">
            <div className="agent-context-heading">
                <span>上下文明细</span>
                <span className="agent-context-heading-actions">
          <small>TOKEN · 估算</small>
          <button type="button" aria-label="关闭上下文明细" onClick={onClose}>
            <X size={16}/>
          </button>
        </span>
            </div>
            {!snapshot.available && <p role="alert">当前范围不可用；已保存的执行上下文仅供查看。</p>}
            <div className="agent-context-scope">
                {activeRun ? "当前执行 · 已保存的上下文" : "下次发送 · 包含当前草稿"}
            </div>
            <div className="agent-context-model" title={activeRun?.model ?? model}>
                {activeRun?.model ?? (model || "尚未选择模型")}
            </div>
            <div className="agent-context-project">
                <strong>当前提供 {toolCount} 个工具{capabilityCount ? ` · ${capabilityCount} 组能力按需加载` : ""}</strong>
                {capabilityCount > 0 &&
                    <small>{loadedCapabilities.length ? `已加载：${loadedCapabilities.join("、")}` : "先提供基础工具与能力目录，业务工具使用时再加载。"}</small>}
            </div>
            {projectContext && (
                <div className="agent-context-project">
                    <strong>{projectContext.name}</strong>
                    <span>当前项目事实 · {activeRun ? "执行快照" : "随资料更新"}</span>
                    <small>
                        分集 {projectContext.coverage.episodes.included}/
                        {projectContext.coverage.episodes.total} · 资产{" "}
                        {projectContext.coverage.assets.included}/
                        {projectContext.coverage.assets.total}
                        {projectContext.coverage.truncated ? " · 部分摘录" : ""}
                    </small>
                    <small>包含项目设定与素材索引；完整内容由助手按需读取。</small>
                </div>
            )}
            {memorySelection && onMemoryOpen && (
                <button
                    type="button"
                    className="agent-context-memory-link"
                    onClick={onMemoryOpen}
                >
                    <span>项目记忆 · {memorySelection.selectedCount} 条</span>
                    <span>查看引用与排除 →</span>
                </button>
            )}
            {selectedReferences && (
                <details className="agent-context-project">
                    <summary>本次消息参考资料 · {selectedReferences.references.length} 份</summary>
                    <small>仅显示本次准备的范围；原文未覆盖部分不会自动发送。</small>
                    {selectedReferences.coverage?.map((item) => (
                        <div key={`${item.referenceId}:${item.revision}`}>
                            <strong>{item.filename}</strong>
                            <small>{item.kind === "image" ? "真实图片输入 · 按 4096 tokens 保守估算" : `文本片段 ${item.includedChunkIndices.length}/${item.totalChunks} · ${item.includedCharacters.toLocaleString()} 字符${item.partial ? " · 部分摘录" : ""}`}</small>
                            {item.warnings.map((warning, index) => <small key={index}>{warning}</small>)}
                        </div>
                    ))}
                </details>
            )}
            {referencesLoading && <p role="status">正在准备所选参考资料的范围与估算…</p>}
            {error && <p role="status">{error}。历史仍可查看。</p>}
            {usage ? (
                <>
                    <div className="agent-context-bar" aria-hidden>
                        {usage.categories.map((item) => (
                            <span
                                key={item.id}
                                style={{
                                    width: `${usage.total ? (item.tokens / usage.total) * 100 : 0}%`,
                                    background: item.color,
                                }}
                            />
                        ))}
                    </div>
                    <dl className="agent-context-breakdown">
                        {usage.categories.map((item) => (
                            <div key={item.id}>
                                <dt>
                                    <i style={{background: item.color}}/>
                                    {item.label}
                                </dt>
                                <dd title={`${item.tokens.toLocaleString()} tokens（估算）`}>
                                    {formatTokenCount(item.tokens)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <div className="agent-context-capacity-bar" aria-hidden>
                        <span style={{width: `${percent ?? 0}%`}}/>
                    </div>
                    <div className="agent-context-totals">
                        <div>
                            <span>预计占用</span>
                            <strong>≈ {formatTokenCount(usage.total)}</strong>
                        </div>
                        <div>
                            <span>剩余可用</span>
                            <span>
                {capacity
                    ? `≈ ${formatTokenCount(Math.max(0, capacity - usage.total))}`
                    : "待确认"}
              </span>
                        </div>
                        <div>
              <span title={source}>
                上下文上限{source ? ` · ${source}` : ""}
              </span>
                            <span>{capacity ? formatTokenCount(capacity) : "未知"}</span>
                        </div>
                    </div>
                    <div className="agent-context-budget">
                        <div>
                            {policy.limitHistory
                                ? `历史上限 ${policy.historyMessageCount} 条 · 已选择 ${selectedCount} 条`
                                : `历史不限条数 · 已选择 ${selectedCount} 条`}
                        </div>
                        <div>
                            {capacity
                                ? `输出预留 ${formatTokenCount(budget.outputReserve)} · 安全输入预算 ${formatTokenCount(budget.inputBudget!)}`
                                : "上限未知 · 可在对话参数中设置本地预算"}
                        </div>
                        <div>
                            {policy.autoCompress
                                ? capacity
                                    ? budget.needsCompression
                                        ? "下次请求前将检查并整理较早的历史"
                                        : "自动整理已开启"
                                    : "自动整理等待可用预算"
                                : "自动整理已关闭"}
                        </div>
                    </div>
                    {lastRecord && <ContextCompactionDetails record={lastRecord}/>}
                    <p>
                        文本按长度粗略估算；每张图片按 4096 tokens 保守估算，非模型实际用量。
                        {capacity
                            ? `预计占用 ${((usage.total / capacity) * 100).toFixed(1)}%；整理触发基于上限的 50%（已有摘要时为 65%），另计 25% 估算余量及输出预留。`
                            : "当前连接未提供可信的上下文上限，暂不计算占用比例。"}
                    </p>
                    {activeRun && (
                        <p>
                            包含已保存的请求与续接状态；当前输出及未回填的工具结果尚未计入。
                            {activeRun.modelMetrics?.at(-1)?.usage?.inputTokens !== undefined
                                ? `最近一次请求实际输入 ${formatTokenCount(activeRun.modelMetrics.at(-1)!.usage!.inputTokens!)} tokens${activeRun.modelMetrics.at(-1)?.usage?.cachedInputTokens !== undefined ? `，其中缓存命中 ${formatTokenCount(activeRun.modelMetrics.at(-1)!.usage!.cachedInputTokens!)}` : ""}。`
                                : ""}
                        </p>
                    )}
                </>
            ) : (
                !error && !referencesLoading && <p>正在读取助手配置…</p>
            )}
        </div>
    );
}

export function ContextUsageTrigger({
                                        open,
                                        onOpenChange,
                                        ...props
                                    }: ContextProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
    const snapshot = useContextUsage(props);
    const ready = snapshot.status === "ready" && "usage" in snapshot ? snapshot : undefined;
    const {percent, usage, capacity, memorySelection, activeRun} = ready ?? {};
    const [memoryOpen, setMemoryOpen] = useState(false);
    return (
        <>
            <Popover.Root open={open} onOpenChange={onOpenChange}>
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        className="agent-chip agent-control-icon agent-context-trigger"
                        aria-label="上下文明细"
                        title={
                            capacity && usage
                                ? `上下文预计占用 ${((usage.total / capacity) * 100).toFixed(1)}%`
                                : "上下文明细（估算）"
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
                        collisionPadding={16}
                        className="agent-context-popover"
                        aria-label="上下文明细"
                    >
                        <ContextUsagePanel
                            snapshot={snapshot}
                            onClose={() => onOpenChange(false)}
                            onMemoryOpen={() => {
                                onOpenChange(false);
                                setMemoryOpen(true);
                            }}
                        />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
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
