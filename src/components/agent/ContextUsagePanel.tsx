import { getTaskContext } from "@/lib/agent/taskContext";
import type { AgentTask } from "@/domain/agent";
import { ContextCompactionDetails } from "./ContextCompactionDetails";
import { normalizeContextPolicy, resolveContextCapacity } from "@/lib/agent/contextPolicy";
import { budgetContext, buildContextMessages, findApplicableSummary, selectContextHistory } from "@/lib/agent/contextPlanner";
import { continuationExtraTokens } from "@/lib/agent/contextCompaction";
import type { ChatModelMetadata } from "@/lib/ai/modelMetadata";
import type { ConnectorConfig } from "@/domain/types";
import { useDeferredValue, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import * as Popover from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { db } from "@/db/database";
import { GENERAL_AGENT_ID, type AgentRun, type AgentInteractionMode } from "@/domain/agent";
import type { ChatMessage } from "@/domain/types";
import { assembleSkills, DEFAULT_SKILL_IDS } from "@/lib/agent/skills";
import { toolSchemas } from "@/lib/agent/tools";
import { estimateContextUsage, formatTokenCount } from "@/lib/agent/contextUsage";

type ContextProps = {
  threadId?: string;
  task?: AgentTask;
  interactionMode?: AgentInteractionMode; draft: string; messages: ChatMessage[]; runs: AgentRun[]; model: string; connector?: ConnectorConfig; modelMetadata?: Record<string, ChatModelMetadata>;
};

function useContextUsage({ draft, messages, runs, model, connector, modelMetadata, interactionMode, task, threadId }: ContextProps) {
  const config = useLiveQuery(() => db.agents.get(GENERAL_AGENT_ID), []);
  const thread = useLiveQuery(() => threadId ? db.chatThreads.get(threadId) : undefined, [threadId]);
  const records = useLiveQuery(() => threadId ? db.contextCompactions.where("threadId").equals(threadId).sortBy("createdAt") : [], [threadId]);
  const taskContext = useLiveQuery(() => getTaskContext(threadId, config?.instructions ?? "", thread?.taskMode, interactionMode), [threadId, config?.instructions, thread?.taskMode, interactionMode, task?.id]);
  const deferredDraft = useDeferredValue(draft);
  const latest = runs.at(-1);
  const activeRun = latest && (latest.status === "running" || latest.status === "waiting_approval" || (latest.hasToolCalls && (latest.status === "failed" || latest.status === "interrupted"))) ? latest : undefined;
  return useMemo(() => {
    const policy = activeRun?.context?.policy ?? normalizeContextPolicy(threadId ? thread?.contextPolicy : config?.contextPolicy);
    const selected = selectContextHistory(messages, policy);
    const summary = policy.autoCompress ? findApplicableSummary(selected, records ?? []) : undefined;
    const resolved = activeRun?.context ?? resolveContextCapacity(model, modelMetadata?.[model], connector?.definitionId, policy);
    const { capacity, capacitySource: source } = resolved;
    const skills = assembleSkills(interactionMode === "conversation" ? [] : config?.enabledSkillIds ?? DEFAULT_SKILL_IDS);
    const instructions = activeRun?.agentSnapshot.instructions ?? (taskContext?.instructions ?? config?.instructions ?? "");
    const skillInstructions = activeRun ? activeRun.skillInstructions ?? "" : skills.skillInstructions;
    const request = activeRun ? activeRun.continuationMessages ?? activeRun.requestMessages : buildContextMessages(instructions, skillInstructions, selected, deferredDraft, summary);
    const tools = toolSchemas(activeRun ? activeRun.enabledToolNames ?? [] : [...new Set([...skills.enabledToolNames, ...(taskContext?.taskToolNames ?? [])])]);
    const budget = budgetContext(request, tools, capacity, !!(activeRun?.context?.summaryId ?? summary), activeRun ? continuationExtraTokens(activeRun) : 0);
    const usage = estimateContextUsage({ instructions, skillInstructions, messages: request, tools });
    const overhead = Math.max(0, budget.estimatedTokens - usage.total);
    usage.categories.push({ id: "envelope", label: "请求结构与续接状态", tokens: overhead, color: "#888888" });
    usage.total += overhead;
    const percent = capacity ? Math.min(100, usage.total / capacity * 100) : undefined;
    return { usage: (config && taskContext) || activeRun ? usage : undefined, capacity, percent, activeRun, source, policy, budget, selectedCount: activeRun?.context?.history.length ?? selected.length, lastRecord: records?.at(-1) };
  }, [activeRun, config, thread, threadId, records, messages, deferredDraft, interactionMode, taskContext, model, modelMetadata, connector]);
}

export function ContextUsagePanel({ onClose, ...props }: ContextProps & { onClose: () => void }) {
  const { usage, capacity, percent, activeRun, source, policy, budget, selectedCount, lastRecord } = useContextUsage(props);
  const { model } = props;
  return <div className="agent-context-panel" role="region" aria-label="上下文明细">
      <div className="agent-context-heading"><span>上下文明细</span><span className="agent-context-heading-actions"><small>TOKEN · 估算</small><button type="button" aria-label="关闭上下文明细" onClick={onClose}><X size={16} /></button></span></div>
      <div className="agent-context-scope">{activeRun ? "当前执行 · 已保存的上下文" : "下次发送 · 包含当前草稿"}</div>
      <div className="agent-context-model" title={activeRun?.model ?? model}>{activeRun?.model ?? (model || "尚未选择模型")}</div>
      {usage ? <>
        <div className="agent-context-bar" aria-hidden>{usage.categories.map((item) => <span key={item.id} style={{ width: `${usage.total ? item.tokens / usage.total * 100 : 0}%`, background: item.color }} />)}</div>
        <dl className="agent-context-breakdown">{usage.categories.map((item) => <div key={item.id}><dt><i style={{ background: item.color }} />{item.label}</dt><dd title={`${item.tokens.toLocaleString()} tokens（估算）`}>{formatTokenCount(item.tokens)}</dd></div>)}</dl>
        <div className="agent-context-capacity-bar" aria-hidden><span style={{ width: `${percent ?? 0}%` }} /></div>
        <div className="agent-context-totals"><div><span>预计占用</span><strong>≈ {formatTokenCount(usage.total)}</strong></div><div><span>剩余可用</span><span>{capacity ? `≈ ${formatTokenCount(Math.max(0, capacity - usage.total))}` : "待确认"}</span></div><div><span title={source}>上下文上限{source ? ` · ${source}` : ""}</span><span>{capacity ? formatTokenCount(capacity) : "未知"}</span></div></div>
        <div className="agent-context-budget">
          <div>{policy.limitHistory ? `历史上限 ${policy.historyMessageCount} 条 · 已选择 ${selectedCount} 条` : `历史不限条数 · 已选择 ${selectedCount} 条`}</div>
          <div>{capacity ? `输出预留 ${formatTokenCount(budget.outputReserve)} · 安全输入预算 ${formatTokenCount(budget.inputBudget!)}` : "上限未知 · 可在对话参数中设置本地预算"}</div>
          <div>{policy.autoCompress ? capacity ? budget.needsCompression ? "下次请求前将检查并整理较早的历史" : "自动整理已开启" : "自动整理等待可用预算" : "自动整理已关闭"}</div>
        </div>
        {lastRecord && <ContextCompactionDetails record={lastRecord} />}
        <p>按文本长度粗略估算，非模型实际用量。{capacity ? `预计占用 ${(usage.total / capacity * 100).toFixed(1)}%；整理触发基于上限的 50%（已有摘要时为 65%），另计 25% 估算余量及输出预留。` : "当前连接未提供可信的上下文上限，暂不计算占用比例。"}</p>
        {activeRun && <p>包含已保存的请求与续接状态；当前输出及未回填的工具结果尚未计入。{activeRun.modelMetrics?.at(-1)?.usage?.inputTokens !== undefined ? `最近一次请求实际输入 ${formatTokenCount(activeRun.modelMetrics.at(-1)!.usage!.inputTokens!)} tokens。` : ""}</p>}
      </> : <p>正在读取助手配置…</p>}
    </div>;
}

export function ContextUsageTrigger({ open, onOpenChange, ...props }: ContextProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { percent, usage, capacity } = useContextUsage(props);
  return <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger asChild>
    <button type="button" className="agent-chip agent-control-icon agent-context-trigger" aria-label="上下文明细" title={capacity && usage ? `上下文预计占用 ${(usage.total / capacity * 100).toFixed(1)}%` : "上下文明细（估算）"}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />{percent !== undefined ? <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${Math.max(0.5, percent / 100 * 50.265)} 50.265`} transform="rotate(-90 12 12)" /> : <circle cx="12" cy="4" r="2" fill="currentColor" />}</svg>
    </button>
    </Popover.Trigger>
    <Popover.Portal container={document.querySelector<HTMLElement>(".agent-chat-root")}>
      <Popover.Content side="top" align="end" sideOffset={10} collisionPadding={16} className="agent-context-popover" aria-label="上下文明细">
        <ContextUsagePanel {...props} onClose={() => onOpenChange(false)} />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
