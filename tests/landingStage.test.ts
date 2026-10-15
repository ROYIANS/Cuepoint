// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {mountStage, type StageEnv, type StageHandle} from "../apps/site/src/film/renderers/stage";
import {progressToFrame, sceneProgressWindow} from "../apps/site/src/film/timeline";
import type {FilmDriver, FilmState} from "../apps/site/src/film/useFilmProgress";

function fakeContext() {
    const calls = {drawImage: 0, clearRect: 0};
    const noop = () => undefined;
    const ctx = {
        calls,
        font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, textAlign: "", textBaseline: "", globalAlpha: 1, globalCompositeOperation: "source-over",
        setTransform: noop, save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, arc: noop, stroke: noop, fill: noop, fillRect: noop, strokeRect: noop, fillText: noop,
        clearRect: () => { calls.clearRect += 1; },
        drawImage: () => { calls.drawImage += 1; },
        createRadialGradient: () => ({addColorStop: noop}),
        createPattern: () => ({}),
        createImageData: (w: number, h: number) => ({data: new Uint8ClampedArray(w * h * 4)}),
        putImageData: noop,
        quadraticCurveTo: noop,
        measureText: (text: string) => ({width: text.length * 10}),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255)}),
    };
    return ctx;
}

type Harness = ReturnType<typeof harness>;

function harness(options: {context?: ReturnType<typeof fakeContext> | null; device?: Partial<ReturnType<StageEnv["device"]>>} = {}) {
    const ctx = options.context === undefined ? fakeContext() : options.context;
    const stage = document.createElement("div");
    const canvas = document.createElement("canvas");
    stage.append(canvas);
    vi.spyOn(canvas, "getContext").mockImplementation(() => ctx as never);
    let time = 1000;
    let hidden = false;
    let nextId = 0;
    const queue = new Map<number, (time: number) => void>();
    const cleanup = {resize: vi.fn(), visible: vi.fn(), hiddenChange: vi.fn()};
    const handlers: {resize?: () => void; visible?: (value: boolean) => void; hidden?: () => void} = {};
    const measure = vi.fn(() => ({w: 1280, h: 800}));
    const loadFont = vi.fn(() => Promise.resolve());
    const env: Partial<StageEnv> = {
        raf: callback => { nextId += 1; queue.set(nextId, callback); return nextId; },
        caf: id => void queue.delete(id),
        now: () => time,
        isHidden: () => hidden,
        dpr: () => 2,
        measure,
        createCanvas: () => ({width: 0, height: 0, getContext: () => fakeContext() as never}),
        observeResize: (_element, callback) => { handlers.resize = callback; return cleanup.resize; },
        observeVisible: (_element, callback) => { handlers.visible = callback; return cleanup.visible; },
        onHiddenChange: callback => { handlers.hidden = callback; return cleanup.hiddenChange; },
        loadFont,
        device: () => ({hardwareConcurrency: 16, deviceMemory: 16, width: 1280, coarsePointer: false, saveData: false, ...options.device}),
    };
    const listeners = new Set<(state: FilmState) => void>();
    const unsubscribe = vi.fn();
    const driver: FilmDriver = {
        start: () => undefined,
        stop: () => undefined,
        subscribe: listener => {
            listeners.add(listener);
            listener(progressToFrame(0));
            return () => { unsubscribe(); listeners.delete(listener); };
        },
    };
    return {
        ctx, stage, canvas, queue, handlers, cleanup, measure, loadFont, unsubscribe, listeners, driver, env,
        setHidden: (value: boolean) => { hidden = value; },
        advance: (ms: number) => { time += ms; },
        now: () => time,
        emit(progress: number) { const state = progressToFrame(progress); listeners.forEach(listener => listener(state)); },
        /** Runs queued frames at ~60 Hz until none is requested (or the guard trips). */
        run(guard = 2000) {
            let frames = 0;
            while (queue.size > 0 && frames < guard) {
                time += 16;
                const callbacks = [...queue.values()];
                queue.clear();
                callbacks.forEach(callback => callback(time));
                frames += 1;
            }
            return frames;
        },
        mount(): StageHandle | undefined {
            return mountStage({stage, canvas, driver, env});
        },
    };
}

