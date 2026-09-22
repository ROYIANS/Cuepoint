import { z } from "zod";

export const WRITE_ENTITY_KINDS = [
  "project", "episode", "beat", "shot", "character", "scene", "prop", "style",
  "audio_chapter", "audio_speaker", "audio_segment", "audio_track", "audio_clip",
  "music_draft", "music_work",
] as const;

const entrySchema = z.object({
  kind: z.enum(WRITE_ENTITY_KINDS),
  operation: z.enum(["created", "updated", "deleted"]),
  id: z.string().min(1).max(200),
  ownerId: z.string().min(1).max(200),
  revision: z.union([z.string().min(1).max(200), z.number().int().nonnegative()]).optional(),
  label: z.string().max(160),
}).strict();
const receiptSchema = z.object({
  version: z.literal(1),
  coverage: z.literal("direct_targets"),
  entries: z.array(entrySchema).min(1).max(40),
}).strict();

export type WriteReceiptEntry = z.infer<typeof entrySchema>;
export type WriteReceipt = z.infer<typeof receiptSchema>;

/** Called only by tool-owned code, inside the business + result transaction. */
export function createWriteReceipt(entries: WriteReceiptEntry[]): WriteReceipt {
  return receiptSchema.parse({ version: 1, coverage: "direct_targets", entries });
}

/** Historical payloads need validation, even when produced by a trusted local tool. */
export function readWriteReceipt(value: unknown): WriteReceipt | undefined {
  const parsed = receiptSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
