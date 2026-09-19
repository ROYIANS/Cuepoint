import { db } from "./database";
import { deleteMediaIfOrphan, PRODUCTION_TABLES } from "./repo";
import type { ProjectReference, ReferenceAttachment, ReferenceChunk } from "@/domain/references";
import { isStudioLibrary } from "@/domain/types";
import { nowIso } from "@/lib/ids";

export async function listProjectReferences(projectId: string): Promise<ProjectReference[]> {
  if (isStudioLibrary(projectId) || !(await db.projects.get(projectId))) return [];
  return (await db.projectReferences.where("projectId").equals(projectId).toArray())
    .filter((row) => row.status !== "unavailable").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Single read snapshot: no foreign bytes, withdrawn sources or changing revisions. */
export async function getReferenceSource(projectId: string, attachment: ReferenceAttachment) {
  return db.transaction("r", [db.projects, db.projectReferences, db.referenceChunks, db.media], async () => {
    if (isStudioLibrary(projectId) || !(await db.projects.get(projectId))) throw new Error("项目不存在");
    const reference = await db.projectReferences.get(attachment.referenceId);
    if (!reference || reference.projectId !== projectId || reference.status === "unavailable") throw new Error("参考资料已移除或不属于当前项目");
    if (reference.revision !== attachment.revision) throw new Error("参考资料版本已变化，请重新附加");
    if (reference.status !== "ready" && reference.status !== "partial") throw new Error("参考资料尚未解析完成，请重试解析");
    const media = await db.media.get(reference.mediaId);
    if (!media || media.projectId !== projectId) throw new Error("参考资料原始文件已不可用");
    const chunks = (await db.referenceChunks.where("referenceId").equals(reference.id).toArray())
      .filter((chunk) => chunk.projectId === projectId && chunk.revision === attachment.revision)
      .sort((a, b) => a.index - b.index);
    return { reference, chunks, media };
  });
}

export async function readProjectReference(projectId: string, attachment: ReferenceAttachment, options: { start?: number; limit?: number; maxChars?: number } = {}) {
  const source = await getReferenceSource(projectId, attachment);
  const { start = 0, limit = 8, maxChars = 16_000 } = options;
  if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 20 || !Number.isSafeInteger(maxChars) || maxChars < 1 || maxChars > 32_000) throw new Error("资料读取范围无效");
  const chunks: ReferenceChunk[] = [];
  let remaining = maxChars;
  for (const chunk of source.chunks.slice(start, start + limit)) {
    // Never silently truncate a chunk: a caller can ask for the next whole chunk.
    if (chunk.text.length > remaining) break;
    chunks.push(chunk); remaining -= chunk.text.length;
  }
  return { reference: source.reference, chunks, totalChunks: source.chunks.length, hasMore: start + chunks.length < source.chunks.length };
}

export async function searchProjectReferences(projectId: string, query: string, limit = 10) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 30 || query.length > 500) throw new Error("搜索参数无效");
  return db.transaction("r", [db.projects, db.projectReferences, db.referenceChunks], async () => {
    if (isStudioLibrary(projectId) || !(await db.projects.get(projectId))) throw new Error("项目不存在");
    const references = (await db.projectReferences.where("projectId").equals(projectId).toArray()).filter((row) => row.status === "ready" || row.status === "partial");
    const needle = query.trim().toLocaleLowerCase();
    const results: Array<{ reference: ProjectReference; excerpt: string; chunkIndex?: number }> = [];
    for (const reference of references) {
      const chunks = await db.referenceChunks.where("referenceId").equals(reference.id).toArray();
      const chunk = chunks.find((part) => part.projectId === projectId && part.revision === reference.revision && part.text.toLocaleLowerCase().includes(needle));
      if (needle && !reference.filename.toLocaleLowerCase().includes(needle) && !chunk) continue;
      const at = chunk?.text.toLocaleLowerCase().indexOf(needle) ?? 0;
      results.push({ reference, excerpt: chunk?.text.slice(Math.max(0, at - 80), Math.max(0, at - 80) + 400) ?? "", chunkIndex: chunk?.index });
      if (results.length >= limit) break;
    }
    return results;
  });
}

export async function removeProjectReference(projectId: string, referenceId: string): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const reference = await db.projectReferences.get(referenceId);
    if (!reference || reference.projectId !== projectId) throw new Error("参考资料不属于当前项目");
    if (reference.status === "unavailable") return;
    await db.projectReferences.put({ ...reference, status: "unavailable", operationId: "removed", updatedAt: nowIso() });
    await db.referenceChunks.where("referenceId").equals(referenceId).delete();
    await deleteMediaIfOrphan(reference.mediaId);
  });
}
