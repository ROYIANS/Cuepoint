// @vitest-environment jsdom
import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Landing} from "../apps/site/src/Landing";
import {EXIT_SECONDS, FILM_PLAY_SECONDS, playbackToProgress, progressToPlaybackTime, SCENE_BEATS, SCENE_TIMES, sceneIndexAtTime, sceneLabel} from "../apps/site/src/film/playback";
import {STAGE_SCENES} from "../apps/site/src/film/scenes";
import {progressToFrame, sceneProgressWindow} from "../apps/site/src/film/timeline";
import {CREDITS_SCROLL_SECONDS, createPlayback, type PlaybackEnv} from "../apps/site/src/film/usePlayback";

describe("pacing", () => {
    it("has one beat per stage scene, adding up to the 60 s film", () => {
        expect(SCENE_BEATS.map(beat => beat.id)).toEqual(STAGE_SCENES.map(scene => scene.id));
        expect(FILM_PLAY_SECONDS).toBe(60);
        for (const beat of SCENE_BEATS) {
            expect(beat.holdSeconds).toBeGreaterThanOrEqual(2.2);
            expect(beat.seconds - beat.holdSeconds - EXIT_SECONDS).toBeGreaterThan(3);
            expect(beat.holdLocal).toBeGreaterThan(0.5);
            expect(beat.holdLocal).toBeLessThan(1);
        }
        expect(SCENE_TIMES[5].end).toBe(FILM_PLAY_SECONDS);
    });

    it("maps the ends and is monotonic and continuous", () => {
        expect(playbackToProgress(0)).toBe(0);
        expect(playbackToProgress(FILM_PLAY_SECONDS)).toBe(1);
        expect(playbackToProgress(-5)).toBe(0);
        expect(playbackToProgress(999)).toBe(1);
        expect(playbackToProgress(Number.NaN)).toBe(0);
        let previous = 0;
        for (let t = 0; t <= FILM_PLAY_SECONDS; t += 0.01) {
            const p = playbackToProgress(t);
            expect(p).toBeGreaterThanOrEqual(previous);
            expect(p - previous).toBeLessThan(0.004); // no jumps
            previous = p;
        }
    });

    it("is flat during every hold, at the scene's holdLocal, and continuous across scene boundaries", () => {
        SCENE_BEATS.forEach((beat, index) => {
            const times = SCENE_TIMES[index];
            const {start, end} = sceneProgressWindow(index);
            const expected = start + beat.holdLocal * (end - start);
            for (const t of [times.holdStart, (times.holdStart + times.holdEnd) / 2, times.holdEnd - 1e-6]) expect(playbackToProgress(t)).toBeCloseTo(expected, 9);
            expect(playbackToProgress(times.holdStart - 0.2)).toBeLessThan(expected);
            expect(playbackToProgress(times.holdEnd + 0.2)).toBeGreaterThan(expected);
            expect(playbackToProgress(times.end)).toBeCloseTo(index === 5 ? 1 : sceneProgressWindow(index + 1).start, 9);
            expect(sceneIndexAtTime(times.start)).toBe(index);
        });
    });

    it("inverts the moving stretches and returns the start of a hold", () => {
        for (let t = 0.05; t < FILM_PLAY_SECONDS; t += 0.37) {
            const inHold = SCENE_TIMES.some(times => t >= times.holdStart && t < times.holdEnd);
            const back = progressToPlaybackTime(playbackToProgress(t));
            if (inHold) {
                const times = SCENE_TIMES[sceneIndexAtTime(t)];
                expect(back).toBeCloseTo(times.holdStart, 6);
            } else {
                expect(back).toBeCloseTo(t, 5);
            }
        }
        expect(progressToPlaybackTime(0)).toBeCloseTo(0, 9);
        expect(progressToPlaybackTime(1)).toBeCloseTo(FILM_PLAY_SECONDS, 9);
        expect(progressToFrame(playbackToProgress(SCENE_TIMES[2].holdStart + 0.5)).local).toBeCloseTo(SCENE_BEATS[2].holdLocal, 9);
    });

    it("names scenes for announcements", () => {
        expect(sceneLabel(0)).toBe("片头");
        expect(sceneLabel(1)).toBe("第一幕 · 灵感 → 剧本");
        expect(sceneLabel(5)).toBe("第五幕 · 成片与交付");
        expect(sceneLabel(9)).toBe("");
    });
});

