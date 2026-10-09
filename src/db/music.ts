import {db} from "./database";
import type {AudioInput} from "@/domain/audio";
import {MUSIC_DURATION_LIMITS, type MusicDraft, type MusicSettings, type MusicWork} from "@/domain/music";
import type {MediaRecord} from "@/domain/types";
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

function validateMusicDuration(engine: MusicSettings["engine"], duration: number | undefined, allowLegacyFraction: boolean) {
    if (duration === undefined) return;
    const {min, max} = MUSIC_DURATION_LIMITS[engine];
    finiteAudioNumber(duration, "音乐时长", min, max);
    if (!allowLegacyFraction && !Number.isInteger(duration)) throw new Error("音乐时长必须为整数秒");
}

function validateStoredMusicSettings(settings: MusicSettings, allowLegacyFraction: boolean) {
    if (settings.engine === "flowmusic") {
        validateMusicDuration(settings.engine, settings.lengthSec, allowLegacyFraction);
        if (settings.bpm !== undefined && settings.bpm !== "" && (!/^\d+(\.\d+)?$/.test(settings.bpm) || Number(settings.bpm) < 1)) throw new Error("BPM 必须大于等于 1");
    } else if (settings.engine === "suno") {
        if (!["v6", "v6-wild", "v6-mini"].includes(settings.version)) throw new Error("不支持的 Suno 版本");
        validateMusicDuration(settings.engine, settings.durationSec, allowLegacyFraction);
        if ([...settings.prompt].length > (settings.custom ? 5000 : 3000) || [...settings.title].length > 80 || [...settings.style].length > 1000) throw new Error("音乐描述、歌词或风格超过长度限制");
    } else throw new Error("不支持的音乐引擎");
}

export function validateMusicSettings(settings: MusicSettings) {
    validateStoredMusicSettings(settings, false);
}

async function validateMusicDraft(row: MusicDraft) {
    await assertAudioProject(row.projectId, "music");
    validateMusicSettings(row.settings);
}

/** Package history keeps fractional parameters readable for an explicit draft repair. */
export async function validateLegacyMusicDraft(row: MusicDraft) {
    await assertAudioProject(row.projectId, "music");
    validateStoredMusicSettings(row.settings, true);
}

async function validateStoredMusicWork(row: MusicWork, allowLegacyFraction: boolean) {
    await assertAudioProject(row.projectId, "music");
    await assertOwnedAudioMedia(row.projectId, row.mediaId);
    validateAudioMetadata(row);
    if (row.settings) validateStoredMusicSettings(row.settings, allowLegacyFraction);
    if (typeof row.title !== "string" || typeof row.notes !== "string" || typeof row.lyrics !== "string" || typeof row.favorite !== "boolean") throw new Error("音乐作品信息无效");
}

async function validateMusicWork(row: MusicWork) {
    await validateStoredMusicWork(row, false);
}

/** Only imported history or metadata edits of existing immutable settings use this path. */
export async function validateLegacyMusicWork(row: MusicWork) {
    await validateStoredMusicWork(row, true);
}

export async function addMusicDraft(projectId: string, input: AudioInput<MusicDraft>): Promise<MusicDraft> {
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
        const row = newAudioRow<MusicDraft>(projectId, "mdr", input);
        await validateMusicDraft(row);
        await db.musicDrafts.add(row);
        await touchAudioProject(projectId);
        return row;
    });
}

export const patchMusicDraft = (projectId: string, id: string, revision: number, patch: Partial<AudioInput<MusicDraft>>) => patchAudioRow(db.musicDrafts, projectId, id, revision, patch, ["settings"], validateMusicDraft);

export async function addMusicWork(projectId: string, input: AudioInput<MusicWork>, media?: MediaRecord): Promise<MusicWork> {
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
        await assertAudioProject(projectId, "music");
        if (media) {
            if (media.projectId !== projectId) throw new Error("文件不属于当前项目");
            await db.media.add(media);
        }
        const row = newAudioRow<MusicWork>(projectId, "mwk", input);
        await validateMusicWork(row);
        await db.musicWorks.add(row);
        await touchAudioProject(projectId);
        return row;
    });
}

export const patchMusicWork = (projectId: string, id: string, revision: number, patch: Partial<Pick<MusicWork, "title" | "notes" | "favorite">>) => patchAudioRow(db.musicWorks, projectId, id, revision, patch, ["title", "notes", "favorite"], validateLegacyMusicWork);



export async function deleteMusicWork(projectId: string, id: string, revision: number) {
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
        await assertAudioProject(projectId, "music");
        assertAudioRevision(await ownedAudioRow(db.musicWorks, projectId, id), revision);
        await detachAudioGenerationResult(projectId, "workId", id);
        await db.musicWorks.delete(id);
        await touchAudioProject(projectId);
    });
}
