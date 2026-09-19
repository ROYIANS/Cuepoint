import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  History,
  Pause,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectMemory } from "@/domain/projectMemory";
import {
  deleteProjectMemory,
  getMemorySourceState,
  getProjectMemory,
  MemoryConflictError,
  replaceProjectMemory,
  listProjectMemories,
  listProjectMemoryVersions,
  setProjectMemoryStatus,
} from "@/db/projectMemories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { readMemory } from "./readMemory";
import { MemoryEditor } from "./MemoryEditor";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  memoryDate,
  sourceLabel,
} from "./memoryLabels";
import "./memory.css";

export function ProjectMemoryPage({
  projectId,
  initialMemoryId,
}: {
  projectId: string;
  initialMemoryId?: string;
}) {
  const result = useLiveQuery(async () => {
    try {
      return { records: await listProjectMemories(projectId), error: "" };
    } catch (error) {
      return {
        records: [],
        error: error instanceof Error ? error.message : "读取记忆失败",
      };
    }
  }, [projectId]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialMemoryId,
  );
  const [editor, setEditor] = useState<ProjectMemory | "new">();
  const selected = result?.records.find((item) => item.id === selectedId);
  const records =
    result?.records.filter(
      (item) =>
        (!category || item.category === category) &&
        (!status || item.status === status) &&
        `${item.title} ${item.body} ${item.applicability} ${item.tags.join(" ")}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    ) ?? [];
  const active =
    result?.records.filter((item) => item.status === "active").length ?? 0;
  return (
    <main className={`memory-page${selected ? " has-selection" : ""}`}>
      <header className="memory-page-heading">
        <div>
          <span className="memory-eyebrow">项目知识</span>
          <h1>把经验，留给下一次创作。</h1>
          <p>汇集这个项目的规范、偏好与决策，每一条都经过你的确认。</p>
        </div>
        <Button onClick={() => setEditor("new")}>
          <Plus />
          添加记忆
        </Button>
      </header>
      <div className="memory-workbench">
        <section className="memory-list-panel" aria-label="项目记忆列表">
          <div className="memory-filters">
            <div className="memory-search">
              <Search size={16} aria-hidden />
              <Input
                aria-label="搜索项目记忆"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索正文、标题或标签"
              />
            </div>
            <div className="memory-filter-row">
              <select
                className="memory-select"
                aria-label="筛选记忆分类"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">全部分类</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="memory-select"
                aria-label="筛选记忆状态"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">全部状态</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="memory-list-meta">
            <span>{records.length} 条记忆</span>
            <span>{active} 条已确认</span>
          </div>
          <div className="memory-list-scroll">
            {!result ? (
              <p className="memory-empty" role="status">
                正在读取项目记忆…
              </p>
            ) : result.error ? (
              <p className="memory-error" role="alert">
                {result.error}
              </p>
            ) : records.length ? (
              records.map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  className={`memory-list-item${selectedId === memory.id ? " is-selected" : ""}`}
                  aria-pressed={selectedId === memory.id}
                  onClick={() => setSelectedId(memory.id)}
                >
                  <div>
                    <span className="memory-category">
                      {CATEGORY_LABELS[memory.category]}
                    </span>
                    <span className={`memory-status is-${memory.status}`}>
                      {STATUS_LABELS[memory.status]}
                    </span>
                  </div>
                  <h2>{memory.title}</h2>
                  <p>{memory.body}</p>
                  <small>
                    {sourceLabel(memory)}
                    <span>{memoryDate(memory.updatedAt)}</span>
                  </small>
                </button>
              ))
            ) : (
              <div className="memory-empty">
                <BookOpen size={28} strokeWidth={1.3} />
                <h2>
                  {result.records.length ? "没有匹配的记忆" : "让好方法留下来"}
                </h2>
                <p>
                  {result.records.length
                    ? "试试其他关键词，或调整筛选条件。"
                    : "可以手动写下一条规范，也可以从任务的已确认总结中，保存值得复用的决策和经验。"}
                </p>
                {!result.records.length && (
                  <Button variant="outline" onClick={() => setEditor("new")}>
                    写下第一条记忆
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
        <section className="memory-detail-panel" aria-label="记忆详情">
          {selected ? (
            <MemoryDetail
              key={selected.id}
              memory={selected}
              onBack={() => setSelectedId(undefined)}
              onEdit={() => setEditor(selected)}
            />
          ) : (
            <div className="memory-detail-placeholder">
              <BookOpen size={36} strokeWidth={1} />
              <h2>{selectedId ? "这条记忆已被删除" : "项目的创作共识"}</h2>
              <p>选择一条记忆，查看它的适用条件、原始依据与修订过程。</p>
              <small>当前用于整理与管理；自动引用将在后续接入。</small>
            </div>
          )}
        </section>
      </div>
      {editor && (
        <MemoryEditor
          key={editor === "new" ? "new" : `${editor.id}:${editor.revision}`}
          projectId={projectId}
          initial={editor === "new" ? undefined : editor}
          memory={editor === "new" ? undefined : editor}
          onClose={() => setEditor(undefined)}
          onSaved={(memory) => {
            setEditor(undefined);
            setSelectedId(memory.id);
            setQuery("");
            setCategory("");
            setStatus("");
          }}
        />
      )}
    </main>
  );
}

function MemoryDetail({
  memory,
  onBack,
  onEdit,
}: {
  memory: ProjectMemory;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { projectId, id } = memory;
  const [readAttempt, setReadAttempt] = useState(0);
  const sourceRead = useLiveQuery(
    () => readMemory(() => getMemorySourceState(projectId, id)),
    [projectId, id, memory.revision, readAttempt],
  );
  const source = sourceRead?.data;
  const versionsRead = useLiveQuery(
    () => readMemory(() => listProjectMemoryVersions(projectId, id)),
    [projectId, id, readAttempt],
  );
  const versions = versionsRead?.data;
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const conflictsRead = useLiveQuery(
    () =>
      readMemory(async () =>
        (
          await Promise.all(
            conflictIds.map((otherId) => getProjectMemory(projectId, otherId)),
          )
        ).filter((row): row is ProjectMemory => !!row),
      ),
    [projectId, conflictIds.join("|"), readAttempt],
  );
  const conflicts = conflictsRead?.data;
  const readError =
    sourceRead?.error || versionsRead?.error || conflictsRead?.error;
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function act(action: () => Promise<unknown>, success: string) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await action();
      setConflictIds([]);
      toast.success(success);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "操作失败，请重试");
      if (failure instanceof MemoryConflictError)
        setConflictIds(failure.existingIds);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  const excerpt =
    memory.source.kind === "manual" ? undefined : memory.source.excerpt;
  return (
    <>
      <div className="memory-detail-toolbar">
        <Button
          className="memory-mobile-back"
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          <ArrowLeft />
          返回列表
        </Button>
        <span>版本 {memory.revision}</span>
        <div>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending || memory.status === "superseded"}
            aria-label="编辑这条记忆"
            onClick={onEdit}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label="删除这条记忆"
            onClick={() => setDeleting(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="memory-detail-scroll">
        {readError && (
          <div className="memory-error" role="alert">
            <p>部分信息暂时无法读取：{readError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReadAttempt((value) => value + 1)}
            >
              重新读取详情
            </Button>
          </div>
        )}
        <div className="memory-detail-kicker">
          <span>{CATEGORY_LABELS[memory.category]}</span>
          <span className={`memory-status is-${memory.status}`}>
            {STATUS_LABELS[memory.status]}
          </span>
        </div>
        <h2 className="memory-detail-title">{memory.title}</h2>
        <p className="memory-detail-body">{memory.body}</p>
        {!!memory.tags.length && (
          <div className="memory-tags">
            {memory.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
        <section className="memory-detail-section">
          <h3>适用条件</h3>
          <p>
            {memory.applicability || "未单独限定，请结合当前创作目标判断。"}
          </p>
        </section>
        <section className="memory-detail-section">
          <h3>
            来源与依据<span>{sourceLabel(memory)}</span>
          </h3>
          <p>
            {source?.message ??
              (sourceRead?.error ? "来源读取失败，请重试" : "正在核对来源…")}
          </p>
          {source?.href && (
            <Link to={source.href} className="memory-source-link">
              查看原任务
              <ArrowUpRight size={14} />
            </Link>
          )}
          {excerpt && (
            <details className="memory-source-excerpt">
              <summary>保存时的原文摘录</summary>
              <p>{excerpt}</p>
            </details>
          )}
          {memory.source.kind !== "manual" &&
            memory.source.evidence?.map((item) => (
              <details className="memory-source-excerpt" key={item.id}>
                <summary>
                  {item.label}
                  {item.truncated ? " · 摘录" : ""}
                </summary>
                <p>{item.body}</p>
              </details>
            ))}
        </section>
        <section className="memory-detail-section">
          <h3>
            <span className="memory-section-label">
              <History size={15} />
              修订历史
            </span>
            <span>{versions?.length ?? 0} 版</span>
          </h3>
          {versions?.map((version) => (
            <details className="memory-version" key={version.versionId}>
              <summary>
                <span>
                  版本 {version.revision} ·{" "}
                  {STATUS_LABELS[version.snapshot.status]}
                </span>
                <small>{memoryDate(version.snapshot.updatedAt)}</small>
              </summary>
              <h4>{version.snapshot.title}</h4>
              <p>{version.snapshot.body}</p>
              <small>
                适用条件：{version.snapshot.applicability || "未单独限定"}
              </small>
            </details>
          ))}
        </section>
        <p className="memory-detail-date">
          创建于 {memoryDate(memory.createdAt)} · 最近更新{" "}
          {memoryDate(memory.updatedAt)}
        </p>
      </div>
      <div className="memory-detail-footer">
        {!!conflicts?.length && (
          <div className="memory-conflicts">
            <p>以下记忆已启用。核对内容后，可用当前记忆明确替代。</p>
            {conflicts.map((other) => (
              <div key={other.id}>
                <strong>{other.title}</strong>
                <p>{other.body}</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    void act(
                      () =>
                        replaceProjectMemory(projectId, other.id, id, {
                          oldRevision: other.revision,
                          newRevision: memory.revision,
                        }),
                      "已替代旧记忆并启用当前条目",
                    )
                  }
                >
                  以当前记忆替代此条
                </Button>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="memory-error" role="alert">
            {error}
          </p>
        )}
        {memory.status === "superseded" ? (
          <p>此条目已被新记忆替代，保留作为历史依据。</p>
        ) : (
          <>
            <p>
              {memory.status === "active"
                ? "停用后内容和修订历史仍会保留。"
                : memory.status === "pending_review"
                  ? "来自备份。请核对正文与适用条件后再启用。"
                  : "这条记忆已暂停使用，可随时重新启用。"}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                void act(
                  () =>
                    setProjectMemoryStatus(
                      projectId,
                      id,
                      memory.status === "active" ? "disabled" : "active",
                      memory.revision,
                    ),
                  memory.status === "active" ? "记忆已停用" : "记忆已确认启用",
                )
              }
            >
              {memory.status === "active" && <Pause />}
              {memory.status === "active"
                ? "停用记忆"
                : memory.status === "pending_review"
                  ? "确认并启用"
                  : "重新启用"}
            </Button>
          </>
        )}
      </div>
      <AlertDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!pending) setDeleting(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除“{memory.title}”？</AlertDialogTitle>
            <AlertDialogDescription>
              这条记忆及其全部修订历史都会被删除，原始任务总结会保留。如果暂时不再适用，可以取消后选择停用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="memory-error">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>保留记忆</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                void act(async () => {
                  await deleteProjectMemory(projectId, id, memory.revision);
                  setDeleting(false);
                  onBack();
                }, "记忆及修订历史已删除")
              }
            >
              {pending ? "删除中…" : "永久删除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
