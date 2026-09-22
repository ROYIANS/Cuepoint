import type { AudioSourceMetadata } from "@/domain/audio";
import type { AudioSchedule, ScheduledAudioClip } from "./schedule";
import { seekAudioSchedule } from "./schedule";
import { AUDIO_MEMORY_BUDGET, encodePcm16Wav, MIX_SAMPLE_RATE, preflightAudioRender } from "./wav";

export type AudioBufferMap = ReadonlyMap<string, AudioBuffer>;

export function audioBufferMetadata(buffer: AudioBuffer): AudioSourceMetadata {
  return { durationSec: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels };
}

export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  if (!blob.size) throw new Error("音频文件为空");
  if (blob.size > 32 * 1024 * 1024) throw new Error("单个文件超过 32 MB，请先拆分音频后导入");
  const context = new OfflineAudioContext(2, 1, MIX_SAMPLE_RATE);
  let buffer: AudioBuffer;
  try { buffer = await context.decodeAudioData(await blob.arrayBuffer()); }
  catch { throw new Error("无法解码音频，请尝试 WAV、MP3、AAC 或浏览器支持的格式"); }
  if (!buffer.length || buffer.length * buffer.numberOfChannels * 4 > AUDIO_MEMORY_BUDGET / 4) throw new Error("解码后的音频过大，请先拆分为较短的文件");
  return buffer;
}

/** Cache owns only decoded buffers; originals remain in IndexedDB. */
export class AudioBufferCache {
  private entries = new Map<string, AudioBuffer>();
  constructor(private readonly budget = 64 * 1024 * 1024) {}
  get(id: string) {
    const buffer = this.entries.get(id);
    if (buffer) { this.entries.delete(id); this.entries.set(id, buffer); }
    return buffer;
  }
  set(id: string, buffer: AudioBuffer) {
    this.entries.delete(id);
    if (buffer.length * buffer.numberOfChannels * 4 > this.budget) return;
    this.entries.set(id, buffer);
    while ([...this.entries.values()].reduce((sum, value) => sum + value.length * value.numberOfChannels * 4, 0) > this.budget) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
  }
  clear() { this.entries.clear(); }
}

export function validateScheduleBuffers(schedule: AudioSchedule, buffers: AudioBufferMap) {
  for (const clip of schedule.clips) {
    const buffer = buffers.get(clip.mediaId);
    if (!buffer) throw new Error(`声音来源尚未加载：${clip.mediaId}`);
    if (clip.offsetSec + clip.durationSec > buffer.duration + 1 / buffer.sampleRate) throw new Error("裁剪范围超过实际解码音频，无法完整播放或导出");
  }
}

/** Both live and offline contexts use exactly this graph and automation. */
export function scheduleAudioNodes(context: BaseAudioContext, clips: readonly ScheduledAudioClip[], buffers: AudioBufferMap, when = context.currentTime) {
  const nodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  try {
    for (const clip of clips) {
      const buffer = buffers.get(clip.mediaId);
      if (!buffer) throw new Error(`声音来源尚未加载：${clip.mediaId}`);
      const source = context.createBufferSource();
      const gain = context.createGain();
      nodes.push({ source, gain });
      source.buffer = buffer;
      // Explicit speaker mixing duplicates mono into stereo in both render paths.
      gain.channelCount = 2; gain.channelCountMode = "explicit"; gain.channelInterpretation = "speakers";
      source.connect(gain); gain.connect(context.destination);
      const start = when + clip.startSec;
      gain.gain.setValueAtTime(clip.envelope[0]?.gain ?? 0, start);
      for (const point of clip.envelope.slice(1)) gain.gain.linearRampToValueAtTime(point.gain, start + point.time);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(start, clip.offsetSec, clip.durationSec);
    }
  } catch (error) {
    for (const { source, gain } of nodes) { try { source.stop(); } catch { /* Not started. */ } source.disconnect(); gain.disconnect(); }
    throw error;
  }
  return () => {
    for (const { source, gain } of nodes) { source.onended = null; try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); gain.disconnect(); }
  };
}

export class AudioPreviewPlayer {
  private context: AudioContext | undefined;
  private cancel: (() => void) | undefined;
  private startedAt = 0;
  private position = 0;
  private duration = 0;
  private generation = 0;
  private disposed = false;
  get currentTime() { return Math.min(this.duration, this.position + (this.cancel && this.context ? Math.max(0, this.context.currentTime - this.startedAt) : 0)); }
  get playing() { return Boolean(this.cancel) && this.currentTime < this.duration; }
  async play(schedule: AudioSchedule, buffers: AudioBufferMap, seekSec = this.position) {
    if (this.disposed) throw new Error("播放器已关闭");
    this.pause();
    const generation = ++this.generation;
    validateScheduleBuffers(schedule, buffers);
    const clips = seekAudioSchedule(schedule, seekSec);
    this.context ??= new AudioContext({ sampleRate: MIX_SAMPLE_RATE });
    await this.context.resume();
    if (generation !== this.generation || this.disposed) return;
    this.position = Math.min(schedule.durationSec, seekSec); this.duration = schedule.durationSec;
    this.startedAt = this.context.currentTime + 0.025;
    this.cancel = scheduleAudioNodes(this.context, clips, buffers, this.startedAt);
  }
  pause() {
    this.position = this.currentTime; this.generation++;
    this.cancel?.(); this.cancel = undefined;
    return this.position;
  }
  async seek(schedule: AudioSchedule, buffers: AudioBufferMap, seconds: number) { await this.play(schedule, buffers, seconds); }
  async dispose() { this.disposed = true; this.pause(); await this.context?.close(); this.context = undefined; }
}

export async function renderAudioMix(schedule: AudioSchedule, buffers: AudioBufferMap, options: { signal?: AbortSignal } = {}) {
  options.signal?.throwIfAborted();
  validateScheduleBuffers(schedule, buffers);
  const sources = [...new Set(schedule.clips.map((clip) => clip.mediaId))].map((id) => audioBufferMetadata(buffers.get(id)!));
  const estimate = preflightAudioRender(schedule.durationSec, sources);
  const context = new OfflineAudioContext(2, estimate.frames, MIX_SAMPLE_RATE);
  const release = scheduleAudioNodes(context, seekAudioSchedule(schedule, 0), buffers, 0);
  // Offline rendering itself cannot be universally cancelled; discard cancelled results.
  try {
    const buffer = await context.startRendering();
    options.signal?.throwIfAborted();
    const result = encodePcm16Wav(buffer);
    options.signal?.throwIfAborted();
    return { ...result, durationSec: estimate.frames / MIX_SAMPLE_RATE, estimatedBytes: estimate.estimatedBytes };
  } finally { release(); }
}
