import {db} from "@/db/database";
import {resolveConnector} from "@/db/connectors";
import {assertAudioProject, ownedAudioRow} from "@/db/audioShared";
import type {AudioBatchSnapshot} from "@/domain/audioGenerationBatch";
import {defaultMimoConnector, speakerSpeechProfile} from "./defaults";
import {validateGenerationInput} from "./input";
import {validateSpeechReference} from "./reference";
import {normalizeBaseUrl} from "@/lib/ai/openaiCompatible";
import {targetRevision} from "@/lib/productionRevision";

/** Reads the same saved voice defaults as individual generation, without preparing or sending a job. */
export async function prepareAudioBatchSnapshot(projectId: string, chapterId: string, segmentId: string, connectorId?: string): Promise<AudioBatchSnapshot> {
    await assertAudioProject(projectId, "audio");
    await ownedAudioRow(db.audioChapters, projectId, chapterId);
    const segment = await ownedAudioRow(db.audioSegments, projectId, segmentId);
    if (segment.chapterId !== chapterId || !segment.text.trim()) throw new Error("批量配音需要当前章节内非空的脚本段落");
    const speaker = segment.speakerId ? await ownedAudioRow(db.audioSpeakers, projectId, segment.speakerId) : undefined;
    const profile = speakerSpeechProfile(speaker);
    const provider = profile.mimo ? "mimo" : "apimart";
    const connections = await db.connectors.toArray();
    let candidate = connectorId ? connections.find(row => row.id === connectorId) : undefined;
    if (!connectorId) candidate = provider === "mimo" ? defaultMimoConnector(connections) : connections.find(row => row.definitionId === "apimart" && row.apiKey.trim());
    const config = candidate ? await resolveConnector(candidate.id) : undefined;
    if (!config?.apiKey.trim() || config.definitionId !== provider) throw new Error(`段落所用音色需要已配置的 ${provider === "mimo" ? "MiMo" : "APIMart"} 连接`);
    const input = validateGenerationInput({kind: "speech", text: segment.text, ...profile, segmentId, segmentRevision: segment.revision});
    if (input.kind !== "speech") throw new Error("配音输入无效");
    const reference = await validateSpeechReference(projectId, input);
    const connector = {id: config.id, provider, baseUrl: normalizeBaseUrl(config.baseUrl)};
    const baseline = {
        input, connector, speakerId: speaker?.id, speakerRevision: speaker?.revision,
        referenceFingerprint: reference?.fingerprint
    };
    return {...baseline, connector: {...connector, provider}, fingerprint: targetRevision({...baseline, credential: config.apiKey})};
}

export async function assertAudioBatchSnapshot(projectId: string, chapterId: string, snapshot: AudioBatchSnapshot): Promise<void> {
    if (!snapshot.input.segmentId) throw new Error("批次缺少段落标识");
    const current = await prepareAudioBatchSnapshot(projectId, chapterId, snapshot.input.segmentId, snapshot.connector.id);
    if (current.fingerprint !== snapshot.fingerprint) throw new Error("脚本、音色、参考音频或连接已变化，请重新准备并确认批次");
}
