/** Immutable source identity. Re-parsing failed work cannot change a ready revision. */
export interface ReferenceAttachment { referenceId: string; revision: number }
export type ReferenceKind = "image" | "text" | "pdf" | "docx";
export type ReferenceStatus = "parsing" | "ready" | "partial" | "failed" | "unavailable";
export interface ReferenceCoverage {
  totalUnits: number;
  processedUnits: number;
  emptyUnits: number[];
  characters: number;
  truncated: boolean;
}
export interface ProjectReference {
  id: string; projectId: string; mediaId: string; digest: string;
  kind: ReferenceKind; filename: string; mimeType: string; size: number;
  revision: number; status: ReferenceStatus; operationId: string;
  coverage: ReferenceCoverage; warnings: string[]; error?: string;
  createdAt: string; updatedAt: string;
}
export interface ReferenceLocator { kind: "page" | "lines" | "paragraph"; start: number; end: number }
export interface ReferenceChunk {
  id: string; projectId: string; referenceId: string; revision: number;
  index: number; text: string; locator: ReferenceLocator;
}
export interface ParsedReference {
  chunks: Array<Pick<ReferenceChunk, "index" | "text" | "locator">>;
  coverage: ReferenceCoverage;
  warnings: string[];
}
export const REFERENCE_LIMITS = {
  selection: 10, imageBytes: 10 * 1024 * 1024, textBytes: 5 * 1024 * 1024,
  documentBytes: 20 * 1024 * 1024, pages: 300, characters: 1_000_000,
  chunkCharacters: 4000, decompressedBytes: 64 * 1024 * 1024,
  zipEntries: 4096, sourceUnits: 100_000, workerTimeoutMs: 60_000,
} as const;
export const REFERENCE_ACCEPT = ".png,.jpg,.jpeg,.webp,.txt,.md,.markdown,.pdf,.docx";
export function referenceAttachment(reference: ProjectReference): ReferenceAttachment {
  return { referenceId: reference.id, revision: reference.revision };
}
export function referenceLocatorLabel(locator: ReferenceLocator): string {
  const unit = locator.kind === "page" ? "页" : locator.kind === "lines" ? "行" : "段";
  return `第 ${locator.start}${locator.end === locator.start ? "" : `–${locator.end}`} ${unit}`;
}
