import { z } from "zod";
import type { MusicGenerationReviewSnapshot } from "@/domain/agent";
import { musicSettingsSchema, musicWireInput } from "@/lib/audioGeneration/input";

export const MUSIC_REVIEW_MAX_BYTES = 128 * 1024;
const identity = z.string().min(1).max(512).refine(value => !/[\u0000-\u001f]/.test(value));
const schema = z.object({
  version: z.literal(1), projectId: identity, projectName: z.string().min(1).max(1000),
  draftId: identity, draftRevision: z.number().int().min(1).max(1e9),
  connectorId: identity, connectorLabel: z.string().min(1).max(1000), settings: musicSettingsSchema,
}).strict();

/** Pure persisted-data boundary: unknown fields, unsupported wire inputs and oversized text fail closed. */
export function parseMusicGenerationReview(value: unknown): MusicGenerationReviewSnapshot | undefined {
  try {
    const encoded = JSON.stringify(value);
    if (!encoded || new TextEncoder().encode(encoded).byteLength > MUSIC_REVIEW_MAX_BYTES) return undefined;
    const parsed = schema.parse(value);
    musicWireInput(parsed.settings);
    return parsed;
  } catch { return undefined; }
}
