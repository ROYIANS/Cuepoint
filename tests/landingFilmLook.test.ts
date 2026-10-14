// @vitest-environment jsdom
import {describe, expect, it} from "vitest";
import {
    createFilmLook, drawLook, dustCount, dustFor, flickerFor, frameRandom, grainPixels, lookFps, reelMark, sceneMark, weaveFor,
    FILM_FPS, FLICKER_MAX, GRAIN_ALPHA, GRAIN_TILE, GRAIN_TILES, MAX_DUST, WEAVE_PX, type Dust, type LookResources,
} from "@/landing/film/renderers/filmLook";

type Call = unknown[];

/** A context that records every call and property write, in order. */
function recordingContext() {
    const log: Call[] = [];
    const state: Record<string, unknown> = {};
    const ctx = new Proxy({} as Record<string, unknown>, {
        get: (_target, key: string) => (key in state ? state[key] : (...args: unknown[]) => { log.push([key, ...args]); }),
        set: (_target, key: string, value) => { state[key] = value; log.push(["set", key, value]); return true; },
    });
    return {ctx: ctx as unknown as CanvasRenderingContext2D, log};
}

const patterns = Array.from({length: GRAIN_TILES}, (_, index) => ({tile: index})) as unknown as CanvasPattern[];
const dust = (): Dust[] => Array.from({length: MAX_DUST}, () => ({kind: "speck", x: 0, y: 0, size: 1, angle: 0}) as Dust);
const resources = (): LookResources => ({patterns, dust: dust()});

function paint(frame: number, quality: "high" | "medium" | "low" = "high", w = 400, h = 300) {
    const {ctx, log} = recordingContext();
    drawLook(ctx, resources(), frame, w, h, 1.5, quality);
    return log;
}

describe("grain tiles", () => {
    it("are deterministic, differ per tile and hold both light and dark specks", () => {
        const a = grainPixels(0);
        expect(a).toHaveLength(GRAIN_TILE * GRAIN_TILE * 4);
        expect(grainPixels(0)).toEqual(a);
        expect(grainPixels(1)).not.toEqual(a);
        let light = 0;
        let dark = 0;
        for (let i = 0; i < a.length; i += 4) (a[i] === 255 ? light++ : dark++);
        expect(light).toBeGreaterThan(a.length / 4 / 3);
        expect(dark).toBeGreaterThan(a.length / 4 / 3);
    });

    it("rotates by the film frame number (frame mod 3)", () => {
        for (let frame = 0; frame < 9; frame += 1) {
            const fill = paint(frame).find(call => call[0] === "set" && call[1] === "fillStyle");
            expect(fill?.[2]).toBe(patterns[frame % GRAIN_TILES]);
        }
    });
});

