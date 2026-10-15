import type {Behavior, Pool, Quality} from "./particles";
import type {Rect, TargetSet} from "./targets";

/** What the particles should chase this frame: a blend of two sets, plus overall visibility. */
export type Plan = { from: TargetSet; to: TargetSet; t: number; behavior: Behavior; alphaScale: number };

type TitleLayout = { cx: number; cy: number; size: number; text: string; fontFamily: string; fontWeight: string };

/** Geometry of the agent scene's execution log, computed once per stage size. */
export type AgentGeom = {
    lineX: number;
    top: number;
    bottom: number;
    rowY: readonly number[];
    textX: number;
    right: number;
    font: number;
    nodeR: number
};
export type VaultGeom = {
    cx: number; cy: number; r: number; font: number;
    lock: { cx: number; top: number; bodyW: number; bodyH: number; shackleR: number };
    keyLabel: { x: number; y: number };
    storeLabel: { x: number; y: number };
};
export type DeliveryGeom = { strip: Rect; icons: readonly Rect[]; labelY: number; font: number };

export type Layout = {
    w: number;
    h: number;
    art: Rect;
    title: TitleLayout;
    /** Storyboard cells inside the art rectangle. */
    cells: readonly Rect[];
    agent: AgentGeom;
    vault: VaultGeom;
    delivery: DeliveryGeom;
};

export type AgentSets = {
    /** Resting positions: node rings, the guide line, flow dots and row separators. */
    base: TargetSet;
    /** Scratch composed every plan: base positions with live brightness, flow dots moving. */
    live: TargetSet;
    nodeK: number;
    lineStart: number;
    lineCount: number;
    flowStart: number;
    flowCount: number;
    sepStart: number;
    sepCount: number;
};
export type VaultSets = {
    /** Rings, spokes and the outsiders; the lock's particles wait hidden in the hub. */
    can: TargetSet;
    /** The same with the lock formed and the outsiders pushed outward. */
    lock: TargetSet;
};
export type DeliverySets = {
    strip: TargetSet;
    files: TargetSet;
    /** Scratch: strip to file blend per group. */
    live: TargetSet;
    /** Particle ranges of the three groups: [0, a, b, end]. */
    groups: readonly number[];
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
    agent: AgentSets;
    vault: VaultSets;
    delivery: DeliverySets;
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
