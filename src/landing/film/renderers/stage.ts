import {SCENE_COPY} from "../../content/copy";
import type {FilmDriver, FilmState} from "../useFilmProgress";
import {agentGeometry, buildAgentSets, drawAgent, planAgent} from "./agent";
import {buildDeliverySets, deliveryGeometry, drawDelivery, planDelivery} from "./delivery";
import {buildVaultSets, drawVault, planVault, vaultGeometry} from "./vault";
import {createFilmLook, type FilmLook} from "./filmLook";
import {drawLeader, LEADER_REST, planLeader} from "./leader";
import {clamp01, type Layout, type Plan, type SceneState, type Sets} from "./plan";
import {createPool, MAX_PARTICLES, mulberry32, type Pool, type Quality, step} from "./particles";
import {createAdaptiveQuality, detectQuality, type QualityInput} from "./quality";
import {drawScript, GRID_DIM, planScript} from "./script";
import {drawSpark, planSpark, SPARK_LINES} from "./spark";
import {
    artRect,
    artScale,
    type CanvasLike,
    createSet,
    fillSet,
    type Rect,
    rectOutline,
    scatterSet,
    type TargetSet,
    textPoints
} from "./targets";

// Canvas 2D controller for the pinned stage. It is loaded lazily (dynamic import
// from Film.tsx), so none of it is part of the first-screen bundle. Frames run
// only while something is changing: scroll progress, particles still moving, or
// the leader at rest (its point breathes, at half rate). Everything else (hidden
// tab, stage off screen, unmounted, any other scene once settled) runs none.
export type StageEnv = {
    raf: (callback: (time: number) => void) => number;
    caf: (id: number) => void;
    now: () => number;
    isHidden: () => boolean;
    dpr: () => number;
    measure: (stage: HTMLElement) => { w: number; h: number };
    createCanvas: () => CanvasLike;
    observeResize: (element: Element, callback: () => void) => () => void;
    observeVisible: (element: Element, callback: (visible: boolean) => void) => () => void;
    onHiddenChange: (callback: () => void) => () => void;
    loadFont: (font: string, text: string) => Promise<unknown>;
    device: () => QualityInput;
    seed: number;
};

export type StageHandle = {
    destroy: () => void;
    quality: () => Quality;
    frames: () => number;
    /** Call when `isFrozen` may have changed back to false: restarts the loop for the film look. */
    wake: () => void;
    /** Whether the film look (grain, weave, marks) is running on this stage. */
    look: () => FilmLook | undefined;
};

export type StageOptions = {
    stage: HTMLElement;
    canvas: HTMLCanvasElement;
    driver: FilmDriver;
    env?: Partial<StageEnv>;
    /** The overlay canvas for the film look; without it the stage draws only the particles. */
    lookCanvas?: HTMLCanvasElement | null;
    /** True while the screening is paused: the film look freezes (grain and frame count stop). */
    isFrozen?: () => boolean;
};

// The warm sprite leans a little amber: the picture's highlights carry the warm tint for free (no extra pass).
const WARM = "255,240,216";
const COOL = "96,177,255";
const GLOW_RADIUS = 2.7;
const MIN_GAP_MS = 2;
const MAX_GAP_MS = 100;
/** The resting leader only breathes: ~30 fps is plenty, and its frame times say nothing about device speed. */
const REST_GAP_MS = 30;

