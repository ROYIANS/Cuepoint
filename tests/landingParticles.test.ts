import {describe, expect, it} from "vitest";
import {BEHAVIORS, createPool, MAX_PARTICLES, mulberry32, step, type Behavior} from "@/landing/film/renderers/particles";
import {createAdaptiveQuality, detectQuality, FRAME_BUDGET_MS, lowerQuality, type QualityInput} from "@/landing/film/renderers/quality";
import {artRect, createSet, fillSet, rectOutline, samplePoints, sortPointsByX, textPoints, type Bitmap, type CanvasLike} from "@/landing/film/renderers/targets";
import {cellLight, GRID_DIM, planScript} from "@/landing/film/renderers/script";
import {planSpark, revealCount} from "@/landing/film/renderers/spark";
import {planLeader, TITLE_FORMED} from "@/landing/film/renderers/leader";
import type {Plan, Sets} from "@/landing/film/renderers/plan";

describe("mulberry32", () => {
    it("is deterministic per seed and stays in [0, 1)", () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const first = Array.from({length: 200}, () => a());
        expect(Array.from({length: 200}, () => b())).toEqual(first);
        expect(first.every(value => value >= 0 && value < 1)).toBe(true);
        expect(Array.from({length: 5}, mulberry32(43))).not.toEqual(first.slice(0, 5));
        expect(new Set(first).size).toBeGreaterThan(190);
    });
});

describe("particle pool", () => {
    it("caps capacity by quality tier", () => {
        expect(MAX_PARTICLES).toEqual({high: 1400, medium: 700, low: 260});
    });

    it("preallocates every array at the fixed capacity", () => {
        const pool = createPool(MAX_PARTICLES.medium, 7);
        for (const key of ["x", "y", "vx", "vy", "tx", "ty", "alpha", "ta", "size", "stiff"] as const) {
            expect(pool[key]).toBeInstanceOf(Float32Array);
            expect(pool[key]).toHaveLength(700);
        }
        expect(createPool(-5).capacity).toBe(0);
    });

    it("steps in place: the same typed arrays are kept and nothing is replaced", () => {
        const pool = createPool(64, 3);
        const before = Object.fromEntries(Object.entries(pool).map(([key, value]) => [key, value]));
        pool.tx.fill(100);
        pool.ty.fill(50);
        pool.ta.fill(1);
        for (let i = 0; i < 120; i += 1) step(pool, 1 / 60, "gather");
        for (const [key, value] of Object.entries(before)) expect((pool as Record<string, unknown>)[key]).toBe(value);
    });

    it("is deterministic for a given seed and differs between seeds", () => {
        const run = (seed: number) => {
            const pool = createPool(100, seed);
            pool.tx.fill(300);
            pool.ty.fill(200);
            pool.ta.fill(0.8);
            for (let i = 0; i < 20; i += 1) step(pool, 1 / 60, "scatter");
            return Array.from(pool.x);
        };
        expect(run(5)).toEqual(run(5));
        expect(run(5)).not.toEqual(run(6));
    });

    it.each(Object.keys(BEHAVIORS) as Behavior[])("converges on its targets and reports settled (%s)", behavior => {
        const pool = createPool(200, 9);
        const random = mulberry32(1);
        for (let i = 0; i < pool.capacity; i += 1) {
            pool.x[i] = random() * 800;
            pool.y[i] = random() * 600;
            pool.tx[i] = random() * 800;
            pool.ty[i] = random() * 600;
            pool.ta[i] = 0.2 + random() * 0.8;
        }
        let unsettled = pool.capacity;
        let steps = 0;
        while (unsettled > 0 && steps < 1200) {
            unsettled = step(pool, 1 / 60, behavior);
            steps += 1;
        }
        expect(unsettled).toBe(0);
        for (let i = 0; i < pool.capacity; i += 1) {
            expect(Math.abs(pool.x[i] - pool.tx[i])).toBeLessThan(0.31);
            expect(Math.abs(pool.y[i] - pool.ty[i])).toBeLessThan(0.31);
            expect(pool.alpha[i]).toBeCloseTo(pool.ta[i], 2);
        }
        // Settled means exactly still: another step changes nothing.
        const x = Float32Array.from(pool.x);
        expect(step(pool, 1 / 60, behavior)).toBe(0);
        expect(Array.from(pool.x)).toEqual(Array.from(x));
    });

    it("shows the spring's error shrinking over time", () => {
        const pool = createPool(1, 1);
        pool.tx[0] = 500;
        const errors: number[] = [];
        for (let i = 0; i < 60; i += 1) {
            step(pool, 1 / 60, "form");
            errors.push(Math.abs(500 - pool.x[0]));
        }
        expect(errors[59]).toBeLessThan(errors[10]);
        expect(errors[59]).toBeLessThan(5);
    });

    it("survives a long hitch and an invalid dt", () => {
        const pool = createPool(20, 2);
        pool.tx.fill(400);
        pool.ta.fill(1);
        step(pool, 5, "form");
        expect(Array.from(pool.x).every(value => Number.isFinite(value) && value < 400 * 1.5)).toBe(true);
        const before = Array.from(pool.x);
        step(pool, Number.NaN, "form");
        step(pool, -1, "form");
        expect(Array.from(pool.x)).toEqual(before);
    });
});