describe("a film frame", () => {
    it("repaints identically for the same frame number and differently for another", () => {
        expect(paint(37)).toEqual(paint(37));
        expect(paint(37)).not.toEqual(paint(38));
        for (let frame = 0; frame < 50; frame += 1) expect(frameRandom(frame, 1)).toBe(frameRandom(frame, 1));
    });

    it("has 0-3 pieces of dust or hair, inside the picture, and never uses more than the fixed set", () => {
        const seen = new Set<number>();
        for (let frame = 0; frame < 4000; frame += 1) {
            const count = dustCount(frame);
            seen.add(count);
            expect(count).toBeGreaterThanOrEqual(0);
            expect(count).toBeLessThanOrEqual(MAX_DUST);
            const pieces = dust();
            expect(dustFor(frame, 400, 300, pieces)).toBe(count);
            for (let i = 0; i < count; i += 1) {
                expect(pieces[i].x).toBeGreaterThanOrEqual(0);
                expect(pieces[i].x).toBeLessThan(400);
                expect(pieces[i].y).toBeGreaterThanOrEqual(0);
                expect(pieces[i].y).toBeLessThan(300);
            }
        }
        expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    });

    it("keeps the exposure flicker and the gate weave within their limits", () => {
        let warm = 0;
        for (let frame = 0; frame < 2000; frame += 1) {
            const flicker = flickerFor(frame);
            expect(flicker.alpha).toBeGreaterThanOrEqual(0);
            expect(flicker.alpha).toBeLessThanOrEqual(FLICKER_MAX);
            if (flicker.warm) warm += 1;
            const shift = weaveFor(frame);
            expect(Math.abs(shift.x)).toBeLessThanOrEqual(WEAVE_PX);
            expect(Math.abs(shift.y)).toBeLessThanOrEqual(WEAVE_PX);
        }
        expect(warm).toBeGreaterThan(700);
        expect(warm).toBeLessThan(1300);
        expect(FLICKER_MAX).toBeLessThanOrEqual(0.035);
    });

    it("draws nothing that allocates: no gradients, no image data, no new patterns", () => {
        const names = new Set<string>();
        for (let frame = 0; frame < 60; frame += 1) for (const call of paint(frame)) names.add(String(call[0]));
        for (const forbidden of ["createRadialGradient", "createLinearGradient", "createImageData", "getImageData", "createPattern"]) expect(names.has(forbidden), forbidden).toBe(false);
    });

    it("halves the grain and drops dust on the low tier", () => {
        const alphas = (log: Call[]) => log.filter(call => call[0] === "set" && call[1] === "globalAlpha").map(call => call[2]);
        expect(alphas(paint(5, "high"))[0]).toBe(GRAIN_ALPHA);
        expect(alphas(paint(5, "low"))[0]).toBe(GRAIN_ALPHA / 2);
        let lowDust = 0;
        let highDust = 0;
        for (let frame = 0; frame < 300; frame += 1) {
            lowDust += paint(frame, "low").filter(call => call[0] === "arc" || call[0] === "quadraticCurveTo").length;
            highDust += paint(frame, "high").filter(call => call[0] === "arc" || call[0] === "quadraticCurveTo").length;
        }
        expect(lowDust).toBe(0);
        expect(highDust).toBeGreaterThan(50);
    });
});

describe("slate marks", () => {
    it("are formatted like a slate", () => {
        expect(reelMark(37)).toBe("REEL 01   0037");
        expect(reelMark(12345)).toBe("REEL 01   2345");
        expect(sceneMark(3)).toBe("SC 03 · TAKE 1");
        expect(sceneMark(0)).toBe("SC 00 · TAKE 1");
    });
});