let h: Harness;
beforeEach(() => { h = harness(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("mountStage", () => {
    it("paints once on mount, marks the stage ready and sizes the canvas from the stage and DPR", () => {
        const handle = h.mount();
        expect(handle).toBeDefined();
        expect(h.stage.dataset.canvas).toBe("on");
        expect(handle!.frames()).toBe(1);
        expect(h.canvas.width).toBe(2560);
        expect(h.canvas.height).toBe(1600);
        expect(handle!.quality()).toBe("high");
        expect(h.listeners.size).toBe(1);
    });

    it("keeps breathing at rest at a reduced rate, and stops once the film has moved on and settled", () => {
        const handle = h.mount()!;
        expect(h.queue.size).toBe(1);
        const frames = h.run(300);
        expect(frames).toBe(300); // never stops by itself while at rest
        expect(h.queue.size).toBe(1);
        expect(handle.frames()).toBeLessThan(200); // ~30 fps, not every 16 ms frame
        h.emit(0.3);
        h.run();
        expect(h.queue.size).toBe(0);
        const settled = handle.frames();
        h.advance(5000);
        h.run();
        expect(handle.frames()).toBe(settled);
    });

    it("resumes when the progress changes and stops again once the particles have settled", () => {
        const handle = h.mount()!;
        h.run();
        const idle = handle.frames();
        h.advance(1000);
        h.emit(0.1); // leader local ~0.6: the dust target set differs from the hidden centre
        expect(handle.frames()).toBe(idle + 1);
        expect(h.queue.size).toBe(1);
        const frames = h.run();
        expect(frames).toBeGreaterThan(5);
        expect(h.queue.size).toBe(0);
        const settled = handle.frames();
        h.advance(2000);
        h.run();
        expect(handle.frames()).toBe(settled);
        // Same progress again is not motion either.
        h.advance(100);
        h.emit(0.1);
        h.run();
        expect(h.queue.size).toBe(0);
    });

    it("draws particles through a pre-rendered sprite, never creating gradients per particle", () => {
        const handle = h.mount()!;
        h.advance(1000);
        h.emit(0.1);
        h.run();
        expect(handle.frames()).toBeGreaterThan(5);
        expect(h.ctx!.calls.drawImage).toBeGreaterThan(100);
        expect(h.ctx!.calls.clearRect).toBe(handle.frames()); // full clear: the overlay never smears
    });

    it("stops while the stage is off screen and resumes with a fresh frame when it returns", () => {
        const handle = h.mount()!;
        h.run();
        h.advance(500);
        h.emit(0.1);
        expect(h.queue.size).toBe(1);
        h.handlers.visible!(false);
        expect(h.queue.size).toBe(0);
        const frames = handle.frames();
        h.advance(100);
        h.emit(0.2);
        h.run();
        expect(handle.frames()).toBe(frames);
        h.handlers.visible!(true);
        expect(h.queue.size).toBe(1);
        h.run();
        expect(handle.frames()).toBeGreaterThan(frames);
    });

    it("stops while the document is hidden and resumes when it is shown", () => {
        const handle = h.mount()!;
        h.run();
        h.advance(500);
        h.emit(0.1);
        h.setHidden(true);
        h.handlers.hidden!();
        expect(h.queue.size).toBe(0);
        const frames = handle.frames();
        h.advance(100);
        h.emit(0.3);
        expect(handle.frames()).toBe(frames);
        expect(h.queue.size).toBe(0);
        h.setHidden(false);
        h.handlers.hidden!();
        expect(h.queue.size).toBe(1);
        h.run();
        expect(handle.frames()).toBeGreaterThan(frames);
    });

    it("rebuilds on resize and again once the display font has loaded", async () => {
        const handle = h.mount()!;
        h.run();
        expect(h.loadFont).toHaveBeenCalledTimes(1);
        const measured = h.measure.mock.calls.length;
        await Promise.resolve();
        await Promise.resolve();
        expect(h.queue.size).toBe(1); // font arrived: sample the title again
        h.run();
        expect(h.measure.mock.calls.length).toBeGreaterThan(measured);
        h.measure.mockReturnValue({w: 600, h: 400});
        h.advance(50);
        h.handlers.resize!();
        h.run();
        expect(h.canvas.width).toBe(1200);
        expect(handle.frames()).toBeGreaterThan(1);
    });

    it("does nothing (and does not throw) when the stage has no size yet", () => {
        h.measure.mockReturnValue({w: 0, h: 0});
        const handle = h.mount()!;
        expect(handle.frames()).toBe(0);
        h.measure.mockReturnValue({w: 800, h: 600});
        h.handlers.resize!();
        h.run();
        expect(handle.frames()).toBeGreaterThan(0);
    });

    it("cleans up on destroy: no frames, no subscription, observers released, later input ignored", () => {
        const handle = h.mount()!;
        expect(h.queue.size).toBe(1);
        handle.destroy();
        expect(h.queue.size).toBe(0);
        expect(h.unsubscribe).toHaveBeenCalledTimes(1);
        expect(h.listeners.size).toBe(0);
        expect(h.cleanup.resize).toHaveBeenCalledTimes(1);
        expect(h.cleanup.visible).toHaveBeenCalledTimes(1);
        expect(h.cleanup.hiddenChange).toHaveBeenCalledTimes(1);
        const frames = handle.frames();
        h.handlers.resize!();
        h.handlers.visible!(true);
        h.handlers.hidden!();
        h.emit(0.5);
        h.run();
        expect(handle.frames()).toBe(frames);
    });

    it("returns undefined, quietly, when no 2D context can be created", () => {
        const broken = harness({context: null});
        expect(broken.mount()).toBeUndefined();
        expect(broken.queue.size).toBe(0);
        expect(broken.listeners.size).toBe(0);
        const throwing = harness();
        vi.spyOn(throwing.canvas, "getContext").mockImplementation(() => { throw new Error("denied"); });
        expect(() => throwing.mount()).not.toThrow();
        expect(throwing.mount()).toBeUndefined();
        // A context that cannot draw gradients (no sprite) also degrades instead of throwing.
        const limited = harness({context: {} as never});
        expect(limited.mount()).toBeUndefined();
        expect(limited.queue.size).toBe(0);
        expect(limited.listeners.size).toBe(0); // a failed mount leaves nothing subscribed
    });

    it("steps the quality tier down when frames stay slow, never back up", () => {
        const handle = h.mount()!;
        h.run();
        expect(handle.quality()).toBe("high");
        const tiers: string[] = [];
        for (let i = 0; i < 260; i += 1) {
            h.advance(34); // a 30 fps machine
            h.emit(0.1 + (i % 2) * 0.001);
            h.run(1); // drain the stage's own frame, if any
            if (tiers.at(-1) !== handle.quality()) tiers.push(handle.quality());
        }
        expect(tiers).toEqual(["high", "medium", "low"]);
        for (let i = 0; i < 200; i += 1) {
            h.advance(8);
            h.emit(0.1 + (i % 2) * 0.001);
        }
        expect(handle.quality()).toBe("low");
    });

    it("starts at a lower tier on constrained devices", () => {
        const phone = harness({device: {width: 390, coarsePointer: true, hardwareConcurrency: 4}});
        expect(phone.mount()!.quality()).toBe("low");
        const saver = harness({device: {saveData: true}});
        expect(saver.mount()!.quality()).toBe("low");
    });
    it.each([[3, "agent"], [4, "vault"], [5, "delivery"]])("paints the picture of stage scene %i (%s) on every tier and settles", (sceneIndex, _name) => {
        for (const device of [{}, {hardwareConcurrency: 4, deviceMemory: 4}, {saveData: true}]) {
            h = harness({device});
            const handle = h.mount()!;
            h.run();
            const {start, end} = sceneProgressWindow(sceneIndex);
            const drawn = h.ctx!.calls.drawImage;
            h.advance(1000);
            h.emit(start + (end - start) * 0.78);
            expect(h.run()).toBeGreaterThan(5);
            expect(h.queue.size).toBe(0);
            expect(h.ctx!.calls.drawImage).toBeGreaterThan(drawn + 20);
            expect(handle.frames()).toBeGreaterThan(1);
            handle.destroy();
        }
    });
});

describe("film look on the stage", () => {
    function mountWithLook(frozen: () => boolean = () => false) {
        const lookCanvas = document.createElement("canvas");
        vi.spyOn(lookCanvas, "getContext").mockImplementation(() => fakeContext() as never);
        const weave = document.createElement("div");
        weave.dataset.filmWeave = "";
        const reel = document.createElement("span");
        reel.dataset.mark = "reel";
        const scene = document.createElement("span");
        scene.dataset.mark = "scene";
        h.stage.append(weave, reel, scene);
        const handle = mountStage({stage: h.stage, canvas: h.canvas, driver: h.driver, env: h.env, lookCanvas, isFrozen: frozen});
        return {handle: handle!, lookCanvas, weave, reel, scene};
    }

    it("creates the overlay with the stage and removes its weave with it; no overlay without a canvas for it", () => {
        const plain = h.mount()!;
        expect(plain.look()).toBeUndefined();
        plain.destroy();
        h = harness();
        const {handle, weave, reel, scene} = mountWithLook();
        expect(handle.look()).toBeDefined();
        h.run(30);
        expect(reel.textContent).toMatch(/^REEL 01 {3}\d{4}$/);
        expect(scene.textContent).toBe("SC 00 · TAKE 1");
        expect(weave.style.transform).toMatch(/^translate3d\(/);
        handle.destroy();
        expect(weave.style.transform).toBe("");
    });

    it("keeps one shared frame loop alive for the film clock, without redrawing a settled picture", () => {
        const {handle} = mountWithLook();
        h.emit(0.3);
        h.run(200); // particles settle...
        const settled = handle.frames();
        expect(h.queue.size).toBe(1); // ...but the loop stays: the grain keeps running
        h.run(120);
        expect(handle.frames()).toBe(settled); // the picture is not repainted
        expect(h.queue.size).toBe(1);
        const frame = handle.look()!.frame();
        h.run(120);
        expect(handle.look()!.frame()).toBeGreaterThan(frame + 30); // ~24 fps over ~2 s
        handle.destroy();
        expect(h.queue.size).toBe(0);
    });

    it("freezes while paused, resumes on wake, and stops when hidden or off screen", () => {
        let frozen = false;
        const {handle} = mountWithLook(() => frozen);
        h.emit(0.3);
        h.run(200);
        frozen = true;
        h.run(5);
        expect(h.queue.size).toBe(0); // the loop ended: nothing runs while paused
        const frame = handle.look()!.frame();
        h.advance(5000);
        frozen = false;
        handle.wake();
        expect(h.queue.size).toBe(1);
        h.run(40);
        expect(handle.look()!.frame()).toBeGreaterThan(frame);
        expect(handle.look()!.frame()).toBeLessThan(frame + 30); // the paused time did not fast-forward the counter
        h.setHidden(true);
        h.handlers.hidden!();
        expect(h.queue.size).toBe(0);
        h.setHidden(false);
        h.handlers.hidden!();
        expect(h.queue.size).toBe(1);
        h.handlers.visible!(false);
        expect(h.queue.size).toBe(0);
        handle.destroy();
    });

    it("plays on without an overlay when its context cannot be created", () => {
        const lookCanvas = document.createElement("canvas");
        vi.spyOn(lookCanvas, "getContext").mockReturnValue(null);
        const handle = mountStage({stage: h.stage, canvas: h.canvas, driver: h.driver, env: h.env, lookCanvas})!;
        expect(handle.look()).toBeUndefined();
        expect(h.stage.dataset.canvas).toBe("on");
        handle.destroy();
    });
});