const baseDevice: QualityInput = {hardwareConcurrency: 16, deviceMemory: 16, width: 1440, coarsePointer: false, saveData: false};

describe("detectQuality", () => {
    it("rates desktops by cores and memory, treating unknown values as unremarkable", () => {
        expect(detectQuality(baseDevice)).toBe("high");
        expect(detectQuality({...baseDevice, hardwareConcurrency: 8, deviceMemory: undefined})).toBe("high");
        expect(detectQuality({...baseDevice, hardwareConcurrency: 4})).toBe("medium");
        expect(detectQuality({...baseDevice, hardwareConcurrency: undefined, deviceMemory: undefined})).toBe("medium");
        expect(detectQuality({...baseDevice, deviceMemory: 4})).toBe("medium");
        expect(detectQuality({...baseDevice, hardwareConcurrency: 2})).toBe("low");
        expect(detectQuality({...baseDevice, deviceMemory: 2})).toBe("low");
    });

    it("never gives a phone-sized or touch device the top tier, and saveData always low", () => {
        expect(detectQuality({...baseDevice, width: 390, coarsePointer: true})).toBe("medium");
        expect(detectQuality({...baseDevice, width: 390, coarsePointer: true, hardwareConcurrency: 8, deviceMemory: 4})).toBe("low");
        expect(detectQuality({...baseDevice, width: 390, coarsePointer: true, hardwareConcurrency: 4})).toBe("low");
        expect(detectQuality({...baseDevice, width: 600})).toBe("medium");
        expect(detectQuality({...baseDevice, saveData: true})).toBe("low");
        expect(detectQuality({...baseDevice, saveData: true, width: 390, coarsePointer: true})).toBe("low");
    });

    it("steps down one tier at a time and stops at low", () => {
        expect(lowerQuality("high")).toBe("medium");
        expect(lowerQuality("medium")).toBe("low");
        expect(lowerQuality("low")).toBeUndefined();
    });
});

describe("createAdaptiveQuality", () => {
    const feed = (adaptive: ReturnType<typeof createAdaptiveQuality>, frames: number, ms: number) => {
        const changes: string[] = [];
        for (let i = 0; i < frames; i += 1) {
            const next = adaptive.push(ms);
            if (next) changes.push(next);
        }
        return changes;
    };

    it("ignores the first frames (cold start) even when they are slow", () => {
        const adaptive = createAdaptiveQuality("high");
        expect(feed(adaptive, 20, 80)).toEqual([]);
        expect(adaptive.current()).toBe("high");
    });

    it("lowers one tier when the p95 stays over the budget, and never raises it again", () => {
        const adaptive = createAdaptiveQuality("high");
        expect(feed(adaptive, 20 + 39, FRAME_BUDGET_MS + 8)).toEqual([]);
        expect(feed(adaptive, 1, FRAME_BUDGET_MS + 8)).toEqual(["medium"]);
        expect(adaptive.current()).toBe("medium");
        // Fast frames afterwards do not bring it back.
        feed(adaptive, 200, 8);
        expect(adaptive.current()).toBe("medium");
        // A further slow run (after the warm-up that follows every change) lowers it again, then stops.
        expect(feed(adaptive, 20 + 40, 30)).toEqual(["low"]);
        expect(feed(adaptive, 300, 60)).toEqual([]);
        expect(adaptive.current()).toBe("low");
    });

    it("tolerates isolated spikes: the 95th percentile, not the maximum, decides", () => {
        const adaptive = createAdaptiveQuality("high");
        feed(adaptive, 20, 16);
        for (let i = 0; i < 120; i += 1) expect(adaptive.push(i % 40 === 0 ? 90 : 16)).toBeUndefined();
        expect(adaptive.current()).toBe("high");
    });

    it("ignores invalid frame times", () => {
        const adaptive = createAdaptiveQuality("medium");
        for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) expect(adaptive.push(bad)).toBeUndefined();
        expect(feed(adaptive, 20 + 40, 40)).toEqual(["low"]);
    });
});

