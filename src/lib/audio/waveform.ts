import type { PcmAudio } from "./wav";

export interface WaveformPeak { min: number; max: number }

/** Real extrema across all channels; bounded output is safe to use while dragging. */
export function createWaveformPeaks(audio: PcmAudio, count = 800): WaveformPeak[] {
  if (!Number.isInteger(count) || count < 1 || count > 10_000) throw new Error("波形精度无效");
  const buckets = Math.min(count, audio.length);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel));
  return Array.from({ length: buckets }, (_, bucket) => {
    let min = 0; let max = 0;
    const start = Math.floor(bucket * audio.length / buckets);
    const end = Math.floor((bucket + 1) * audio.length / buckets);
    for (const channel of channels) for (let i = start; i < end; i++) { min = Math.min(min, channel[i]); max = Math.max(max, channel[i]); }
    return { min, max };
  });
}
