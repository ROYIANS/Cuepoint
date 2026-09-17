export const PACKAGE_FORMAT = "aifenjing-project-v1" as const;

export type Id = string;

export type MediaKind = "image" | "video";

export interface GenerationResult {
  mediaId: Id;
  kind: MediaKind;
}

export interface GenerationSlot {
  prompt: string;
  referenceImageIds: Id[];
  referenceVideoIds: Id[];
  result?: GenerationResult;
}

export type CharacterImageSlot =
  | "front"
  | "side"
  | "back"
  | "expression"
  | "costume";

export type SceneImageSlot = "wide" | "medium" | "detail";

export type ShotColumnId =
  | "category"
  | "durationSec"
  | "content"
  | "notes"
  | "sceneCloseup"
  | "sound"
  | "emotion"
  | "cameraAngle"
  | "cameraGear"
  | "focalLength"
  | "characters"
  | "scene";

export interface ShotSettings {
  defaultDurationSec: number;
  autoIncrementShotNumber: boolean;
}

export interface ColumnSettings {
  visible: ShotColumnId[];
}

export interface StoryBeat {
  id: Id;
  title: string;
  content: string;
}

export interface ProjectStory {
  logline: string;
  script: string;
  beats: StoryBeat[];
}

export interface WorldSetting {
  worldview: string;
  background: string;
  rules: string;
}

export interface Project {
  id: Id;
  name: string;
  createdAt: string;
  updatedAt: string;
  columnSettings: ColumnSettings;
  shotSettings: ShotSettings;
  story: ProjectStory;
  setting: WorldSetting;
  extra?: Record<string, unknown>;
}

export interface Character {
  id: Id;
  projectId: Id;
  name: string;
  bio: string;
  appearance: string;
  notes: string;
  slots: Partial<Record<CharacterImageSlot, GenerationSlot>>;
  createdAt: string;
  updatedAt: string;
  extra?: Record<string, unknown>;
}

export interface Scene {
  id: Id;
  projectId: Id;
  name: string;
  location: string;
  timeOfDay: string;
  atmosphere: string;
  notes: string;
  slots: Partial<Record<SceneImageSlot, GenerationSlot>>;
  createdAt: string;
  updatedAt: string;
  extra?: Record<string, unknown>;
}

export interface Shot {
  id: Id;
  projectId: Id;
  order: number;
  shotNumber: string;
  frame: GenerationSlot;
  reference: GenerationSlot;
  category: string;
  durationSec: number;
  content: string;
  notes: string;
  sceneCloseup: string;
  sound: string;
  emotion: string;
  cameraAngle: string;
  cameraGear: string;
  focalLength: string;
  characterIds: Id[];
  sceneId?: Id;
  beatId?: Id;
  extra?: Record<string, unknown>;
}

export interface MediaRecord {
  id: Id;
  projectId: Id;
  mimeType: string;
  filename: string;
  blob: Blob;
}

export const CHARACTER_SLOTS: { id: CharacterImageSlot; label: string }[] = [
  { id: "front", label: "正面" },
  { id: "side", label: "侧面" },
  { id: "back", label: "背面" },
  { id: "expression", label: "表情" },
  { id: "costume", label: "服装" },
];

export const SCENE_SLOTS: { id: SceneImageSlot; label: string }[] = [
  { id: "wide", label: "全景" },
  { id: "medium", label: "中景" },
  { id: "detail", label: "细节" },
];

export const DEFAULT_SHOT_SETTINGS: ShotSettings = {
  defaultDurationSec: 0,
  autoIncrementShotNumber: true,
};

export function emptyStory(): ProjectStory {
  return { logline: "", script: "", beats: [] };
}

export function normalizeStory(raw: unknown): ProjectStory {
  const story = emptyStory();
  if (!raw || typeof raw !== "object") return story;
  const record = raw as Record<string, unknown>;
  story.logline = String(record.logline ?? "");
  story.script = String(record.script ?? "");
  story.beats = Array.isArray(record.beats)
    ? record.beats
        .filter((beat): beat is Record<string, unknown> => Boolean(beat) && typeof beat === "object")
        .map((beat, index) => ({
          id: String(beat.id ?? `beat_${index}`),
          title: String(beat.title ?? ""),
          content: String(beat.content ?? ""),
        }))
    : [];
  return story;
}

export function emptySetting(): WorldSetting {
  return { worldview: "", background: "", rules: "" };
}

export function normalizeSetting(raw: unknown): WorldSetting {
  const setting = emptySetting();
  if (!raw || typeof raw !== "object") return setting;
  const record = raw as Record<string, unknown>;
  setting.worldview = String(record.worldview ?? "");
  setting.background = String(record.background ?? "");
  setting.rules = String(record.rules ?? "");
  return setting;
}

export const DEFAULT_VISIBLE_COLUMNS: ShotColumnId[] = [
  "category",
  "durationSec",
  "content",
  "notes",
  "sceneCloseup",
];
