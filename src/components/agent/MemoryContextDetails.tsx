import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "@tanstack/react-router";
import { BookOpen, Check, Minus, RotateCcw } from "lucide-react";
import type { AgentRun } from "@/domain/agent";
import type { MemorySelection } from "@/domain/memoryRetrieval";
import {
  getThreadMemoryExclusions,
  setThreadMemoryExcluded,
} from "@/db/memoryRetrieval";
import { listProjectMemories } from "@/db/projectMemories";
import { db } from "@/db/database";
import { readMemory } from "@/components/memory/readMemory";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
} from "@/components/memory/memoryLabels";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatTokenCount } from "@/lib/agent/contextUsage";
import "./memoryContext.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection?: MemorySelection;
  threadId?: string;
  run?: AgentRun;
  readOnly?: boolean;
};
export function MemoryContextDetails({
  open,
  onOpenChange,
  selection,
  threadId,
  run,
  readOnly,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <MemoryContextContent
          key={`${run?.id ?? "preview"}:${selection?.projectId}`}
          selection={selection}
          threadId={threadId}
          run={run}
          readOnly={readOnly}
        />
      )}
    </Sheet>
  );
}
function MemoryContextContent({
  selection,
  threadId,
  run,
  readOnly,
}: Omit<Props, "open" | "onOpenChange">) {
  const [step, setStep] = useState<number | "prepared">(
    run?.memoryAudit?.at(-1)?.step ?? "prepared",
  );
  const shown =
    step === "prepared"
      ? selection
      : run?.memoryAudit?.find((item) => item.step === step)?.selection;
  const projectId = shown?.projectId ?? selection?.projectId;
  const [attempt, setAttempt] = useState(0);
  const state = useLiveQuery(
    () =>
      readMemory(async () => {
        if (!projectId)
          return { memories: [], exclusions: [], available: false };
        const project = await db.projects.get(projectId);
        if (!project) return { memories: [], exclusions: [], available: false };
        return {
          available: true,
          memories: await listProjectMemories(projectId),
          exclusions: threadId
            ? await getThreadMemoryExclusions(threadId, projectId)
            : [],
        };
      }),
    [projectId, threadId, attempt],
  );
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function exclude(id: string, excluded: boolean) {
    if (lock.current || !threadId || !projectId) return;
    lock.current = true;
    setPending(id);
    setError("");
    try {
      await setThreadMemoryExcluded(threadId, projectId, id, excluded);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "保存排除设置失败，请重试",
      );
    } finally {
      lock.current = false;
      setPending(undefined);
    }
  }
  const mutable =
    !!threadId && !readOnly && state?.data?.available && !state.error;
  return (
    <SheetContent
      className="memory-context-sheet"
      aria-label="项目记忆引用详情"
    >
      <SheetHeader className="memory-context-heading">
        <span className="memory-context-eyebrow">项目上下文</span>
        <SheetTitle>
          {step === "prepared" ? "下次引用的记忆" : "这次带入的记忆"}
        </SheetTitle>
        <SheetDescription>
          {run
            ? "查看模型请求对应的记忆版本，历史记录不会随项目编辑而改写。"
            : "根据当前草稿与任务选择，实际发送前会再次核对。"}
        </SheetDescription>
      </SheetHeader>
      <div className="memory-context-scroll">
        {run && (
          <label className="memory-context-step">
            查看请求
            <select
              value={step}
              onChange={(event) =>
                setStep(
                  event.target.value === "prepared"
                    ? "prepared"
                    : Number(event.target.value),
                )
              }
            >
              {run.memoryAudit?.map((entry) => (
                <option key={entry.step} value={entry.step}>
                  第 {entry.step} 次模型请求
                </option>
              ))}
              <option value="prepared">当前准备的上下文</option>
            </select>
          </label>
        )}
        {shown ? (
          <>
            <div className="memory-context-stats">
              <span>
                <strong>{shown.selectedCount}</strong> 条已纳入
              </span>
              <span>≈ {formatTokenCount(shown.estimatedTokens)} tokens</span>
            </div>
            <p className="memory-context-note">
              {step === "prepared"
                ? run
                  ? "准备快照；尚不代表请求已发送。"
                  : "预计下次发送。"
                : "请求启动时记录的输入，不代表模型一定采用了其中的建议。"}{" "}
              {shown.omittedCount > 0
                ? `另有 ${shown.omittedCount} 条未纳入，可能不相关或超出预算。`
                : ""}
            </p>
            {shown.entries.length ? (
              shown.entries.map((entry) => {
                const current = state?.data?.memories.find(
                  (item) => item.id === entry.id,
                );
                const excluded = state?.data?.exclusions.includes(entry.id);
                return (
                  <article className="memory-context-entry" key={entry.id}>
                    <div className="memory-context-entry-meta">
                      <span>
                        {CATEGORY_LABELS[entry.category]} ·{" "}
                        {entry.inclusion === "project"
                          ? "项目通用"
                          : "按需引用"}
                      </span>
                      <span>版本 {entry.revision}</span>
                    </div>
                    <h3>{entry.title}</h3>
                    <p className="memory-context-reason">{entry.reason}</p>
                    <p className="memory-context-body">{entry.body}</p>
                    {entry.applicability && (
                      <div className="memory-context-condition">
                        <span>适用条件</span>
                        <p>{entry.applicability}</p>
                      </div>
                    )}
                    <p className="memory-context-source">
                      {entry.source.kind === "manual"
                        ? "来源：人工整理"
                        : entry.source.kind === "imported"
                          ? "来源：项目备份，原链接未连接"
                          : `来源：${entry.source.taskTitle}`}{" "}
                      {state?.data &&
                        (!current
                          ? "· 原记忆已删除，保留请求快照"
                          : current.revision !== entry.revision
                            ? `· 当前为版本 ${current.revision}（${STATUS_LABELS[current.status]}）`
                            : current.status !== "active"
                              ? `· 当前${STATUS_LABELS[current.status]}`
                              : "")}
                    </p>
                    <div className="memory-context-entry-actions">
                      {projectId && current && (
                        <Link
                          to="/p/$projectId/memory"
                          params={{ projectId }}
                          search={{ memory: entry.id }}
                        >
                          查看记忆与来源 ↗
                        </Link>
                      )}
                      {mutable && (current || excluded) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!pending}
                          onClick={() => void exclude(entry.id, !excluded)}
                        >
                          {excluded ? <Check /> : <Minus />}
                          {pending === entry.id
                            ? "保存中…"
                            : excluded
                              ? "恢复引用"
                              : "本对话排除"}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="memory-context-empty">
                <BookOpen size={28} strokeWidth={1.2} />
                <h3>本次没有带入记忆</h3>
                <p>
                  没有匹配的已启用内容，或当前预算不足。项目通用规则同样受预算限制。
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="memory-context-note">本次尚无项目记忆快照。</p>
        )}
        {!!state?.data?.exclusions.length && (
          <section className="memory-context-exclusions">
            <h3>
              本对话已排除 <span>{state.data.exclusions.length}</span>
            </h3>
            {state.data.exclusions.map((id) => (
              <div key={id}>
                <span>
                  {state.data.memories.find((item) => item.id === id)?.title ??
                    "已删除的记忆"}
                </span>
                {mutable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!pending}
                    onClick={() => void exclude(id, false)}
                  >
                    <RotateCcw />
                    恢复
                  </Button>
                )}
              </div>
            ))}
          </section>
        )}
        {(error || state?.error) && (
          <div className="memory-context-error" role="alert">
            <p>{error || state?.error}</p>
            {state?.error && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAttempt((value) => value + 1)}
              >
                重新读取
              </Button>
            )}
          </div>
        )}
      </div>
      <footer className="memory-context-footer">
        <p>
          {threadId
            ? "排除和修改在后续模型请求前生效，不影响正在生成的回复，也不会抹去已发送的历史内容。"
            : "开始对话后，可以单独排除不适合本次任务的记忆。"}
        </p>
        <p>当前要求和最新项目事实优先于历史记忆。数值为文本估算。</p>
      </footer>
    </SheetContent>
  );
}
export function MemoryRunHistory({
  run,
  readOnly,
}: {
  run: AgentRun;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const count = run.memoryAudit?.at(-1)?.selection.selectedCount ?? 0;
  if (!run.memorySelection && !run.memoryAudit?.length) return null;
  return (
    <>
      <button
        type="button"
        className="agent-memory-history"
        onClick={() => setOpen(true)}
        aria-label="查看本次请求的记忆"
      >
        <BookOpen size={12} />
        记忆 {count}
      </button>
      <MemoryContextDetails
        open={open}
        onOpenChange={setOpen}
        run={run}
        selection={run.memorySelection}
        threadId={run.threadId}
        readOnly={readOnly}
      />
    </>
  );
}
