import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Folder, Plus, Search, X, ArrowLeft } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id, Project } from "@/domain/types";
import { createProject } from "@/db/repo";

export function ProjectPicker({ projects, projectId, required, locked, onChange, allowClear = true, allLabel }: {
  projects: Project[]; projectId?: Id; required?: boolean; locked?: boolean;
  onChange: (projectId: Id | undefined) => void | Promise<void>;
  allowClear?: boolean; allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const saveLock = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = projects.find((project) => project.id === projectId);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return projects.filter((project) => !needle || `${project.name} ${project.brief ?? ""}`.toLocaleLowerCase().includes(needle));
  }, [projects, query]);
  async function choose(next?: Id) {
    if (locked || saveLock.current) return;
    saveLock.current = true; setPending(true);
    try { await onChange(next); setOpen(false); setQuery(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "项目选择失败"); }
    finally { saveLock.current = false; setPending(false); }
  }
  async function create() {
    if (locked || saveLock.current || !name.trim()) return;
    saveLock.current = true; setPending(true);
    try { const project = await createProject(name.trim()); await onChange(project.id); setCreating(false); setOpen(false); setName(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "创建项目失败"); }
    finally { saveLock.current = false; setPending(false); }
  }
  return <Popover.Root open={open && !locked} onOpenChange={(next) => { if (!locked && !pending) setOpen(next); if (!next) { setQuery(""); setCreating(false); } }}>
    <Popover.Trigger asChild><button ref={trigger} type="button" className={`agent-chip agent-project-trigger${required && !selected ? " is-required" : ""}`} aria-label={projectId ? `项目：${selected?.name ?? "项目不可用"}` : "选择项目"} disabled={locked} title={locked ? projectId ? "此对话的项目已固定；处理其他项目请新开对话" : "此对话已开始；在项目中工作请新开对话" : undefined}>
      <Folder size={15} aria-hidden /><span>{selected?.name ?? (projectId ? "项目不可用" : locked ? "未绑定项目" : allLabel ?? (required ? "先选择项目" : "选择项目"))}</span>{!locked && <ChevronDown size={12} aria-hidden />}
    </button></Popover.Trigger>
    <Popover.Portal container={trigger.current?.closest<HTMLElement>('[role="dialog"]') ?? document.querySelector<HTMLElement>(".agent-chat-root") ?? undefined}>
      <Popover.Content side="top" align="start" sideOffset={8} collisionPadding={12} className="agent-project-picker" aria-label={creating ? "新建项目" : "选择项目"} onKeyDown={(event) => {
        if (event.key === "Escape") return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')];
          const index = options.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1);
          if (options[next]) { event.preventDefault(); options[next].focus(); }
        }
      }}>
        {creating ? <div className="agent-project-create-form">
          <button type="button" onClick={() => setCreating(false)} disabled={pending}><ArrowLeft size={14} />返回项目</button>
          <h3>给创作一个空间</h3><p>先起一个名字，创作设定可以稍后补充。</p>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="项目名称" aria-label="项目名称" disabled={pending} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); void create(); } }} />
          <button type="button" className="agent-project-create-submit" disabled={pending || !name.trim()} onClick={() => void create()}>{pending ? "创建中…" : "创建并选择"}</button>
        </div> : <>
          <div className="agent-project-picker-search"><Search size={15} aria-hidden /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目" aria-label="搜索项目" aria-controls={listId} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && filtered.length) { event.preventDefault(); event.stopPropagation(); void choose(filtered[0].id); } }} /></div>
          <div id={listId} className="agent-project-picker-list" role="listbox" aria-label="项目列表">
            {filtered.map((project) => <button type="button" role="option" aria-selected={project.id === projectId} key={project.id} disabled={pending} onClick={() => void choose(project.id)}><Folder size={16} aria-hidden /><span><strong>{project.name}</strong>{project.brief?.trim() && <small>{project.brief}</small>}</span>{project.id === projectId && <Check size={15} aria-hidden />}</button>)}
            {!filtered.length && <p className="agent-project-picker-empty">{projects.length ? "没有找到匹配的项目" : "还没有项目，先为这次创作起个名字。"}</p>}
          </div>
          <div className="agent-project-picker-actions">{allowClear && <button type="button" onClick={() => void choose(undefined)} disabled={!projectId || pending}><X size={15} aria-hidden />{allLabel ?? "不在项目中工作"}</button>}<button type="button" disabled={pending} onClick={() => setCreating(true)}><Plus size={15} aria-hidden />新建项目</button></div>
        </>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
