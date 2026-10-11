import type {ProductStore} from "@/lib/storage/types";
import {db as productDb} from "./database";
import type {
    AudioChapter,
    AudioClip,
    AudioExport,
    AudioInput,
    AudioPatch,
    AudioProjectSnapshot,
    AudioRow,
    AudioSegment,
    AudioSpeaker,
    AudioTake,
    AudioTrack
} from "@/domain/audio";
import type {MediaRecord} from "@/domain/types";
import type {StoreTable} from "@/lib/storage/types";
import {
    assertAudioProject,
    assertAudioRevision,
    assertOwnedAudioMedia,
    AUDIO_TRANSACTION_TABLES,
    detachAudioGenerationResult,
    finiteAudioNumber,
    newAudioRow,
    ownedAudioRow,
    patchAudioRow,
    touchAudioProject,
    validateAudioMetadata
} from "./audioShared";
import {validateSpeechReference} from "@/lib/audioGeneration/reference";
import {validateMimoSpeech} from "@/lib/audioGeneration/input";
import {nowIso} from "@/lib/ids";
import {targetRevision} from "@/lib/productionRevision";

export async function validateAudioChapter(row: AudioChapter, store?: ProductStore) {
    const db = store ?? productDb;
    await assertAudioProject(row.projectId, "audio", db);
    finiteAudioNumber(row.order, "章节顺序");
    if (typeof row.title !== "string" || !row.title.trim()) throw new Error("章节名称不能为空");
}

export async function validateAudioSpeaker(row: AudioSpeaker, store?: ProductStore) {
    const db = store ?? productDb;
    await assertAudioProject(row.projectId, "audio", db);
    if (typeof row.name !== "string" || !row.name.trim()) throw new Error("说话人名称不能为空");
    if (row.speed !== undefined) finiteAudioNumber(row.speed, "语速", 0.25, 4);
    if (row.mimo) {
        validateMimoSpeech({
            text: "音色配置",
            voice: row.voice ?? "mimo_default",
            speed: row.speed ?? 1,
            mimo: row.mimo
        });
        await validateSpeechReference(row.projectId, row, db);
    }
}

export async function validateAudioSegment(row: AudioSegment, store?: ProductStore) {
    const db = store ?? productDb;
    await assertAudioProject(row.projectId, "audio", db);
    await ownedAudioRow(db.audioChapters, row.projectId, row.chapterId);
    finiteAudioNumber(row.order, "段落顺序");
    if (typeof row.text !== "string" || typeof row.notes !== "string") throw new Error("脚本内容必须为文本");
    if (row.speakerId) await ownedAudioRow(db.audioSpeakers, row.projectId, row.speakerId);
    if (row.selectedTakeId) {
        const take = await ownedAudioRow(db.audioTakes, row.projectId, row.selectedTakeId);
        if (take.segmentId !== row.id) throw new Error("配音版本不属于当前段落");
    }
}

export async function validateAudioTake(row: AudioTake, store?: ProductStore) {
    const db = store ?? productDb;
    await assertAudioProject(row.projectId, "audio", db);
    validateAudioMetadata(row);
    if (!["recording", "upload", "library", "tts", "music"].includes(row.source) || typeof row.name !== "string") throw new Error("音频来源无效");
    if (row.segmentId) await ownedAudioRow(db.audioSegments, row.projectId, row.segmentId);
    await assertOwnedAudioMedia(row.projectId, row.mediaId, db);
}

export async function validateAudioTrack(row: AudioTrack, store?: ProductStore) {
    const db = store ?? productDb;
    await assertAudioProject(row.projectId, "audio", db);
    await ownedAudioRow(db.audioChapters, row.projectId, row.chapterId);
    finiteAudioNumber(row.order, "音轨顺序");
    finiteAudioNumber(row.gain, "音轨音量", 0, 4);
    if (typeof row.muted !== "boolean" || typeof row.solo !== "boolean" || typeof row.name !== "string") throw new Error("音轨设置无效");
    if (!["voice", "music", "effects"].includes(row.role)) throw new Error("未知音轨类型");
}

