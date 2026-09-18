import { validShotMediaId, type ShotMediaIndex } from "@/lib/shotMedia";
import { SHOT_COLUMNS, normalizeVisibleColumns } from "@/domain/columns";
import {
  SHOT_STATUS_LABELS,
  episodeLabel,
  normalizeEpisodeStory,
  normalizeShotStatus,
} from "@/domain/types";
import type {
  Character,
  Episode,
  Id,
  Project,
  Scene,
  Shot,
  ShotColumnId,
  ShotStatus,
} from "@/domain/types";

const BASE_COLUMNS = new Set<ShotColumnId>([
  "content",
  "durationSec",
  "characters",
  "scene",
  "notes",
]);

export interface EpisodeDeliveryColumn {
  id: string;
  label: string;
}

export interface EpisodeDeliveryRow {
  shot: Shot;
  order: number;
  shotNumber: string;
  status: ShotStatus;
  statusLabel: string;
  beat: string;
  content: string;
  durationSec: number;
  characters: string;
  scene: string;
  notes: string;
  visualMediaId?: Id;
  values: Record<string, string>;
  missing: Array<"content" | "duration" | "scene" | "firstFrame" | "clip">;
}

export interface EpisodeDelivery {
  project: Project;
  episode: Episode;
  columns: EpisodeDeliveryColumn[];
  rows: EpisodeDeliveryRow[];
  beatCount: number;
  totalDurationSec: number;
}

export function deriveEpisodeDelivery(input: {
  project: Project;
  episode: Episode;
  shots: Shot[];
  characters: Character[];
  scenes: Scene[];
  media: ShotMediaIndex;
}): EpisodeDelivery {
  const { project, episode } = input;
  const characterNames = new Map(input.characters.map((item) => [item.id, item.name]));
  const sceneNames = new Map(input.scenes.map((item) => [item.id, item.name]));
  const beats = normalizeEpisodeStory(episode.story).beats;
  const beatNames = new Map(beats.map((beat) => [beat.id, beat.title || "未命名场"]));
  const columns = SHOT_COLUMNS.filter(
    (column) =>
      normalizeVisibleColumns(project.columnSettings.visible).includes(column.id) &&
      !BASE_COLUMNS.has(column.id),
  ).map(({ id, label }) => ({ id, label }));

  const rows = [...input.shots]
    .filter((shot) => shot.projectId === project.id && shot.episodeId === episode.id)
    .sort((left, right) => left.order - right.order)
    .map((shot, index): EpisodeDeliveryRow => {
      const values = Object.fromEntries(
        columns.map((column) => [column.id, String(shot[column.id as keyof Shot] ?? "")]),
      );
      const missing: EpisodeDeliveryRow["missing"] = [];
      if (!shot.content.trim()) missing.push("content");
      if (!(Number(shot.durationSec) > 0)) missing.push("duration");
      if (!shot.sceneId || !sceneNames.has(shot.sceneId)) missing.push("scene");
      if (!validShotMediaId(shot.firstFrame.result, "image", project.id, input.media)) missing.push("firstFrame");
      if (!validShotMediaId(shot.clip.result, "video", project.id, input.media)) missing.push("clip");
      const status = normalizeShotStatus(shot.status);

      return {
        shot,
        order: index + 1,
        shotNumber: shot.shotNumber,
        status,
        statusLabel: SHOT_STATUS_LABELS[status],
        beat: shot.beatId ? (beatNames.get(shot.beatId) ?? "未分场") : "未分场",
        content: shot.content,
        durationSec: Math.max(0, Number(shot.durationSec) || 0),
        characters: shot.characterIds
          .map((id) => characterNames.get(id) ?? `未知角色(${id})`)
          .join("、"),
        scene: shot.sceneId ? (sceneNames.get(shot.sceneId) ?? `未知场景(${shot.sceneId})`) : "",
        notes: shot.notes,
        visualMediaId:
          validShotMediaId(shot.firstFrame.result, "image", project.id, input.media) ??
          validShotMediaId(shot.lastFrame.result, "image", project.id, input.media),
        values,
        missing,
      };
    });

  return {
    project,
    episode,
    columns,
    rows,
    beatCount: beats.length,
    totalDurationSec: rows.reduce((sum, row) => sum + row.durationSec, 0),
  };
}

export function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function episodeDeliveryCsv(delivery: EpisodeDelivery): string {
  const headers = [
    "顺序",
    "镜号",
    "状态",
    "场次",
    "内容",
    "时长(秒)",
    "角色",
    "场景",
    "备注",
    ...delivery.columns.map((column) => column.label),
  ];
  const records = delivery.rows.map((row) => [
    row.order,
    row.shotNumber,
    row.statusLabel,
    row.beat,
    row.content,
    row.durationSec,
    row.characters,
    row.scene,
    row.notes,
    ...delivery.columns.map((column) => row.values[column.id] ?? ""),
  ]);
  return `\uFEFF${[headers, ...records]
    .map((record) => record.map(escapeCsvCell).join(","))
    .join("\r\n")}`;
}

export function episodeDeliveryFilename(delivery: EpisodeDelivery): string {
  const safe = `${delivery.project.name}-${episodeLabel(delivery.episode)}`
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return `${safe || "分镜交付"}-分镜.csv`;
}

export function downloadEpisodeDeliveryCsv(delivery: EpisodeDelivery): void {
  const blob = new Blob([episodeDeliveryCsv(delivery)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = episodeDeliveryFilename(delivery);
  anchor.click();
  URL.revokeObjectURL(url);
}
