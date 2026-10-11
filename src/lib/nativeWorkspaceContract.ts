import { z } from "zod";
const id = z.string().min(1).max(4096);
const string = z.string().max(16384);
const filters = z
  .object({
    statuses: z
      .array(z.enum(["draft", "ready", "framed", "clipped", "approved"]))
      .max(5),
    beatIds: z.array(id).max(10000),
    gaps: z.array(z.enum(["missingFirstFrame", "missingClip"])).max(2),
  })
  .strict();
export const nativeProjectSchema = z.object({ id, title: string }).strict();
export const nativeVideoProjectSchema = z
  .object({
    projectId: id,
    mode: z.enum(["film", "series"]),
    kind: z.enum(["video", "audio", "music"]),
    aspectPreset: z.enum(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]),
    outputWidth: z.number().int().positive().max(10000),
    outputHeight: z.number().int().positive().max(10000),
    archivedAt: string.nullable(),
    createdAt: string,
    brief: string,
    genre: string,
    audience: string,
    tone: string,
    logline: string,
    updatedAt: string,
    columnSettings: z.object({ visible: z.array(z.string()).max(64) }).strict(),
    shotSettings: z
      .object({
        defaultDurationSec: z.number().finite().nonnegative().max(86400),
        autoIncrementShotNumber: z.boolean(),
        workspaceView: z.enum(["design", "media"]),
        filters,
      })
      .strict(),
  })
  .strict();
export const nativeEpisodeSchema = z
  .object({
    id,
    projectId: id,
    order: z.number().int().nonnegative(),
    title: string,
    logline: string,
    script: z.string().max(2000000),
    createdAt: string,
    updatedAt: string,
    shotFilters: filters,
  })
  .strict();