function bitmap(width: number, height: number, ink: (x: number, y: number) => boolean): Bitmap {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (ink(x, y)) data[(y * width + x) * 4 + 3] = 255;
    return {data, width, height};
}

describe("samplePoints", () => {
    const block = bitmap(100, 60, (x, y) => x >= 20 && x < 80 && y >= 10 && y < 50);

    it("returns only inked positions as flat x,y pairs, within the limit", () => {
        const points = samplePoints(block, {maxPoints: 5000, step: 2, rng: () => 0.5});
        expect(points.length % 2).toBe(0);
        expect(points.length / 2).toBe(30 * 20);
        for (let i = 0; i < points.length; i += 2) {
            expect(points[i]).toBeGreaterThanOrEqual(19);
            expect(points[i]).toBeLessThan(81);
            expect(points[i + 1]).toBeGreaterThanOrEqual(9);
            expect(points[i + 1]).toBeLessThan(51);
        }
    });

    it("widens the grid and thins the rest so the count never exceeds maxPoints", () => {
        for (const maxPoints of [1, 7, 50, 200, 599]) {
            const count = samplePoints(block, {maxPoints, step: 1, rng: () => 0.5}).length / 2;
            expect(count).toBeLessThanOrEqual(maxPoints);
            expect(count).toBeGreaterThan(maxPoints * 0.4);
        }
        expect(samplePoints(block, {maxPoints: 0, rng: () => 0.5})).toHaveLength(0);
    });

    it("applies the offset, restricts to a region and is deterministic with a seeded rng", () => {
        const a = samplePoints(block, {maxPoints: 100, ox: 1000, oy: 500, rng: mulberry32(1)});
        const b = samplePoints(block, {maxPoints: 100, ox: 1000, oy: 500, rng: mulberry32(1)});
        expect(Array.from(a)).toEqual(Array.from(b));
        expect(a[0]).toBeGreaterThan(1000);
        const region = samplePoints(block, {maxPoints: 5000, step: 1, rng: () => 0.5, region: {x: 0, y: 0, w: 50, h: 60}});
        expect(Math.max(...Array.from(region).filter((_, index) => index % 2 === 0))).toBeLessThan(51);
        expect(region.length / 2).toBe(30 * 40);
    });

    it("finds nothing in blank bitmaps and respects the alpha threshold", () => {
        expect(samplePoints(bitmap(10, 10, () => false), {maxPoints: 50, rng: () => 0.5})).toHaveLength(0);
        const faint = {width: 4, height: 4, data: new Uint8ClampedArray(64).fill(0).map((_, index) => (index % 4 === 3 ? 60 : 0))};
        expect(samplePoints(faint, {maxPoints: 50, step: 1, rng: () => 0.5})).toHaveLength(0);
        expect(samplePoints(faint, {maxPoints: 50, step: 1, threshold: 10, rng: () => 0.5}).length / 2).toBe(16);
    });
});

