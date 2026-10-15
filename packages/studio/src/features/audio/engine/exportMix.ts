import type {AudioExport} from "../models/audio";
import {addAudioExport} from "../commands/audio";
import {getAudioProjectSnapshot} from "../queries/snapshot";
import {flushPendingDrafts} from "../../../platform/product/drafts";
import {createId} from "../../../platform/identity";
import {buildAudioSchedule} from "./schedule";
import {loadBuffers} from "./buffers";
import {renderAudioMix} from "./engine";
import {createAudioExportFingerprint} from "./fingerprint";

export async function exportAudioMix({projectId, projectName, chapterId, scope}: {
    projectId: string; projectName: string; chapterId: string; scope: NonNullable<AudioExport["scope"]>;
}) {
    await flushPendingDrafts(projectId);
    const frozenSnapshot = await getAudioProjectSnapshot(projectId);
    const schedule = buildAudioSchedule(frozenSnapshot, scope === "chapter" ? chapterId : undefined);
    if (!schedule.clips.length) throw new Error("请先将音频放入时间线");
    const buffers = await loadBuffers(schedule);
    const result = await renderAudioMix(schedule, buffers);
    const mediaId = createId("med");
    const chapter = frozenSnapshot.chapters.find((row) => row.id === chapterId);
    const filename = `${projectName}-${scope === "chapter" ? chapter?.title ?? "章节" : "完整项目"}.wav`;
    await addAudioExport(projectId, {
        chapterId: scope === "chapter" ? chapterId : undefined,
        scope: scope === "chapter" ? "chapter" : "project",
        chapterTitle: scope === "chapter" ? chapter?.title : undefined,
        fingerprint: createAudioExportFingerprint(schedule),
        format: "wav",
        mediaId,
        durationSec: result.durationSec
    }, {id: mediaId, projectId, filename, blob: result.blob, mimeType: "audio/wav"});
    return {blob: result.blob, filename, attenuation: result.attenuation, attenuationDb: result.attenuationDb};
}
