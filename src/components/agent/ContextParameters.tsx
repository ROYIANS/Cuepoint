import { useRef, useState } from "react";
import { InputNumber, Switch } from "antd";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { db } from "@/db/database";
import { GENERAL_AGENT_ID } from "@/domain/agent";
import type { ContextPolicy } from "@/domain/context";
import { normalizeContextPolicy } from "@/lib/agent/contextPolicy";
import { resetThreadContextPolicy, saveContextPolicyAsDefault, updateContextPolicy } from "@/db/contextSettings";
import "./contextParameters.css";

export function ContextParameters({ threadId, onBack }: { threadId?: string; onBack: () => void }) {
  const source = useLiveQuery(async () => threadId ? (await db.chatThreads.get(threadId)) ?? null : (await db.agents.get(GENERAL_AGENT_ID)) ?? null, [threadId]);
  const policy = normalizeContextPolicy(source?.contextPolicy);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const save = async (action: () => Promise<void>, message?: string) => {
    if (lock.current) return;
    lock.current = true; setSaving(true);
    try { await action(); if (message) toast.success(message); }
    catch { toast.error("保存参数失败，请重试"); }
    finally { lock.current = false; setSaving(false); }
  };
  const patch = (value: Partial<ContextPolicy>) => void save(() => updateContextPolicy(threadId, { ...policy, ...value }));
  const disabled = saving || !source;
  return <div className="agent-control-panel agent-parameters">
    <div className="agent-skill-heading"><button type="button" className="agent-skill-back" onClick={onBack}><ArrowLeft size={16} />对话参数</button><span>{threadId ? "当前对话" : "新对话默认"}</span></div>
    <div className="agent-parameter-row"><label htmlFor="context-auto"><strong>自动压缩上下文</strong><small>接近预算时整理较早的消息，保留原始对话。</small></label><Switch aria-label="自动压缩上下文" id="context-auto" size="small" checked={policy.autoCompress} disabled={disabled} onChange={(autoCompress) => patch({ autoCompress })} /></div>
    <div className="agent-parameter-row"><label htmlFor="context-history"><strong>限制历史消息</strong><small>仅选取最近的完整对话轮次，不删除聊天记录。</small></label><Switch aria-label="限制历史消息" id="context-history" size="small" checked={policy.limitHistory} disabled={disabled} onChange={(limitHistory) => patch({ limitHistory })} /></div>
    {policy.limitHistory && <div className="agent-parameter-detail"><label htmlFor="context-history-count">最多携带</label><InputNumber id="context-history-count" aria-label="历史消息条数" min={0} max={10000} precision={0} value={policy.historyMessageCount} disabled={disabled} onChange={(count) => { if (count !== null) patch({ historyMessageCount: count }); }} /><span>条</span><p>用户和助手消息各算一条，按完整轮次向下取整。0 表示不带历史或历史摘要；当前问题始终保留。</p></div>}
    <details className="agent-parameter-advanced"><summary>高级预算</summary><label htmlFor="context-local-budget">本地上下文预算 <span>可选</span></label><InputNumber id="context-local-budget" aria-label="本地上下文预算" min={2048} max={10000000} precision={0} placeholder="采用模型上限" value={policy.customContextTokens} disabled={disabled} onChange={(count) => patch({ customContextTokens: count ?? undefined })} /><p>单位为 tokens。模型上限未知时可在此设置；已知上限时仅能收紧预算。此值不会改写模型资料。</p></details>
    <p className="agent-parameter-note">自动整理使用当前模型，可能产生额外用量。上限未知且未设置本地预算时，不会自动整理。修改对下次发送生效。</p>
    {threadId && <div className="agent-parameter-actions"><button type="button" disabled={disabled} onClick={() => void save(() => resetThreadContextPolicy(threadId), "已恢复新对话默认参数")}><RotateCcw size={13} />恢复默认</button><button type="button" disabled={disabled} onClick={() => void save(() => saveContextPolicyAsDefault(threadId), "已设为新对话默认参数")}>设为默认</button></div>}
    <span className="agent-parameter-save" role="status">{saving ? "正在保存…" : "设置自动保存"}</span>
  </div>;
}
