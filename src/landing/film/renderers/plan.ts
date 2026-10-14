import type {Behavior, Pool, Quality} from "./particles";
import type {Rect, TargetSet} from "./targets";

/** What the particles should chase this frame: a blend of two sets, plus overall visibility. */
export type Plan = {from: TargetSet; to: TargetSet; t: number; behavior: Behavior; alphaScale: number};

type TitleLayout = {cx: number; cy: number; size: number; text: string; fontFamily: string; fontWeight: string};

export type Layout = {
    w: number;
    h: number;
    art: Rect;
    title: TitleLayout;
    /** Storyboard cells inside the art rectangle. */
    cells: readonly Rect[];
};

export type Sets = {
    /** All particles hidden at the stage centre (before the burst). */
    center: TargetSet;
    /** Dust across the whole stage. */
    scatter: TargetSet;
    title: TargetSet;
    /** Script lines, typed left to right. */
    text: TargetSet;
    /** Scratch: `text` with only a prefix revealed. */
    typed: TargetSet;
    /** Storyboard cell outlines. */
    grid: TargetSet;
    /** Scratch: `grid` with per-cell brightness. Shares x/y with `grid`. */
    gridLit: TargetSet;
    /** Number of particles carrying a text point, and of grid points per cell. */
    textCount: number;
    /** Font size (px) the script lines were sampled at. */
    textSize: number;
    cellSize: number;
    /** Reveal count currently composed into `typed`; -1 when stale. */
    typedCount: number;
};

export type SceneState = {
    layout: Layout;
    sets: Sets;
    pool: Pool;
    quality: Quality;
    /** Local progress of the current scene (0..1). */
    local: number;
    /** Milliseconds since the stage mounted. */
    t: number;
    glow: (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number) => void;
};

export function smoothstep(value: number): number {
    const x = Math.min(1, Math.max(0, value));
    return x * x * (3 - 2 * x);
}

export function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}
