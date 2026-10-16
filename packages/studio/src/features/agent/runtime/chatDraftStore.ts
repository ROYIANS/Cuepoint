import {REFERENCE_LIMITS, referenceAttachment, type ReferenceAttachment} from "../../references/models/references";
import {importReferenceFile, retryReferenceImport} from "../../references/documents/import";
import type {DraftSnapshot, DraftRecovery, SubmittedDraft, ReferenceImportDraft} from "../models/chatDraft";

const EMPTY: DraftSnapshot = Object.freeze({text: "", textRevision: 0, revision: 0, attachments: Object.freeze([]), imports: Object.freeze([])});

/** Document-owned compose sessions and original reference-import operations. */
export function createChatDraftStore() {
    let drafts: Record<string, DraftSnapshot> = {};
    let revision = 0;
    let admissionOpen = true;
    const controllers = new Map<string, AbortController>();
    const imports = new Set<Promise<void>>();
    const listeners = new Set<() => void>();
    let shutdownPromise: Promise<void> | undefined;
    function session(scope: string, projectId?: string) {
        function publish(next: Record<string, DraftSnapshot>) {
            drafts = Object.fromEntries(Object.entries(next).map(([key, draft]) => [key, draft === drafts[key] ? draft : Object.freeze({...draft,
                attachments: Object.freeze(draft.attachments.map(item => Object.freeze({...item}))),
                imports: Object.freeze(draft.imports.map(item => Object.freeze({...item})))})]));
            for (const listener of [...listeners]) {try {listener();} catch { /* View observation cannot own imports. */ }}
        }

        function update(fn: (previous: DraftSnapshot) => DraftSnapshot, key = scope) {
            const next = {...fn(drafts[key] ?? EMPTY), revision: ++revision};
            const assignedRevision = next.revision;
            publish({...drafts, [key]: next});
            return assignedRevision;
        }

        function setText(text: string) {
            update((previous) => ({...previous, text, textRevision: ++revision}));
        }

        function capture(): SubmittedDraft {
            const current = drafts[scope] ?? EMPTY;
            return {
                scope,
                text: current.text,
                textRevision: current.textRevision,
                attachments: current.attachments.map(attachment => ({...attachment})),
                imports: current.imports.map(job => ({...job}))
            };
        }

        function attach(attachment: ReferenceAttachment) {
            update((previous) => ({
                ...previous,
                attachments: [...previous.attachments.filter((item) => item.referenceId !== attachment.referenceId), attachment]
            }));
        }

        function importFiles(files: File[], retryId?: string): Promise<void> {
            if (!admissionOpen) return Promise.reject(new Error("应用正在退出，无法导入资料"));
            if (!projectId) return Promise.resolve();
            if (files.length > REFERENCE_LIMITS.selection) {
                return Promise.reject(new Error(`每次最多导入 ${REFERENCE_LIMITS.selection} 个文件`));
            }
            const jobs = files.map((file) => ({
                id: crypto.randomUUID(),
                filename: file.name,
                status: "importing" as const,
                file
            }));
            for (const job of jobs) controllers.set(job.id, new AbortController());
            let resolve!: () => void;
            let reject!: (cause: unknown) => void;
            const done = new Promise<void>((yes, no) => {resolve = yes; reject = no;});
            imports.add(done);
            // Complete reservation precedes notifying a subscriber that can Stop or Quit.
            update((previous) => ({...previous, imports: [...previous.imports, ...jobs]}));
            void (async () => {
                for (const job of jobs) {
                    const controller = controllers.get(job.id);
                    if (!controller || controller.signal.aborted || !admissionOpen) {
                        controllers.delete(job.id);
                        update(previous => ({...previous, imports: previous.imports.filter(item => item.id !== job.id)}));
                        continue;
                    }
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
                        if (controller.signal.aborted) {
                            update(previous => ({...previous, imports: previous.imports.filter(item => item.id !== job.id)}));
                            continue;
                        }
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
                        if (controller.signal.aborted) update(previous => ({...previous, imports: previous.imports.filter(item => item.id !== job.id)}));
                        else update((previous) => ({
                            ...previous,
                            imports: previous.imports.map((item) => item.id === job.id ? {
                                ...item,
                                status: "failed",
                                error: error instanceof Error ? error.message : "导入失败"
                            } : item)
                        }));
                    } finally {
                        controllers.delete(job.id);
                    }
                }
            })().then(() => {imports.delete(done); resolve();}, cause => {imports.delete(done); reject(cause);});
            return done;
        }

        function cancel(id: string) {
            controllers.get(id)?.abort();
            controllers.delete(id);
            update((previous) => ({...previous, imports: previous.imports.filter((item) => item.id !== id)}));
        }

        function clearSent(attachments: ReferenceAttachment[], key = scope) {
            update((previous) => ({
                ...previous,
                attachments: withoutSent(previous.attachments, attachments)
            }), key);
        }

        function acknowledge(submitted: SubmittedDraft) {
            return update((previous) => ({
                ...previous,
                ...(previous.textRevision === submitted.textRevision ? {text: "", textRevision: ++revision} : {}),
                attachments: withoutSent(previous.attachments, submitted.attachments)
            }), submitted.scope);
        }

        function consume(submitted: SubmittedDraft): DraftRecovery {
            const revision = acknowledge(submitted);
            return {scope: submitted.scope, revision};
        }

        function restore(submitted: SubmittedDraft, recovery: DraftRecovery): boolean {
            if (!admissionOpen || recovery.scope !== submitted.scope) return false;
            const current = drafts[recovery.scope] ?? EMPTY;
            // All mutations count, including attachment/import changes and editing back
            // to empty. Never replace a later composer version by comparing text alone.
            if (current.revision !== recovery.revision || current.text || current.attachments.length || current.imports.length) return false;
            update((previous) => ({...previous, text: submitted.text, textRevision: ++revision,
                attachments: [...submitted.attachments]}), recovery.scope);
            return true;
        }

        function reserveDestination(key: string) {
            if (!admissionOpen) throw new Error("应用正在退出，发送内容仍保留在原位置");
            if (key in drafts) throw new Error("新话题已有草稿，请先处理该草稿后重试");
            publish({...drafts, [key]: {...EMPTY, revision: ++revision}});
        }

        function moveTo(key: string, submitted: SubmittedDraft) {
            if (!admissionOpen) throw new Error("应用正在退出，草稿保留在原话题");
            // A created thread should have no compose session. Never overwrite a
            // destination session, even if its user has since edited back to empty.
            if (key in drafts) throw new Error("新话题已有草稿，发送内容保留在原话题");
            const source = drafts[submitted.scope] ?? EMPTY;
            const retained = {
                ...source,
                ...(source.textRevision === submitted.textRevision ? {text: "", textRevision: ++revision} : {}),
                attachments: withoutSent(source.attachments, submitted.attachments)
            };
            const destination: DraftSnapshot = {
                ...EMPTY,
                text: submitted.text,
                textRevision: ++revision,
                attachments: submitted.attachments
            };
            const moved = {...submitted, scope: key, textRevision: destination.textRevision};
            publish({...drafts, [submitted.scope]: retained, [key]: destination});
            return {
                submitted: moved,
                // Navigation may reject before showing the destination. Restore only
                // when neither owner has edited; otherwise keep the payload in the
                // created thread, which remains available through the thread list.
                restore: () => {
                    if (!admissionOpen) return false;
                    const origin = drafts[submitted.scope] ?? EMPTY;
                    const target = drafts[key] ?? EMPTY;
                    if (source.textRevision !== submitted.textRevision || origin.textRevision !== retained.textRevision || target.textRevision !== moved.textRevision) return false;
                    publish({
                        ...drafts,
                        [submitted.scope]: {
                            ...origin, text: submitted.text, textRevision: ++revision,
                            attachments: [...origin.attachments.filter((item) => !submitted.attachments.some((sent) => sent.referenceId === item.referenceId)), ...submitted.attachments]
                        },
                        [key]: {
                            ...target,
                            text: "",
                            textRevision: ++revision,
                            attachments: withoutSent(target.attachments, submitted.attachments)
                        }
                    });
                    return true;
                }
            };
        }

        return {setText, capture, acknowledge, consume, restore, reserveDestination, moveTo, attach, cancel, clearSent,
            remove: (attachment: ReferenceAttachment) => clearSent([attachment]),
            importFiles,
            retry(job: ReferenceImportDraft) {cancel(job.id); return this.importFiles([job.file], job.referenceId);}
        };
    }
    return {
        session,
        snapshot: (scope: string) => drafts[scope] ?? EMPTY,
        subscribe(this: void, listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
        shutdown(): Promise<void> {
            if (shutdownPromise) return shutdownPromise;
            admissionOpen = false;
            const original = [...imports];
            let resolve!: () => void;
            shutdownPromise = new Promise<void>(done => {resolve = done;});
            for (const controller of controllers.values()) controller.abort();
            void Promise.allSettled(original).then(resolve);
            return shutdownPromise;
        }
    };
}
export const chatDrafts = createChatDraftStore();

function withoutSent(attachments: readonly Readonly<ReferenceAttachment>[], sent: readonly Readonly<ReferenceAttachment>[]) {
    return attachments.filter((item) => !sent.some((snapshot) => snapshot.referenceId === item.referenceId && snapshot.revision === item.revision));
}
