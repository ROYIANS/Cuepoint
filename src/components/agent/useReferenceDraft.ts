import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {REFERENCE_LIMITS, referenceAttachment, type ReferenceAttachment} from "@/domain/references";
import {importReferenceFile, retryReferenceImport} from "@/lib/references/import";

export type ReferenceImportDraft = {
    id: string;
    filename: string;
    status: "importing" | "failed";
    error?: string;
    file: File;
    referenceId?: string
};
type DraftState = {
    text: string;
    textRevision: number;
    attachments: ReferenceAttachment[];
    imports: ReferenceImportDraft[]
};
type SubmittedDraft = Pick<DraftState, "text" | "textRevision" | "attachments" | "imports"> & { scope: string };
const EMPTY: DraftState = {text: "", textRevision: 0, attachments: [], imports: []};

export function useReferenceDraft(scope: string, projectId?: string) {
    const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
    // Callbacks can edit while thread creation/navigation is awaiting. Keep a
    // synchronous snapshot so transfers inspect the latest edits even before paint.
    const currentDrafts = useRef(drafts);
    const revision = useRef(0);
    const controllers = useRef(new Map<string, AbortController>());
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        const ownedControllers = controllers.current;
        return () => {
            mounted.current = false;
            for (const controller of ownedControllers.values()) controller.abort();
        };
    }, []);
    const draft = drafts[scope] ?? EMPTY;

    function publish(next: Record<string, DraftState>) {
        if (!mounted.current) return;
        currentDrafts.current = next;
        setDrafts(next);
    }

    function update(fn: (previous: DraftState) => DraftState, key = scope) {
        if (mounted.current) publish({...currentDrafts.current, [key]: fn(currentDrafts.current[key] ?? EMPTY)});
    }

    function setText(text: string) {
        update((previous) => ({...previous, text, textRevision: ++revision.current}));
    }

    function capture(): SubmittedDraft {
        const current = currentDrafts.current[scope] ?? EMPTY;
        return {
            scope,
            text: current.text,
            textRevision: current.textRevision,
            attachments: [...current.attachments],
            imports: [...current.imports]
        };
    }

    function attach(attachment: ReferenceAttachment) {
        update((previous) => ({
            ...previous,
            attachments: [...previous.attachments.filter((item) => item.referenceId !== attachment.referenceId), attachment]
        }));
    }

    async function importFiles(files: File[], retryId?: string) {
        if (!projectId) return;
        if (files.length > REFERENCE_LIMITS.selection) {
            toast.error(`每次最多导入 ${REFERENCE_LIMITS.selection} 个文件`);
            return;
        }
        const jobs = files.map((file) => ({
            id: crypto.randomUUID(),
            filename: file.name,
            status: "importing" as const,
            file
        }));
        update((previous) => ({...previous, imports: [...previous.imports, ...jobs]}));
        for (const job of jobs) controllers.current.set(job.id, new AbortController());
        for (const job of jobs) {
            const controller = controllers.current.get(job.id);
            if (!controller || controller.signal.aborted || !mounted.current) continue;
            try {
                const options = {
                    signal: controller.signal,
                    onProgress: (reference: { id: string }) => update((previous) => ({
                        ...previous,
                        imports: previous.imports.map((item) => item.id === job.id ? {
                            ...item,
                            referenceId: reference.id
                        } : item)
                    }))
                };
                const reference = retryId ? await retryReferenceImport(projectId, retryId, options) : await importReferenceFile(projectId, job.file, options);
                if (controller.signal.aborted) continue;
                update((previous) => ({
                    ...previous,
                    imports: previous.imports.map((item) => item.id === job.id ? {
                        ...item,
                        referenceId: reference.id
                    } : item)
                }));
                if (reference.status !== "ready" && reference.status !== "partial") throw new Error(reference.error ?? "解析未完成，请重试");
                update((previous) => ({
                    ...previous,
                    attachments: [...previous.attachments.filter((item) => item.referenceId !== reference.id), referenceAttachment(reference)],
                    imports: previous.imports.filter((item) => item.id !== job.id)
                }));
            } catch (error) {
                if (!controller.signal.aborted) update((previous) => ({
                    ...previous,
                    imports: previous.imports.map((item) => item.id === job.id ? {
                        ...item,
                        status: "failed",
                        error: error instanceof Error ? error.message : "导入失败"
                    } : item)
                }));
            } finally {
                controllers.current.delete(job.id);
            }
        }
    }

    function cancel(id: string) {
        controllers.current.get(id)?.abort();
        controllers.current.delete(id);
        update((previous) => ({...previous, imports: previous.imports.filter((item) => item.id !== id)}));
    }

    function clearSent(attachments: ReferenceAttachment[], key = scope) {
        update((previous) => ({
            ...previous,
            attachments: withoutSent(previous.attachments, attachments)
        }), key);
    }

    function acknowledge(submitted: SubmittedDraft) {
        update((previous) => ({
            ...previous,
            ...(previous.textRevision === submitted.textRevision ? {text: "", textRevision: ++revision.current} : {}),
            attachments: withoutSent(previous.attachments, submitted.attachments)
        }), submitted.scope);
    }

    function moveTo(key: string, submitted: SubmittedDraft) {
        if (!mounted.current) throw new Error("对话页面已关闭，草稿保留在原话题");
        // A created thread should have no compose session. Never overwrite a
        // destination session, even if its user has since edited back to empty.
        if (key in currentDrafts.current) throw new Error("新话题已有草稿，发送内容保留在原话题");
        const source = currentDrafts.current[submitted.scope] ?? EMPTY;
        const retained = {
            ...source,
            ...(source.textRevision === submitted.textRevision ? {text: "", textRevision: ++revision.current} : {}),
            attachments: withoutSent(source.attachments, submitted.attachments)
        };
        const destination: DraftState = {
            ...EMPTY,
            text: submitted.text,
            textRevision: ++revision.current,
            attachments: submitted.attachments
        };
        const moved = {...submitted, scope: key, textRevision: destination.textRevision};
        publish({...currentDrafts.current, [submitted.scope]: retained, [key]: destination});
        return {
            submitted: moved,
            // Navigation may reject before showing the destination. Restore only
            // when neither owner has edited; otherwise keep the payload in the
            // created thread, which remains available through the thread list.
            restore: () => {
                if (!mounted.current) return false;
                const origin = currentDrafts.current[submitted.scope] ?? EMPTY;
                const target = currentDrafts.current[key] ?? EMPTY;
                if (source.textRevision !== submitted.textRevision || origin.textRevision !== retained.textRevision || target.textRevision !== moved.textRevision) return false;
                publish({
                    ...currentDrafts.current,
                    [submitted.scope]: {
                        ...origin, text: submitted.text, textRevision: ++revision.current,
                        attachments: [...origin.attachments.filter((item) => !submitted.attachments.some((sent) => sent.referenceId === item.referenceId)), ...submitted.attachments]
                    },
                    [key]: {
                        ...target,
                        text: "",
                        textRevision: ++revision.current,
                        attachments: withoutSent(target.attachments, submitted.attachments)
                    }
                });
                return true;
            }
        };
    }

    return {
        ...draft,
        setText,
        capture,
        acknowledge,
        moveTo,
        attach,
        importFiles,
        cancel,
        clearSent,
        remove: (attachment: ReferenceAttachment) => clearSent([attachment]),
        retry: (job: ReferenceImportDraft) => {
            cancel(job.id);
            void importFiles([job.file], job.referenceId);
        }
    };
}

function withoutSent(attachments: ReferenceAttachment[], sent: ReferenceAttachment[]) {
    return attachments.filter((item) => !sent.some((snapshot) => snapshot.referenceId === item.referenceId && snapshot.revision === item.revision));
}
