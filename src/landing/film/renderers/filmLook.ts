import {mulberry32, type Quality} from "./particles";
import type {CanvasLike} from "./targets";

// A modern, restrained film look over the whole picture: grain, gate weave, a little exposure
// flicker, dust and hairs, plus the slate marks in the corners. It is its own overlay canvas
// above the particle canvas, stepped by a 24 fps "film clock" from the stage's one frame loop
// (it adds no second rAF). Every effect is a pure function of the film frame number, so
// the same frame always paints the same pixels. Nothing is allocated per frame: the grain
// tiles and their patterns are built once, dust and flicker are a handful of fills.
// The vignette is a static CSS gradient (landing.css), and the warm highlight is the particle
// sprite's colour (stage.ts); neither costs anything per frame.
export const FILM_FPS = 24;
export const GRAIN_TILE = 256;
export const GRAIN_TILES = 3;
/** Grain opacity (the specks themselves carry their own alpha). */
export const GRAIN_ALPHA = 0.1;
/** Peak opacity of the exposure flicker. */
export const FLICKER_MAX = 0.035;
/** Gate weave amplitude in CSS px. */
export const WEAVE_PX = 1.3;
export const MAX_DUST = 3;
/** The overlay canvas reaches this far past every stage edge, so weave never shows a seam. */
const LOOK_PAD = 4;
const LOW_FPS = 12;
const MAX_STEP_MS = 100;
const DUST_COLOR = "#fff4e2";
const WARM_FLICKER = "#fff0d8";

/** Deterministic value in [0, 1) from a frame number and a salt. */
export function frameRandom(frame: number, salt: number): number {
    let h = Math.imul((frame | 0) ^ Math.imul(salt | 0, 0x85ebca6b), 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
}

/** One RGBA noise tile: sparse white and black specks (alpha grows with distance from the mean), same seed, same bytes. */
export function grainPixels(index: number, size = GRAIN_TILE): Uint8ClampedArray {
    const rng = mulberry32(0x6a09e667 + index * 7919);
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i += 1) {
        const v = rng();
        const strength = Math.abs(v * 2 - 1);
        const shade = v >= 0.5 ? 255 : 0;
        data[i * 4] = shade;
        data[i * 4 + 1] = shade;
        data[i * 4 + 2] = shade;
        data[i * 4 + 3] = Math.round(strength * strength * 255);
    }
    return data;
}

export type Dust = {kind: "speck" | "hair"; x: number; y: number; size: number; angle: number};

/** How many marks dirty this frame: usually none or one, at most MAX_DUST. */
export function dustCount(frame: number): number {
    const r = frameRandom(frame, 3);
    return Math.min(MAX_DUST, Math.floor(r * r * (MAX_DUST + 1)));
}

/** Fills `out[i]` for i < the returned count; reuses the given objects. */
export function dustFor(frame: number, w: number, h: number, out: Dust[]): number {
    const count = dustCount(frame);
    for (let i = 0; i < count; i += 1) {
        const salt = 10 + i * 5;
        const slot = out[i];
        slot.kind = frameRandom(frame, salt) < 0.62 ? "speck" : "hair";
        slot.x = frameRandom(frame, salt + 1) * w;
        slot.y = frameRandom(frame, salt + 2) * h;
        slot.size = slot.kind === "speck" ? 0.6 + frameRandom(frame, salt + 3) * 1.1 : 8 + frameRandom(frame, salt + 3) * 14;
        slot.angle = frameRandom(frame, salt + 4) * Math.PI * 2;
    }
    return count;
}

export function flickerFor(frame: number): {alpha: number; warm: boolean} {
    return {alpha: frameRandom(frame, 1) * FLICKER_MAX, warm: frameRandom(frame, 2) >= 0.5};
}

export function weaveFor(frame: number): {x: number; y: number} {
    return {x: (frameRandom(frame, 6) * 2 - 1) * WEAVE_PX, y: (frameRandom(frame, 7) * 2 - 1) * WEAVE_PX};
}

/** Slate marks. */
export const reelMark = (frame: number): string => `REEL 01   ${String(Math.max(0, Math.floor(frame)) % 10000).padStart(4, "0")}`;
export const sceneMark = (sceneIndex: number): string => `SC ${String(Math.max(0, Math.floor(sceneIndex))).padStart(2, "0")} · TAKE 1`;

/** Painted frames per second for the quality tier. */
export const lookFps = (quality: Quality): number => (quality === "low" ? LOW_FPS : FILM_FPS);

export type LookResources = {patterns: readonly CanvasPattern[]; dust: Dust[]};

/**
 * Paints one overlay frame. `w`/`h` are the overlay's size in CSS px (stage plus padding on every side);
 * the context's pixel ratio is `dpr`. No allocation, no gradients.
 */
