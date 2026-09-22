import type { AudioClip, AudioProjectSnapshot } from "@/domain/audio";

export function timelineGeometry(durationSec: number, viewportWidth: number, zoomFactor = 1) {
  const available = Math.max(120, viewportWidth - 112);
  const span = Math.max(1, durationSec * 1.08);
  const pixelsPerSecond = available / span * Math.max(0.5, Math.min(12, zoomFactor));
  const width = Math.max(available, span * pixelsPerSecond);
  const intervals = [.05, .1, .2, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  const step = intervals.find((interval) => interval * pixelsPerSecond >= 72) ?? 3600;
  const ticks = Array.from({ length: Math.min(500, Math.floor(width / pixelsPerSecond / step) + 1) }, (_, i) => i * step);
  return { pixelsPerSecond, width, step, ticks, durationSec: width / pixelsPerSecond };
}

export function snapTimelinePosition(value: number, clipDuration: number, targets: readonly number[], pixelsPerSecond: number, enabled: boolean) {
  const candidate = Math.max(0, value);
  if (!enabled || pixelsPerSecond <= 0) return candidate;
  const tolerance = 7 / pixelsPerSecond;
  let result = candidate, distance = tolerance;
  for (const target of targets) for (const edge of [0, clipDuration]) {
    const adjusted = target - edge;
    const delta = Math.abs(adjusted - candidate);
    if (adjusted >= 0 && delta <= distance) { result = adjusted; distance = delta; }
  }
  return result;
}

export function timelineClipLabel(clip: AudioClip, snapshot: AudioProjectSnapshot) {
  const take = snapshot.takes.find((row) => row.id === clip.takeId);
  const segment = take?.segmentId ? snapshot.segments.find((row) => row.id === take.segmentId) : undefined;
  const speaker = segment?.speakerId ? snapshot.speakers.find((row) => row.id === segment.speakerId) : undefined;
  const track = snapshot.tracks.find((row) => row.id === clip.trackId);
  return { title: segment?.text.trim() || take?.name || "声音片段", speaker: speaker?.name || (track?.role === "music" ? "背景音乐" : track?.role === "effects" ? "音效" : "旁白"), segmentId: segment?.id };
}

export function formatTimelineTick(seconds: number, step: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(step < 1 ? (step < .1 ? 2 : 1) : 0).padStart(step < 1 ? (step < .1 ? 5 : 4) : 2, "0")}`;
}
