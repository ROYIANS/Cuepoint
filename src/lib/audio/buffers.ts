import {db as productDb} from "@/db/database";
import type {ProductStore} from "@/lib/storage/types";
import {AudioBufferCache, decodeAudioBlob} from "./engine";
import type {AudioSchedule} from "./schedule";
import {preflightAudioRender} from "./wav";
import {withBinaryReadLease} from "@/lib/storage/binary";

const cache = new AudioBufferCache();

export async function loadBuffers(schedule: AudioSchedule, store?: ProductStore) {
    preflightAudioRender(schedule.durationSec, schedule.sources);
    const buffers = new Map<string, AudioBuffer>();
    for (const source of schedule.sources) {
        const buffer = await loadAudioBuffer(source.mediaId, store);
        buffers.set(source.mediaId, buffer);
    }
    return buffers;
}


export async function loadAudioBuffer(mediaId: string, store?: ProductStore): Promise<AudioBuffer> {
    const db = store ?? productDb;
    const record = await db.media.get(mediaId);
    if (!record) throw new Error("音频原文件已不存在，无法完整播放或导出");
    return withBinaryReadLease(record.blob, async lease => {
        const key = `${mediaId}:${await lease.cacheIdentity()}`;
        const cached = cache.get(key);
        if (cached) return cached;
        const buffer = await decodeAudioBlob(await lease.readBlob());
        cache.set(key, buffer);
        return buffer;
    });
}
