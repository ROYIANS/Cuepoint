import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ListTodo, Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AgentRun, AgentTask } from "@/domain/agent";
import { createAgentTask } from "@/db/agentTasks";
import { getTaskDisplayState, TASK_STATE_LABELS } from "@/lib/agent/taskState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import "./taskWorkspace.css";

type BoardFilter = "active" | "all" | "archived";
const COLUMNS = [
  { id: "pending", label: "待开始", hint: "把想法变成清晰的目标", states: ["pending"] },
  { id: "running", label: "进行中", hint: "围绕目标，逐步推进", states: ["running"] },
  { id: "attention", label: "待处理", hint: "检查结果，或接续执行", states: ["approval", "interrupted", "failed", "cancelled", "review"] },
  { id: "done", label: "已完成", hint: "经过你确认的成果", states: ["completed", "archived"] },
];

export function TaskBoard({ tasks, runs, onOpenTask, onBack }: {
  tasks: AgentTask[] | undefined; runs: AgentRun[] | undefined;
  onOpenTask: (task: AgentTask) => void; onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("active");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const ready = tasks !== undefined && runs !== undefined;
  const entries = useMemo(() => {
    const grouped = new Map<string, AgentRun[]>();
    for (const run of runs ?? []) grouped.set(run.threadId, [...(grouped.get(run.threadId) ?? []), run]);
    return (tasks ?? []).map((task) => ({ task, state: getTaskDisplayState(task, grouped.get(task.threadId) ?? []) }))
      .sort((a, b) => b.task.updatedAt.localeCompare(a.task.updatedAt));
  }, [tasks, runs]);
  const visible = entries.filter(({ task }) =>
    (filter === "all" || (filter === "archived" ? task.lifecycle === "archived" : task.lifecycle !== "archived")) &&
    `${task.title} ${task.goal}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const completeCount = entries.filter(({ state }) => state === "completed").length;
  async function create() {
    if (saveLock.current || !title.trim() || !goal.trim()) return;
    saveLock.current = true; setSaving(true);
    try {
      const task = await createAgentTask({ title: title.trim(), goal: goal.trim() });
      setCreating(false); setTitle(""); setGoal(""); onOpenTask(task);
    } catch (error) { toast.error(error instanceof Error ? error.message : "创建任务失败，请重试"); }
    finally { saveLock.current = false; setSaving(false); }
  }
  return <section className="agent-task-board" aria-label="任务工作区">
    <header className="agent-task-board-heading">
      <div><Button variant="ghost" size="sm" className="agent-task-back" onClick={onBack}><ArrowLeft />返回助手</Button>
        <div className="agent-task-eyebrow">创作工作区 <span>/</span> TASKS</div>
        <h1>让每一个想法，走向完成<span>。</span></h1>
        <p>与小光点一起拆解目标、推进步骤，留下经过确认的成果。</p>
      </div>
      <Button onClick={() => setCreating(true)} className="agent-task-create"><Plus />新建任务</Button>
    </header>
    <div className="agent-task-board-toolbar">
      <div className="agent-task-filters" role="group" aria-label="筛选任务">
        {([{ value: "active", label: "工作台" }, { value: "all", label: "全部" }, { value: "archived", label: "已归档" }] as const).map(({ value, label }) =>
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <span className="agent-task-board-count">{ready ? `${entries.length} 个任务 · ${completeCount} 个已完成` : "读取工作区…"}</span>
      <label className="agent-task-search"><Search size={16} aria-hidden /><input aria-label="搜索任务" placeholder="搜索任务与目标…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    </div>
    {!ready ? <div className="agent-task-loading" role="status">正在读取任务与执行进度…</div> : entries.length === 0 ?
      <div className="agent-task-empty"><ListTodo size={32} strokeWidth={1.25} aria-hidden /><h2>先定一个小目标</h2><p>整理角色设定、打磨故事，或准备下一次创作。<br />你可以先写下任务，随时再与助手一起推进。</p><Button onClick={() => setCreating(true)}><Plus />创建第一个任务</Button><span>无需配置模型，也可以手动管理任务</span></div> :
      <div className="agent-task-columns">
        {COLUMNS.map((column) => {
          const cards = visible.filter(({ state }) => column.states.includes(state));
          return <section className="agent-task-column" key={column.id} aria-label={column.label}>
            <header><span className={`agent-task-state-dot is-${column.id}`} /><h2>{column.label}</h2><span>{cards.length}</span></header>
            <p className="agent-task-column-hint">{column.hint}</p>
            {cards.length === 0 ? <div className="agent-task-column-empty">{query || filter === "archived" ? "没有匹配的任务" : "暂无任务"}</div> : cards.map(({ task, state }) => {
              const done = task.plan.filter((step) => step.status === "completed").length;
              return <button className="agent-task-card" key={task.id} type="button" onClick={() => onOpenTask(task)}>
                <div className="agent-task-card-top"><span className={`agent-task-status is-${state}`}>{TASK_STATE_LABELS[state]}</span><ArrowUpRight size={16} aria-hidden /></div>
                <h3>{task.title}</h3><p>{task.goal}</p>
                {task.plan.length > 0 && <div className="agent-task-mini-progress"><span style={{ width: `${done / task.plan.length * 100}%` }} /></div>}
                <footer><span><Sparkles size={12} aria-hidden />小光点</span><span>{task.plan.length ? <><Check size={12} aria-hidden />{done}/{task.plan.length}</> : "待拆解步骤"}</span></footer>
              </button>;
            })}
          </section>;
        })}
      </div>}
    <Dialog open={creating} onOpenChange={(next) => { if (!saveLock.current) setCreating(next); }}>
      <DialogContent className="agent-task-dialog" showCloseButton={!saving}>
        <DialogHeader><DialogTitle>新建任务</DialogTitle><DialogDescription>写下想完成的事情，步骤可以稍后补充。</DialogDescription></DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); void create(); }}>
          <label className="agent-task-field">任务名称<Input autoFocus value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完善主角的人物设定" disabled={saving} required /></label>
          <label className="agent-task-field">目标与完成标准<Textarea value={goal} maxLength={20_000} onChange={(event) => setGoal(event.target.value)} placeholder="希望得到什么结果？有哪些需要注意的要求？" rows={5} disabled={saving} required /></label>
          <DialogFooter><Button type="button" variant="ghost" disabled={saving} onClick={() => setCreating(false)}>取消</Button><Button type="submit" disabled={saving || !title.trim() || !goal.trim()}>{saving ? "创建中…" : "创建任务"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
