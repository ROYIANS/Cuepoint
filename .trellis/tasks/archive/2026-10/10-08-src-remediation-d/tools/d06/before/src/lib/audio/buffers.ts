import {db} from "@/db/database";
import {AudioBufferCache, decodeAudioBlob} from "./engine";
import type {AudioSchedule} from "./schedule";
import {preflightAudioRender} from "./wav";

const cache = new AudioBufferCache();

export async function loadBuffers(schedule: AudioSchedule) {
    preflightAudioRender(schedule.durationSec, schedule.sources);
    const buffers = new Map<string, AudioBuffer>();
    for (const source of schedule.sources) {
        const buffer = await loadAudioBuffer(source.mediaId);
        buffers.set(source.mediaId, buffer);
    }
    return buffers;
}


export async function loadAudioBuffer(mediaId: string): Promise<AudioBuffer> {
    let buffer = cache.get(mediaId);
    if (!buffer) {
        const record = await db.media.get(mediaId);
        if (!record) throw new Error("音频原文件已不存在，无法完整播放或导出");
        buffer = await decodeAudioBlob(record.blob);
        cache.set(mediaId, buffer);
    }
    return buffer;
}
