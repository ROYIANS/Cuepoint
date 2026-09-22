import type { AudioRow, AudioProvenance } from "./audio";
import type { MusicSettings } from "./music";
import type { Id } from "./types";
export type AudioGenerationInput =
  | { kind: "speech"; text: string; voice: string; speed: number; segmentId?: Id; segmentRevision?: number }
  | { kind: "music"; settings: MusicSettings; draftId?: Id; draftRevision?: number };
export type AudioGenerationStatus = "prepared" | "submitting" | "uncertain" | "submitted" | "running" | "remote-completed" | "downloading" | "saved" | "failed" | "target-conflict";
export interface AudioGenerationResult {
  key: string;
  provenance: AudioProvenance;
  title: string;
  lyrics?: string;
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
  connector: { id: Id; provider: "apimart"; baseUrl: string };
  source: { kind: "manual" } | { kind: "agent"; callId: Id; runId: Id };
  status: AudioGenerationStatus;
  taskIds: string[];
  results: AudioGenerationResult[];
  error?: string;
  claim?: { owner: string; claimedAt: string };
  /** Imported jobs are historical and never auto-submit or auto-poll. */
  dormant?: boolean;
}
