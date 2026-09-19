import { MemoryEditor } from "@/components/memory/MemoryEditor";
import type { MemoryCandidate, ProjectMemory } from "@/domain/projectMemory";
import { MemoryPromotion } from "@/components/memory/MemoryPromotion";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCheck, ClipboardCheck, History, LoaderCircle, Pencil, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { AgentTask, AgentReasoningEffort } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import type { ChatModelMetadata } from "@/lib/ai/modelMetadata";
import type { AgentTaskWrapup, WrapupContent, WrapupEvidence } from "@/domain/agentTaskWrapup";
import { createManualWrapup, getTaskWrapupState, saveWrapup, confirmWrapup } from "@/db/agentTaskWrapups";
import { setAgentTaskLifecycle } from "@/db/agentTasks";
import { prepareTaskWrapup, cancelTaskWrapup, recoverTaskWrapups } from "@/lib/agent/taskWrapup";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./taskWrapup.css";

export type WrapupModelSelection = { connector: ConnectorConfig; model: string; modelMetadata?: ChatModelMetadata; reasoningEffort?: AgentReasoningEffort };
type Props = { task: AgentTask; modelSelection?: WrapupModelSelection; busy: boolean; onEditingChange: (value: boolean) => void; onPendingChange: (value: boolean) => void };
type Section = "results" | "decisions" | "lessons" | "unresolved";
const SECTIONS: Array<{ key: Section; label: string; hint: string }> = [
  { key: "results", label: "交付成果", hint: "实际完成了什么，成果在哪里" },
  { key: "decisions", label: "决策与约束", hint: "保留后续工作需要遵循的选择" },
  { key: "lessons", label: "问题与经验", hint: "哪些方法有效，哪些问题值得记住" },
  { key: "unresolved", label: "未完成与下一步", hint: "仍待处理的事项；没有则留空" },
];
const OUTCOMES = { fact: "记录", downloaded: "已生成 · 未应用", applied: "已应用", unresolved: "待核实" };
const FINDINGS = { met: "符合要求", unmet: "尚未达到", review: "待检查" };
const dateLabel = (value: string) => new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Sources({ ids, evidence, selectable, onChange }: { ids: string[]; evidence: WrapupEvidence[]; selectable?: boolean; onChange?: (ids: string[]) => void }) {
  if (!selectable && !ids.length) return null;
  return <details className="task-review-sources"><summary>{selectable ? "关联依据" : "查看依据"}<span>{ids.length}</span></summary>
    {selectable ? <div className="task-review-source-options">{evidence.length ? evidence.map((source) => <label key={source.id}><input type="checkbox" checked={ids.includes(source.id)} disabled={!ids.includes(source.id) && (!source.available || ids.length >= 12)} onChange={() => onChange?.(ids.includes(source.id) ? ids.filter((id) => id !== source.id) : [...ids, source.id])} /><span>{source.label}<small>{source.available ? OUTCOMES[source.outcome] : "已不可用"}</small></span></label>) : <p>尚无可关联的记录，可以先保存人工总结。</p>}</div> : ids.map((id) => { const source = evidence.find((entry) => entry.id === id); return <div className="task-review-source" key={id}><div><span>{source?.label ?? "原始来源已不可用"}</span><small>{source?.available ? OUTCOMES[source.outcome] : "当前来源不可用"}</small></div>{source?.available && source.href && /^\/(?!\/)/.test(source.href) && <Link to={source.href}>打开成果<ArrowUpRight size={13} /></Link>}{source && <details><summary>本版保存的记录</summary><pre>{source.body}</pre></details>}</div>; })}
  </details>;
}

function ReviewDocument({ record, evidence, projectId, onCandidate }: { record: AgentTaskWrapup; evidence: WrapupEvidence[]; projectId: string; onCandidate: (candidate: MemoryCandidate) => void }) {
  const content = record.content;
  return <div className="task-review-document">
    <p className="task-review-overview">{content.overview || "尚未填写总结。"}</p>
    <section className="task-review-section"><h3>完成标准 <span>{content.acceptance.filter((item) => item.status === "met").length} / {content.acceptance.length}</span></h3>{content.acceptance.length ? content.acceptance.map((finding) => <div className="task-review-finding" key={finding.criterionIndex}><div><span>{finding.criterion}</span><small className={`is-${finding.status}`}>{FINDINGS[finding.status]}</small></div>{finding.note && <p>{finding.note}</p>}<Sources ids={finding.sourceIds} evidence={evidence} /></div>) : <p className="agent-task-muted">此任务未单独设置完成标准，请核对目标、成果与清单。</p>}</section>
    {SECTIONS.map(({ key, label }) => <section key={key} className="task-review-section"><h3>{label}<span>{content[key].length}</span></h3>{content[key].length ? content[key].map((item, index) => <div key={index} className="task-review-entry"><p>{item.text}</p><Sources ids={item.sourceIds} evidence={evidence} />{record.confirmedAt && (key === "decisions" || key === "lessons") && <MemoryPromotion onCandidate={onCandidate} projectId={projectId} source={{ taskId: record.taskId, summaryId: record.id, summaryRevision: record.revision, itemKind: key === "decisions" ? "decision" : "lesson", itemIndex: index, itemText: item.text }} />}</div>) : <p className="agent-task-muted">{key === "unresolved" ? "未列出待办事项。" : "尚未记录。"}</p>}</section>)}
  </div>;
}

