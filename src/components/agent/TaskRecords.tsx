import { ReferenceSourceLink } from "./ReferenceAttachments";
import { toolReferenceAttachments } from "@/lib/agent/referenceEvidence";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, ChevronDown, History, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { AgentTask } from "@/domain/agent";
import type { ChatMessage } from "@/domain/types";
import { TASK_RECORD_KINDS, TASK_RECORD_CLAIMS, type AgentTaskRecord, type TaskRecordInput } from "@/domain/agentTaskRecords";
import { listTaskRecords, listTaskRecordVersions, saveTaskRecord } from "@/db/agentTaskRecords";
import { db } from "@/db/database";
import { CreatedEntityLinks } from "./AgentRunDetails";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const KINDS = { research: "调研", approach: "方案", progress: "进展", verification: "验证", question: "待解决" };
const CLAIMS = { observation: "观察", proposal: "建议", decision: "已确认决策", result: "完成结果" };
const dateLabel = (value: string) => new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const emptyRecord = (): TaskRecordInput => ({ kind: "research", claim: "proposal", title: "", body: "", sources: [] });

type Props = { task: AgentTask; messages: ChatMessage[]; editable: boolean };
export function TaskRecords({ task, messages, editable }: Props) {
  const records = useLiveQuery(() => listTaskRecords(task.id), [task.id]);
  const calls = useLiveQuery(async () => {
    const runs = await db.agentRuns.where("taskId").equals(task.id).toArray();
    const owned = new Set(runs.filter((run) => run.threadId === task.threadId).map((run) => run.id));
    return (await db.agentToolCalls.where("threadId").equals(task.threadId).toArray()).filter((call) => owned.has(call.runId));
  }, [task.id, task.threadId]);
  const [filter, setFilter] = useState<TaskRecordInput["kind"] | "all">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ record?: AgentTaskRecord; input: TaskRecordInput }>();
  const [historyId, setHistoryId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const history = useLiveQuery(() => historyId ? listTaskRecordVersions(task.id, historyId) : [], [task.id, historyId]);
  const evidence = [
    ...messages.filter((message) => message.threadId === task.threadId && message.role === "user" && (message.content.trim() || message.attachments?.length)).map((message) => ({ type: "message" as const, id: message.id, label: `用户 · ${message.content.slice(0, 70) || "参考资料"}`, body: message.content })),
    ...(calls ?? []).filter((call) => call.status === "completed" && call.effect !== "bookkeeping" && call.result).map((call) => ({ type: "tool" as const, id: call.id, label: call.title, body: call.result! })),
  ];
  const visible = [...(records ?? [])].reverse().filter((record) => (filter === "all" || record.kind === filter) && `${record.title} ${record.body}`.toLowerCase().includes(query.trim().toLowerCase()));
  function edit(record?: AgentTaskRecord) { setError(""); setEditing({ record, input: record ? { kind: record.kind, claim: record.claim, title: record.title, body: record.body, sources: [...record.sources], todoId: record.todoId } : emptyRecord() }); }
  function change(patch: Partial<TaskRecordInput>) { setEditing((current) => current ? { ...current, input: { ...current.input, ...patch } } : current); }
  async function save() {
    if (!editing || saving.current || !editable) return;
    saving.current = true; setPending(true); setError("");
    try {
      await saveTaskRecord(task.id, editing.input, editing.record ? { id: editing.record.id, expectedRevision: editing.record.revision } : {});
      setEditing(undefined); toast.success("工作记录已保存");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "保存失败，请重试"); }
    finally { saving.current = false; setPending(false); }
  }
  return <div className="agent-task-records">
    <div className="agent-task-section-heading"><div><h3>工作记录 <span>{records?.length ?? 0}</span></h3><p className="agent-task-muted">保留依据与决策，让下一次执行接得上。</p></div><Button variant="ghost" size="sm" disabled={!editable} onClick={() => edit()}><Plus />新记录</Button></div>
    <label className="agent-task-record-search"><Search size={16} /><input aria-label="搜索工作记录" placeholder="搜索标题或内容…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="agent-task-record-filters" aria-label="记录类型"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部</button>{TASK_RECORD_KINDS.map((kind) => <button key={kind} type="button" aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{KINDS[kind]}</button>)}</div>
    {!records ? <p className="agent-task-muted" role="status">正在读取记录…</p> : !visible.length ? <div className="agent-task-record-empty"><BookOpen size={28} strokeWidth={1.3} /><h3>{records.length ? "没有匹配的记录" : "每一步，都有迹可循"}</h3><p>{records.length ? "试试其他关键词或分类。" : "助手会在推进任务时记录调研、方案和验证结果。你也可以补充重要信息。"}</p></div> : visible.map((record) => <details className="agent-task-record" key={record.id}>
      <summary><span className={`agent-task-record-kind is-${record.kind}`}>{KINDS[record.kind]}</span><span className="agent-task-record-title">{record.title}<small>{CLAIMS[record.claim]} · {record.author === "ai" ? "助手" : "你"} · {dateLabel(record.updatedAt)}</small></span><ChevronDown size={16} /></summary>
      <div className="agent-task-record-content"><div className="agent-task-record-actions"><span>版本 {record.revision}{record.todoId ? ` · ${task.plan.find((step) => step.id === record.todoId)?.title ?? "原步骤已调整"}` : ""}</span><Button variant="ghost" size="icon-sm" aria-label={`查看${record.title}的历史版本`} onClick={() => setHistoryId(record.id)}><History /></Button><Button variant="ghost" size="icon-sm" aria-label={`编辑${record.title}`} disabled={!editable || record.body.length > 12_000} title={record.body.length > 12_000 ? "这是完整变更快照，请在概览中调整任务要求" : undefined} onClick={() => edit(record)}><Pencil /></Button></div><p className="agent-task-record-body">{record.body}</p>
        {record.sources.length > 0 && <div className="agent-task-record-sources"><h4>记录依据</h4>{record.sources.map((source) => { const item = evidence.find((entry) => entry.id === source.id && entry.type === source.type); return <details key={`${source.type}:${source.id}`}><summary>{item?.label ?? "来源已不可用"}</summary>{source.type === "tool" ? <>{calls?.filter((call) => call.id === source.id).map((call) => <div key={call.id}><CreatedEntityLinks call={call} includePreview />{toolReferenceAttachments(call.result, task.projectId).map(attachment => <ReferenceSourceLink key={`${attachment.referenceId}:${attachment.revision}`} projectId={task.projectId} attachment={attachment} />)}</div>)}<details className="agent-task-record-raw"><summary>查看原始工具结果</summary><pre>{item?.body ?? "原始记录不存在，无法重新核实。"}</pre></details></> : <><pre>{item?.body ?? "原始记录不存在，无法重新核实。"}</pre>{messages.find(message => message.id === source.id)?.attachments?.map(attachment => <ReferenceSourceLink key={`${attachment.referenceId}:${attachment.revision}`} projectId={task.projectId} attachment={attachment} />)}</>}</details>; })}</div>}
      </div>
    </details>)}
    <Dialog open={!!editing} onOpenChange={(open) => { if (!open && !saving.current) setEditing(undefined); }}><DialogContent className="agent-task-dialog agent-task-record-editor" showCloseButton={!pending}><DialogHeader><DialogTitle>{editing?.record ? "编辑工作记录" : "新建工作记录"}</DialogTitle><DialogDescription>保存后保留历史版本。编辑记录仅影响本文；目标与清单请在概览中调整。</DialogDescription></DialogHeader>{editing && <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="agent-task-record-selects"><label className="agent-task-field">分类<select value={editing.input.kind} disabled={pending} onChange={(event) => change({ kind: event.target.value as TaskRecordInput["kind"] })}>{TASK_RECORD_KINDS.map((kind) => <option key={kind} value={kind}>{KINDS[kind]}</option>)}</select></label><label className="agent-task-field">内容性质<select value={editing.input.claim} disabled={pending} onChange={(event) => change({ claim: event.target.value as TaskRecordInput["claim"] })}>{TASK_RECORD_CLAIMS.map((claim) => <option key={claim} value={claim}>{CLAIMS[claim]}</option>)}</select></label></div>
      <label className="agent-task-field">标题<Input autoFocus maxLength={120} required disabled={pending} value={editing.input.title} onChange={(event) => change({ title: event.target.value })} /></label>
      <label className="agent-task-field">内容<Textarea rows={9} maxLength={12_000} required disabled={pending} value={editing.input.body} onChange={(event) => change({ body: event.target.value })} placeholder="记录发现、决策依据，或接下来需要解决的问题…" /></label>
      <label className="agent-task-field">关联步骤<select value={editing.input.todoId ?? ""} disabled={pending} onChange={(event) => change({ todoId: event.target.value || undefined })}><option value="">整个任务</option>{editing.input.todoId && !task.plan.some((step) => step.id === editing.input.todoId) && <option value={editing.input.todoId}>原步骤已调整，请重新选择</option>}{task.plan.map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}</select></label>
      {evidence.length > 0 && <details className="agent-task-evidence-picker"><summary>关联依据 <span>{editing.input.sources.length} / 12</span></summary><div>{evidence.map((item) => { const selected = editing.input.sources.some((source) => source.id === item.id && source.type === item.type); return <label key={`${item.type}:${item.id}`}><input type="checkbox" checked={selected} disabled={pending || (!selected && editing.input.sources.length >= 12)} onChange={() => change({ sources: selected ? editing.input.sources.filter((source) => source.id !== item.id || source.type !== item.type) : [...editing.input.sources, { type: item.type, id: item.id }] })} /><span>{item.label}</span></label>; })}</div></details>}
      {error && <p className="agent-task-record-error" role="alert">{error}。草稿仍在，可以复制内容后重新打开最新版本。</p>}
      <DialogFooter><Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(undefined)}>取消</Button><Button type="submit" disabled={pending || !editable || !editing.input.title.trim() || !editing.input.body.trim()}>{pending ? "保存中…" : "保存记录"}</Button></DialogFooter>
    </form>}</DialogContent></Dialog>
    <Dialog open={!!historyId} onOpenChange={(open) => { if (!open) setHistoryId(undefined); }}><DialogContent className="agent-task-dialog agent-task-record-editor"><DialogHeader><DialogTitle>历史版本</DialogTitle><DialogDescription>按保存时间留存，可展开查看当时的内容。</DialogDescription></DialogHeader>{history ? [...history].reverse().map((version) => <details className="agent-task-record-version" key={version.versionId}><summary><span>版本 {version.revision} · {version.author === "ai" ? "助手" : "你"}</span><small>{dateLabel(version.updatedAt)}</small></summary><h3>{version.title}</h3><p className="agent-task-muted">{KINDS[version.kind]} · {CLAIMS[version.claim]}</p><p className="agent-task-record-body">{version.body}</p></details>) : <p role="status">正在读取历史…</p>}</DialogContent></Dialog>
  </div>;
}