function lookHarness(options: {context?: CanvasRenderingContext2D | null; pattern?: () => unknown} = {}) {
    const main = recordingContext();
    const counts = {pattern: 0, tile: 0, image: 0};
    const context = options.context === undefined ? main.ctx : options.context;
    const wrapped = context && new Proxy(context as unknown as Record<string, unknown>, {
        get: (target, key: string) => key === "createPattern" ? () => { counts.pattern += 1; return options.pattern ? options.pattern() : {pattern: counts.pattern}; } : target[key],
        set: (target, key: string, value) => { target[key] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const canvas = {width: 0, height: 0, getContext: () => wrapped} as unknown as HTMLCanvasElement;
    const weave = document.createElement("div");
    const reel = document.createElement("span");
    const scene = document.createElement("span");
    const look = createFilmLook({
        canvas,
        weave,
        reel,
        scene,
        createCanvas: () => {
            counts.tile += 1;
            return {width: 0, height: 0, getContext: () => ({createImageData: (w: number, h: number) => { counts.image += 1; return {data: new Uint8ClampedArray(w * h * 4)}; }, putImageData: () => undefined})} as never;
        },
    });
    return {look, canvas, weave, reel, scene, counts, log: main.log};
}

describe("film look controller", () => {
    it("sizes its canvas past the stage edges at a capped pixel ratio", () => {
        const h = lookHarness();
        h.look!.resize(1280, 800, 3, "high");
        expect(h.canvas.width).toBe(Math.ceil((1280 + 8) * 1.5));
        expect(h.canvas.height).toBe(Math.ceil((800 + 8) * 1.5));
        h.look!.resize(1280, 800, 3, "low");
        expect(h.canvas.width).toBe(1288);
    });

    it("steps a 24 fps film clock: it paints when a film frame is due and not between", () => {
        const h = lookHarness();
        h.look!.resize(1280, 800, 1, "high");
        let painted = 0;
        let now = 1000;
        for (let i = 0; i < 60; i += 1) { // one second at 60 Hz
            if (h.look!.tick(now, 2, "high")) painted += 1;
            now += 1000 / 60;
        }
        expect(painted).toBeGreaterThanOrEqual(23);
        expect(painted).toBeLessThanOrEqual(25);
        expect(h.look!.frame()).toBe(painted);
        h.look!.tick(now + 100, 2, "high"); // a frame is due and painted...
        const before = h.look!.frame();
        expect(h.look!.tick(now + 101, 2, "high")).toBe(false); // ...so the next millisecond paints nothing
        expect(h.look!.frame()).toBe(before);
    });

    it("runs at 12 fps on the low tier, with no weave", () => {
        const h = lookHarness();
        h.look!.resize(1280, 800, 1, "low");
        let painted = 0;
        let now = 0;
        for (let i = 0; i < 60; i += 1) {
            if (h.look!.tick(now, 1, "low")) painted += 1;
            now += 1000 / 60;
        }
        expect(painted).toBeGreaterThanOrEqual(11);
        expect(painted).toBeLessThanOrEqual(13);
        expect(lookFps("low")).toBe(12);
        expect(lookFps("medium")).toBe(FILM_FPS);
        expect(h.weave.style.transform).toBe("translate3d(0.00px, 0.00px, 0)");
        expect(h.look!.frame()).toBe(painted * 2); // frame numbers still run at film speed
    });

    it("freezes the frame number while held and resumes with a fresh interval", () => {
        const h = lookHarness();
        h.look!.resize(400, 300, 1, "high");
        let now = 0;
        for (let i = 0; i < 10; i += 1) { h.look!.tick(now, 0, "high"); now += 20; }
        const frozen = h.look!.frame();
        h.look!.hold();
        now += 60_000; // a long pause must not fast-forward the counter
        expect(h.look!.tick(now, 0, "high")).toBe(true);
        expect(h.look!.frame()).toBe(frozen + 1);
    });

    it("moves the picture by the frame's weave and writes the slate marks only when they change", () => {
        const h = lookHarness();
        h.look!.resize(400, 300, 1, "high");
        h.look!.tick(0, 3, "high");
        const shift = weaveFor(h.look!.frame());
        expect(h.weave.style.transform).toBe(`translate3d(${shift.x.toFixed(2)}px, ${shift.y.toFixed(2)}px, 0)`);
        expect(h.reel.textContent).toBe(reelMark(1));
        expect(h.scene.textContent).toBe("SC 03 · TAKE 1");
        h.look!.tick(100, 3, "high");
        expect(h.reel.textContent).toBe(reelMark(2));
        h.look!.tick(200, 4, "high");
        expect(h.scene.textContent).toBe("SC 04 · TAKE 1");
        h.look!.destroy();
        expect(h.weave.style.transform).toBe("");
    });

    it("builds its grain once: later frames create no tiles, images or patterns", () => {
        const h = lookHarness();
        expect(h.counts).toEqual({pattern: GRAIN_TILES, tile: GRAIN_TILES, image: GRAIN_TILES});
        h.look!.resize(400, 300, 1, "high");
        let now = 0;
        for (let i = 0; i < 300; i += 1) { h.look!.tick(now, 1, "high"); now += 17; }
        expect(h.counts).toEqual({pattern: GRAIN_TILES, tile: GRAIN_TILES, image: GRAIN_TILES});
    });

    it("is simply absent without a 2D context or patterns, and never throws", () => {
        expect(lookHarness({context: null}).look).toBeUndefined();
        expect(lookHarness({pattern: () => null}).look).toBeUndefined();
        expect(lookHarness({pattern: () => { throw new Error("no patterns"); }}).look).toBeUndefined();
    });
});
