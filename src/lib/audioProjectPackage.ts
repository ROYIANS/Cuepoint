import {validateAudioTaskObservations} from "./audioGeneration/observations";
import {db} from "@/db/database";
import {AUDIO_TABLES} from "@/db/audioShared";
import {
    validateAudioChapter,
    validateAudioClip,
    validateAudioExport,
    validateAudioSegment,
    validateAudioSpeaker,
    validateAudioTake,
    validateAudioTrack
} from "@/db/audio";
import {validateLegacyMusicDraft, validateLegacyMusicWork} from "@/db/music";
import {validateGenerationInput} from "./audioGeneration/input";
import {validateSpeechReference} from "./audioGeneration/reference";
import {sanitizeAudioArrangementHistory} from "./packages/audioArrangementCodec";

import {type AudioPackage, parseAudioPackageData} from "./packages/audioPackageCodec";

export {parseAudioPackage, remapAudioPackage} from "./packages/audioPackageCodec";
export type {AudioPackage} from "./packages/audioPackageCodec";

export async function snapshotAudioPackage(projectId: string): Promise<AudioPackage> {
    const entries = await Promise.all(AUDIO_TABLES.map(async (table): Promise<[string, unknown]> => [table.name, await table.where("projectId").equals(projectId).toArray()]));
    const raw: Record<string, unknown> = Object.fromEntries(entries);
    const batches = await db.audioGenerationBatches.where("projectId").equals(projectId).toArray();
    const batchIds = new Set(batches.map(batch => batch.id));
    raw.audioGenerationJobs = (await db.audioGenerationJobs.where("projectId").equals(projectId).toArray()).map((job) => ({
        ...job,
        source: job.source.kind === "batch" && batchIds.has(job.source.batchId) ? {...job.source, owner: {kind: "manual"}} : {kind: "manual"},
        dormant: true,
        claim: undefined
    }));
    raw.audioGenerationBatches = batches.map(batch => ({
        ...batch, owner: {kind: "manual"}, sourceCallId: undefined, confirmedAt: undefined, confirmedItemIds: [], dormant: true
    }));
    raw.audioGenerationBatchItems = (await db.audioGenerationBatchItems.where("projectId").equals(projectId).toArray()).map(item => ({...item,
        snapshot: {...item.snapshot, fingerprint: "historical", referenceFingerprint: undefined,
            connector: {id: "imported", provider: item.snapshot.connector.provider, baseUrl: ""}}
    }));
    raw.audioArrangementProposals = sanitizeAudioArrangementHistory(await db.audioArrangementProposals.where("projectId").equals(projectId).toArray());
    const value = parseAudioPackageData({version: 1, ...raw});
    for (const job of value.audioGenerationJobs) validateAudioTaskObservations(job.taskObservations, job.taskIds);
    return value;
}

/** Called within the package transaction, after project/media insertion. */
export async function insertAudioPackage(value: AudioPackage | undefined): Promise<void> {
    if (!value) return;
    await db.audioChapters.bulkAdd(value.audioChapters);
    await db.audioSpeakers.bulkAdd(value.audioSpeakers);
    await db.audioSegments.bulkAdd(value.audioSegments);
    await db.audioTakes.bulkAdd(value.audioTakes);
    await db.audioTracks.bulkAdd(value.audioTracks);
    await db.audioClips.bulkAdd(value.audioClips);
    await db.audioExports.bulkAdd(value.audioExports);
    await db.musicDrafts.bulkAdd(value.musicDrafts);
    await db.musicWorks.bulkAdd(value.musicWorks);
    await db.audioGenerationJobs.bulkAdd(value.audioGenerationJobs);
    await db.audioGenerationBatches.bulkAdd(value.audioGenerationBatches);
    await db.audioGenerationBatchItems.bulkAdd(value.audioGenerationBatchItems);
    await db.audioArrangementProposals.bulkAdd(value.audioArrangementProposals);
    for (const row of value.audioChapters) await validateAudioChapter(row);
    for (const row of value.audioSpeakers) await validateAudioSpeaker(row);
    for (const row of value.audioSegments) await validateAudioSegment(row);
    for (const row of value.audioTakes) await validateAudioTake(row);
    for (const row of value.audioTracks) await validateAudioTrack(row);
    for (const row of value.audioClips) await validateAudioClip(row);
    for (const row of value.audioExports) await validateAudioExport(row);
    for (const row of value.musicDrafts) await validateLegacyMusicDraft(row);
    for (const row of value.musicWorks) await validateLegacyMusicWork(row);
    for (const job of value.audioGenerationJobs) {
        if (job.source.kind === "batch") {
            const source = job.source;
            const item = value.audioGenerationBatchItems.find(row => row.id === source.itemId);
            const batch = value.audioGenerationBatches.find(row => row.id === source.batchId);
            if (!batch || !item || item.batchId !== batch.id || item.jobId !== job.id || item.intentId !== job.intentId || job.input.kind !== "speech") throw new Error("项目包批次生成任务缺少真实归属");
        }
        if (job.input.kind === "speech") {
            if (Boolean(job.input.mimo) !== (job.connector.provider === "mimo")) throw new Error("配音设置与服务商不匹配");
            if (job.input.mimo) validateGenerationInput(job.input);
            await validateSpeechReference(job.projectId, job.input);
        } else if (job.connector.provider !== "apimart") throw new Error("音乐生成服务商无效");
        for (const result of job.results) {
            if (result.mediaId && (await db.media.get(result.mediaId))?.projectId !== job.projectId) throw new Error("生成结果媒体归属无效");
            if (result.takeId && (await db.audioTakes.get(result.takeId))?.projectId !== job.projectId) throw new Error("生成结果配音归属无效");
            if (result.workId && (await db.musicWorks.get(result.workId))?.projectId !== job.projectId) throw new Error("生成结果作品归属无效");
        }
    }
    for (const batch of value.audioGenerationBatches) {
        const chapter = await db.audioChapters.get(batch.chapterId);
        if (chapter?.projectId !== batch.projectId || !batch.dormant || batch.confirmedItemIds.length) throw new Error("导入批次归属或历史状态无效");
        const items = value.audioGenerationBatchItems.filter(item => item.batchId === batch.id);
        if (items.length !== batch.itemIds.length || new Set(batch.itemIds).size !== items.length || items.some(item => !batch.itemIds.includes(item.id) || item.chapterId !== batch.chapterId || item.projectId !== batch.projectId)) throw new Error("批次项目包缺少真实项");
    }
    for (const item of value.audioGenerationBatchItems) {
        if (!value.audioGenerationBatches.some(batch => batch.id === item.batchId)) throw new Error("批次项缺少归属");
        if (item.jobId) {
            const job = await db.audioGenerationJobs.get(item.jobId);
            if (!job || job.projectId !== item.projectId || job.source.kind !== "batch" || job.source.batchId !== item.batchId || job.source.itemId !== item.id || job.intentId !== item.intentId) throw new Error("批次任务来源不匹配");
        }
    }
    for (const proposal of value.audioArrangementProposals) {
        if (!proposal.dormant || (await db.audioChapters.get(proposal.chapterId))?.projectId !== proposal.projectId) throw new Error("声音排列历史归属无效");
    }
}