describe("point-set helpers", () => {
    it("sorts left to right and lays outlines on the border", () => {
        expect(Array.from(sortPointsByX(new Float32Array([5, 1, 2, 9, 2, 3])))).toEqual([2, 3, 2, 9, 5, 1]);
        const outline = rectOutline({x: 10, y: 20, w: 100, h: 50}, 60);
        expect(outline).toHaveLength(120);
        for (let i = 0; i < 120; i += 2) {
            const onVertical = Math.abs(outline[i] - 10) < 1e-3 || Math.abs(outline[i] - 110) < 1e-3;
            const onHorizontal = Math.abs(outline[i + 1] - 20) < 1e-3 || Math.abs(outline[i + 1] - 70) < 1e-3;
            expect(onVertical || onHorizontal).toBe(true);
        }
    });

    it("assigns points to particles (shuffled or in order) and turns the rest into faint dust", () => {
        const set = createSet(10);
        const points = new Float32Array([1, 1, 2, 2, 3, 3, 4, 4]);
        expect(fillSet(set, points, {rng: mulberry32(3), shuffle: false, width: 100, height: 100})).toBe(4);
        expect(Array.from(set.x.slice(0, 4))).toEqual([1, 2, 3, 4]);
        expect(Array.from(set.a.slice(0, 4))).toEqual([1, 1, 1, 1]);
        expect(set.a.slice(4).every(value => value > 0 && value < 0.5)).toBe(true);
        const shuffled = createSet(10);
        fillSet(shuffled, points, {rng: mulberry32(3), shuffle: true, width: 100, height: 100});
        expect(Array.from(shuffled.x.slice(0, 4)).sort()).toEqual([1, 2, 3, 4]);
        // More points than particles: only as many as fit are used.
        expect(fillSet(createSet(2), points, {rng: mulberry32(3), shuffle: false, width: 10, height: 10})).toBe(2);
    });

    it("puts the picture beside the text on wide screens and under it on narrow ones", () => {
        const wide = artRect(1280, 800);
        expect(wide.x).toBeGreaterThan(1280 * 0.5);
        expect(wide.x + wide.w).toBeLessThan(1280);
        const narrow = artRect(390, 844);
        expect(narrow.y).toBeGreaterThan(844 * 0.5);
        expect(narrow.x + narrow.w).toBeLessThanOrEqual(390);
    });
});

describe("textPoints", () => {
    // A fake off-screen canvas: every character is `size` wide and the whole drawn area is inked.
    function fakeCanvas(widthPerChar: (size: number) => number): () => CanvasLike {
        let size = 10;
        const ctx = {
            font: "", fillStyle: "", textBaseline: "", textAlign: "",
            measureText: (text: string) => ({width: text.length * widthPerChar(size)}),
            clearRect: () => undefined,
            fillText: () => undefined,
            getImageData: (_x: number, _y: number, w: number, h: number) => ({width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255)}),
        };
        Object.defineProperty(ctx, "font", {get: () => `${size}px`, set: (value: string) => { size = Number.parseFloat(/(\d+(\.\d+)?)px/.exec(value)?.[1] ?? "10"); }});
        return () => ({width: 0, height: 0, getContext: () => ctx as unknown as CanvasRenderingContext2D});
    }
    const options = {font: (size: number) => `500 ${size}px serif`, size: 20, lineHeight: 30, x: 200, y: 100, align: "left" as const, maxPoints: 90, rng: mulberry32(1)};

    it("samples each line separately, line by line, within the point budget", () => {
        const {points, size} = textPoints(["abcd", "efgh", "ijkl"], {...options, createCanvas: fakeCanvas(() => 20)});
        expect(size).toBe(20);
        expect(points.length / 2).toBeLessThanOrEqual(90);
        expect(points.length / 2).toBeGreaterThan(40);
        const rows = Array.from({length: points.length / 2}, (_, index) => points[index * 2 + 1]);
        // Rows never go back up: line 1's points come before line 2's, and so on.
        const bands = [rows.slice(0, rows.length / 3), rows.slice(rows.length / 3, (rows.length * 2) / 3), rows.slice((rows.length * 2) / 3)];
        expect(Math.max(...bands[0])).toBeLessThan(Math.min(...bands[2]));
        expect(Math.min(...Array.from({length: points.length / 2}, (_, index) => points[index * 2]))).toBeGreaterThan(150);
    });

    it("shrinks the font to fit maxWidth and returns nothing without a context", () => {
        const fit = textPoints(["abcdefgh"], {...options, maxWidth: 80, createCanvas: fakeCanvas(size => size)});
        expect(fit.size).toBeLessThan(20);
        expect(fit.size).toBeCloseTo(10, 0);
        expect(textPoints(["x"], {...options, createCanvas: () => ({width: 0, height: 0, getContext: () => null})}).points).toHaveLength(0);
        expect(textPoints([], {...options, createCanvas: fakeCanvas(() => 20)}).points).toHaveLength(0);
    });
});

