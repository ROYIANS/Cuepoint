import type { AudioProvenance, AudioRow, AudioSourceMetadata } from "./audio";
import type { Id } from "./types";
export type MusicSettings =
  | { engine: "flowmusic"; soundPrompt: string; lyrics: string; title: string; bpm?: string; lengthSec?: number; seed?: string }
  | { engine: "suno"; version: "v6" | "v6-wild" | "v6-mini"; custom: boolean; instrumental: boolean; prompt: string; title: string; style: string; negativeTags: string; durationSec?: number };
export interface MusicDraft extends AudioRow { settings: MusicSettings }
export interface MusicWork extends AudioRow, AudioSourceMetadata {
  mediaId: Id;
  title: string;
  notes: string;
  favorite: boolean;
  lyrics: string;
  settings?: MusicSettings;
  provenance?: AudioProvenance;
}
export function defaultMusicSettings(engine: MusicSettings["engine"] = "suno"): MusicSettings {
  return engine === "flowmusic"
    ? { engine, soundPrompt: "", lyrics: "", title: "" }
    : { engine, version: "v6", custom: false, instrumental: false, prompt: "", title: "", style: "", negativeTags: "" };
}