export function drawLook(ctx: CanvasRenderingContext2D, res: LookResources, frame: number, w: number, h: number, dpr: number, quality: Quality): void {
    const low = quality === "low";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, Math.ceil(w * dpr), Math.ceil(h * dpr));
    // Grain: one of the tiles, at a random offset, filled in a single call.
    const ox = Math.floor(frameRandom(frame, 4) * GRAIN_TILE);
    const oy = Math.floor(frameRandom(frame, 5) * GRAIN_TILE);
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
    ctx.globalAlpha = low ? GRAIN_ALPHA / 2 : GRAIN_ALPHA;
    ctx.fillStyle = res.patterns[frame % GRAIN_TILES];
    ctx.fillRect(-GRAIN_TILE, -GRAIN_TILE, w + GRAIN_TILE * 2, h + GRAIN_TILE * 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Exposure flicker.
    const flicker = flickerFor(frame);
    ctx.globalAlpha = flicker.alpha;
    ctx.fillStyle = flicker.warm ? WARM_FLICKER : "#000";
    ctx.fillRect(0, 0, w, h);
    // Dust and hairs.
    if (!low) {
        const count = dustFor(frame, w, h, res.dust);
        if (count > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = DUST_COLOR;
            ctx.strokeStyle = DUST_COLOR;
            ctx.lineWidth = 0.8;
            for (let i = 0; i < count; i += 1) {
                const d = res.dust[i];
                ctx.beginPath();
                if (d.kind === "speck") {
                    ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    const dx = Math.cos(d.angle) * d.size;
                    const dy = Math.sin(d.angle) * d.size;
                    ctx.moveTo(d.x, d.y);
                    ctx.quadraticCurveTo(d.x + dx * 0.5 - dy * 0.35, d.y + dy * 0.5 + dx * 0.35, d.x + dx, d.y + dy);
                    ctx.stroke();
                }
            }
        }
    }
    ctx.globalAlpha = 1;
}

export type FilmLook = {
    /** Sizes the overlay for the stage (CSS px) and the tier; rebuilds nothing but the canvas bitmap. */
    resize: (w: number, h: number, dpr: number, quality: Quality) => void;
    /** Advances the film clock; paints and returns true when a film frame is due. */
    tick: (now: number, sceneIndex: number, quality: Quality) => boolean;
    /** Stops the clock (paused, or off screen): the next tick starts a fresh interval, the frame number stays. */
    hold: () => void;
    frame: () => number;
    destroy: () => void;
};

export type LookTargets = {
    canvas: HTMLCanvasElement;
    createCanvas: () => CanvasLike;
    /** Moved by the gate weave. */
    weave?: HTMLElement | null;
    reel?: HTMLElement | null;
    scene?: HTMLElement | null;
};

/** Undefined when the context or patterns are unavailable: the film then plays without the overlay. */
export function createFilmLook(targets: LookTargets): FilmLook | undefined {
    try {
        const ctx = targets.canvas.getContext("2d");
        if (!ctx) return undefined;
        const patterns: CanvasPattern[] = [];
        for (let index = 0; index < GRAIN_TILES; index += 1) {
            const tile = targets.createCanvas();
            tile.width = GRAIN_TILE;
            tile.height = GRAIN_TILE;
            const tileCtx = tile.getContext("2d");
            if (!tileCtx) return undefined;
            const image = tileCtx.createImageData(GRAIN_TILE, GRAIN_TILE);
            image.data.set(grainPixels(index));
            tileCtx.putImageData(image, 0, 0);
            const pattern = ctx.createPattern(tile as unknown as CanvasImageSource, "repeat");
            if (!pattern) return undefined;
            patterns.push(pattern);
        }
        return createLook(ctx, targets, {patterns, dust: Array.from({length: MAX_DUST}, (): Dust => ({kind: "speck", x: 0, y: 0, size: 1, angle: 0}))});
    } catch {
        return undefined;
    }
}

function createLook(ctx: CanvasRenderingContext2D, targets: LookTargets, res: LookResources): FilmLook {
    const {canvas, weave, reel, scene} = targets;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let frame = 0;
    let acc = 0;
    let lastNow: number | undefined;
    let shownScene = -1;
    let shownReel = "";
    return {
        resize(width, height, ratio, quality) {
            w = width + LOOK_PAD * 2;
            h = height + LOOK_PAD * 2;
            dpr = Math.min(ratio, quality === "low" ? 1 : 1.5);
            const pw = Math.ceil(w * dpr);
            const ph = Math.ceil(h * dpr);
            if (canvas.width !== pw) canvas.width = pw;
            if (canvas.height !== ph) canvas.height = ph;
            lastNow = undefined;
        },
        tick(now, sceneIndex, quality) {
            if (!(w > 0 && h > 0)) return false;
            const interval = 1000 / lookFps(quality);
            if (lastNow === undefined) acc = interval; // the first tick after (re)start paints at once
            else acc += Math.min(MAX_STEP_MS, Math.max(0, now - lastNow));
            lastNow = now;
            if (acc < interval) return false;
            acc = acc > interval * 2 ? 0 : acc - interval;
            frame += FILM_FPS / lookFps(quality);
            drawLook(ctx, res, frame, w, h, dpr, quality);
            if (weave) {
                const shift = quality === "low" ? {x: 0, y: 0} : weaveFor(frame);
                weave.style.transform = `translate3d(${shift.x.toFixed(2)}px, ${shift.y.toFixed(2)}px, 0)`;
            }
            if (reel) {
                const text = reelMark(frame);
                if (text !== shownReel) {
                    shownReel = text;
                    reel.textContent = text;
                }
            }
            if (scene && sceneIndex !== shownScene) {
                shownScene = sceneIndex;
                scene.textContent = sceneMark(sceneIndex);
            }
            return true;
        },
        hold() {
            lastNow = undefined;
        },
        frame: () => frame,
        destroy() {
            if (weave) weave.style.transform = "";
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
    };
}
