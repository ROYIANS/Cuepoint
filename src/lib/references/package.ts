import { z } from "zod";
import type { ProjectReference, ReferenceChunk } from "@/domain/references";
import { REFERENCE_LIMITS as LIMITS } from "@/domain/references";
import type { MediaRecord } from "@/domain/types";
import { createId } from "@/lib/ids";
import { assertReferenceSignature, identifyReference } from "./parse";
const integer = z.number().int().nonnegative();
const coverage = z.object({ totalUnits: integer, processedUnits: integer, emptyUnits: z.array(z.number().int().positive()).max(LIMITS.pages), characters: integer.max(LIMITS.characters), truncated: z.boolean() });
const referenceSchema = z.object({
  id: z.string().min(1), projectId: z.string().min(1), mediaId: z.string().min(1), digest: z.string().regex(/^[a-f0-9]{64}$/),
  filename: z.string().min(1).max(1000), mimeType: z.string(), kind: z.enum(["image", "text", "pdf", "docx"]),
  size: integer.max(LIMITS.documentBytes), revision: z.number().int().positive(), operationId: z.string(),
  status: z.enum(["parsing", "ready", "partial", "failed", "unavailable"]), coverage,
  warnings: z.array(z.string().max(4000)).max(100), error: z.string().max(4000).optional(), createdAt: z.string(), updatedAt: z.string(),
});
const chunkSchema = z.object({ id: z.string().min(1), projectId: z.string().min(1), referenceId: z.string().min(1), revision: z.number().int().positive(), index: integer,
  text: z.string().max(LIMITS.chunkCharacters), locator: z.object({ kind: z.enum(["page", "lines", "paragraph"]), start: z.number().int().positive(), end: z.number().int().positive() }),
});
export function parseReferencePackage(rawRows: unknown, rawChunks: unknown, projectId: unknown) {
  const references = z.array(referenceSchema).parse(rawRows ?? []);
  const chunks = z.array(chunkSchema).parse(rawChunks ?? []);
  const byId = new Map(references.map((row) => [row.id, row]));
  const fail = () => { throw new Error("参考资料归属、正文或版本不一致"); };
  if (byId.size !== references.length || new Set(chunks.map((chunk) => chunk.id)).size !== chunks.length) fail();
  for (const row of references) {
    if (row.projectId !== projectId || projectId === "studio" || row.coverage.processedUnits > row.coverage.totalUnits) fail();
    if (row.coverage.emptyUnits.some((unit) => unit > row.coverage.totalUnits)) fail();
    const parts = chunks.filter((part) => part.referenceId === row.id).sort((a, b) => a.index - b.index);
    if (parts.some((part, i) => part.index !== i || part.revision !== row.revision || part.projectId !== projectId || part.locator.end < part.locator.start || part.locator.end > row.coverage.totalUnits || part.locator.kind !== (row.kind === "pdf" ? "page" : row.kind === "docx" ? "paragraph" : "lines"))) fail();
    const textCharacters = parts.reduce((sum, part) => sum + part.text.length, 0);
    if (textCharacters > LIMITS.characters) fail();
    if (row.status === "ready" || row.status === "partial") {
      if (textCharacters !== row.coverage.characters) fail();
      if (!row.coverage.truncated && row.coverage.processedUnits !== row.coverage.totalUnits) fail();
      const incomplete = row.coverage.truncated || row.kind === "pdf" && row.coverage.emptyUnits.length > 0;
      if ((row.status === "partial") !== incomplete) fail();
    }
    if (new Set(row.coverage.emptyUnits).size !== row.coverage.emptyUnits.length || row.kind !== "pdf" && row.coverage.emptyUnits.length > 0) fail();
    if ((row.status === "unavailable" || row.status === "failed" || row.status === "parsing" || row.kind === "image") && parts.length) fail();
  }
  if (chunks.some((part) => !byId.has(part.referenceId))) fail();
  return { references, chunks };
}

/** All blob verification happens before opening the import transaction. */
export async function remapReferencePackage(input: ReturnType<typeof parseReferencePackage>, projectId: string, mediaMap: Map<string, string>, media: MediaRecord[]) {
  const ids = new Map(input.references.map((row) => [row.id, createId("ref")]));
  const references: ProjectReference[] = [];
  for (const row of input.references) {
    const mediaId = mediaMap.get(row.mediaId);
    if (row.status !== "unavailable") {
      const record = media.find((entry) => entry.id === mediaId);
      if (!record || record.blob.size !== row.size) throw new Error("参考资料缺少原始文件或大小不符");
      const format = identifyReference({ name: row.filename, size: row.size });
      if (format.kind !== row.kind || format.mimeType !== row.mimeType) throw new Error("参考资料文件类型不一致");
      const bytes = await record.blob.arrayBuffer();
      assertReferenceSignature(new Uint8Array(bytes), row.kind, row.mimeType);
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (digest !== row.digest) throw new Error("参考资料原始文件校验失败");
      record.filename = row.filename; record.mimeType = row.mimeType;
      record.blob = new Blob([bytes], { type: row.mimeType });
    }
    references.push({ ...row, id: ids.get(row.id)!, projectId, mediaId: mediaId ?? createId("unavailable"), operationId: createId("import"),
      ...(row.status === "parsing" ? { status: "failed", error: "导入前解析尚未完成，请重试解析" } : {}) });
  }
  const chunks: ReferenceChunk[] = input.chunks.map((part) => ({ ...part, id: createId("rfc"), projectId, referenceId: ids.get(part.referenceId)! }));
  return { references, chunks };
}