export function TaskWrapup({ task, modelSelection, busy, onEditingChange, onPendingChange }: Props) {
  const state = useLiveQuery(() => getTaskWrapupState(task.id), [task.id]);
  const [draft, setDraft] = useState<{ id: string; revision: number; content: WrapupContent; sources: WrapupEvidence[] }>();
  const [candidate, setCandidate] = useState<MemoryCandidate>();
  const [savedMemory, setSavedMemory] = useState<ProjectMemory>();
  const [memoryPending, setMemoryPending] = useState(false);
  const [pending, setPending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const latest = state?.latest;
  const preparing = latest?.status === "preparing";
  const editable = !busy && !pending && !preparing && task.lifecycle === "open";
  const canGenerate = !!modelSelection?.connector.apiKey.trim() && !!modelSelection.model.trim();
  useEffect(() => { void recoverTaskWrapups(task.threadId).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "无法读取整理状态")); }, [task.threadId]);
  useEffect(() => { onEditingChange(!!draft || !!candidate); return () => onEditingChange(false); }, [!!draft, !!candidate, onEditingChange]);
  useEffect(() => { onPendingChange(pending || preparing || memoryPending); return () => onPendingChange(false); }, [pending, preparing, memoryPending, onPendingChange]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!draft) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect);
  }, [draft]);
  async function act(action: () => Promise<unknown>, success?: string) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError("");
    try { await action(); if (success) toast.success(success); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "操作失败，请重试"); }
    finally { lock.current = false; setPending(false); }
  }
  async function manual() { await act(async () => { const record = await createManualWrapup(task.id); setDraft({ id: record.id, revision: record.revision, content: structuredClone(record.content), sources: record.snapshot.evidence }); }); }
  async function generate() {
    if (!modelSelection || !canGenerate) return;
    await act(async () => {
      const abort = new AbortController(); controller.current = abort;
      try { await prepareTaskWrapup(task.id, modelSelection.connector, modelSelection.model, abort, undefined, modelSelection.reasoningEffort, modelSelection.modelMetadata); }
      finally { if (controller.current === abort) controller.current = null; }
    }, "总结草稿已准备好，请检查并确认");
  }
  function edit() { if (latest) { setError(""); setDraft({ id: latest.id, revision: latest.revision, content: structuredClone(latest.content), sources: latest.snapshot.evidence }); } }
  function change(content: WrapupContent) { setDraft((current) => current ? { ...current, content } : current); }
  function currentSources(sources: WrapupEvidence[]) {
    return sources.map((source) => {
      const current = state?.currentEvidence.find((item) => item.id === source.id);
      return current ? { ...source, ...current, body: source.body } : { ...source, available: false, href: undefined };
    });
  }
  const evidence = draft ? currentSources(draft.sources) : latest ? currentSources(latest.snapshot.evidence) : [];
  return <div className="task-review" aria-label="任务验收总结">
    <div className="task-review-heading"><div><span className="task-review-eyebrow">REVIEW & REFLECTION</span><h3>让这次工作，有一个清晰的收尾。</h3><p>检查交付，留下决策与经验，再确认完成。</p></div><ClipboardCheck size={24} strokeWidth={1.3} aria-hidden /></div>
    {state === undefined ? <p className="agent-task-muted" role="status">正在读取总结…</p> : <>
      {!latest && <div className="task-review-start"><p>把已有成果与完成标准放在一起检查。也可以先保存阶段总结，之后再回来继续。</p><div><Button disabled={!editable || !canGenerate} onClick={() => void generate()}><Sparkles />AI 整理总结</Button><Button variant="ghost" disabled={!editable} onClick={() => void manual()}><Pencil />手动填写</Button></div><small>{canGenerate ? `使用 ${modelSelection!.model} · 仅整理已有记录` : "尚未配置对话模型，仍可手动填写总结。"}</small></div>}
      {latest && <>
        <div className="task-review-toolbar"><span>{latest.confirmedAt ? "已确认" : preparing ? "整理中" : latest.status === "failed" ? "整理失败" : latest.status === "interrupted" ? "整理已中断" : "待你检查"}<small>版本 {latest.revision} · {latest.author === "ai" ? "AI 草稿" : "人工修订"}</small></span><Button variant="ghost" size="icon-sm" aria-label="查看总结历史" onClick={() => setHistoryOpen(true)}><History /></Button>{!draft && !preparing && <Button variant="ghost" size="sm" disabled={!editable || state.stale || latest.status !== "draft" || !!latest.confirmedAt} onClick={edit}><Pencil />编辑</Button>}</div>
        {preparing && <div className="task-review-notice" role="status"><LoaderCircle className="task-review-spinner" size={16} /><span>正在整理已有记录…<small>不会执行创作工具，之前的总结会保留。</small></span><Button variant="ghost" size="sm" onClick={() => { controller.current?.abort(); void cancelTaskWrapup(task.id, latest.id).catch((failure: Error) => setError(failure.message)); }}>停止</Button></div>}
        {state.stale && <div className="task-review-notice"><RefreshCw size={16} /><span>任务或来源已有变化<small>当前总结作为历史保留。请基于最新记录重新整理，再确认完成。</small></span></div>}
        {(latest.status === "failed" || latest.status === "interrupted") && <div className="task-review-notice"><span>{latest.error || "本次整理未完成，任务状态保持不变。"}<small>可以重新整理，也可以手动接着写。</small></span></div>}
        <p className="task-review-coverage">本版参考 {latest.snapshot.coverage.included} / {latest.snapshot.coverage.total} 项记录{latest.snapshot.coverage.omitted > 0 ? ` · ${latest.snapshot.coverage.omitted} 项未纳入` : ""}{latest.snapshot.coverage.truncated > 0 ? ` · ${latest.snapshot.coverage.truncated} 项为摘录` : ""}。验收仍需要你的判断。</p>
        {draft ? <form className="task-review-editor" onSubmit={(event) => { event.preventDefault(); void act(async () => { await saveWrapup(task.id, draft.id, draft.content, draft.revision); setDraft(undefined); }, "总结草稿已保存"); }}>
          <label className="agent-task-field">总结<Textarea autoFocus value={draft.content.overview} rows={4} maxLength={4000} disabled={pending} onChange={(event) => change({ ...draft.content, overview: event.target.value })} placeholder="这次完成了什么，目前处于什么状态…" /></label>
          <section className="task-review-section"><h3>完成标准</h3>{draft.content.acceptance.length ? draft.content.acceptance.map((finding, index) => <div className="task-review-finding-editor" key={finding.criterionIndex}><label className="agent-task-field">{finding.criterion}<select aria-label={`验收：${finding.criterion}`} disabled={pending} value={finding.status} onChange={(event) => change({ ...draft.content, acceptance: draft.content.acceptance.map((item, at) => at === index ? { ...item, status: event.target.value as typeof finding.status } : item) })}>{Object.entries(FINDINGS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Textarea aria-label={`验收说明：${finding.criterion}`} placeholder="你的检查结果与判断依据…" value={finding.note} rows={2} maxLength={2000} disabled={pending} onChange={(event) => change({ ...draft.content, acceptance: draft.content.acceptance.map((item, at) => at === index ? { ...item, note: event.target.value } : item) })} /><Sources ids={finding.sourceIds} evidence={evidence} selectable={!pending} onChange={(sourceIds) => change({ ...draft.content, acceptance: draft.content.acceptance.map((item, at) => at === index ? { ...item, sourceIds } : item) })} /></div>) : <p className="agent-task-muted">尚无独立完成标准，可回到概览补充。</p>}</section>
          {SECTIONS.map(({ key, label, hint }) => <section className="task-review-section" key={key}><div className="agent-task-section-heading"><h3>{label}</h3><Button type="button" variant="ghost" size="icon-sm" aria-label={`添加${label}`} disabled={pending || draft.content[key].length >= 20} onClick={() => change({ ...draft.content, [key]: [...draft.content[key], { text: "", sourceIds: [] }] })}><Plus /></Button></div><p className="agent-task-muted">{hint}</p>{draft.content[key].map((entry, index) => <div className="task-review-entry-editor" key={index}><div><Textarea aria-label={`${label} ${index + 1}`} rows={3} maxLength={2000} disabled={pending} value={entry.text} onChange={(event) => change({ ...draft.content, [key]: draft.content[key].map((item, at) => at === index ? { ...item, text: event.target.value } : item) })} /><Button type="button" variant="ghost" size="icon-sm" disabled={pending} aria-label={`移除${label} ${index + 1}`} onClick={() => change({ ...draft.content, [key]: draft.content[key].filter((_, at) => at !== index) })}><X /></Button></div><Sources ids={entry.sourceIds} evidence={evidence} selectable={!pending} onChange={(sourceIds) => change({ ...draft.content, [key]: draft.content[key].map((item, at) => at === index ? { ...item, sourceIds } : item) })} /></div>)}</section>)}
          <div className="task-review-editor-actions"><Button type="button" variant="ghost" disabled={pending} onClick={() => { setDraft(undefined); setError(""); }}>取消编辑</Button><Button type="submit" disabled={pending || busy || !draft.content.overview.trim()}>{pending ? "保存中…" : "保存草稿"}</Button></div>
        </form> : <>
          {latest.status === "draft" && <ReviewDocument onCandidate={setCandidate} projectId={task.projectId} record={latest} evidence={evidence} />}
          {state.confirmed && (latest.id !== state.confirmed.id || latest.revision !== state.confirmed.revision) && <details className="task-review-previous"><summary>上次确认的总结 · {dateLabel(state.confirmed.confirmedAt!)}</summary><ReviewDocument onCandidate={setCandidate} projectId={task.projectId} record={state.confirmed} evidence={currentSources(state.confirmed.snapshot.evidence)} /></details>}
          {!preparing && task.lifecycle === "open" && <div className="task-review-actions"><div><Button variant="ghost" size="sm" disabled={!editable || !canGenerate} onClick={() => void generate()}><Sparkles />{latest.status === "failed" || latest.status === "interrupted" ? "重新尝试" : "重新整理"}</Button><Button variant="ghost" size="sm" disabled={!editable} onClick={() => void manual()}><Pencil />{state.stale ? "基于最新记录填写" : "新建人工版本"}</Button></div>
            {!state.stale && latest.status === "draft" && !latest.confirmedAt && <Button disabled={!editable || !latest.content.overview.trim()} onClick={() => void act(() => confirmWrapup(task.id, latest.id, latest.revision), "总结已确认，任务尚未标记完成")}><CheckCheck />确认这份总结</Button>}
            {latest.confirmedAt && !state.stale && <Button disabled={!editable || state.completionBlockers.length > 0} onClick={() => void act(() => setAgentTaskLifecycle(task.id, "completed", { id: latest.id, revision: latest.revision }), "任务已确认完成")}><CheckCheck />确认任务完成</Button>}
            {state.completionBlockers.length > 0 && <div className="task-review-blockers"><span>完成前还需要</span><ul>{state.completionBlockers.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>}
          </div>}
        </>}
      </>}
      {error && <p className="task-review-error" role="alert">{error}{draft ? "。编辑内容仍保留。" : ""}</p>}
    </>}
    {savedMemory && <p className="task-review-coverage">已保存在项目记忆中。<Link to="/p/$projectId/memory" params={{ projectId: task.projectId }} search={{ memory: savedMemory.id }}>查看“{savedMemory.title}”</Link></p>}
    {candidate && <MemoryEditor projectId={task.projectId} initial={candidate.input} source={candidate.ref} sourceExcerpt={`${candidate.source.taskTitle} · 总结版本 ${candidate.ref.summaryRevision}\n${candidate.source.excerpt}`} onPendingChange={setMemoryPending} onClose={() => setCandidate(undefined)} onSaved={(memory) => { setCandidate(undefined); setSavedMemory(memory); }} />}
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="agent-task-dialog task-review-history"><DialogHeader><DialogTitle>总结历史</DialogTitle><DialogDescription>每次保存独立留存。旧总结仅供追溯，不代表当前工作已通过验收。</DialogDescription></DialogHeader>{state?.history.map((version) => <details key={`${version.id}:${version.revision}`}><summary><span>{version.confirmedAt ? "已确认" : version.status === "draft" ? "草稿" : version.status === "failed" ? "失败" : "中断"} · 版本 {version.revision}<small>{dateLabel(version.updatedAt)} · {version.author === "ai" ? "AI" : "人工"}</small></span></summary><ReviewDocument onCandidate={setCandidate} projectId={task.projectId} record={version} evidence={currentSources(version.snapshot.evidence)} /></details>)}</DialogContent></Dialog>
  </div>;
}