export async function validateAudioClip(row: AudioClip, store?: ProductStore) {
    const db = store ?? productDb;
    await assertAudioProject(row.projectId, "audio", db);
    const track = await ownedAudioRow(db.audioTracks, row.projectId, row.trackId);
    const take = await ownedAudioRow(db.audioTakes, row.projectId, row.takeId);
    if (take.segmentId && (await ownedAudioRow(db.audioSegments, row.projectId, take.segmentId)).chapterId !== row.chapterId) throw new Error("配音版本不属于当前章节");
    if (track.chapterId !== row.chapterId) throw new Error("音轨不属于当前章节");
    finiteAudioNumber(row.startSec, "片段位置");
    finiteAudioNumber(row.trimStartSec, "裁剪起点");
    finiteAudioNumber(row.trimEndSec, "裁剪终点", 0, take.durationSec);
    const duration = row.trimEndSec - row.trimStartSec;
    if (duration <= 0) throw new Error("裁剪终点必须大于起点");
    finiteAudioNumber(row.gain, "片段音量", 0, 4);
    finiteAudioNumber(row.fadeInSec, "淡入时长", 0, duration);
    finiteAudioNumber(row.fadeOutSec, "淡出时长", 0, duration);
    if (row.fadeInSec + row.fadeOutSec > duration) throw new Error("淡入淡出不能超过片段时长");
}

export async function validateAudioExport(row: AudioExport, store?: ProductStore) {
    const db = store ?? productDb;
    await assertAudioProject(row.projectId, "audio", db);
    if (row.chapterId) await ownedAudioRow(db.audioChapters, row.projectId, row.chapterId);
    await assertOwnedAudioMedia(row.projectId, row.mediaId, db);
    finiteAudioNumber(row.durationSec, "导出时长", Number.EPSILON);
    if (row.format !== "wav" || !row.fingerprint) throw new Error("导出信息无效");
}

async function add<T extends AudioRow>(table: StoreTable<T>, prefix: string, projectId: string, input: AudioInput<T>, validate: (row: T, store: ProductStore) => Promise<void>, media?: MediaRecord, store?: ProductStore): Promise<T> {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        await assertAudioProject(projectId, "audio", db);
        if (media) {
            if (media.projectId !== projectId) throw new Error("音频文件不属于当前项目");
            await db.media.add(media);
        }
        const row = newAudioRow<T>(projectId, prefix, input);
        await validate(row, db);
        await (db.table(table.name) as unknown as StoreTable<T>).add(row);
        await touchAudioProject(projectId, db);
        return row;
    });
}

export const addAudioChapter = (projectId: string, input: AudioInput<AudioChapter>, store?: ProductStore) => (db => add(db.audioChapters, "ach", projectId, input, validateAudioChapter, undefined, db))(store ?? productDb);
export const addAudioSpeaker = (projectId: string, input: AudioInput<AudioSpeaker>, store?: ProductStore) => (db => add(db.audioSpeakers, "asp", projectId, input, validateAudioSpeaker, undefined, db))(store ?? productDb);
export const addAudioSegment = (projectId: string, input: AudioInput<AudioSegment>, store?: ProductStore) => (db => add(db.audioSegments, "asg", projectId, input, validateAudioSegment, undefined, db))(store ?? productDb);
export const addAudioTake = (projectId: string, input: AudioInput<AudioTake>, media?: MediaRecord, store?: ProductStore) => (db => add(db.audioTakes, "atk", projectId, input, validateAudioTake, media, db))(store ?? productDb);
export const addAudioTrack = (projectId: string, input: AudioInput<AudioTrack>, store?: ProductStore) => (db => add(db.audioTracks, "atr", projectId, input, validateAudioTrack, undefined, db))(store ?? productDb);
export const addAudioClip = (projectId: string, input: AudioInput<AudioClip>, store?: ProductStore) => (db => add(db.audioClips, "acl", projectId, input, validateAudioClip, undefined, db))(store ?? productDb);
export const addAudioExport = (projectId: string, input: AudioInput<AudioExport>, media?: MediaRecord, store?: ProductStore) => (db => add(db.audioExports, "aex", projectId, {
    ...input,
    scope: input.chapterId ? "chapter" : "project"
}, validateAudioExport, media, db))(store ?? productDb);
export const patchAudioChapter = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioChapter>, store?: ProductStore) => (db => patchAudioRow(db.audioChapters, projectId, id, revision, patch, ["title", "order"], validateAudioChapter, db))(store ?? productDb);
export const patchAudioSpeaker = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioSpeaker>, store?: ProductStore) => (db => patchAudioRow(db.audioSpeakers, projectId, id, revision, patch, ["name", "voice", "speed", "mimo"], validateAudioSpeaker, db))(store ?? productDb);
export const patchAudioSegment = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioSegment>, store?: ProductStore) => (db => patchAudioRow(db.audioSegments, projectId, id, revision, patch, ["speakerId", "order", "text", "notes", "selectedTakeId"], validateAudioSegment, db))(store ?? productDb);
export const patchAudioTrack = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioTrack>, store?: ProductStore) => (db => patchAudioRow(db.audioTracks, projectId, id, revision, patch, ["name", "role", "order", "gain", "muted", "solo"], validateAudioTrack, db))(store ?? productDb);
export const patchAudioClip = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioClip>, store?: ProductStore) => (db => patchAudioRow(db.audioClips, projectId, id, revision, patch, ["trackId", "takeId", "startSec", "trimStartSec", "trimEndSec", "gain", "fadeInSec", "fadeOutSec"], validateAudioClip, db))(store ?? productDb);

