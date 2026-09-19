import type { ContextPolicy } from "./context";
import type { ProjectGenerationDefaults } from "@/domain/output";

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

export const SHOT_STATUSES = [
  "draft",
  "ready",
  "framed",
  "clipped",
  "approved",
] as const;

export type ShotStatus = (typeof SHOT_STATUSES)[number];

export const SHOT_STATUS_LABELS: Record<ShotStatus, string> = {
  draft: "草稿",
  ready: "可生成",
  framed: "已出图",
  clipped: "已成片",
  approved: "通过",
};

export function normalizeShotStatus(raw: unknown): ShotStatus {
  return SHOT_STATUSES.includes(raw as ShotStatus) ? (raw as ShotStatus) : "draft";
}

export type ShotGapFilter = "missingFirstFrame" | "missingClip";

export const SHOT_UNASSIGNED_BEAT = "none" as const;

export interface ShotFilters {
  statuses: ShotStatus[];
  beatIds: string[];
  gaps: ShotGapFilter[];
}

export const DEFAULT_SHOT_FILTERS: ShotFilters = {
  statuses: [],
  beatIds: [],
  gaps: [],
};

export function normalizeShotFilters(raw: unknown): ShotFilters {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const statuses = Array.isArray(record.statuses)
    ? record.statuses
        .filter((value): value is ShotStatus =>
          SHOT_STATUSES.includes(value as ShotStatus),
        )
        .filter((value, index, list) => list.indexOf(value) === index)
    : [];
  const beatIds = Array.isArray(record.beatIds)
    ? record.beatIds
        .map((value) => String(value))
        .filter((value, index, list) => list.indexOf(value) === index)
    : [];
  const gaps = Array.isArray(record.gaps)
    ? record.gaps
        .filter(
          (value): value is ShotGapFilter =>
            value === "missingFirstFrame" || value === "missingClip",
        )
        .filter((value, index, list) => list.indexOf(value) === index)
    : [];
  return { statuses, beatIds, gaps };
}

export function shotFiltersActive(filters: ShotFilters): boolean {
  return (
    filters.statuses.length > 0 ||
    filters.beatIds.length > 0 ||
    filters.gaps.length > 0
  );
}

export interface ShotSettings {
  defaultDurationSec: number;
  autoIncrementShotNumber: boolean;
  workspaceView: ShotWorkspaceView;
  filters: ShotFilters;
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
  /** Episode-local filters. Missing on legacy records only. */
  shotFilters?: ShotFilters;
  createdAt: string;
  updatedAt: string;
  extra?: Record<string, unknown>;
}

/** Read legacy preferences without leaking another episode's beat IDs. */
export function getEpisodeShotFilters(
  episode: Pick<Episode, "story" | "shotFilters">,
  project?: Pick<Project, "shotSettings">,
): ShotFilters {
  const filters = normalizeShotFilters(episode.shotFilters ?? project?.shotSettings?.filters);
  const beatIds = new Set(normalizeEpisodeStory(episode.story).beats.map((beat) => beat.id));
  return { ...filters, beatIds: filters.beatIds.filter((id) => id === SHOT_UNASSIGNED_BEAT || beatIds.has(id)) };
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

export const ASPECT_PRESET_IDS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;

export type AspectPresetId = (typeof ASPECT_PRESET_IDS)[number];

export const ASPECT_PRESETS: Record<
  AspectPresetId,
  { width: number; height: number; label: string }
> = {
  "21:9": { width: 2520, height: 1080, label: "21:9" },
  "4:3": { width: 1440, height: 1080, label: "4:3" },
  "3:4": { width: 1080, height: 1440, label: "3:4" },
  "16:9": { width: 1920, height: 1080, label: "16:9" },
  "9:16": { width: 1080, height: 1920, label: "9:16" },
  "1:1": { width: 1080, height: 1080, label: "1:1" },
};

export function normalizeAspectPreset(raw: unknown): AspectPresetId {
  return ASPECT_PRESET_IDS.includes(raw as AspectPresetId)
    ? (raw as AspectPresetId)
    : "16:9";
}

export function resolutionForAspect(preset: AspectPresetId): {
  width: number;
  height: number;
} {
  const { width, height } = ASPECT_PRESETS[normalizeAspectPreset(preset)];
  return { width, height };
}

export interface Project {
  defaultStyleId?: Id;
  generationDefaults?: ProjectGenerationDefaults;
  brief?: string;
  genre?: string;
  audience?: string;
  tone?: string;
  id: Id;
  name: string;
  mode: ProjectMode;
  aspectPreset: AspectPresetId;
  coverMediaId?: Id;
  createdAt: string;
  updatedAt: string;
  columnSettings: ColumnSettings;
  shotSettings: ShotSettings;
  story: ProjectStory;
  setting: WorldSetting;
  extra?: Record<string, unknown>;
}

export interface Character {
  personality?: string;
  motivation?: string;
  voice?: string;
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
  geography?: string;
  lighting?: string;
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
  appearance?: string;
  material?: string;
  size?: string;
  usage?: string;
  continuity?: string;
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
  palette?: string;
  lighting?: string;
  lens?: string;
  composition?: string;
  negativePrompt?: string;
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
  propIds?: Id[];
  /** Undefined inherits project default; null explicitly disables style. */
  styleId?: Id | null;
  id: Id;
  projectId: Id;
  episodeId: Id;
  order: number;
  shotNumber: string;
  status: ShotStatus;
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
  filters: { ...DEFAULT_SHOT_FILTERS },
};

export function normalizeShotSettings(raw: unknown): ShotSettings {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    defaultDurationSec: Math.max(0, Number(record.defaultDurationSec) || 0),
    autoIncrementShotNumber: record.autoIncrementShotNumber !== false,
    workspaceView: normalizeShotWorkspaceView(record.workspaceView),
    filters: normalizeShotFilters(record.filters),
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

/** Studio-global BYOK connectors (not part of project ZIP). */
export type ConnectorProtocol = "openai-compatible";

export type ConnectorDefinitionId = "openai-compatible" | "deepseek" | "apimart" | "aihubmix";

export interface ConnectorConfig {
  id: Id;
  definitionId: ConnectorDefinitionId;
  protocol: ConnectorProtocol;
  label?: string;
  baseUrl: string;
  apiKey: string;
  /** Optional; unused by Agent chat (model picked there). Kept for probe fallback only. */
  defaultModel?: string;
  updatedAt: string;
}

/** Studio-global Agent chat (not part of project ZIP). */
export type ChatMessageRole = "user" | "assistant" | "system";

export type ChatMessageStatus = "pending" | "streaming" | "complete" | "error" | "aborted" | "interrupted";

export interface ChatThread {
  excludedMemoryIds?: Id[];
  projectId?: Id;
  taskMode?: boolean;
  contextPolicy?: ContextPolicy;
  interactionMode?: import("./agent").AgentInteractionMode;
  reasoningSelection?: { connectorId: Id; baseUrl: string; model: string; value?: import("./agent").AgentReasoningEffort };
  id: Id;
  title: string;
  connectorId?: Id;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  runId?: Id;
  /** Execution notices are separate from answer content and never sent as history. */
  error?: string;
  id: Id;
  threadId: Id;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  status?: ChatMessageStatus;
  /** Model chain-of-thought / reasoning text (not re-sent on follow-ups). */
  reasoning?: string;
  /** Wall time from first reasoning delta to first answer content delta. */
  reasoningDurationMs?: number;
}
