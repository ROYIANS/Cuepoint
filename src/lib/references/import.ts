import { db } from "@/db/database";
import { generationImageDimensions } from "@/lib/agent/generationMedia";
import { REFERENCE_LIMITS as LIMITS, type ParsedReference, type ProjectReference, type ReferenceKind } from "@/domain/references";
import { isStudioLibrary } from "@/domain/types";
import { createId, nowIso } from "@/lib/ids";
import { assertReferenceSignature, identifyReference, parseTextReference } from "./parse";

export interface ReferenceImportOptions { signal?: AbortSignal; onProgress?: (reference: ProjectReference) => void }

async function parseDocxInWorker(buffer: ArrayBuffer, signal?: AbortSignal): Promise<ParsedReference> {
  const worker = new Worker(new URL("./docx.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    const finish = (error?: unknown, result?: ParsedReference) => {
      clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.terminate();
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => finish(signal?.reason ?? new Error("解析已取消"));
    const timer = setTimeout(() => finish(new Error("DOCX 解析超时，请拆分文档后重试")), LIMITS.workerTimeoutMs);
    worker.onmessage = (event: MessageEvent<{ result?: ParsedReference; error?: string }>) => finish(event.data.error ? new Error(event.data.error) : undefined, event.data.result);
    worker.onerror = () => finish(new Error("DOCX 解析失败，请检查文件后重试"));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort(); else worker.postMessage(buffer, [buffer]);
  });
}

async function parseFile(buffer: ArrayBuffer, kind: ReferenceKind, mimeType: string, signal?: AbortSignal): Promise<ParsedReference> {
  signal?.throwIfAborted();
  if (kind === "text") return parseTextReference(buffer);
  if (kind === "pdf") return (await import("./pdf")).parsePdfReference(buffer, signal);
  if (kind === "docx") return parseDocxInWorker(buffer, signal);
  const dimensions = await generationImageDimensions(new Blob([buffer], { type: mimeType }));
  if (dimensions.width * dimensions.height > 100_000_000) throw new Error("图片像素超过 1 亿，请缩小后重试");
  if (typeof createImageBitmap !== "undefined") {
    const image = await createImageBitmap(new Blob([buffer], { type: mimeType })).catch(() => { throw new Error("图片已损坏，无法解码"); });
    try { if (image.width * image.height > 100_000_000) throw new Error("图片像素超过 1 亿，请缩小后重试"); }
    finally { image.close(); }
  }
  return { chunks: [], coverage: { totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: 0, truncated: false }, warnings: [] };
}

async function finishImport(reference: ProjectReference, buffer: ArrayBuffer, options: ReferenceImportOptions): Promise<ProjectReference> {
  options.onProgress?.(reference);
  let parsed: ParsedReference | undefined;
  let error: string | undefined;
  try { parsed = await parseFile(buffer, reference.kind, reference.mimeType, options.signal); options.signal?.throwIfAborted(); }
  catch (failure) { error = options.signal?.aborted ? "解析已取消，可以重试" : failure instanceof Error ? failure.message : "解析失败，请重试"; }
  return db.transaction("rw", [db.projects, db.projectReferences, db.referenceChunks], async () => {
    const current = await db.projectReferences.get(reference.id);
    if (!current || current.operationId !== reference.operationId || current.status !== "parsing" || !(await db.projects.get(reference.projectId))) throw new Error("资料已移除或本次解析已被替代");
    const next: ProjectReference = {
      ...current, updatedAt: nowIso(), status: error ? "failed" : parsed!.coverage.truncated || parsed!.coverage.emptyUnits.length > 0 && reference.kind === "pdf" ? "partial" : "ready",
      error, coverage: parsed?.coverage ?? current.coverage, warnings: parsed?.warnings ?? [],
    };
    await db.referenceChunks.where("referenceId").equals(reference.id).delete();
    if (parsed?.chunks.length) await db.referenceChunks.bulkAdd(parsed.chunks.map((chunk) => ({ ...chunk, id: createId("rfc"), referenceId: reference.id, revision: reference.revision, projectId: reference.projectId })));
    await db.projectReferences.put(next);
    return next;
  });
}

