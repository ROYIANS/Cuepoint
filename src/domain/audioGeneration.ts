import type { AudioRow, AudioProvenance, MimoSpeechSettings } from "./audio";
import type { MusicSettings } from "./music";
import type { Id } from "./types";
export type AudioGenerationInput =
  | { kind: "speech"; text: string; voice: string; speed: number; mimo?: MimoSpeechSettings; segmentId?: Id; segmentRevision?: number }
  | { kind: "music"; settings: MusicSettings; draftId?: Id; draftRevision?: number };
export type AudioGenerationStatus = "prepared" | "submitting" | "uncertain" | "submitted" | "running" | "remote-completed" | "downloading" | "saved" | "failed" | "target-conflict";
export type AudioTaskVerifiedStatus = "pending" | "processing" | "completed" | "failed";
export interface AudioTaskObservation {
  taskId: string;
  checkedAt: string;
  status: AudioTaskVerifiedStatus | "unknown" | "query-failed";
  /** Historical provider fact; an unsuccessful check never refreshes its timestamp. */
  lastVerified?: { status: AudioTaskVerifiedStatus; observedAt: string };
}
export interface AudioGenerationResult {
  key: string;
  provenance: AudioProvenance;
  title: string;
  lyrics?: string;
  finalTextPreview?: string;
  durationSec?: number;
  mediaId?: Id;
  takeId?: Id;
  workId?: Id;
  /** User removed the saved take/work. Keep source history; never recreate it on refresh. */
  deleted?: boolean;
  error?: string;
}
export interface AudioGenerationJob extends AudioRow {
  intentId: string;
  input: AudioGenerationInput;
  connector: { id: Id; provider: "apimart" | "mimo"; baseUrl: string };
  source: { kind: "manual" } | { kind: "agent"; callId: Id; runId: Id };
  status: AudioGenerationStatus;
  taskIds: string[];
  taskObservations?: AudioTaskObservation[];
  results: AudioGenerationResult[];
  error?: string;
  referenceFingerprint?: string;
  claim?: { owner: string; claimedAt: string };
  /** Imported jobs are historical and never auto-submit or auto-poll. */
  dormant?: boolean;
}