export const nativeBeatSchema = z
  .object({
    id,
    episodeId: id,
    order: z.number().int().nonnegative(),
    title: string,
    content: z.string().max(1000000),
    timeOfDay: string,
    characterIds: z.array(id).max(10000),
    sceneId: id.nullable(),
    scriptRange: z
      .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
        excerpt: z.string().max(1000000),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const nativeShotSchema = z
  .object({
    id,
    projectId: id,
    episodeId: id,
    order: z.number().int().nonnegative(),
    shotNumber: z.string().max(128),
    beatId: id.nullable(),
    status: z.enum(["draft", "ready", "framed", "clipped", "approved"]),
    durationSec: z.number().finite().nonnegative().max(86400),
    content: z.string().max(1000000),
    notes: z.string().max(1000000),
    sceneCloseup: string,
    sound: string,
    emotion: string,
    cameraAngle: string,
    cameraGear: string,
    focalLength: string,
    category: string,
    characterIds: z.array(id).max(10000),
    sceneId: id.nullable(),
    propIds: z.array(id).max(10000),
    styleId: id.nullable(),
  })
  .strict();
export const nativeAssetSchema = z
  .object({
    id,
    projectId: id,
    kind: z.enum(["media", "output"]),
    displayName: string,
    mimeType: string,
    byteLength: z
      .number()
      .int()
      .positive()
      .max(16 * 1024 ** 3),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    reference: z
      .object({
        workspaceId: id,
        projectId: id,
        relativePath: z.string().max(1024),
      })
      .strict(),
  })
  .strict();
export const nativeAvailabilitySchema = z
  .object({ assetId: id, status: z.enum(["present", "missing", "corrupt"]) })
  .strict();
export const nativeWorkspaceStateSchema = z
  .object({
    schema: z.literal(4),
    workspaceId: id,
    projects: z.array(nativeProjectSchema).max(10000),
    assets: z.array(nativeAssetSchema).max(10000),
    references: z
      .array(
        z
          .object({
            id,
            projectId: id,
            assetId: id,
            startSec: z.number().finite().nonnegative(),
            durationSec: z.number().finite().positive(),
          })
          .strict(),
      )
      .max(10000),
    sqliteVersion: z.string(),
    videoProjects: z.array(nativeVideoProjectSchema).max(10000),
    episodes: z.array(nativeEpisodeSchema).max(10000),
    beats: z.array(nativeBeatSchema).max(10000),
    shots: z.array(nativeShotSchema).max(10000),
  })
  .strict();
export const nativeVideoStateSchema = z
  .object({
    project: nativeProjectSchema,
    video: nativeVideoProjectSchema,
    episodes: z.array(nativeEpisodeSchema).max(10000),
    beats: z.array(nativeBeatSchema).max(10000),
    shots: z.array(nativeShotSchema).max(10000),
    referencedAssetIds: z.array(id).max(10000),
  })
  .strict();
export const nativeUndoSchema = z
  .object({ token: id, resource: string, ids: z.array(id).max(10000) })
  .strict();
export const nativeConflictSchema = z
  .object({
    resource: string,
    id,
    fields: z
      .array(
        z
          .object({
            field: string,
            current: z.string(),
            expected: z.string(),
            requested: z.string(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const nativeDuplicateBeatSchema = z
  .object({
    beat: nativeBeatSchema,
    shots: z.array(nativeShotSchema).max(10000),
    receipt: nativeUndoSchema,
  })
  .strict();
export const nativeDuplicateShotSchema = z
  .object({ shot: nativeShotSchema, receipt: nativeUndoSchema })
  .strict();
const nativeProductOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("state"), value: nativeWorkspaceStateSchema })
    .strict(),
  z.object({ kind: z.literal("project"), value: nativeProjectSchema }).strict(),
  z.object({ kind: z.literal("asset"), value: nativeAssetSchema }).strict(),
  z
    .object({
      kind: z.literal("availability"),
      value: z.array(nativeAvailabilitySchema).max(10000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("videoProject"),
      value: nativeVideoProjectSchema,
    })
    .strict(),
  z.object({ kind: z.literal("episode"), value: nativeEpisodeSchema }).strict(),
  z.object({ kind: z.literal("beat"), value: nativeBeatSchema }).strict(),
  z.object({ kind: z.literal("shot"), value: nativeShotSchema }).strict(),
  z
    .object({
      kind: z.literal("shots"),
      value: z.array(nativeShotSchema).max(10000),
    })
    .strict(),
  z
    .object({ kind: z.literal("videoState"), value: nativeVideoStateSchema })
    .strict(),
  z.object({ kind: z.literal("undo"), value: nativeUndoSchema }).strict(),
  z
    .object({
      kind: z.literal("duplicateBeat"),
      value: nativeDuplicateBeatSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("duplicateShot"),
      value: nativeDuplicateShotSchema,
    })
    .strict(),
  z
    .object({ kind: z.literal("conflict"), value: nativeConflictSchema })
    .strict(),
]);
const nativeProductResultSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("state"),
      value: nativeWorkspaceStateSchema.nullable(),
    })
    .strict(),
  z
    .object({ type: z.literal("outcome"), value: nativeProductOutcomeSchema })
    .strict(),
  z.object({ type: z.literal("canceled") }).strict(),
  z.object({ type: z.literal("closed") }).strict(),
]);
export const nativeProductReplySchema = z
  .object({
    version: z.literal(1),
    generation: z.number().int().nonnegative(),
    result: nativeProductResultSchema,
  })
  .strict();
export type NativeProject = z.infer<typeof nativeProjectSchema>;
export type NativeVideoProject = z.infer<typeof nativeVideoProjectSchema>;
export type NativeEpisode = z.infer<typeof nativeEpisodeSchema>;
export type NativeBeat = z.infer<typeof nativeBeatSchema>;
export type NativeShot = z.infer<typeof nativeShotSchema>;
export type NativeAsset = z.infer<typeof nativeAssetSchema>;
export type NativeAvailability = z.infer<typeof nativeAvailabilitySchema>;
export type NativeWorkspaceState = z.infer<typeof nativeWorkspaceStateSchema>;
export type NativeVideoWorkspaceState = z.infer<typeof nativeVideoStateSchema>;
export type NativeUndoReceipt = z.infer<typeof nativeUndoSchema>;
export type NativeResult = z.infer<typeof nativeProductResultSchema>;