async function remove<T extends AudioRow>(table: StoreTable<T>, projectId: string, id: string, revision: number, before: (row: T, store: ProductStore) => Promise<void>, store?: ProductStore) {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        await assertAudioProject(projectId, "audio", db);
        const boundTable = db.table(table.name) as unknown as StoreTable<T>;
        const row = await ownedAudioRow(boundTable, projectId, id);
        assertAudioRevision(row, revision);
        await before(row, db);
        await boundTable.delete(id);
        await touchAudioProject(projectId, db);
    });
}

export const deleteAudioClip = (projectId: string, id: string, revision: number, store?: ProductStore) => (db => remove(db.audioClips, projectId, id, revision, async () => {
}, db))(store ?? productDb);
export const deleteAudioTrack = (projectId: string, id: string, revision: number, store?: ProductStore) => (db => remove(db.audioTracks, projectId, id, revision, async (_row, db) => {
    await db.audioClips.where("trackId").equals(id).delete();
}, db))(store ?? productDb);
export const deleteAudioSpeaker = (projectId: string, id: string, revision: number, store?: ProductStore) => (db => remove(db.audioSpeakers, projectId, id, revision, async (_row, db) => {
    await db.audioSegments.where("speakerId").equals(id).modify((row) => {
        delete row.speakerId;
        row.revision++;
        row.updatedAt = nowIso();
    });
}, db))(store ?? productDb);
export const deleteAudioSegment = (projectId: string, id: string, revision: number, store?: ProductStore) => (db => remove(db.audioSegments, projectId, id, revision, async (_row, db) => {
    // Retain all recorded/generated sources and placed clips when deleting script.
    await db.audioTakes.where("segmentId").equals(id).modify((row) => {
        delete row.segmentId;
        row.revision++;
        row.updatedAt = nowIso();
    });
}, db))(store ?? productDb);
export const deleteAudioTake = (projectId: string, id: string, revision: number, store?: ProductStore) => (db => remove(db.audioTakes, projectId, id, revision, async (_row, db) => {
    if (await db.audioClips.where("takeId").equals(id).count() || await db.audioSegments.where("projectId").equals(projectId).filter((s) => s.selectedTakeId === id).count()) throw new Error("此版本已被采用，请先移除引用");
    await detachAudioGenerationResult(projectId, "takeId", id, db);
}, db))(store ?? productDb);
export const deleteAudioChapter = (projectId: string, id: string, revision: number, store?: ProductStore) => (db => remove(db.audioChapters, projectId, id, revision, async (chapter, db) => {
    if (await db.audioChapters.where("projectId").equals(projectId).count() <= 1) throw new Error("至少保留一个章节");
    const segments = await db.audioSegments.where("chapterId").equals(id).toArray();
    for (const segment of segments) await db.audioTakes.where("segmentId").equals(segment.id).modify((row) => {
        delete row.segmentId;
        row.revision++;
        row.updatedAt = nowIso();
    });
    await db.audioSegments.where("chapterId").equals(id).delete();
    await db.audioClips.where("chapterId").equals(id).delete();
    await db.audioTracks.where("chapterId").equals(id).delete();
    await db.audioGenerationBatches.where("chapterId").equals(id).delete();
    await db.audioGenerationBatchItems.where("chapterId").equals(id).delete();
    await db.audioArrangementProposals.where("chapterId").equals(id).delete();
    await db.audioExports.where("projectId").equals(projectId).filter((row) => row.chapterId === id).modify((row) => {
        row.scope = "chapter";
        row.chapterTitle = chapter.title;
        delete row.chapterId;
        row.revision++;
        row.updatedAt = nowIso();
    });
}, db))(store ?? productDb);

export async function getAudioProjectSnapshot(projectId: string, store?: ProductStore): Promise<AudioProjectSnapshot> {
    const db = store ?? productDb;
    return db.transaction("r", AUDIO_TRANSACTION_TABLES, async (db) => {
        await assertAudioProject(projectId, "audio", db);
        const [chapters, speakers, segments, takes, tracks, clips, exports] = await Promise.all([
            db.audioChapters.where("projectId").equals(projectId).sortBy("order"), db.audioSpeakers.where("projectId").equals(projectId).toArray(),
            db.audioSegments.where("projectId").equals(projectId).sortBy("order"), db.audioTakes.where("projectId").equals(projectId).toArray(),
            db.audioTracks.where("projectId").equals(projectId).sortBy("order"), db.audioClips.where("projectId").equals(projectId).toArray(), db.audioExports.where("projectId").equals(projectId).toArray(),
        ]);
        return {chapters, speakers, segments, takes, tracks, clips, exports};
    });
}

