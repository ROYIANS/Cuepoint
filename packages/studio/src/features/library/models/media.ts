import type {Id} from "../../../platform/identity";
import {z} from "zod";

const opaque = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/u);
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
/** Historical provenance only. These IDs do not restore a native directory grant. */
export const desktopImportProvenanceSchema = z.object({
    version: z.literal(1), importId: opaque, itemId: opaque, grantId: opaque, scanId: opaque,
    entryRevision: z.string().min(1).max(256), sourceHash: hash,
    thumbnail: z.object({preset: z.literal("thumbnail-v1"), contentHash: hash,
        width: z.number().int().positive().max(1920), height: z.number().int().positive().max(1080),
        atSeconds: z.number().finite().nonnegative().max(86400)}).strict(),
    decoder: z.object({name: z.literal("ffmpeg"), version: z.string().min(1).max(160)}).strict(),
}).strict();
export type DesktopImportProvenance = z.infer<typeof desktopImportProvenanceSchema>;

export interface MediaRecord {
    /** Explicit library adoption retained even before attachment to a slot. */
    libraryRetained?: boolean;
    thumbnailMediaId?: Id;
    /** A derivative belongs only to its source and is never an independent picker item. */
    derivative?: {kind: "video-thumbnail"; sourceMediaId: Id};
    source?: DesktopImportProvenance;
    id: Id;
    projectId: Id;
    mimeType: string;
    filename: string;
    blob: import("../../../platform/media/binaryTypes").BinaryContent;
}
