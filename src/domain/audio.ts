import type { Id } from "./types";

export interface AudioRow {
  id: Id;
  projectId: Id;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface AudioChapter extends AudioRow { title: string; order: number }
export interface AudioSpeaker extends AudioRow {
  name: string;
  voice?: string;
  speed?: number;
}
export interface AudioSegment extends AudioRow {
  chapterId: Id;
  speakerId?: Id;
  order: number;
  text: string;
  notes: string;
  selectedTakeId?: Id;
}
export interface AudioSourceMetadata { durationSec: number; sampleRate: number; channels: number }
export interface AudioProvenance {
  provider: "apimart";
  model: string;
  taskId?: string;
  clipId?: string;
  /** Original provider result position, never the UI sort order. */
  audioIndex?: number;
  jobId?: Id;
  audioUrl?: string;
  coverUrl?: string;
}
export interface AudioTake extends AudioRow, AudioSourceMetadata {
  segmentId?: Id;
  mediaId: Id;
  name: string;
  source: "recording" | "upload" | "library" | "tts" | "music";
  textSnapshot?: string;
  provenance?: AudioProvenance;
}
export interface AudioTrack extends AudioRow {
  chapterId: Id;
  role: "voice" | "music" | "effects";
  name: string;
  order: number;
  gain: number;
  muted: boolean;
  solo: boolean;
}
export interface AudioClip extends AudioRow {
  chapterId: Id;
  trackId: Id;
  takeId: Id;
  startSec: number;
  trimStartSec: number;
  trimEndSec: number;
  gain: number;
  fadeInSec: number;
  fadeOutSec: number;
}
export interface AudioExport extends AudioRow {
  chapterId?: Id;
  scope?: "chapter" | "project";
  chapterTitle?: string;
  fingerprint: string;
  format: "wav";
  mediaId: Id;
  durationSec: number;
}
export interface AudioProjectSnapshot {
  chapters: AudioChapter[];
  speakers: AudioSpeaker[];
  segments: AudioSegment[];
  takes: AudioTake[];
  tracks: AudioTrack[];
  clips: AudioClip[];
  exports: AudioExport[];
}
export type AudioInput<T extends AudioRow> = Omit<T, keyof AudioRow>;
export type AudioPatch<T extends AudioRow> = Partial<AudioInput<T>>;
