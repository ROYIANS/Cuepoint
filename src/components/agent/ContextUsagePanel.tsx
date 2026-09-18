import { buildTaskInstructions } from "@/lib/agent/taskState";
import type { AgentTask } from "@/domain/agent";
import { resolveModelMetadata } from "@/lib/ai/modelMetadata";
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
import { buildAgentRequestMessages, estimateContextUsage, formatTokenCount } from "@/lib/agent/contextUsage";

type ContextProps = {
  task?: AgentTask;
  interactionMode?: AgentInteractionMode; draft: string; messages: ChatMessage[]; runs: AgentRun[]; model: string; connector?: ConnectorConfig; modelMetadata?: Record<string, ChatModelMetadata>;
};

function useContextUsage({ draft, messages, runs, model, connector, modelMetadata, interactionMode, task }: ContextProps) {
  const config = useLiveQuery(() => db.agents.get(GENERAL_AGENT_ID), []);
  const deferredDraft = useDeferredValue(draft);
  const latest = runs.at(-1);
  const activeRun = latest && (latest.status === "running" || latest.status === "waiting_approval" || (latest.hasToolCalls && (latest.status === "failed" || latest.status === "interrupted"))) ? latest : undefined;
  const usage = useMemo(() => {
    if (!config && !activeRun) return undefined;
    const skills = assembleSkills(interactionMode === "conversation" ? [] : config?.enabledSkillIds ?? DEFAULT_SKILL_IDS);
    const instructions = activeRun?.agentSnapshot.instructions ?? buildTaskInstructions(config?.instructions ?? "", task);
    const skillInstructions = activeRun ? activeRun.skillInstructions ?? "" : skills.skillInstructions;
    return estimateContextUsage({
      instructions, skillInstructions,
      messages: activeRun ? activeRun.continuationMessages ?? activeRun.requestMessages : buildAgentRequestMessages(instructions, skillInstructions, messages, deferredDraft),
      tools: toolSchemas(activeRun ? activeRun.enabledToolNames ?? [] : skills.enabledToolNames),
    });
  }, [activeRun, config, messages, deferredDraft, interactionMode, task]);
  const sameConnector = !activeRun || (connector?.id === activeRun.connector.id && connector?.baseUrl.replace(/\/+$/, "") === activeRun.connector.baseUrl.replace(/\/+$/, "") && connector?.definitionId === activeRun.connector.definitionId);
  const metadata = resolveModelMetadata(activeRun?.model ?? model, sameConnector ? modelMetadata?.[activeRun?.model ?? model] : undefined, activeRun?.connector.definitionId ?? connector?.definitionId);
  const capacity = metadata.contextWindow?.tokens;
  const percent = usage && capacity ? Math.min(100, usage.total / capacity * 100) : undefined;
  const source = metadata.contextWindow?.source === "provider" ? "供应商模型目录" : metadata.contextWindow?.sourceUrl;
  return { usage, capacity, percent, activeRun, source };
}

export function ContextUsagePanel({ onClose, ...props }: ContextProps & { onClose: () => void }) {
  const { usage, capacity, percent, activeRun, source } = useContextUsage(props);
  const { model } = props;
  return <div className="agent-context-panel" role="region" aria-label="上下文明细">
      <div className="agent-context-heading"><span>上下文明细</span><span className="agent-context-heading-actions"><small>TOKEN · 估算</small><button type="button" aria-label="关闭上下文明细" onClick={onClose}><X size={16} /></button></span></div>
      <div className="agent-context-scope">{activeRun ? "当前执行 · 已保存的上下文" : "下次发送 · 包含当前草稿"}</div>
      <div className="agent-context-model" title={activeRun?.model ?? model}>{activeRun?.model ?? (model || "尚未选择模型")}</div>
      {usage ? <>
        <div className="agent-context-bar" aria-hidden>{usage.categories.map((item) => <span key={item.id} style={{ width: `${usage.total ? item.tokens / usage.total * 100 : 0}%`, background: item.color }} />)}</div>
        <dl className="agent-context-breakdown">{usage.categories.map((item) => <div key={item.id}><dt><i style={{ background: item.color }} />{item.label}</dt><dd title={`${item.tokens.toLocaleString()} tokens（估算）`}>{formatTokenCount(item.tokens)}</dd></div>)}</dl>
        <div className="agent-context-capacity-bar" aria-hidden><span style={{ width: `${percent ?? 0}%` }} /></div>
        <div className="agent-context-totals"><div><span>预计占用</span><strong>≈ {formatTokenCount(usage.total)}</strong></div><div><span>剩余可用</span><span>{capacity ? `≈ ${formatTokenCount(Math.max(0, capacity - usage.total))}` : "待确认"}</span></div><div><span title={source}>上下文上限{source === "供应商模型目录" ? " · 供应商" : capacity ? " · Model Bank" : ""}</span><span>{capacity ? formatTokenCount(capacity) : "未知"}</span></div></div>
        <p>按文本长度粗略估算，非模型实际用量。{capacity ? `预计占用 ${(usage.total / capacity * 100).toFixed(1)}%；上限优先采用供应商数据，其次采用本地 Model Bank 参考资料。剩余空间仍需容纳模型输出。` : "当前连接未提供可信的上下文上限，暂不计算占用比例。"}</p>
        {activeRun && <p>仅统计已保存的可读消息；当前输出、未回填的工具结果和加密推理状态未计入。{activeRun.modelMetrics?.at(-1)?.usage?.inputTokens !== undefined ? `最近一次请求实际输入 ${formatTokenCount(activeRun.modelMetrics.at(-1)!.usage!.inputTokens!)} tokens。` : ""}</p>}
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
