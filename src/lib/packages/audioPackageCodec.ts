import {z} from "zod";
import type {ProjectKind} from "@/domain/types";
import type {AudioTaskObservation} from "@/domain/audioGeneration";
import {validateAudioTaskObservations} from "@/lib/audioGeneration/observations";
import {mimoSpeechSettingsSchema} from "@/lib/audioGeneration/input";
import {createId} from "@/lib/ids";
import {preserveAudioExportFreshness, remapAudioExportFingerprint} from "@/lib/audio/fingerprint";
import {createAudioArrangementPackageSchema, remapAudioArrangementHistory} from "./audioArrangementCodec";

const id = z.string().min(1);
const number = z.number().finite();
const base = {id, projectId: id, revision: number.int().positive(), createdAt: z.string(), updatedAt: z.string()};
const meta = {durationSec: number.positive(), sampleRate: number.int().positive(), channels: number.int().positive()};
const provenance = z.object({
    provider: z.enum(["apimart", "mimo"]),
    model: z.string(),
    taskId: z.string().optional(),
    clipId: z.string().optional(),
    audioIndex: number.int().positive().optional(),
    jobId: id.optional(),
    audioUrl: z.string().optional(),
    coverUrl: z.string().optional()
});
const settings = z.discriminatedUnion("engine", [
    z.object({
        engine: z.literal("flowmusic"),
        soundPrompt: z.string(),
        lyrics: z.string(),
        title: z.string(),
        bpm: z.string().optional(),
        lengthSec: number.optional(),
        seed: z.string().optional()
    }),
    z.object({
        engine: z.literal("suno"),
        version: z.enum(["v6", "v6-wild", "v6-mini"]),
        custom: z.boolean(),
        instrumental: z.boolean(),
        prompt: z.string(),
        title: z.string(),
        style: z.string(),
        negativeTags: z.string(),
        durationSec: number.optional()
    }),
]);
const input = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("speech"),
        text: z.string(),
        voice: z.string(),
        speed: number,
        mimo: mimoSpeechSettingsSchema.optional(),
        segmentId: id.optional(),
        segmentRevision: number.optional()
    }),
    z.object({kind: z.literal("music"), settings, draftId: id.optional(), draftRevision: number.optional()}),
]);
const batchSource = z.object({kind: z.literal("batch"), batchId: id, itemId: id, owner: z.object({kind: z.literal("manual")})});
const speechSnapshot = z.object({
    input: input.options[0], connector: z.object({id, provider: z.enum(["apimart", "mimo"]), baseUrl: z.string()}),
    speakerId: id.optional(), speakerRevision: number.optional(), fingerprint: z.string(), referenceFingerprint: z.string().optional()
});
/** Explicit allowlist: credentials, chat permission data and live claims cannot travel. */
const segmentSchema = z.object({
        ...base,
        chapterId: id,
        speakerId: id.optional(),
        order: number,
        text: z.string(),
        notes: z.string(),
        selectedTakeId: id.optional()
    });
const takeSchema = z.object({
        ...base, ...meta,
        segmentId: id.optional(),
        mediaId: id,
        name: z.string(),
        source: z.enum(["recording", "upload", "library", "tts", "music"]),
        textSnapshot: z.string().optional(),
        provenance: provenance.optional()
    });
const clipSchema = z.object({
        ...base,
        chapterId: id,
        trackId: id,
        takeId: id,
        startSec: number,
        trimStartSec: number,
        trimEndSec: number,
        gain: number,
        fadeInSec: number,
        fadeOutSec: number
    });
