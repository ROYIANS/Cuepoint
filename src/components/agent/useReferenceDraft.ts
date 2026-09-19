import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { REFERENCE_LIMITS, referenceAttachment, type ReferenceAttachment } from "@/domain/references";
import { importReferenceFile, retryReferenceImport } from "@/lib/references/import";

export type ReferenceImportDraft = { id: string; filename: string; status: "importing" | "failed"; error?: string; file: File; referenceId?: string };
type DraftState = { attachments: ReferenceAttachment[]; imports: ReferenceImportDraft[] };
const EMPTY: DraftState = { attachments: [], imports: [] };

export function useReferenceDraft(scope: string, projectId?: string) {
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; for (const controller of controllers.current.values()) controller.abort(); }; }, []);
  const draft = drafts[scope] ?? EMPTY;
  function update(fn: (previous: DraftState) => DraftState, key = scope) {
    if (mounted.current) setDrafts((previous) => ({ ...previous, [key]: fn(previous[key] ?? EMPTY) }));
  }
  function attach(attachment: ReferenceAttachment) {
    update((previous) => ({ ...previous, attachments: [...previous.attachments.filter((item) => item.referenceId !== attachment.referenceId), attachment] }));
  }
  async function importFiles(files: File[], retryId?: string) {
    if (!projectId) return;
    if (files.length > REFERENCE_LIMITS.selection) { toast.error(`每次最多导入 ${REFERENCE_LIMITS.selection} 个文件`); return; }
    const jobs = files.map((file) => ({ id: crypto.randomUUID(), filename: file.name, status: "importing" as const, file }));
    update((previous) => ({ ...previous, imports: [...previous.imports, ...jobs] }));
    for (const job of jobs) controllers.current.set(job.id, new AbortController());
    for (const job of jobs) {
      const controller = controllers.current.get(job.id);
      if (!controller || controller.signal.aborted || !mounted.current) continue;
      try {
        const options = { signal: controller.signal, onProgress: (reference: { id: string }) => update((previous) => ({ ...previous, imports: previous.imports.map((item) => item.id === job.id ? { ...item, referenceId: reference.id } : item) })) };
        const reference = retryId ? await retryReferenceImport(projectId, retryId, options) : await importReferenceFile(projectId, job.file, options);
        if (controller.signal.aborted) continue;
        update((previous) => ({ ...previous, imports: previous.imports.map((item) => item.id === job.id ? { ...item, referenceId: reference.id } : item) }));
        if (reference.status !== "ready" && reference.status !== "partial") throw new Error(reference.error ?? "解析未完成，请重试");
        update((previous) => ({ attachments: [...previous.attachments.filter((item) => item.referenceId !== reference.id), referenceAttachment(reference)], imports: previous.imports.filter((item) => item.id !== job.id) }));
      } catch (error) {
        if (!controller.signal.aborted) update((previous) => ({ ...previous, imports: previous.imports.map((item) => item.id === job.id ? { ...item, status: "failed", error: error instanceof Error ? error.message : "导入失败" } : item) }));
      } finally { controllers.current.delete(job.id); }
    }
  }
  function cancel(id: string) {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    update((previous) => ({ ...previous, imports: previous.imports.filter((item) => item.id !== id) }));
  }
  function clearSent(attachments: ReferenceAttachment[], key = scope) {
    update((previous) => ({ ...previous, attachments: previous.attachments.filter((item) => !attachments.some((sent) => sent.referenceId === item.referenceId && sent.revision === item.revision)) }), key);
  }
  function moveTo(key: string) {
    if (key === scope) return;
    setDrafts((previous) => ({ ...previous, [key]: previous[scope] ?? EMPTY, [scope]: EMPTY }));
  }
  return { ...draft, moveTo, attach, importFiles, cancel, clearSent, remove: (attachment: ReferenceAttachment) => clearSent([attachment]), retry: (job: ReferenceImportDraft) => { cancel(job.id); void importFiles([job.file], job.referenceId); } };
}
