import type { MediaKind, MediaRecord } from "@/domain/types";

export function reusableMedia(records: MediaRecord[], ownerId: string, kinds: readonly MediaKind[], query = ""): MediaRecord[] {
  const needle = query.trim().toLocaleLowerCase();
  return records.filter((record) => record.projectId === ownerId && record.blob.size > 0 &&
    kinds.some((kind) => record.mimeType.startsWith(`${kind}/`)) &&
    (!needle || record.filename.toLocaleLowerCase().includes(needle)));
}
