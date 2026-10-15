import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import type {AudioGenerationJob, AudioGenerationStatus} from "../models/audioGeneration";
import {assertAudioProject, ownedAudioRow, touchAudioProject} from "./ownership";
import {assertAudioRevision, finiteAudioNumber, newAudioRow} from "../models/row";
import {AUDIO_TRANSACTION_TABLES} from "../../../platform/product/scopes";
import {validateMusicSettings} from "../../music/commands/music";
import {validateGenerationInput} from "../generation/input";
import {validateSpeechReference} from "../generation/reference";
import {nowIso} from "../../../platform/identity";
import {validateAudioTaskObservations} from "../generation/observations";

async function validateAudioGenerationJob(row: AudioGenerationJob, store?: ProductStore) {
    const db = store ?? productDb;
    validateAudioTaskObservations(row.taskObservations, row.taskIds);
    await assertAudioProject(row.projectId, row.input.kind === "speech" ? "audio" : "music", db);
    if (!row.intentId || !row.connector.id || !["apimart", "mimo"].includes(row.connector.provider)) throw new Error("生成任务标识无效");
    if (row.input.kind === "speech") {
        if (Boolean(row.input.mimo) !== (row.connector.provider === "mimo")) throw new Error("配音设置与服务商不匹配");
        if (row.input.mimo) {
            validateGenerationInput(row.input);
            const reference = await validateSpeechReference(row.projectId, row.input, db);
            if (row.referenceFingerprint && row.referenceFingerprint !== reference?.fingerprint) throw new Error("克隆参考音频已变化，请重新准备生成");
        }
        if (!row.input.mimo && (!row.input.text.trim() || [...row.input.text].length > 4096)) throw new Error("配音文本需要 1–4096 个字符");
        finiteAudioNumber(row.input.speed, "语速", 0.25, 4);
        if (row.input.segmentId) await ownedAudioRow(db.audioSegments, row.projectId, row.input.segmentId);
    } else {
        if (row.connector.provider !== "apimart") throw new Error("音乐生成仅支持 APIMart");
        validateMusicSettings(row.input.settings);
        if (row.input.draftId) await ownedAudioRow(db.musicDrafts, row.projectId, row.input.draftId);
    }
}

export async function prepareAudioGenerationJob(projectId: string, input: Pick<AudioGenerationJob, "intentId" | "input" | "connector" | "source" | "referenceFingerprint">, store?: ProductStore): Promise<AudioGenerationJob> {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        const existing = await db.audioGenerationJobs.where("intentId").equals(input.intentId).first();
        if (existing) {
            if (existing.projectId !== projectId || JSON.stringify(existing.input) !== JSON.stringify(input.input) || JSON.stringify(existing.connector) !== JSON.stringify(input.connector) || JSON.stringify(existing.source) !== JSON.stringify(input.source)) throw new Error("生成意图已存在且参数不同");
            await assertAudioProject(projectId, undefined, db);
            return existing;
        }
        const row = newAudioRow<AudioGenerationJob>(projectId, "agj", {
            ...input,
            status: "prepared",
            taskIds: [],
            results: []
        });
        await validateAudioGenerationJob(row, db);
        if (row.input.kind === "speech" && row.input.mimo?.mode === "clone") {
            row.referenceFingerprint = (await validateSpeechReference(projectId, row.input, db))!.fingerprint;
        }
        await db.audioGenerationJobs.add(row);
        await touchAudioProject(projectId, db);
        return row;
    });
}

export async function claimAudioGenerationJob(projectId: string, id: string, revision: number, owner: string, store?: ProductStore): Promise<AudioGenerationJob> {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        const row = await ownedAudioRow(db.audioGenerationJobs, projectId, id);
        assertAudioRevision(row, revision);
        await validateAudioGenerationJob(row, db);
        if (row.dormant || row.status !== "prepared" || row.claim) throw new Error("生成任务已提交或不可继续");
        if (!owner) throw new Error("缺少提交者标识");
        if (row.input.kind === "speech" && row.input.segmentId && row.input.segmentRevision !== undefined) assertAudioRevision(await ownedAudioRow(db.audioSegments, projectId, row.input.segmentId), row.input.segmentRevision);
        if (row.input.kind === "music" && row.input.draftId && row.input.draftRevision !== undefined) assertAudioRevision(await ownedAudioRow(db.musicDrafts, projectId, row.input.draftId), row.input.draftRevision);
        const next: AudioGenerationJob = {
            ...row,
            status: "submitting",
            claim: {owner, claimedAt: nowIso()},
            revision: row.revision + 1,
            updatedAt: nowIso()
        };
        await db.audioGenerationJobs.put(next);
        return next;
    });
}

const NEXT: Record<AudioGenerationStatus, readonly AudioGenerationStatus[]> = {
    prepared: ["failed"],
    submitting: ["uncertain", "submitted", "remote-completed", "downloading", "failed"],
    uncertain: ["submitted", "running", "remote-completed", "failed"],
    submitted: ["running", "downloading", "remote-completed", "failed"],
    running: ["submitted", "downloading", "remote-completed", "failed"],
    "remote-completed": ["downloading", "saved", "target-conflict", "failed"],
    downloading: ["submitted", "running", "remote-completed", "saved", "target-conflict", "failed"],
    saved: [],
    failed: ["submitted", "downloading", "running", "remote-completed"],
    "target-conflict": ["submitted", "running", "remote-completed", "failed", "saved", "downloading"],
};

export async function patchAudioGenerationJob(projectId: string, id: string, revision: number, patch: Partial<Pick<AudioGenerationJob, "status" | "taskIds" | "taskObservations" | "results" | "error" | "failureStage">>, store?: ProductStore): Promise<AudioGenerationJob> {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        await assertAudioProject(projectId, undefined, db);
        const row = await ownedAudioRow(db.audioGenerationJobs, projectId, id);
        assertAudioRevision(row, revision);
        if (row.dormant) throw new Error("导入的历史任务不能继续生成");
        if (patch.status && patch.status !== row.status && !NEXT[row.status].includes(patch.status)) throw new Error("生成任务状态转换无效");
        const next: AudioGenerationJob = {...row, ...patch, revision: row.revision + 1, updatedAt: nowIso()};
        validateAudioTaskObservations(next.taskObservations, next.taskIds);
        if (new Set(next.results.map((r) => r.key)).size !== next.results.length) throw new Error("生成结果标识重复");
        for (const result of next.results) {
            if (result.mediaId) await ownedAudioRow(db.media, projectId, result.mediaId);
            if (result.takeId) await ownedAudioRow(db.audioTakes, projectId, result.takeId);
            if (result.workId) await ownedAudioRow(db.musicWorks, projectId, result.workId);
        }
        await db.audioGenerationJobs.put(next);
        await touchAudioProject(projectId, db);
        return next;
    });
}
