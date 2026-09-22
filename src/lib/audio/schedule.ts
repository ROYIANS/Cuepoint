import type { AudioChapter, AudioTrack, AudioTake, AudioClip } from "@/domain/audio";

/** Seconds are always measured against the original source, never mutated audio. */
export type ScheduleChapter = Pick<AudioChapter, "id" | "order">;
export type ScheduleTrack = Pick<AudioTrack, "id" | "chapterId" | "gain" | "muted" | "solo">;
export type ScheduleTake = Pick<AudioTake, "id" | "mediaId" | "durationSec" | "sampleRate" | "channels">;
export type ScheduleClip = Pick<AudioClip, "id" | "chapterId" | "trackId" | "takeId" | "startSec" | "trimStartSec" | "trimEndSec" | "gain" | "fadeInSec" | "fadeOutSec">;
export interface AudioScheduleInput {
  chapters: readonly ScheduleChapter[]; tracks: readonly ScheduleTrack[];
  takes: readonly ScheduleTake[]; clips: readonly ScheduleClip[];
}
export interface EnvelopePoint { time: number; gain: number }
export interface ScheduledAudioClip {
  clipId: string; mediaId: string; startSec: number; offsetSec: number;
  durationSec: number; envelope: EnvelopePoint[];
}
export interface AudioSchedule {
  clips: ScheduledAudioClip[]; durationSec: number;
  sources: ScheduleTake[]; chapterOffsets: Record<string, number>;
}

function nonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}必须是有效的非负数`);
}

export function clipEnvelope(clip: Pick<ScheduleClip, "trimStartSec" | "trimEndSec" | "fadeInSec" | "fadeOutSec" | "gain">, trackGain = 1): EnvelopePoint[] {
  const duration = clip.trimEndSec - clip.trimStartSec;
  const fadeIn = clip.fadeInSec;
  const fadeOut = clip.fadeOutSec;
  const times = [0, duration];
  if (fadeIn) times.push(fadeIn);
  if (fadeOut) times.push(duration - fadeOut);
  // When fades overlap, their minimum has an additional intersection vertex.
  if (fadeIn + fadeOut > duration) times.push(duration * fadeIn / (fadeIn + fadeOut));
  return [...new Set(times)].sort((a, b) => a - b).map((time) => ({
    time,
    gain: clip.gain * trackGain * Math.min(1, fadeIn ? time / fadeIn : 1, fadeOut ? (duration - time) / fadeOut : 1),
  }));
}

export function envelopeGainAt(envelope: readonly EnvelopePoint[], time: number): number {
  if (!envelope.length) return 0;
  if (time <= envelope[0].time) return envelope[0].gain;
  for (let i = 1; i < envelope.length; i++) {
    const previous = envelope[i - 1];
    const next = envelope[i];
    if (time <= next.time) return previous.gain + (next.gain - previous.gain) * (time - previous.time) / (next.time - previous.time);
  }
  return envelope[envelope.length - 1].gain;
}

/** Returns a new schedule; chapters concatenate in order, with initial silence retained. */
export function buildAudioSchedule(input: AudioScheduleInput, chapterId?: string): AudioSchedule {
  const chapters = [...input.chapters].filter((chapter) => !chapterId || chapter.id === chapterId).sort((a, b) => a.order - b.order);
  if (chapterId && !chapters.length) throw new Error("找不到音频章节");
  const takes = new Map(input.takes.map((take) => [take.id, take]));
  const result: AudioSchedule = { clips: [], durationSec: 0, sources: [], chapterOffsets: {} };
  const usedMedia = new Map<string, ScheduleTake>();
  for (const chapter of chapters) {
    const tracks = input.tracks.filter((track) => track.chapterId === chapter.id);
    const anySolo = tracks.some((track) => track.solo);
    const trackMap = new Map(tracks.map((track) => [track.id, track]));
    let chapterDuration = 0;
    result.chapterOffsets[chapter.id] = result.durationSec;
    for (const clip of input.clips.filter((candidate) => candidate.chapterId === chapter.id)) {
      const track = trackMap.get(clip.trackId);
      const take = takes.get(clip.takeId);
      if (!track || !take) throw new Error("片段的轨道或声音来源缺失");
      for (const [label, value] of Object.entries({ startSec: clip.startSec, trimStartSec: clip.trimStartSec, trimEndSec: clip.trimEndSec, gain: clip.gain, fadeInSec: clip.fadeInSec, fadeOutSec: clip.fadeOutSec, trackGain: track.gain, durationSec: take.durationSec })) nonnegative(value, label);
      const duration = clip.trimEndSec - clip.trimStartSec;
      if (duration <= 0 || clip.trimEndSec > take.durationSec + 1e-6 || clip.fadeInSec > duration || clip.fadeOutSec > duration) throw new Error("片段裁剪或淡入淡出超出声音长度");
      if (track.muted || (anySolo && !track.solo) || track.gain === 0 || clip.gain === 0) continue;
      chapterDuration = Math.max(chapterDuration, clip.startSec + duration);
      result.clips.push({ clipId: clip.id, mediaId: take.mediaId, startSec: result.durationSec + clip.startSec, offsetSec: clip.trimStartSec, durationSec: duration, envelope: clipEnvelope(clip, track.gain) });
      usedMedia.set(take.mediaId, { ...take });
    }
    result.durationSec += chapterDuration;
  }
  result.clips.sort((a, b) => a.startSec - b.startSec);
  result.sources = [...usedMedia.values()];
  return result;
}

/** Seek preserves the gain already reached within a fade and the source offset. */
export function seekAudioSchedule(schedule: AudioSchedule, seekSec: number): ScheduledAudioClip[] {
  nonnegative(seekSec, "播放位置");
  return schedule.clips.flatMap((clip) => {
    const elapsed = Math.max(0, seekSec - clip.startSec);
    if (elapsed >= clip.durationSec) return [];
    return [{ ...clip, startSec: Math.max(0, clip.startSec - seekSec), offsetSec: clip.offsetSec + elapsed, durationSec: clip.durationSec - elapsed,
      envelope: [{ time: 0, gain: envelopeGainAt(clip.envelope, elapsed) }, ...clip.envelope.filter((point) => point.time > elapsed).map((point) => ({ time: point.time - elapsed, gain: point.gain }))] }];
  });
}