function defaultEnv(): StageEnv {
    return {
        raf: callback => window.requestAnimationFrame(callback),
        caf: id => window.cancelAnimationFrame(id),
        now: () => performance.now(),
        isHidden: () => document.hidden,
        dpr: () => window.devicePixelRatio || 1,
        measure: stage => ({w: stage.clientWidth, h: stage.clientHeight}),
        createCanvas: () => document.createElement("canvas"),
        observeResize: (element, callback) => {
            if (typeof ResizeObserver === "undefined") {
                window.addEventListener("resize", callback);
                return () => window.removeEventListener("resize", callback);
            }
            const observer = new ResizeObserver(callback);
            observer.observe(element);
            return () => observer.disconnect();
        },
        observeVisible: (element, callback) => {
            if (typeof IntersectionObserver === "undefined") return () => undefined;
            const observer = new IntersectionObserver(entries => entries.forEach(entry => callback(entry.isIntersecting)));
            observer.observe(element);
            return () => observer.disconnect();
        },
        onHiddenChange: callback => {
            document.addEventListener("visibilitychange", callback);
            return () => document.removeEventListener("visibilitychange", callback);
        },
        loadFont: (font, text) => document.fonts?.load(font, text) ?? Promise.resolve(),
        device: () => {
            const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
            return {
                hardwareConcurrency: nav.hardwareConcurrency,
                deviceMemory: nav.deviceMemory,
                width: window.innerWidth,
                coarsePointer: typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
                saveData: nav.connection?.saveData === true,
            };
        },
        seed: 20260922,
    };
}

