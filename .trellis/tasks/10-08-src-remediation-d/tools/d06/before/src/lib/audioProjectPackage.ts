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

import {parseAudioPackageData, type AudioPackage} from "./packages/audioPackageCodec";
export {parseAudioPackage, remapAudioPackage} from "./packages/audioPackageCodec";
export type {AudioPackage} from "./packages/audioPackageCodec";

export async function snapshotAudioPackage(projectId: string): Promise<AudioPackage> {
    const entries = await Promise.all(AUDIO_TABLES.map(async (table) => [table.name, await table.where("projectId").equals(projectId).toArray()]));
    const raw = Object.fromEntries(entries);
    raw.audioGenerationJobs = (await db.audioGenerationJobs.where("projectId").equals(projectId).toArray()).map((job) => ({
        ...job,
        source: {kind: "manual"},
        dormant: true,
        claim: undefined
    }));
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
}