describe("createPlayback", () => {
    const metrics = {top: 0, range: 4400, end: 5200};
    let clock: number;
    let scroll: number;
    let hiddenFlag: boolean;
    let queue: Map<number, () => void>;
    let writes: number[];
    let locked: string;
    let removed: number;
    let interrupt: (() => void) | undefined;
    let listening: boolean;

    function make() {
        let id = 0;
        const env: Partial<PlaybackEnv> = {
            raf: callback => { id += 1; queue.set(id, () => callback(clock)); return id; },
            caf: handle => void queue.delete(handle),
            now: () => clock,
            isHidden: () => hiddenFlag,
            metrics: () => metrics,
            scrollY: () => scroll,
            scrollTo: y => { scroll = y; writes.push(y); },
            lockScroll: () => { locked = "auto"; return () => { locked = "restored"; }; },
            listen: onInterrupt => { interrupt = onInterrupt; listening = true; return () => { listening = false; removed += 1; }; },
        };
        return createPlayback({env});
    }
    /** Runs frames at ~60 Hz for the given seconds. */
    const run = (seconds: number, step = 16) => {
        for (let spent = 0; spent < seconds * 1000 && queue.size > 0; spent += step) {
            clock += step;
            const callbacks = [...queue.values()];
            queue.clear();
            callbacks.forEach(callback => callback());
        }
    };

    beforeEach(() => {
        clock = 1000;
        scroll = 0;
        hiddenFlag = false;
        queue = new Map();
        writes = [];
        locked = "";
        removed = 0;
        interrupt = undefined;
        listening = false;
    });

    it("plays from the top: the scroll follows the pacing, holds stay still, and it ends at the credits", () => {
        const playback = make();
        const states: string[] = [];
        playback.subscribe(() => states.push(playback.state()));
        expect(playback.state()).toBe("idle");
        playback.play();
        expect(playback.state()).toBe("playing");
        expect(locked).toBe("auto");
        // First hold of the leader: scroll constant for its whole length.
        const hold = SCENE_TIMES[0];
        run(hold.holdStart + 0.3);
        const held = scroll;
        expect(held).toBeCloseTo(playbackToProgress(playback.time()) * metrics.range, 6);
        writes = [];
        run(hold.holdEnd - hold.holdStart - 0.6);
        expect(new Set(writes).size).toBe(1);
        expect(writes[0]).toBe(held);
        run(FILM_PLAY_SECONDS - playback.time() + 0.3);
        expect(playback.time()).toBe(FILM_PLAY_SECONDS);
        expect(playback.state()).toBe("playing"); // still gliding to the credits
        run(CREDITS_SCROLL_SECONDS + 1);
        expect(playback.state()).toBe("finished");
        expect(scroll).toBeCloseTo(metrics.end, 6);
        expect(playback.time()).toBe(FILM_PLAY_SECONDS);
        expect(queue.size).toBe(0);
        expect(locked).toBe("restored");
        expect(listening).toBe(false);
        expect(states).toEqual(["playing", "finished"]);
    });

    it("takes about 60 s of playback time", () => {
        const playback = make();
        playback.play();
        run(30);
        expect(playback.time()).toBeGreaterThan(29);
        expect(playback.time()).toBeLessThan(31);
        run(40);
        expect(playback.time()).toBe(FILM_PLAY_SECONDS);
    });

    it("caps a long frame gap at 100 ms", () => {
        const playback = make();
        playback.play();
        clock += 5000;
        [...queue.values()].forEach(callback => callback());
        expect(playback.time()).toBeCloseTo(0.1, 6);
    });

    it("pauses on wheel/touch/keys (the listener) and resumes from where the viewer left it", () => {
        const playback = make();
        playback.play();
        run(12);
        expect(interrupt).toBeDefined();
        interrupt!();
        expect(playback.state()).toBe("paused");
        expect(queue.size).toBe(0);
        expect(locked).toBe("restored");
        expect(listening).toBe(false);
        const stopped = playback.time();
        playback.play(); // position unchanged: the clock continues exactly
        expect(playback.time()).toBe(stopped);
        interrupt!();
        scroll = playbackToProgress(30) * metrics.range; // the viewer scrolled by hand
        playback.play();
        expect(playback.time()).toBeCloseTo(progressToPlaybackTime(playbackToProgress(30)), 4);
    });

    it("does not treat its own scrolling as the viewer taking over", () => {
        const playback = make();
        playback.play();
        run(5);
        window.dispatchEvent(new Event("scroll"));
        expect(playback.state()).toBe("playing");
    });

    it("pauses when the page is hidden", () => {
        const playback = make();
        playback.play();
        run(1);
        hiddenFlag = true;
        run(0.1);
        expect(playback.state()).toBe("paused");
        expect(queue.size).toBe(0);
    });

    it("seeks: moves the clock and the scroll at once; leaves idle/finished as paused", () => {
        const playback = make();
        const frames: number[] = [];
        playback.onFrame(seconds => frames.push(seconds));
        playback.seekTime(30);
        expect(playback.state()).toBe("paused");
        expect(scroll).toBeCloseTo(playbackToProgress(30) * metrics.range, 6);
        expect(frames).toEqual([30]);
        playback.seek(0.5);
        expect(playback.time()).toBeCloseTo(progressToPlaybackTime(0.5), 9);
        playback.play();
        run(1);
        expect(playback.time()).toBeGreaterThan(progressToPlaybackTime(0.5));
    });

    it("replays from the top after finishing, and from the top when started at the credits", () => {
        const playback = make();
        playback.play();
        run(FILM_PLAY_SECONDS + CREDITS_SCROLL_SECONDS + 1);
        expect(playback.state()).toBe("finished");
        playback.play();
        expect(playback.state()).toBe("playing");
        expect(playback.time()).toBe(0);
        expect(scroll).toBe(0);
        playback.pause();
        scroll = metrics.range + 300;
        playback.play();
        expect(playback.time()).toBe(0);
    });

    it("only lets Space toggle while playing or while the stage is in view", () => {
        const playback = make();
        expect(playback.keyToggleAllowed()).toBe(true);
        scroll = metrics.range + 10;
        expect(playback.keyToggleAllowed()).toBe(false);
        scroll = 100;
        playback.play();
        expect(playback.keyToggleAllowed()).toBe(true);
    });

    it("cleans up on dispose: no frame, no listeners, scroll behavior restored", () => {
        const playback = make();
        playback.play();
        run(1);
        playback.dispose();
        expect(queue.size).toBe(0);
        expect(removed).toBe(1);
        expect(locked).toBe("restored");
        expect(playback.state()).toBe("paused");
        playback.play(); // usable again (StrictMode remounts)
        expect(playback.state()).toBe("playing");
    });

    it("default listener: wheel, touch, navigation keys and background clicks interrupt; controls and Space do not", () => {
        const playback = createPlayback({env: {...(undefined as never), raf: () => 1, caf: () => undefined, now: () => 0, isHidden: () => false, metrics: () => metrics, scrollY: () => 0, scrollTo: () => undefined, lockScroll: () => () => undefined}});
        const button = document.createElement("button");
        document.body.append(button);
        const trial = (dispatch: () => void) => {
            playback.play();
            dispatch();
            const paused = playback.state() === "paused";
            if (!paused) playback.pause();
            return paused;
        };
        expect(trial(() => window.dispatchEvent(new Event("wheel")))).toBe(true);
        expect(trial(() => window.dispatchEvent(new Event("touchstart")))).toBe(true);
        expect(trial(() => document.body.dispatchEvent(new Event("pointerdown", {bubbles: true})))).toBe(true);
        expect(trial(() => button.dispatchEvent(new Event("pointerdown", {bubbles: true})))).toBe(false);
        expect(trial(() => document.body.dispatchEvent(new KeyboardEvent("keydown", {key: "PageDown", bubbles: true})))).toBe(true);
        expect(trial(() => document.body.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true})))).toBe(false);
        button.remove();
    });
});