function makeSets(capacity: number): Sets {
    const make = (value: number) => {
        const set = createSet(capacity);
        set.x.fill(value);
        set.y.fill(value);
        set.a.fill(1);
        return set;
    };
    const grid = make(5);
    return {center: make(1), scatter: make(2), title: make(3), text: make(4), typed: make(6), grid, gridLit: {x: grid.x, y: grid.y, a: Float32Array.from(grid.a)}, textCount: 40, textSize: 30, cellSize: 8, typedCount: -1};
}

describe("scene plans", () => {
    const blank = (sets: Sets): Plan => ({from: sets.center, to: sets.center, t: 0, behavior: "scatter", alphaScale: 0});

    it("leader: hidden at the centre, bursts to dust, then gathers into the title", () => {
        const sets = makeSets(50);
        const plan = blank(sets);
        planLeader(0.2, sets, plan);
        expect([plan.from, plan.to, plan.t]).toEqual([sets.center, sets.center, 0]);
        planLeader(0.5, sets, plan);
        expect([plan.from, plan.to]).toEqual([sets.center, sets.scatter]);
        expect(plan.t).toBeGreaterThan(0);
        planLeader(0.6, sets, plan);
        expect([plan.from, plan.to, plan.t]).toEqual([sets.scatter, sets.scatter, 0]);
        planLeader(0.7, sets, plan);
        expect([plan.from, plan.to]).toEqual([sets.scatter, sets.title]);
        planLeader(TITLE_FORMED, sets, plan);
        expect(plan.t).toBe(1);
        planLeader(1, sets, plan);
        expect(plan.t).toBe(1);
        expect(plan.behavior).toBe("form");
    });

    it("spark: title dissolves, then text is revealed as a growing prefix", () => {
        const sets = makeSets(50);
        const plan = blank(sets);
        planSpark(0.05, sets, plan);
        expect([plan.from, plan.to]).toEqual([sets.title, sets.scatter]);
        expect(revealCount(0.1, 40)).toBe(0);
        expect(revealCount(0.5, 40)).toBeGreaterThan(0);
        expect(revealCount(0.5, 40)).toBeLessThan(40);
        expect(revealCount(1, 40)).toBe(40);
        planSpark(0.5, sets, plan);
        expect(plan.from).toBe(sets.typed);
        const shown = revealCount(0.5, 40);
        expect(sets.typed.x[0]).toBe(4);
        expect(sets.typed.x[shown]).toBe(2);
        expect(sets.typed.a[shown]).toBeLessThan(1);
        planSpark(1, sets, plan);
        expect(sets.typed.x[39]).toBe(4);
        expect(sets.typed.x[40]).toBe(2);
    });

    it("script: text splits into the grid, cells light one after another, the scene fades out at the end", () => {
        const sets = makeSets(48);
        const plan = blank(sets);
        planScript(0.08, sets, 6, plan);
        expect([plan.from, plan.to]).toEqual([sets.text, sets.grid]);
        expect(cellLight(0.2, 0)).toBe(0);
        for (let cell = 1; cell < 6; cell += 1) expect(cellLight(0.5, cell)).toBeLessThanOrEqual(cellLight(0.5, cell - 1));
        expect(cellLight(0.9, 5)).toBe(1);
        planScript(0.55, sets, 6, plan);
        expect(plan.from).toBe(sets.gridLit);
        expect(sets.gridLit.a[0]).toBeCloseTo(GRID_DIM + 0.55, 5);
        expect(sets.gridLit.a[5 * 8]).toBeLessThan(sets.gridLit.a[0]);
        expect(plan.alphaScale).toBe(1);
        planScript(0.999, sets, 6, plan);
        expect(plan.alphaScale).toBeLessThan(0.01);
    });
});
