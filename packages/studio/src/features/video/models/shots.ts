import {recoverLegacyIds} from "../../../platform/data/legacyScalar";
import type {Id} from "../../../platform/identity";
import type {GenerationSlot} from "../../library/models/slots";

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

function normalizeShotWorkspaceView(raw: unknown): ShotWorkspaceView {
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
        ? recoverLegacyIds(record.beatIds)
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
    return {statuses, beatIds, gaps};
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

export const DEFAULT_SHOT_SETTINGS: ShotSettings = {
    defaultDurationSec: 0,
    autoIncrementShotNumber: true,
    workspaceView: "design",
    filters: {...DEFAULT_SHOT_FILTERS},
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

export const DEFAULT_VISIBLE_COLUMNS: ShotColumnId[] = [
    "durationSec",
    "content",
    "characters",
    "scene",
    "notes",
];
