import type { GenerationResult, MediaKind, MediaRecord } from "@/domain/types";

export type ShotMediaIndex = ReadonlyMap<string, MediaRecord>;

/** A stored ID alone is not evidence that a deliverable exists. */
export function validShotMediaId(
  result: GenerationResult | undefined,
  kind: MediaKind,
  projectId: string,
  media: ShotMediaIndex,
): string | undefined {
  if (!result || result.kind !== kind) return undefined;
  const record = media.get(result.mediaId);
  return record && record.projectId === projectId && record.blob.size > 0 &&
    record.mimeType.startsWith(`${kind}/`)
    ? record.id
    : undefined;
}
