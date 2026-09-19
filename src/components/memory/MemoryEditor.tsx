import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import type {
  MemoryInput,
  MemorySourceRef,
  ProjectMemory,
} from "@/domain/projectMemory";
import {
  createProjectMemory,
  getProjectMemory,
  MemoryConflictError,
  promoteProjectMemory,
  updateProjectMemory,
} from "@/db/projectMemories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { readMemory } from "./readMemory";
import { CATEGORY_LABELS } from "./memoryLabels";
import "./memory.css";

export const EMPTY_MEMORY: MemoryInput = {
  category: "convention",
  title: "",
  topicKey: "",
  body: "",
  applicability: "",
  tags: [],
};

export function MemoryEditor({
  projectId,
  initial = EMPTY_MEMORY,
  memory,
  source,
  sourceExcerpt,
  onClose,
  onSaved,
  onPendingChange,
}: {
  projectId: string;
  initial?: MemoryInput;
  memory?: ProjectMemory;
  source?: MemorySourceRef;
  sourceExcerpt?: string;
  onClose: () => void;
  onSaved: (memory: ProjectMemory) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const baseline: MemoryInput = {
    category: initial.category,
    title: initial.title,
    topicKey: initial.topicKey,
    body: initial.body,
    applicability: initial.applicability,
    tags: initial.tags,
  };
  const [draft, setDraft] = useState<MemoryInput>(() => ({
    ...baseline,
    tags: [...initial.tags],
  }));
  const [tagsText, setTagsText] = useState(initial.tags.join("，"));
  const [expectedRevision, setExpectedRevision] = useState(memory?.revision);
  const [readAttempt, setReadAttempt] = useState(0);
  const currentRead = useLiveQuery(
    () =>
      readMemory(async () =>
        memory
          ? ((await getProjectMemory(projectId, memory.id)) ?? null)
          : null,
      ),
    [projectId, memory?.id, readAttempt],
  );
  const current = currentRead?.data;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [discard, setDiscard] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    onPendingChange?.(pending);
    return () => onPendingChange?.(false);
  }, [pending, onPendingChange]);
  const conflictsRead = useLiveQuery(
    () =>
      readMemory(async () =>
        (
          await Promise.all(
            conflictIds.map((id) => getProjectMemory(projectId, id)),
          )
        ).filter((item): item is ProjectMemory => !!item),
      ),
    [projectId, conflictIds.join("|"), readAttempt],
  );
  const conflicts = conflictsRead?.data;
  const readError = currentRead?.error || conflictsRead?.error;
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(baseline) ||
    tagsText !== initial.tags.join("，");
  const blocker = useBlocker({
    shouldBlockFn: () => dirty || pending,
    withResolver: true,
    enableBeforeUnload: dirty || pending,
  });
  function close() {
    if (pending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function change(patch: Partial<MemoryInput>) {
    setDraft((value) => ({ ...value, ...patch }));
    setConflictIds([]);
    setError("");
  }
  async function save(replace?: { id: string; expectedRevision: number }) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    const input = {
      ...draft,
      topicKey: draft.topicKey.trim() || draft.title,
      tags: tagsText
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    try {
      if (memory) {
        const updated = await updateProjectMemory(
          projectId,
          memory.id,
          input,
          expectedRevision!,
        );
        onSaved(updated);
        toast.success("记忆已更新");
      } else {
        const result = source
          ? await promoteProjectMemory(projectId, source, input, { replace })
          : await createProjectMemory(projectId, input, { replace });
        onSaved(result.memory);
        toast.success(
          result.duplicate
            ? "这条记忆已经保存，无需重复添加"
            : "已保存到项目记忆",
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "保存失败，编辑内容已保留，请重试",
      );
      if (failure instanceof MemoryConflictError)
        setConflictIds(failure.existingIds);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="memory-editor-dialog"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {memory ? "编辑记忆" : source ? "保存为项目记忆" : "添加项目记忆"}
            </DialogTitle>
            <DialogDescription>
              写下后续创作可以复用的内容，并明确它适用的条件。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="memory-editor-form"
          >
            <fieldset disabled={pending} className="memory-editor-fields">
              {sourceExcerpt && (
                <details className="memory-source-excerpt">
                  <summary>查看这条记忆的原始依据</summary>
                  <p>{sourceExcerpt}</p>
                  <small>
                    来自已确认的历史总结。请再次检查它是否仍适用于当前项目。
                  </small>
                </details>
              )}
              <div className="memory-form-pair">
                <Field label="分类">
                  <select
                    className="memory-select"
                    value={draft.category}
                    onChange={(event) =>
                      change({
                        category: event.target.value as MemoryInput["category"],
                      })
                    }
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="标题">
                  <Input
                    autoFocus
                    required
                    maxLength={120}
                    value={draft.title}
                    onChange={(event) => change({ title: event.target.value })}
                    placeholder="例如：角色对白的语气"
                  />
                </Field>
              </div>
              <Field label="记忆正文">
                <Textarea
                  required
                  rows={6}
                  maxLength={6000}
                  value={draft.body}
                  onChange={(event) => change({ body: event.target.value })}
                  placeholder="保留明确、可复用的结论，而不是整段聊天记录。"
                />
              </Field>
              <Field label="适用条件">
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={draft.applicability}
                  onChange={(event) =>
                    change({ applicability: event.target.value })
                  }
                  placeholder="适用于哪些场景，有什么例外？"
                />
              </Field>
              <div className="memory-form-pair">
                <Field label="主题（用于检查重复）">
                  <Input
                    maxLength={120}
                    value={draft.topicKey}
                    onChange={(event) =>
                      change({ topicKey: event.target.value })
                    }
                    placeholder="留空时使用标题"
                  />
                </Field>
                <Field label="标签（逗号分隔）">
                  <Input
                    maxLength={600}
                    value={tagsText}
                    onChange={(event) => setTagsText(event.target.value)}
                    placeholder="角色，对白"
                  />
                </Field>
              </div>
            </fieldset>
            {memory && current && current.revision !== expectedRevision && (
              <div className="memory-conflicts" role="status">
                <strong>这条记忆已在其他地方更新</strong>
                <p>
                  最新版本 {current.revision}：{current.title}
                </p>
                <p>{current.body}</p>
                <p>适用条件：{current.applicability || "未单独限定"}</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setExpectedRevision(current.revision);
                    setError("");
                  }}
                >
                  已核对最新版本，保留我的草稿继续编辑
                </Button>
              </div>
            )}
            {memory && current === null && (
              <p className="memory-error" role="alert">
                这条记忆已被删除。编辑内容仍保留，可复制后另行添加。
              </p>
            )}
            {readError && (
              <div className="memory-error" role="alert">
                <p>暂时无法读取记忆：{readError}。草稿已保留。</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setReadAttempt((value) => value + 1)}
                >
                  重新读取
                </Button>
              </div>
            )}
            {error && (
              <p className="memory-error" role="alert">
                {error}。编辑内容仍保留。
              </p>
            )}
            {!!conflicts?.length && (
              <div className="memory-conflicts">
                <p>
                  已有相同主题的内容。你可以修改主题，也可以明确替代其中一条。
                </p>
                {conflicts.map((item) => (
                  <div key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    {!memory && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          void save({
                            id: item.id,
                            expectedRevision: item.revision,
                          })
                        }
                      >
                        保存并替代此条
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="memory-editor-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={close}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={
                  pending ||
                  !!readError ||
                  (!!memory &&
                    (!current || current.revision !== expectedRevision)) ||
                  !draft.title.trim() ||
                  !draft.body.trim()
                }
              >
                {pending ? "保存中…" : memory ? "保存修改" : "确认并保存"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={discard || blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) {
            setDiscard(false);
            blocker.reset?.();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃尚未保存的修改？</AlertDialogTitle>
            <AlertDialogDescription>
              当前编辑的内容尚未写入项目记忆，离开后将丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                if (blocker.status === "blocked") blocker.proceed();
                else onClose();
              }}
            >
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