/** Atomic edit batch for drag/split/undo. A stale row aborts the entire command. */


/** Replace one chapter's clip document with a CAS guard; undo never copies Blobs. */
export async function assertAudioClipDocument(projectId: string, chapterId: string, expected: AudioClip[], store?: ProductStore): Promise<AudioClip[]> {
    const db = store ?? productDb;
    const current = await db.audioClips.where("chapterId").equals(chapterId).toArray();
    if (new Set(expected.map(row => row.id)).size !== expected.length || expected.length !== current.length || expected.some(row => row.projectId !== projectId || row.chapterId !== chapterId || !current.some(saved => saved.id === row.id && saved.revision === row.revision))) throw new Error("时间线已被其他操作修改，请刷新后重试");
    return current;
}

/** Insert/remove only, preserving every retained row byte-for-byte, including revision. */
export async function changeAudioClipMembership(projectId: string, chapterId: string, expected: AudioClip[], next: AudioClip[], store?: ProductStore): Promise<AudioClip[]> {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        await assertAudioProject(projectId, "audio", db);
        await ownedAudioRow(db.audioChapters, projectId, chapterId);
        const current = await assertAudioClipDocument(projectId, chapterId, expected, db);
        if (new Set(next.map(row => row.id)).size !== next.length) throw new Error("片段 ID 重复");
        const added: AudioClip[] = [];
        for (const row of next) {
            const saved = current.find(item => item.id === row.id);
            if (saved) {
                if (targetRevision(saved) !== targetRevision(row)) throw new Error("批量排列不能修改已有片段");
            } else {
                if (await db.audioClips.get(row.id)) throw new Error("片段 ID 已被占用");
                if (row.projectId !== projectId || row.chapterId !== chapterId || !row.id || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error("片段标识或归属无效");
                await assertOwnedAudioMedia(projectId, (await ownedAudioRow(db.audioTakes, projectId, row.takeId)).mediaId, db);
                await validateAudioClip(row, db);
                added.push(row);
            }
        }
        const retained = new Set(next.map(row => row.id));
        await db.audioClips.bulkDelete(current.filter(row => !retained.has(row.id)).map(row => row.id));
        await db.audioClips.bulkAdd(added);
        if (added.length || next.length !== current.length) await touchAudioProject(projectId, db);
        return next;
    });
}

export async function replaceAudioClips(projectId: string, chapterId: string, expected: AudioClip[], next: AudioClip[], store?: ProductStore): Promise<AudioClip[]> {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        await assertAudioProject(projectId, "audio", db);
        await ownedAudioRow(db.audioChapters, projectId, chapterId);
        if (new Set(expected.map((r) => r.id)).size !== expected.length || new Set(next.map((r) => r.id)).size !== next.length) throw new Error("片段 ID 重复");
        const current = await assertAudioClipDocument(projectId, chapterId, expected, db);
        const rows: AudioClip[] = [];
        for (const row of next) {
            if (!row.id || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error("片段标识或版本无效");
            if (row.projectId !== projectId || row.chapterId !== chapterId) throw new Error("片段不属于当前章节");
            const existing = await db.audioClips.get(row.id);
            if (existing && !current.some((c) => c.id === row.id)) throw new Error("片段 ID 已被占用");
            const changed = {
                ...row,
                revision: Math.max(row.revision, existing?.revision ?? 0) + 1,
                updatedAt: nowIso()
            };
            await validateAudioClip(changed, db);
            rows.push(changed);
        }
        await db.audioClips.where("chapterId").equals(chapterId).delete();
        await db.audioClips.bulkAdd(rows);
        await touchAudioProject(projectId, db);
        return rows;
    });
}

/** Copy a completed music work; edits/deletion in either project stay independent. */
export async function adoptMusicWorkAsAudioTake(projectId: string, workId: string, segmentId?: string, store?: ProductStore): Promise<AudioTake> {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        await assertAudioProject(projectId, "audio", db);
        const work = await db.musicWorks.get(workId);
        if (!work) throw new Error("音乐作品不存在");
        await assertAudioProject(work.projectId, "music", db);
        const media = await ownedAudioRow(db.media, work.projectId, work.mediaId);
        const mediaId = crypto.randomUUID();
        return addAudioTake(projectId, {
            mediaId,
            segmentId,
            name: work.title,
            source: "music",
            durationSec: work.durationSec,
            sampleRate: work.sampleRate,
            channels: work.channels,
            provenance: work.provenance ? {...work.provenance, jobId: undefined} : undefined,
        }, {...media, id: mediaId, projectId, libraryRetained: undefined}, db);
    });
}
