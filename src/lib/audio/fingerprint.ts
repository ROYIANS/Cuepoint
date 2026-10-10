import {z} from "zod";
import type {AudioExport} from "@/domain/audio";
import {type AudioSchedule, type AudioScheduleInput, buildAudioSchedule} from "@/lib/audio/schedule";

const id = z.string().min(1);
const seconds = z.number().finite().nonnegative();
const positiveInteger = z.number().finite().int().positive();
const sourceFields = {
    id, mediaId: id, durationSec: seconds.positive(), sampleRate: positiveInteger, channels: positiveInteger
};
const provenanceSchema = z.object({
    provider: z.enum(["apimart", "mimo"]), model: z.string(), taskId: z.string().optional(),
    clipId: z.string().optional(), audioIndex: positiveInteger.optional(), jobId: id.optional(),
    audioUrl: z.string().optional(), coverUrl: z.string().optional()
}).strict();
// v0 used both minimal scheduling inputs and full persisted AudioTake rows.
// Strict schemas retain every known field and refuse to discard future metadata.
const fullSourceSchema = z.object({
    ...sourceFields, projectId: id, revision: positiveInteger,
    createdAt: z.string(), updatedAt: z.string(), segmentId: id.optional(), name: z.string(),
    source: z.enum(["recording", "upload", "library", "tts", "music"]),
    textSnapshot: z.string().optional(), provenance: provenanceSchema.optional()
}).strict();
const scheduleSchema = z.object({
    clips: z.array(z.object({
        clipId: id, mediaId: id, startSec: seconds, offsetSec: seconds, durationSec: seconds.positive(),
        envelope: z.array(z.object({time: seconds, gain: seconds}).strict()).min(2)
    }).strict()),
    durationSec: seconds,
    sources: z.array(z.union([fullSourceSchema, z.object(sourceFields).strict()])),
    chapterOffsets: z.record(id, seconds)
}).strict();
const versionedSchema = z.object({
    version: z.literal(1), schedule: scheduleSchema,
    // Import can remove optional references from source rows. Keep the original
    // stale verdict even if that lossy repair would make the schedules coincide.
    stale: z.literal(true).optional()
}).strict();
const fingerprintSchema = z.union([versionedSchema, scheduleSchema]);
type ParsedFingerprint = Omit<z.infer<typeof versionedSchema>, "version">;
type ExportScope = Pick<AudioExport, "fingerprint" | "chapterId" | "scope">;
export type AudioExportFreshness = "current" | "stale" | "unknown";

function canonicalJson(value: unknown): string {
    return JSON.stringify(value, (_key, item: unknown) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        return Object.fromEntries(Object.entries(item as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right)));
    });
}

function readFingerprint(fingerprint: string): ParsedFingerprint | undefined {
    try {
        const parsed = fingerprintSchema.safeParse(JSON.parse(fingerprint) as unknown);
        if (!parsed.success) return undefined;
        return "version" in parsed.data ? parsed.data : {schedule: parsed.data};
    } catch {
        return undefined;
    }
}

export function createAudioExportFingerprint(schedule: AudioSchedule): string {
    return canonicalJson({version: 1, schedule});
}

export function getAudioExportFreshness(item: ExportScope, snapshot: AudioScheduleInput): AudioExportFreshness {
    const parsed = readFingerprint(item.fingerprint);
    if (!parsed) return "unknown";
    if (parsed.stale || (item.scope === "chapter" && !item.chapterId)) return "stale";
    try {
        return canonicalJson(parsed.schedule) === canonicalJson(buildAudioSchedule(snapshot, item.chapterId))
            ? "current" : "stale";
    } catch {
        return "stale";
    }
}

/** Preserve history before a package allowlist removes newer source metadata. */
export function preserveAudioExportFreshness(item: ExportScope, snapshot: AudioScheduleInput): string {
    const parsed = readFingerprint(item.fingerprint);
    if (!parsed || getAudioExportFreshness(item, snapshot) !== "stale") return item.fingerprint;
    return canonicalJson({version: 1, schedule: parsed.schedule, stale: true});
}

interface FingerprintIdMaps {
    records: ReadonlyMap<string, string>;
    media: ReadonlyMap<string, string>;
    projectId: string;
}

/** Only recognized schedules are remapped; historical missing IDs stay evidence. */
export function remapAudioExportFingerprint(
    item: ExportScope & Pick<AudioExport, "projectId">,
    snapshot: AudioScheduleInput,
    maps: FingerprintIdMaps
): string {
    const parsed = readFingerprint(item.fingerprint);
    if (!parsed) return item.fingerprint;
    const stale = getAudioExportFreshness(item, snapshot) !== "current";
    const recordId = (value: string) => maps.records.get(value) ?? value;
    const mediaId = (value: string) => maps.media.get(value) ?? value;
    const schedule = parsed.schedule;
    for (const clip of schedule.clips) {
        clip.clipId = recordId(clip.clipId);
        clip.mediaId = mediaId(clip.mediaId);
    }
    for (const source of schedule.sources) {
        source.id = recordId(source.id);
        source.mediaId = mediaId(source.mediaId);
        if (!("projectId" in source)) continue;
        if (source.projectId === item.projectId) source.projectId = maps.projectId;
        if (source.segmentId) source.segmentId = recordId(source.segmentId);
        // Mirror the package's existing optional provenance reference repair.
        if (source.provenance?.jobId) source.provenance.jobId = maps.records.get(source.provenance.jobId);
    }
    schedule.chapterOffsets = Object.fromEntries(Object.entries(schedule.chapterOffsets)
        .map(([chapterId, offset]) => [recordId(chapterId), offset]));
    return canonicalJson({version: 1, schedule, ...(stale ? {stale: true} : {})});
}