describe("player UI", () => {
    let container: HTMLDivElement;
    let root: Root;
    let reduced: boolean;
    let rafQueue: Map<number, FrameRequestCallback>;

    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
        window.scrollTo = vi.fn() as never;
        localStorage.clear();
        reduced = false;
        rafQueue = new Map();
        let id = 0;
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { id += 1; rafQueue.set(id, callback); return id; });
        vi.stubGlobal("cancelAnimationFrame", (handle: number) => void rafQueue.delete(handle));
        vi.stubGlobal("matchMedia", vi.fn(() => ({get matches() { return reduced; }, addEventListener: () => undefined, removeEventListener: () => undefined})));
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            const track = this.classList.contains("lp-track");
            return {top: 0, height: track ? 5200 : 0, bottom: 0, left: 0, right: 0, width: this.classList.contains("lp-hud-bar") ? 1000 : 0, x: 0, y: 0, toJSON: () => ({})} as DOMRect;
        });
        window.innerHeight = 800;
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
    const render = () => act(async () => root.render(createElement(Landing)));
    const byLabel = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`);

    it("shows a big play button at rest, outside the aria-hidden art, and starts the film on click", async () => {
        await render();
        const start = container.querySelector<HTMLElement>(".lp-start")!;
        expect(start.getAttribute("data-on")).toBe("true");
        expect(start.closest("[aria-hidden='true']")).toBeNull();
        const button = start.querySelector<HTMLElement>("button")!;
        expect(button.getAttribute("aria-label")).toBe("播放");
        expect(container.querySelector(".lp-hud .lp-ic")?.getAttribute("aria-label")).toBe("播放");
        await act(async () => button.click());
        expect(container.querySelector(".lp-hud .lp-ic")?.getAttribute("aria-label")).toBe("暂停");
        expect(start.getAttribute("data-on")).toBe("false");
        expect(start.hasAttribute("inert")).toBe(true);
        expect(rafQueue.size).toBeGreaterThan(0);
        await act(async () => (container.querySelector(".lp-hud .lp-ic") as HTMLElement).click());
        expect(container.querySelector(".lp-hud .lp-ic")?.getAttribute("aria-label")).toBe("播放");
    });

    it("renders no player in the static page", async () => {
        reduced = true;
        await render();
        expect(container.querySelector(".lp-start, .lp-hud, [role=slider]")).toBeNull();
    });

    it("exposes the seek bar as a slider with scene text and jumps by scene with the arrow keys", async () => {
        await render();
        const slider = container.querySelector<HTMLElement>("[role=slider]")!;
        expect(slider.getAttribute("aria-valuemin")).toBe("0");
        expect(slider.getAttribute("aria-valuemax")).toBe(String(FILM_PLAY_SECONDS));
        expect(slider.getAttribute("aria-valuetext")).toBe("片头");
        expect(slider.tabIndex).toBe(0);
        await act(async () => { slider.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight", bubbles: true, cancelable: true})); });
        expect(slider.getAttribute("aria-valuetext")).toBe(sceneLabel(1));
        expect(Number(slider.getAttribute("aria-valuenow"))).toBe(Math.round(SCENE_TIMES[1].holdStart));
        await act(async () => { slider.dispatchEvent(new KeyboardEvent("keydown", {key: "End", bubbles: true, cancelable: true})); });
        expect(slider.getAttribute("aria-valuenow")).toBe(String(FILM_PLAY_SECONDS));
        await act(async () => { slider.dispatchEvent(new KeyboardEvent("keydown", {key: "Home", bubbles: true, cancelable: true})); });
        expect(slider.getAttribute("aria-valuenow")).toBe("0");
        expect(container.querySelectorAll(".lp-hud-tick")).toHaveLength(5);
    });

    it("toggles with Space on the page, but never takes Space away from a focused button", async () => {
        await render();
        const space = async (target: Element) => {
            const event = new KeyboardEvent("keydown", {key: " ", code: "Space", bubbles: true, cancelable: true});
            await act(async () => { target.dispatchEvent(event); });
            return event;
        };
        const page = await space(document.body);
        expect(page.defaultPrevented).toBe(true);
        expect(byLabel("暂停")).toBeTruthy();
        const onButton = await space(byLabel("暂停")!);
        expect(onButton.defaultPrevented).toBe(false);
        expect(byLabel("暂停")).toBeTruthy(); // not toggled by the page handler
        await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true})); });
        const slider = container.querySelector("[role=slider]")!;
        const onSlider = await space(slider); // a slider has no Space action of its own: the page would scroll, so Space plays
        expect(onSlider.defaultPrevented).toBe(true);
        expect(byLabel("暂停")).toBeTruthy();
        expect(byLabel("播放")).toBeTruthy();
    });

    it("never takes Space away from links, disclosure summaries or text fields", async () => {
        await render();
        for (const tag of ["a", "summary", "input", "textarea", "select"]) {
            const element = document.createElement(tag);
            container.append(element);
            const event = new KeyboardEvent("keydown", {key: " ", code: "Space", bubbles: true, cancelable: true});
            await act(async () => { element.dispatchEvent(event); });
            expect(event.defaultPrevented, tag).toBe(false);
            expect(byLabel("暂停"), tag).toBeNull();
            element.remove();
        }
    });

    it("announces scene changes only while the film plays", async () => {
        await render();
        const live = container.querySelector("[data-playback-live]")!;
        expect(live.textContent).toBe("");
        (window as unknown as {scrollY: number}).scrollY = 0;
        await act(async () => window.dispatchEvent(new Event("scroll")));
        expect(live.textContent).toBe("");
    });
});