async function importSource(projectId: string, file: File, options: ReferenceImportOptions, existingMediaId?: string): Promise<ProjectReference> {
  const format = identifyReference(file);
  if (isStudioLibrary(projectId) || !(await db.projects.get(projectId))) throw new Error("请先选择一个项目，再添加参考资料");
  options.signal?.throwIfAborted();
  const buffer = await file.arrayBuffer();
  assertReferenceSignature(new Uint8Array(buffer), format.kind, format.mimeType);
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  options.signal?.throwIfAborted();
  const operationId = createId("parse");
  const reference = await db.transaction("rw", [db.projects, db.media, db.projectReferences], async () => {
    options.signal?.throwIfAborted();
    if (!(await db.projects.get(projectId))) throw new Error("项目已删除");
    const duplicate = await db.projectReferences.where("[projectId+digest]").equals([projectId, digest]).filter((row) => row.status !== "unavailable").first();
    if (duplicate) return duplicate;
    const mediaId = existingMediaId ?? createId("med");
    if (existingMediaId) {
      const media = await db.media.get(existingMediaId);
      if (!media || media.projectId !== projectId || media.blob.size !== file.size) throw new Error("图片已不可用");
    } else await db.media.add({ id: mediaId, projectId, filename: file.name, mimeType: format.mimeType, blob: new Blob([buffer], { type: format.mimeType }) });
    const at = nowIso();
    const row: ProjectReference = { ...format, id: createId("ref"), projectId, mediaId, digest, filename: file.name, size: file.size, revision: 1, operationId, status: "parsing", coverage: { totalUnits: 0, processedUnits: 0, emptyUnits: [], characters: 0, truncated: false }, warnings: [], createdAt: at, updatedAt: at };
    await db.projectReferences.add(row);
    await db.projects.update(projectId, { updatedAt: at });
    return row;
  });
  if (reference.operationId !== operationId) return reference;
  return finishImport(reference, buffer, options);
}

export function importReferenceFile(projectId: string, file: File, options: ReferenceImportOptions = {}): Promise<ProjectReference> {
  return importSource(projectId, file, options);
}

/** Import/reuse generated or business-owned pixels without duplicating its Blob. */
export async function registerProjectImage(projectId: string, mediaId: string, options: ReferenceImportOptions = {}): Promise<ProjectReference> {
  const media = await db.media.get(mediaId);
  if (!media || media.projectId !== projectId) throw new Error("图片不属于当前项目或已删除");
  const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  const ext = extensions[media.mimeType];
  if (!ext) throw new Error("当前仅支持 PNG、JPEG 和 WebP 图片");
  const filename = /\.(png|jpe?g|webp)$/i.test(media.filename) ? media.filename : `${media.filename}.${ext}`;
  return importSource(projectId, new File([media.blob], filename, { type: media.mimeType }), options, mediaId);
}

/** Explicitly recover an interrupted local parse; no network or model request. */
export async function retryReferenceImport(projectId: string, referenceId: string, options: ReferenceImportOptions = {}): Promise<ProjectReference> {
  const source = await db.transaction("r", [db.projects, db.projectReferences, db.media], async () => {
    const row = await db.projectReferences.get(referenceId);
    if (isStudioLibrary(projectId) || !(await db.projects.get(projectId)) || !row || row.projectId !== projectId || row.status === "unavailable") throw new Error("资料已不可用");
    const media = await db.media.get(row.mediaId);
    if (!media || media.projectId !== projectId) throw new Error("原始文件已不可用");
    return { row, media };
  });
  if (source.row.status === "ready" || source.row.status === "partial") return source.row;
  const buffer = await source.media.blob.arrayBuffer();
  options.signal?.throwIfAborted();
  const reference = await db.transaction("rw", [db.projects, db.projectReferences], async () => {
    const row = await db.projectReferences.get(referenceId);
    if (!row || row.status === "unavailable" || row.operationId !== source.row.operationId || !(await db.projects.get(projectId))) throw new Error("资料状态已变化，请刷新后重试");
    const next: ProjectReference = { ...row, status: "parsing", error: undefined, operationId: createId("parse"), updatedAt: nowIso() };
    await db.projectReferences.put(next); return next;
  });
  return finishImport(reference, buffer, options);
}
