import type { GenerationSlot, Id, MediaKind } from "./types";

export function emptySlot(): GenerationSlot {
  return {
    prompt: "",
    referenceImageIds: [],
    referenceVideoIds: [],
  };
}

export function parseGenerationSlot(
  raw: unknown,
  legacyMediaId?: unknown,
): GenerationSlot {
  const slot = emptySlot();
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    slot.prompt = String(record.prompt ?? "");
    slot.referenceImageIds = Array.isArray(record.referenceImageIds)
      ? record.referenceImageIds.map(String)
      : [];
    slot.referenceVideoIds = Array.isArray(record.referenceVideoIds)
      ? record.referenceVideoIds.map(String)
      : [];
    const result = record.result as
      | { mediaId?: unknown; kind?: unknown }
      | undefined;
    if (result?.mediaId) {
      slot.result = {
        mediaId: String(result.mediaId),
        kind: result.kind === "video" ? "video" : "image",
      };
    }
  }
  if (!slot.result && legacyMediaId) {
    slot.result = { mediaId: String(legacyMediaId), kind: "image" };
  }
  return slot;
}

export function slotMediaIds(slot: GenerationSlot | undefined): Id[] {
  if (!slot) return [];
  const ids = [...slot.referenceImageIds, ...slot.referenceVideoIds];
  if (slot.result?.mediaId) ids.push(slot.result.mediaId);
  return ids;
}

export function collectSlotsMedia(slots: Array<GenerationSlot | undefined>): Id[] {
  return slots.flatMap(slotMediaIds);
}

export function remapSlot(
  slot: GenerationSlot,
  mapMedia: (id?: string) => string | undefined,
): GenerationSlot {
  const referenceImageIds = slot.referenceImageIds
    .map((id) => mapMedia(id))
    .filter((id): id is string => Boolean(id));
  const referenceVideoIds = slot.referenceVideoIds
    .map((id) => mapMedia(id))
    .filter((id): id is string => Boolean(id));
  const resultId = mapMedia(slot.result?.mediaId);
  return {
    prompt: slot.prompt,
    referenceImageIds,
    referenceVideoIds,
    result:
      resultId && slot.result
        ? { mediaId: resultId, kind: slot.result.kind }
        : undefined,
  };
}

export function kindFromMime(mimeType: string): MediaKind {
  return mimeType.startsWith("video/") ? "video" : "image";
}

export function slotHasBody(slot: GenerationSlot | undefined): boolean {
  if (!slot) return false;
  return Boolean(
    slot.prompt.trim() ||
      slot.referenceImageIds.length ||
      slot.referenceVideoIds.length,
  );
}

export function firstResultId(
  slots: Array<GenerationSlot | undefined>,
): Id | undefined {
  return slots.find((slot) => slot?.result?.mediaId)?.result?.mediaId;
}
