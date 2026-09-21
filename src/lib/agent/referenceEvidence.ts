import { REFERENCE_TOOL_NAMES } from "./referenceToolNames";
import { projectImageSources } from "@/domain/imageDiscovery";
import { db } from "@/db/database";
import type { ReferenceAttachment } from "@/domain/references";
import type { WrapupEvidence } from "@/domain/agentTaskWrapup";

/** Only interpret the code-owned reference envelope, never IDs found in prose. */
export function toolReferenceAttachments(result: string | undefined, projectId: string): ReferenceAttachment[] {
  try {
    const value = JSON.parse(result ?? "null");
    const input = value?.referenceInput;
    if (input?.projectId !== projectId || !Array.isArray(input.references)) return [];
    return input.references.filter((item: unknown): item is ReferenceAttachment => {
      if (!item || typeof item !== "object") return false;
      const ref = item as Record<string, unknown>;
      return typeof ref.referenceId === "string" && ref.referenceId.length > 0 && ref.referenceId.length <= 120 && Number.isSafeInteger(ref.revision) && Number(ref.revision) > 0;
    });
  } catch { return []; }
}

/** Caller supplies a consistent transaction; blob reads and parsing never run here. */
export async function collectReferenceEvidence(projectId: string, attachments: readonly ReferenceAttachment[]) {
  const unique = [...new Map(attachments.map(item => [`${item.referenceId}:${item.revision}`, item])).values()];
  const rows = await db.projectReferences.bulkGet(unique.map(item => item.referenceId));
  const media = await db.media.bulkGet(rows.map(row => row?.projectId === projectId ? row.mediaId : ""));
  return unique.map((attachment, index) => {
    const row = rows[index]?.projectId === projectId ? rows[index] : undefined;
    const bytes = media[index]?.projectId === projectId ? media[index] : undefined;
    const available = !!row && row.revision === attachment.revision && (row.status === "ready" || row.status === "partial") && !!bytes;
    const evidence: WrapupEvidence = {
      id: `reference:${attachment.referenceId}:${attachment.revision}`, kind: "reference",
      label: row?.filename ?? "原参考资料已不可用", outcome: available ? "fact" : "unresolved", available,
      reference: { projectId, ...attachment },
      body: available ? JSON.stringify({ filename: row.filename, revision: row.revision, kind: row.kind, coverage: row.coverage, warnings: row.warnings, note: "来源可用仅证明原资料存在；不代表模型已读完或结论已核实。" }) : "原参考资料已移除、版本变化或不再属于当前项目。",
    };
    return { evidence, fingerprint: { attachment, source: row ?? null, media: bytes ? { id: bytes.id, mimeType: bytes.mimeType, size: bytes.blob.size } : null } };
  });
}

/** Summary preparation needs evidence of the read, not another copy of cached source prose. */
export function referenceToolSummary(name: string, result: string | undefined, projectId: string): Record<string, unknown> | undefined {
  if (!REFERENCE_TOOL_NAMES.some((candidate) => candidate === name)) return undefined;
  let value: Record<string, unknown>;
  try { const parsed: unknown = JSON.parse(result ?? "null"); value = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; }
  catch { value = {}; }
  const references = toolReferenceAttachments(result, projectId);
  const raw = value.referenceInput;
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const owned = input.projectId === projectId;
  const coverage = owned && Array.isArray(input.coverage) ? input.coverage.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    if (!references.some((reference) => reference.referenceId === row.referenceId && reference.revision === row.revision)) return [];
    return [{ referenceId: row.referenceId, revision: row.revision, kind: row.kind, includedChunkIndices: row.includedChunkIndices, totalChunks: row.totalChunks, includedCharacters: row.includedCharacters, partial: row.partial }];
  }) : [];
  const images = owned && Array.isArray(input.images) ? input.images.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    return row.projectId === projectId && typeof row.mediaId === "string" ? [{ mediaId: row.mediaId, mimeType: row.mimeType, size: row.size }] : [];
  }) : [];
  return {
    kind: "historical_reference_read",
    projectId, references, coverage, images,
    imageSources: projectImageSources(name, result).filter((source) => source.projectId === projectId).map(({ id, projectId, entityKind, entityId, episodeId, slot, source, mediaId, revision }) => ({ id, projectId, entityKind, entityId, episodeId, slot, source, mediaId, revision })),
    ...(typeof value.status === "string" ? { status: value.status } : {}),
    note: "此处仅记录当时查找或读取的来源身份与覆盖范围，不重放资料正文或图片像素。来源当前是否可用请以独立资料证据为准；读取不代表结论已核实。",
  };
}

/** Historical source lookups may contain pre-fix nested cached reference bodies.
 * Re-read their source using current tools instead of recursively trusting old JSON/prose. */
export function historicalToolSummary(name: string, result: string | undefined, projectId: string): Record<string, unknown> | undefined {
  if (name === "material_read_text" || name === "material_read_image") {
    let value: Record<string, unknown> = {};
    try { const parsed: unknown = JSON.parse(result ?? "null"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed as Record<string, unknown>; } catch { /* Legacy invalid read has no reliable identity. */ }
    return { kind: "historical_material_read", materialId: value.materialId, revision: value.revision, partial: value.partial, nextStart: value.nextStart, extractionCoverage: value.extractionCoverage, note: "只保留当时读取身份和范围，不重放素材正文或像素。请用当前素材工具重新读取，校验现有归属、归档状态与版本。" };
  }
  const reference = referenceToolSummary(name, result, projectId);
  if (reference) return reference;
  if (name === "task_read" || name === "project_history_read") return {
    kind: "historical_source_lookup", tool: name,
    note: "历史来源查询的缓存正文不重放；请使用当前任务或项目来源工具重新读取，并重新校验资料可用性。",
  };
  return undefined;
}

/** Upgrade only pre-fix source-lookup outputs at transport time; the immutable
 * ledger and authored user/assistant messages remain untouched. */
export function safeHistoricalLookupOutput(name: string | undefined, output: string): string {
  if (name !== "task_read" && name !== "project_history_read") return output;
  try {
    const value: unknown = JSON.parse(output);
    if (value && typeof value === "object" && "sourceProjectionVersion" in value && value.sourceProjectionVersion === 1) return output;
  } catch { /* Old opaque lookups cannot certify their source projection. */ }
  return JSON.stringify(historicalToolSummary(name, output, ""));
}
