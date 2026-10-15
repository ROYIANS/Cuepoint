import type {AudioInput, AudioRow, AudioSourceMetadata} from "./audio";
import {createId, nowIso} from "../../../platform/identity";

export function finiteAudioNumber(value: number, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label}超出有效范围`);
}

export function validateAudioMetadata(source: AudioSourceMetadata) {
    finiteAudioNumber(source.durationSec, "音频时长", Number.EPSILON);
    finiteAudioNumber(source.sampleRate, "采样率", 1, 384000);
    finiteAudioNumber(source.channels, "声道数", 1, 32);
    if (!Number.isInteger(source.sampleRate) || !Number.isInteger(source.channels)) throw new Error("采样率与声道数必须为整数");
}

export function assertAudioRevision(row: AudioRow, expectedRevision: number) {
    if (row.revision !== expectedRevision) throw new Error("内容已被其他操作修改，请刷新后重试");
}

export function newAudioRow<T extends AudioRow>(projectId: string, prefix: string, input: AudioInput<T>): T {
    const at = nowIso();
    return {...input, id: createId(prefix), projectId, revision: 1, createdAt: at, updatedAt: at} as T;
}
