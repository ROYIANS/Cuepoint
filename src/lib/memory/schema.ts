import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const memoryCategorySchema = z.enum([
  "convention",
  "preference",
  "decision",
  "lesson",
]);
export const memoryInputSchema = z
  .object({
    category: memoryCategorySchema,
    title: text(160),
    topicKey: text(200),
    body: text(8000),
    applicability: z.string().trim().max(2000),
    tags: z.array(text(40)).max(12),
  })
  .strict();
export const memorySourceRefSchema = z
  .object({
    taskId: text(160),
    summaryId: text(160),
    summaryRevision: z.number().int().positive(),
    itemKind: z.enum(["decision", "lesson"]),
    itemIndex: z.number().int().min(0).max(29),
    itemText: text(3000),
  })
  .strict();
const evidence = z
  .object({
    id: text(300),
    label: z.string().max(300),
    body: z.string().max(1200),
    truncated: z.boolean(),
  })
  .strict();
export const memorySourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }).strict(),
  memorySourceRefSchema
    .extend({
      kind: z.literal("summary"),
      projectId: text(160),
      threadId: text(160),
      taskTitle: text(160),
      confirmedAt: text(60),
      excerpt: z.string().max(3000),
      evidence: z.array(evidence).max(8),
    })
    .strict(),
  z
    .object({
      kind: z.literal("imported"),
      originProjectId: text(160),
      originMemoryId: text(160),
      originalKind: z.enum(["manual", "summary", "imported"]),
      excerpt: z.string().max(3000),
      evidence: z.array(evidence).max(8).optional(),
      taskTitle: z.string().max(160).optional(),
      summaryId: text(160).optional(),
      summaryRevision: z.number().int().positive().optional(),
    })
    .strict(),
]);
export const projectMemorySchema = memoryInputSchema
  .extend({
    id: text(160),
    projectId: text(160),
    status: z.enum(["active", "disabled", "superseded", "pending_review"]),
    revision: z.number().int().positive(),
    supersededBy: text(160).optional(),
    source: memorySourceSchema,
    createdAt: text(60),
    updatedAt: text(60),
    reviewedAt: text(60).optional(),
  })
  .strict();
export const projectMemoryVersionSchema = z
  .object({
    versionId: text(160),
    memoryId: text(160),
    projectId: text(160),
    revision: z.number().int().positive(),
    reason: text(300),
    snapshot: projectMemorySchema,
  })
  .strict();
export const normalizeMemoryText = (text: string) =>
  text.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
export function parseMemoryInput(raw: unknown) {
  const input = memoryInputSchema.parse(raw);
  return {
    ...input,
    topicKey: normalizeMemoryText(input.topicKey),
    tags: [...new Set(input.tags.map(normalizeMemoryText))],
  };
}
