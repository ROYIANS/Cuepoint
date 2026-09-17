export const PACKAGE_FORMAT = "aifenjing-project-v1" as const;

export const STUDIO_LIBRARY_ID = "studio" as const;

export type Id = string;

export function isStudioLibrary(ownerId: Id): boolean {
  return ownerId === STUDIO_LIBRARY_ID;
}

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

export type PropImageSlot = "hero" | "detail" | "worn";

export type StyleImageSlot = "look" | "light" | "lens";

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

export type ShotWorkspaceView = "design" | "media";

export function normalizeShotWorkspaceView(raw: unknown): ShotWorkspaceView {
  return raw === "media" ? "media" : "design";
}

export interface ShotSettings {
  defaultDurationSec: number;
  autoIncrementShotNumber: boolean;
  workspaceView: ShotWorkspaceView;
}

export interface ColumnSettings {
  visible: ShotColumnId[];
}

export interface StoryBeat {
  id: Id;
  title: string;
  content: string;
  characterIds: Id[];
  sceneId?: Id;
  timeOfDay: string;
  scriptRange?: {
    start: number;
    end: number;
    excerpt: string;
  };
}

export interface ProjectStory {
  logline: string;
}

export interface EpisodeStory {
  logline: string;
  script: string;
  beats: StoryBeat[];
}

export interface Episode {
  id: Id;
  projectId: Id;
  order: number;
  title: string;
  story: EpisodeStory;
  createdAt: string;
  updatedAt: string;
  extra?: Record<string, unknown>;
}

export interface WorldSetting {
  worldview: string;
  background: string;
  rules: string;
}

export type ProjectMode = "film" | "series";

export function normalizeProjectMode(raw: unknown): ProjectMode {
  return raw === "film" ? "film" : "series";
}

export interface Project {
  id: Id;
  name: string;
  mode: ProjectMode;
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

export interface Prop {
  id: Id;
  projectId: Id;
  name: string;
  kind: string;
  notes: string;
  slots: Partial<Record<PropImageSlot, GenerationSlot>>;
  createdAt: string;
  updatedAt: string;
  extra?: Record<string, unknown>;
}

export interface VisualStyle {
  id: Id;
  projectId: Id;
  name: string;
  notes: string;
  slots: Partial<Record<StyleImageSlot, GenerationSlot>>;
  createdAt: string;
  updatedAt: string;
  extra?: Record<string, unknown>;
}

export type ShotPictureField = "firstFrame" | "lastFrame" | "clip";

export interface Shot {
  id: Id;
  projectId: Id;
  episodeId: Id;
  order: number;
  shotNumber: string;
  firstFrame: GenerationSlot;
  lastFrame: GenerationSlot;
  clip: GenerationSlot;
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

export const PROP_SLOTS: { id: PropImageSlot; label: string }[] = [
  { id: "hero", label: "主图" },
  { id: "detail", label: "细节" },
  { id: "worn", label: "使用" },
];

export const STYLE_SLOTS: { id: StyleImageSlot; label: string }[] = [
  { id: "look", label: "画面" },
  { id: "light", label: "光色" },
  { id: "lens", label: "镜头气质" },
];

export const DEFAULT_SHOT_SETTINGS: ShotSettings = {
  defaultDurationSec: 0,
  autoIncrementShotNumber: true,
  workspaceView: "design",
};

export function normalizeShotSettings(raw: unknown): ShotSettings {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    defaultDurationSec: Math.max(0, Number(record.defaultDurationSec) || 0),
    autoIncrementShotNumber: record.autoIncrementShotNumber !== false,
    workspaceView: normalizeShotWorkspaceView(record.workspaceView),
  };
}

export function emptySeriesStory(): ProjectStory {
  return { logline: "" };
}

export function normalizeSeriesStory(raw: unknown): ProjectStory {
  const story = emptySeriesStory();
  if (!raw || typeof raw !== "object") return story;
  const record = raw as Record<string, unknown>;
  story.logline = String(record.logline ?? "");
  return story;
}

export function emptyEpisodeStory(): EpisodeStory {
  return { logline: "", script: "", beats: [] };
}

export function normalizeStoryBeat(raw: unknown, index: number): StoryBeat {
  const beat =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const normalized: StoryBeat = {
    id: String(beat.id ?? `beat_${index}`),
    title: String(beat.title ?? ""),
    content: String(beat.content ?? ""),
    characterIds: Array.isArray(beat.characterIds)
      ? beat.characterIds.map((id) => String(id))
      : [],
    sceneId: beat.sceneId ? String(beat.sceneId) : undefined,
    timeOfDay: String(beat.timeOfDay ?? ""),
  };
  if (beat.scriptRange && typeof beat.scriptRange === "object") {
    const range = beat.scriptRange as Record<string, unknown>;
    const start = Number(range.start);
    const end = Number(range.end);
    const excerpt = String(range.excerpt ?? "");
    if (
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end > start &&
      excerpt.length === end - start
    ) {
      normalized.scriptRange = { start, end, excerpt };
    }
  }
  return normalized;
}

export function normalizeEpisodeStory(raw: unknown): EpisodeStory {
  const story = emptyEpisodeStory();
  if (!raw || typeof raw !== "object") return story;
  const record = raw as Record<string, unknown>;
  story.logline = String(record.logline ?? "");
  story.script = String(record.script ?? "");
  story.beats = Array.isArray(record.beats)
    ? record.beats.map((beat, index) => {
        const normalized = normalizeStoryBeat(beat, index);
        if (
          normalized.scriptRange &&
          story.script.slice(normalized.scriptRange.start, normalized.scriptRange.end) !==
            normalized.scriptRange.excerpt
        ) {
          delete normalized.scriptRange;
        }
        return normalized;
      })
    : [];
  return story;
}

export function episodeLabel(episode: Pick<Episode, "order" | "title">): string {
  const heading = `第${episode.order + 1}集`;
  const title = episode.title.trim();
  return title ? `${heading} · ${title}` : heading;
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
  "durationSec",
  "content",
  "characters",
  "scene",
  "notes",
];
