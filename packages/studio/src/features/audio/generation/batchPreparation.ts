import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import {resolveConnector} from "../../settings/commands/connectors";
import {assertAudioProject, ownedAudioRow} from "../commands/ownership";
import type {AudioBatchSnapshot} from "../models/audioGenerationBatch";
import {defaultMimoConnector, speakerSpeechProfile} from "./defaults";
import {validateGenerationInput} from "./input";
import {validateSpeechReference} from "./reference";
import {normalizeBaseUrl} from "../../agent/providers/openaiCompatible";
import {targetRevision} from "../../../platform/data/revision";

/** Reads the same saved voice defaults as individual generation, without preparing or sending a job. */
export async function prepareAudioBatchSnapshot(projectId: string, chapterId: string, segmentId: string, connectorId?: string, store?: ProductStore): Promise<AudioBatchSnapshot> {
    const db = store ?? productDb;
    await assertAudioProject(projectId, "audio", db);
    await ownedAudioRow(db.audioChapters, projectId, chapterId);
    const segment = await ownedAudioRow(db.audioSegments, projectId, segmentId);
    if (segment.chapterId !== chapterId || !segment.text.trim()) throw new Error("批量配音需要当前章节内非空的脚本段落");
    const speaker = segment.speakerId ? await ownedAudioRow(db.audioSpeakers, projectId, segment.speakerId) : undefined;
    const profile = speakerSpeechProfile(speaker);
    const provider = profile.mimo ? "mimo" : "apimart";
    const connections = await db.connectors.toArray();
    let candidate = connectorId ? connections.find(row => row.id === connectorId) : undefined;
    if (!connectorId) candidate = provider === "mimo" ? defaultMimoConnector(connections) : connections.find(row => row.definitionId === "apimart" && row.apiKey.trim());
    const config = candidate ? await resolveConnector(candidate.id, db) : undefined;
    if (!config?.apiKey.trim() || config.definitionId !== provider) throw new Error(`段落所用音色需要已配置的 ${provider === "mimo" ? "MiMo" : "APIMart"} 连接`);
    const input = validateGenerationInput({
        kind: "speech",
        text: segment.text, ...profile,
        segmentId,
        segmentRevision: segment.revision
    });
    if (input.kind !== "speech") throw new Error("配音输入无效");
    const reference = await validateSpeechReference(projectId, input, db);
    const connector = {id: config.id, provider, baseUrl: normalizeBaseUrl(config.baseUrl)};
    const baseline = {
        input, connector, speakerId: speaker?.id, speakerRevision: speaker?.revision,
        referenceFingerprint: reference?.fingerprint
    };
    return {
        ...baseline,
        connector: {...connector, provider},
        fingerprint: targetRevision({...baseline, credential: config.apiKey})
    };
}

export async function assertAudioBatchSnapshot(projectId: string, chapterId: string, snapshot: AudioBatchSnapshot, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    if (!snapshot.input.segmentId) throw new Error("批次缺少段落标识");
    const current = await prepareAudioBatchSnapshot(projectId, chapterId, snapshot.input.segmentId, snapshot.connector.id, db);
    if (current.fingerprint !== snapshot.fingerprint) throw new Error("脚本、音色、参考音频或连接已变化，请重新准备并确认批次");
}