const schemas = {
    audioChapters: z.object({...base, title: z.string(), order: number}),
    audioSpeakers: z.object({
        ...base,
        name: z.string(),
        voice: z.string().optional(),
        speed: number.optional(),
        mimo: mimoSpeechSettingsSchema.optional()
    }),
    audioSegments: segmentSchema,
    audioTakes: takeSchema,
    audioTracks: z.object({
        ...base,
        chapterId: id,
        role: z.enum(["voice", "music", "effects"]),
        name: z.string(),
        order: number,
        gain: number,
        muted: z.boolean(),
        solo: z.boolean()
    }),
    audioClips: clipSchema,
    audioExports: z.object({
        ...base,
        chapterId: id.optional(),
        scope: z.enum(["chapter", "project"]).optional(),
        chapterTitle: z.string().optional(),
        fingerprint: z.string(),
        format: z.literal("wav"),
        mediaId: id,
        durationSec: number
    }),
    musicDrafts: z.object({...base, settings}),
    musicWorks: z.object({
        ...base, ...meta,
        mediaId: id,
        title: z.string(),
        notes: z.string(),
        favorite: z.boolean(),
        lyrics: z.string(),
        settings: settings.optional(),
        provenance: provenance.optional()
    }),
    audioGenerationJobs: z.object({
        ...base,
        intentId: id,
        input,
        connector: z.object({id, provider: z.enum(["apimart", "mimo"]), baseUrl: z.string()}),
        source: z.union([z.object({kind: z.literal("manual")}), batchSource]),
        status: z.enum(["prepared", "submitting", "uncertain", "submitted", "running", "remote-completed", "downloading", "saved", "failed", "target-conflict"]),
        taskIds: z.array(z.string()),
        taskObservations: z.custom<AudioTaskObservation[]>().optional(),
        results: z.array(z.object({
            key: id,
            provenance,
            title: z.string(),
            lyrics: z.string().optional(),
            finalTextPreview: z.string().optional(),
            durationSec: number.optional(),
            mediaId: id.optional(),
            takeId: id.optional(),
            workId: id.optional(),
            deleted: z.boolean().optional(),
            error: z.string().optional()
        })),
        error: z.string().optional(),
        failureStage: z.enum(["preflight", "provider"]).optional(),
        dormant: z.literal(true)
    }),
    audioGenerationBatches: z.object({
        ...base, version: z.literal(1), chapterId: id, title: z.string(), owner: z.object({kind: z.literal("manual")}),
        status: z.enum(["draft", "ready", "running", "paused", "settled", "cancelled"]), itemIds: z.array(id),
        confirmedItemIds: z.array(id).max(0), retrySourceBatchId: id.optional(), pauseReason: z.string().optional(), dormant: z.literal(true)
    }),
    audioGenerationBatchItems: z.object({
        ...base, batchId: id, chapterId: id, segmentId: id, order: number, included: z.boolean(),
        state: z.enum(["draft", "queued", "linked", "cancelled"]), snapshot: speechSnapshot, intentId: id, jobId: id.optional()
    }),
    audioArrangementProposals: createAudioArrangementPackageSchema({segment: segmentSchema, take: takeSchema, clip: clipSchema}),
};
type TableName = keyof typeof schemas;
const schema = z.object({
    version: z.literal(1),
    audioChapters: z.array(schemas.audioChapters),
    audioSpeakers: z.array(schemas.audioSpeakers),
    audioSegments: z.array(schemas.audioSegments),
    audioTakes: z.array(schemas.audioTakes),
    audioTracks: z.array(schemas.audioTracks),
    audioClips: z.array(schemas.audioClips),
    audioExports: z.array(schemas.audioExports),
    musicDrafts: z.array(schemas.musicDrafts),
    musicWorks: z.array(schemas.musicWorks),
    audioGenerationJobs: z.array(schemas.audioGenerationJobs),
    audioGenerationBatches: z.array(schemas.audioGenerationBatches).default([]),
    audioGenerationBatchItems: z.array(schemas.audioGenerationBatchItems).default([]),
    audioArrangementProposals: z.array(schemas.audioArrangementProposals).default([]),
});
export type AudioPackage = z.infer<typeof schema>;

// Only the comparison sees future source fields; the returned package still
// follows its explicit allowlist. Object key order is immaterial to freshness.
const fingerprintPackageSchema = schema.extend({
    audioTakes: z.array(schemas.audioTakes.passthrough().extend({provenance: provenance.passthrough().optional()}))
});

export function parseAudioPackageData(raw: unknown): AudioPackage {
    const original = fingerprintPackageSchema.parse(raw);
    const snapshot = {
        chapters: original.audioChapters,
        tracks: original.audioTracks,
        takes: original.audioTakes,
        clips: original.audioClips
    };
    return schema.parse({
        ...original, audioExports: original.audioExports.map(row => ({
            ...row, fingerprint: preserveAudioExportFreshness(row, snapshot)
        }))
    });
}

export function parseAudioPackage(raw: unknown, projectId: unknown, kind: ProjectKind): AudioPackage | undefined {
    if (raw === undefined) {
        if (kind !== "video") throw new Error("缺少音频或音乐项目数据");
        return undefined;
    }
    const value = parseAudioPackageData(raw);
    for (const job of value.audioGenerationJobs) validateAudioTaskObservations(job.taskObservations, job.taskIds);
    const seen = new Set<string>();
    for (const name of Object.keys(schemas) as TableName[]) for (const row of value[name]) {
        if (row.projectId !== projectId || seen.has(row.id)) throw new Error("音频项目记录重复或所有者不匹配");
        seen.add(row.id);
        if (kind === "video" || (kind === "music" && name.startsWith("audio") && name !== "audioGenerationJobs") || (kind === "audio" && name.startsWith("music"))) throw new Error("项目包包含其他类型的数据");
    }
    if (kind === "audio" && !value.audioChapters.length) throw new Error("音频项目至少需要一个章节");
    return value;
}