function makeSprite(env: StageEnv, rgb: string): CanvasLike {
    const size = 64;
    const canvas = env.createCanvas();
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, `rgba(${rgb},1)`);
    gradient.addColorStop(0.16, `rgba(${rgb},0.7)`);
    gradient.addColorStop(0.42, `rgba(${rgb},0.16)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return canvas;
}

// The leader's title card is the particles themselves (no DOM text on the stage): large, centred, a touch above the middle.
function titleLayout(w: number, h: number): Layout["title"] {
    const size = w >= 900 ? Math.min(w * 0.095, 132) : w * 0.105;
    return {
        cx: w / 2,
        cy: h * 0.46,
        size,
        text: SCENE_COPY.leader.title,
        fontFamily: '"Noto Serif SC", "Songti SC", "STSong", serif',
        fontWeight: "700"
    };
}

function gridCells(art: Rect): Rect[] {
    // Wide stages lay the six frames out 3 x 2; a phone's tall frame takes 2 x 3.
    const tall = art.w < 420;
    const cols = tall ? 2 : 3;
    const rows = tall ? 3 : 2;
    const gap = 10;
    const cellW = (art.w - gap * (cols - 1)) / cols;
    const cellH = Math.min((art.h - gap * (rows - 1)) / rows, cellW * 0.66);
    const top = art.y + (art.h - (cellH * rows + gap * (rows - 1))) / 2;
    const cells: Rect[] = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) cells.push({
            x: art.x + col * (cellW + gap),
            y: top + row * (cellH + gap),
            w: cellW,
            h: cellH
        });
    }
    return cells;
}

function buildLayout(w: number, h: number): Layout {
    const art = artRect(w, h);
    return {
        w,
        h,
        art,
        title: titleLayout(w, h),
        cells: gridCells(art),
        agent: agentGeometry(art),
        vault: vaultGeometry(art),
        delivery: deliveryGeometry(art)
    };
}

const textFont = (size: number) => `500 ${size}px "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif`;

function buildSets(layout: Layout, capacity: number, env: StageEnv): Sets {
    const rng = mulberry32(env.seed);
    const {w, h, art, title} = layout;
    const center = createSet(capacity);
    center.x.fill(w / 2);
    center.y.fill(h / 2);
    const scatter = createSet(capacity);
    scatterSet(scatter, 0, rng, w, h, () => 0.18 + rng() * 0.4);

    const titleSet = createSet(capacity);
    const titleFont = (size: number) => `${title.fontWeight} ${size}px ${title.fontFamily}`;
    const titlePoints = textPoints([title.text], {
        font: titleFont,
        size: title.size,
        lineHeight: title.size * 1.2,
        x: title.cx,
        y: title.cy,
        align: "center",
        maxWidth: w * 0.9,
        maxPoints: Math.floor(capacity * 0.86),
        rng,
        createCanvas: env.createCanvas
    });
    fillSet(titleSet, titlePoints.points, {rng, shuffle: true, width: w, height: h});

    const textSet = createSet(capacity);
    const textSize = Math.max(14, Math.min(38 * Math.min(artScale(art), 1.2), art.w / 12, art.h / 5.8));
    // The script page sits in the middle of the frame (its lines stay left-aligned, like a screenplay).
    const blockW = Math.max(...SPARK_LINES.map(line => line.length)) * textSize;
    const lines = textPoints(SPARK_LINES, {
        font: textFont,
        size: textSize,
        lineHeight: textSize * 1.9,
        x: art.x + Math.max(0, (art.w - blockW) / 2),
        y: art.y + art.h / 2,
        align: "left",
        maxWidth: art.w,
        maxPoints: Math.floor(capacity * 0.8),
        rng,
        createCanvas: env.createCanvas
    });
    const textCount = fillSet(textSet, lines.points, {rng, shuffle: false, width: w, height: h});

    const gridSet = createSet(capacity);
    const cellSize = Math.floor((capacity * 0.82) / layout.cells.length);
    const outline = new Float32Array(cellSize * layout.cells.length * 2);
    layout.cells.forEach((cell, index) => outline.set(rectOutline(cell, cellSize), index * cellSize * 2));
    const outlined = fillSet(gridSet, outline, {rng, shuffle: false, width: w, height: h});
    gridSet.a.fill(GRID_DIM, 0, outlined);
    const gridLit: TargetSet = {x: gridSet.x, y: gridSet.y, a: Float32Array.from(gridSet.a)};

    return {
        center,
        scatter,
        title: titleSet,
        text: textSet,
        typed: createSet(capacity),
        grid: gridSet,
        gridLit,
        textCount,
        textSize: lines.size,
        cellSize,
        typedCount: -1,
        agent: buildAgentSets(layout.agent, capacity, rng, w, h),
        vault: buildVaultSets(layout.vault, capacity, rng, w, h),
        delivery: buildDeliverySets(layout.delivery, capacity, rng, w, h)
    };
}

function applyPlan(pool: Pool, plan: Plan): void {
    const {from, to, t, alphaScale} = plan;
    const blend = t > 0 && from !== to;
    for (let i = 0; i < pool.capacity; i += 1) {
        if (blend) {
            pool.tx[i] = from.x[i] + (to.x[i] - from.x[i]) * t;
            pool.ty[i] = from.y[i] + (to.y[i] - from.y[i]) * t;
            pool.ta[i] = (from.a[i] + (to.a[i] - from.a[i]) * t) * alphaScale;
        } else {
            pool.tx[i] = from.x[i];
            pool.ty[i] = from.y[i];
            pool.ta[i] = from.a[i] * alphaScale;
        }
    }
}

function snapToTargets(pool: Pool): void {
    pool.x.set(pool.tx);
    pool.y.set(pool.ty);
    pool.vx.fill(0);
    pool.vy.fill(0);
    pool.alpha.set(pool.ta);
}

export function mountStage(options: StageOptions): StageHandle | undefined {
    const {stage, canvas, driver} = options;
    const env: StageEnv = {...defaultEnv(), ...options.env};
    try {
        return start(stage, canvas, driver, env, options);
    } catch {
        // No usable canvas or fonts: the text-only film stays, without a picture.
        return undefined;
    }
}

function start(stage: HTMLElement, canvas: HTMLCanvasElement, driver: FilmDriver, env: StageEnv, options: StageOptions): StageHandle | undefined {
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const warm = makeSprite(env, WARM);
    const cool = makeSprite(env, COOL);
    const look: FilmLook | undefined = options.lookCanvas
        ? createFilmLook({
            canvas: options.lookCanvas,
            createCanvas: env.createCanvas,
            weave: stage.querySelector<HTMLElement>("[data-film-weave]"),
            reel: stage.querySelector<HTMLElement>("[data-mark=reel]"),
            scene: stage.querySelector<HTMLElement>("[data-mark=scene]"),
        })
        : undefined;
    const lookFrozen = () => options.isFrozen?.() === true;

    const adaptive = createAdaptiveQuality(detectQuality(env.device()));
    let quality = adaptive.current();
    let pool: Pool | undefined;
    let sets: Sets | undefined;
    let layout: Layout | undefined;
    let dpr = 1;
    let needsBuild = true;
    let dirty = true;
    let state: FilmState = {progress: 0, sceneIndex: 0, local: 0};
    let visible = true;
    let destroyed = false;
    let frameId: number | undefined;
    let lastRender = 0;
    let rendered = false;
    let frames = 0;
    let needMore = false;
    let fontRequested = false;
    const startedAt = env.now();
    const plan: Plan = {from: createSet(0), to: createSet(0), t: 0, behavior: "scatter", alphaScale: 0};

    const glow: SceneState["glow"] = (target, x, y, radius, alpha) => {
        target.globalAlpha = alpha;
        target.drawImage(warm as unknown as CanvasImageSource, x - radius, y - radius, radius * 2, radius * 2);
        target.globalAlpha = 1;
    };

    function build(): boolean {
        const size = env.measure(stage);
        if (!(size.w > 0 && size.h > 0)) return false;
        const capacity = MAX_PARTICLES[quality];
        dpr = Math.min(env.dpr(), quality === "low" ? 1.5 : 2);
        const width = Math.round(size.w * dpr);
        const height = Math.round(size.h * dpr);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        layout = buildLayout(size.w, size.h);
        sets = buildSets(layout, capacity, env);
        if (!pool || pool.capacity !== capacity) pool = createPool(capacity, env.seed);
        planFor(state.sceneIndex, state.local);
        applyPlan(pool, plan);
        snapToTargets(pool);
        look?.resize(size.w, size.h, env.dpr(), quality);
        needsBuild = false;
        if (!fontRequested) {
            // The display font may arrive after the first build: sample the title again once it has.
            fontRequested = true;
            const title = layout.title;
            env.loadFont(`${title.fontWeight} ${title.size}px ${title.fontFamily}`, title.text).then(() => {
                if (destroyed) return;
                needsBuild = true;
                requestFrame();
            }, () => undefined);
        }
        return true;
    }

    function planFor(sceneIndex: number, local: number): void {
        if (!sets || !layout) return;
        if (sceneIndex === 0) planLeader(local, sets, plan);
        else if (sceneIndex === 1) planSpark(local, sets, plan);
        else if (sceneIndex === 2) planScript(local, sets, layout.cells.length, plan);
        else if (sceneIndex === 3) planAgent(local, sets, layout.agent, plan);
        else if (sceneIndex === 4) planVault(local, sets, plan);
        else planDelivery(local, sets, layout.delivery, plan);
    }

    function drawParticles(target: CanvasRenderingContext2D, current: Pool): void {
        const streak = quality !== "low";
        target.globalCompositeOperation = "lighter";
        for (let i = 0; i < current.capacity; i += 1) {
            const alpha = current.alpha[i];
            if (alpha < 0.02) continue;
            const radius = current.size[i] * GLOW_RADIUS;
            const sprite = (i % 17 === 0 ? cool : warm) as unknown as CanvasImageSource;
            const x = current.x[i];
            const y = current.y[i];
            target.globalAlpha = alpha;
            target.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
            // Motion streak: a fainter copy behind the particle along its velocity (cheaper and
            // cleaner than fading the whole previous frame, which would also smear the overlay).
            if (streak && Math.abs(current.vx[i]) + Math.abs(current.vy[i]) > 60) {
                target.globalAlpha = alpha * 0.35;
                target.drawImage(sprite, x - current.vx[i] * 0.035 - radius, y - current.vy[i] * 0.035 - radius, radius * 2, radius * 2);
            }
        }
        target.globalAlpha = 1;
        target.globalCompositeOperation = "source-over";
    }

    function render(): void {
        if (destroyed || !visible || env.isHidden()) return;
        const now = env.now();
        const gap = now - lastRender;
        if (rendered && gap < MIN_GAP_MS && !needsBuild) {
            // A second call within the same frame (the driver's tick and this loop can both fire): take over
            // any new target now, but draw once, on the next frame.
            if (dirty) {
                planFor(state.sceneIndex, state.local);
                if (pool) applyPlan(pool, plan);
                dirty = false;
                needMore = true;
            }
            return;
        }
        const resting = state.sceneIndex === 0 && state.local < LEADER_REST;
        const breathingOnly = resting && !dirty && !needsBuild && rendered;
        if (breathingOnly && gap < REST_GAP_MS) return;
        const continuous = rendered && gap < MAX_GAP_MS;
        lastRender = now;
        rendered = true;
        if (continuous && !breathingOnly) {
            const lower = adaptive.push(gap);
            if (lower) {
                quality = lower;
                needsBuild = true;
            }
        }
        if (needsBuild && !build()) return;
        if (!pool || !sets || !layout) return;
        const dt = continuous ? gap / 1000 : 1 / 60;
        if (dirty) {
            planFor(state.sceneIndex, state.local);
            applyPlan(pool, plan);
            dirty = false;
        }
        const unsettled = step(pool, dt, plan.behavior);
        const elapsed = now - startedAt;
        const scene: SceneState = {layout, sets, pool, quality, local: clamp01(state.local), t: elapsed, glow};
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx!.clearRect(0, 0, layout.w, layout.h);
        drawParticles(ctx!, pool);
        if (state.sceneIndex === 0) drawLeader(ctx!, scene);
        else if (state.sceneIndex === 1) drawSpark(ctx!, scene);
        else if (state.sceneIndex === 2) drawScript(ctx!, scene);
        else if (state.sceneIndex === 3) drawAgent(ctx!, scene);
        else if (state.sceneIndex === 4) drawVault(ctx!, scene);
        else drawDelivery(ctx!, scene);
        frames += 1;
        needMore = unsettled > 0 || resting;
    }

    const canRun = () => !destroyed && visible && !env.isHidden();

    // The film look keeps the loop alive while the stage is on screen and not paused: its clock
    // (24 fps) is checked on every frame, the particle picture is redrawn only when it changes.
    const lookRunning = () => look !== undefined && canRun() && !lookFrozen();

    function loop(): void {
        frameId = undefined;
        if (!look || needMore || dirty || needsBuild) render();
        if (look) {
            if (lookRunning()) look.tick(env.now(), state.sceneIndex, quality);
            else look.hold();
        }
        if ((needMore || lookRunning()) && canRun()) frameId = env.raf(loop);
    }

    function ensureLoop(): void {
        if (frameId === undefined && (needMore || lookRunning()) && canRun()) frameId = env.raf(loop);
    }

    function requestFrame(): void {
        needMore = true;
        if (frameId === undefined && canRun()) frameId = env.raf(loop);
    }

    // The subscription's immediate call only records the current state: the first frame is drawn
    // explicitly, inside the try, so a failure there leaves nothing registered with the driver.
    let subscribed = false;
    const offDriver = driver.subscribe(next => {
        state = next;
        dirty = true;
        if (!subscribed) return;
        render();
        ensureLoop();
    });
    subscribed = true;
    try {
        render();
    } catch (error) {
        offDriver();
        throw error;
    }
    ensureLoop();
    const offResize = env.observeResize(stage, () => {
        needsBuild = true;
        requestFrame();
    });
    const offVisible = env.observeVisible(stage, value => {
        visible = value;
        if (value) {
            dirty = true;
            requestFrame();
        } else if (frameId !== undefined) {
            env.caf(frameId);
            frameId = undefined;
        }
    });
    const offHidden = env.onHiddenChange(() => {
        if (env.isHidden()) {
            if (frameId !== undefined) env.caf(frameId);
            frameId = undefined;
        } else {
            dirty = true;
            requestFrame();
        }
    });
    stage.dataset.canvas = "on";

    return {
        quality: () => quality,
        frames: () => frames,
        wake: ensureLoop,
        look: () => look,
        destroy() {
            destroyed = true;
            offDriver();
            offResize();
            offVisible();
            offHidden();
            if (frameId !== undefined) env.caf(frameId);
            frameId = undefined;
            look?.destroy();
        },
    };
}
