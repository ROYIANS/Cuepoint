export const MIX_SAMPLE_RATE = 48_000;
export const AUDIO_MEMORY_BUDGET = 256 * 1024 * 1024;

export interface PcmAudio {
  length: number; sampleRate: number; numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

/** Uniform attenuation only when needed; preserves balance and dynamics. */
export function encodePcm16Wav(audio: PcmAudio): { blob: Blob; peak: number; attenuation: number; attenuationDb: number } {
  if (audio.sampleRate !== MIX_SAMPLE_RATE || audio.numberOfChannels < 1 || audio.numberOfChannels > 2 || !Number.isSafeInteger(audio.length) || audio.length < 1) throw new Error("混音必须为 48 kHz 单声道或立体声音频");
  const bytes = audio.length * 4;
  if (bytes + 44 > AUDIO_MEMORY_BUDGET || bytes > 0xffffffff - 36) throw new Error("WAV 文件过大，请按章节导出");
  const left = audio.getChannelData(0);
  const right = audio.getChannelData(audio.numberOfChannels === 1 ? 0 : 1);
  if (left.length !== audio.length || right.length !== audio.length) throw new Error("音频采样长度不一致");
  let peak = 0;
  for (let i = 0; i < audio.length; i++) {
    if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw new Error("混音包含无效采样");
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const attenuation = peak > 1 ? 1 / peak : 1;
  const output = new ArrayBuffer(44 + bytes);
  const view = new DataView(output);
  const writeText = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  writeText(0, "RIFF"); view.setUint32(4, bytes + 36, true); writeText(8, "WAVE");
  writeText(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 2, true); view.setUint32(24, MIX_SAMPLE_RATE, true);
  view.setUint32(28, MIX_SAMPLE_RATE * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  writeText(36, "data"); view.setUint32(40, bytes, true);
  for (let i = 0; i < audio.length; i++) {
    for (let channel = 0; channel < 2; channel++) {
      const sample = Math.max(-1, Math.min(1, (channel ? right[i] : left[i]) * attenuation));
      view.setInt16(44 + i * 4 + channel * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
  }
  return { blob: new Blob([output], { type: "audio/wav" }), peak, attenuation, attenuationDb: 20 * Math.log10(attenuation) };
}

export function preflightAudioRender(durationSec: number, sources: readonly { durationSec: number; sampleRate: number; channels: number }[], budget = AUDIO_MEMORY_BUDGET) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error("时间线没有可导出的声音");
  let decodedBytes = 0;
  for (const source of sources) {
    if (![source.durationSec, source.sampleRate, source.channels].every((n) => Number.isFinite(n) && n > 0) || !Number.isInteger(source.channels) || source.channels > 32) throw new Error("声音元数据无效");
    // Include decode resampling to 48 kHz and an extra working copy.
    decodedBytes += Math.ceil(source.durationSec * Math.max(MIX_SAMPLE_RATE, source.sampleRate)) * source.channels * 4 * 2;
  }
  const frames = Math.ceil(durationSec * MIX_SAMPLE_RATE);
  const outputBytes = frames * 4 + 44;
  // Native output + render working copy + WAV array + Blob copy, plus 16 MiB overhead.
  const estimatedBytes = decodedBytes + frames * 2 * 4 * 2 + outputBytes * 2 + 16 * 1024 * 1024;
  if (!Number.isSafeInteger(frames) || !Number.isFinite(budget) || budget <= 0 || estimatedBytes > budget || outputBytes > 0xffffffff - 36) throw new Error(`预计需要 ${Math.ceil(estimatedBytes / 1024 / 1024)} MB 音频内存，请按章节导出或缩短音频`);
  return { frames, estimatedBytes, outputBytes, budget };
}