export function remapAudioPackage(value: AudioPackage | undefined, projectId: string, mediaMap: Map<string, string>): AudioPackage | undefined {
    if (!value) return undefined;
    const map = new Map<string, string>();
    for (const name of Object.keys(schemas) as TableName[]) for (const row of value[name]) map.set(row.id, createId("aud"));
    const reference = (id: string) => {
        const next = map.get(id);
        if (!next) throw new Error("音频项目引用的记录缺失");
        return next;
    };
    const media = (id: string) => {
        const next = mediaMap.get(id);
        if (!next) throw new Error("音频项目引用的文件缺失");
        return next;
    };
    const historical = (id: string) => {
        let next = map.get(id);
        if (!next) {next = createId("history"); map.set(id, next);}
        return next;
    };
    const fingerprintInput = {
        chapters: value.audioChapters, tracks: value.audioTracks, takes: value.audioTakes, clips: value.audioClips
    };
    const next = structuredClone(value);
    next.audioExports = next.audioExports.map((row) => ({
        ...row,
        fingerprint: remapAudioExportFingerprint(row, fingerprintInput, {records: map, media: mediaMap, projectId})
    }));
    for (const name of Object.keys(schemas) as TableName[]) for (const row of next[name]) {
        if (name === "audioArrangementProposals") continue;
        row.id = reference(row.id);
        row.projectId = projectId;
        if ("chapterId" in row && row.chapterId) row.chapterId = reference(row.chapterId);
        if ("speakerId" in row && row.speakerId) row.speakerId = reference(row.speakerId);
        if ("segmentId" in row && row.segmentId) row.segmentId = name === "audioGenerationBatchItems" ? historical(row.segmentId) : reference(row.segmentId);
        if ("selectedTakeId" in row && row.selectedTakeId) row.selectedTakeId = reference(row.selectedTakeId);
        if ("trackId" in row) row.trackId = reference(row.trackId);
        if ("takeId" in row) row.takeId = reference(row.takeId);
        if ("mediaId" in row) row.mediaId = media(row.mediaId);
        if ("mimo" in row && row.mimo?.referenceMediaId) row.mimo.referenceMediaId = media(row.mimo.referenceMediaId);
        if ("provenance" in row && row.provenance?.jobId) row.provenance.jobId = map.get(row.provenance.jobId);
    }
    for (const job of next.audioGenerationJobs) {
        job.intentId = createId("imported");
        job.connector = {id: "imported", provider: job.connector.provider, baseUrl: ""};
        if (job.source.kind === "batch") job.source = {...job.source, batchId: reference(job.source.batchId), itemId: reference(job.source.itemId), owner: {kind: "manual"}};
        else job.source = {kind: "manual"};
        job.dormant = true;
        if (job.input.kind === "speech" && job.input.mimo?.referenceMediaId) job.input.mimo.referenceMediaId = media(job.input.mimo.referenceMediaId);
        if (job.input.kind === "speech" && job.input.segmentId) job.input.segmentId = map.get(job.input.segmentId);
        if (job.input.kind === "music" && job.input.draftId) job.input.draftId = map.get(job.input.draftId);
        for (const result of job.results) {
            if (result.mediaId) result.mediaId = media(result.mediaId);
            if (result.takeId) result.takeId = map.get(result.takeId);
            if (result.workId) result.workId = map.get(result.workId);
            if (result.provenance.jobId) result.provenance.jobId = map.get(result.provenance.jobId);
        }
    }
    for (const batch of next.audioGenerationBatches) {
        batch.owner = {kind: "manual"}; batch.dormant = true; batch.confirmedItemIds = [];
        batch.itemIds = batch.itemIds.map(reference);
        batch.retrySourceBatchId = batch.retrySourceBatchId ? map.get(batch.retrySourceBatchId) : undefined;
    }
    for (const item of next.audioGenerationBatchItems) {
        item.batchId = reference(item.batchId);
        item.intentId = createId("imported-batch-intent");
        item.jobId = item.jobId ? reference(item.jobId) : undefined;
        item.snapshot.connector = {id: "imported", provider: item.snapshot.connector.provider, baseUrl: ""};
        item.snapshot.fingerprint = "historical";
        item.snapshot.referenceFingerprint = undefined;
        if (item.snapshot.speakerId) item.snapshot.speakerId = historical(item.snapshot.speakerId);
        if (item.snapshot.input.segmentId) item.snapshot.input.segmentId = historical(item.snapshot.input.segmentId);
        if (item.snapshot.input.mimo?.referenceMediaId) item.snapshot.input.mimo.referenceMediaId = media(item.snapshot.input.mimo.referenceMediaId);
        const job = next.audioGenerationJobs.find(row => row.id === item.jobId);
        if (job) job.intentId = item.intentId;
    }
    next.audioArrangementProposals = next.audioArrangementProposals.map(row => schemas.audioArrangementProposals.parse(remapAudioArrangementHistory(row, {projectId, historical, media: id => mediaMap.get(id)})));
    return next;
}
