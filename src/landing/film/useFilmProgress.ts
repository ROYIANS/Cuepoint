import {type RefObject, useEffect, useRef, useState} from "react";
import {progressToFrame} from "./timeline";
import {toneCss} from "./tone";

export type FilmState = { progress: number; sceneIndex: number; local: number };

export type FilmDriverEnv = {
    raf: (callback: (time: number) => void) => number;
    caf: (id: number) => void;
    now: () => number;
    isHidden: () => boolean;
    /** Smoothing time constant in ms. */
    tau: number;
    /** Attaches scroll/resize/visibility listeners and returns their removal. */
    listen: (onScroll: () => void, onVisible: () => void) => () => void;
};

export type FilmDriver = {
    start: () => void;
    stop: () => void;
    /** Notified with the smoothed state; called once immediately with the current one. */
    subscribe: (listener: (state: FilmState) => void) => () => void;
};

const SETTLE_EPSILON = 0.0002;
const MAX_FRAME_MS = 100;

/**
 * Scroll-to-progress driver. The scroll handler only marks the target dirty; the
 * target is read (one layout read) and eased inside a rAF tick, and frames are
 * scheduled only while the value is still converging, so an idle page runs no
 * frames at all. Nothing here touches React state.
 */
export function createFilmDriver(options: {
    read: () => number;
    write: (state: FilmState) => void;
    env?: Partial<FilmDriverEnv>;
}): FilmDriver {
    const env: FilmDriverEnv = {
        raf: callback => window.requestAnimationFrame(callback),
        caf: id => window.cancelAnimationFrame(id),
        now: () => performance.now(),
        isHidden: () => document.hidden,
        tau: 80,
        listen: (onScroll, onVisible) => {
            window.addEventListener("scroll", onScroll, {passive: true});
            window.addEventListener("resize", onScroll, {passive: true});
            document.addEventListener("visibilitychange", onVisible);
            return () => {
                window.removeEventListener("scroll", onScroll);
                window.removeEventListener("resize", onScroll);
                document.removeEventListener("visibilitychange", onVisible);
            };
        },
        ...options.env,
    };
    const listeners = new Set<(state: FilmState) => void>();
    let current = 0;
    let target = 0;
    let dirty = false;
    let frameId: number | undefined;
    let last = 0;
    let stopListening: (() => void) | undefined;
    let lastState: FilmState = {...progressToFrame(0)};

    const emit = () => {
        lastState = progressToFrame(current);
        options.write(lastState);
        for (const listener of listeners) listener(lastState);
    };

    const schedule = () => {
        if (frameId !== undefined || env.isHidden()) return;
        last = env.now();
        frameId = env.raf(tick);
    };

    function tick(time: number) {
        frameId = undefined;
        if (env.isHidden()) return;
        if (dirty) {
            target = Math.min(1, Math.max(0, options.read()));
            dirty = false;
        }
        const dt = Math.min(Math.max(time - last, 0), MAX_FRAME_MS);
        last = time;
        const k = 1 - Math.exp(-dt / env.tau);
        current += (target - current) * k;
        if (Math.abs(target - current) < SETTLE_EPSILON) current = target;
        emit();
        if (current !== target) frameId = env.raf(tick);
    }

    const onScroll = () => {
        dirty = true;
        schedule();
    };

    return {
        start() {
            if (stopListening) return;
            target = Math.min(1, Math.max(0, options.read()));
            current = target; // first paint is exact: no easing from 0
            dirty = false;
            emit();
            stopListening = env.listen(onScroll, () => {
                if (env.isHidden()) {
                    if (frameId !== undefined) env.caf(frameId);
                    frameId = undefined;
                } else {
                    onScroll();
                }
            });
        },
        stop() {
            stopListening?.();
            stopListening = undefined;
            if (frameId !== undefined) env.caf(frameId);
            frameId = undefined;
        },
        subscribe(listener) {
            listeners.add(listener);
            listener(lastState);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

/** Where the film's track sits in the document, in px: `top` is where progress is 0, `range` the scroll distance to progress 1, `end` where the credits begin. */
export type TrackMetrics = { top: number; range: number; end: number };

export function readTrackMetrics(track: HTMLElement | null): TrackMetrics | undefined {
    if (!track) return undefined;
    const rect = track.getBoundingClientRect();
    const range = rect.height - window.innerHeight;
    if (!(range > 0)) return undefined;
    const top = rect.top + window.scrollY;
    return {top, range, end: top + rect.height};
}

// The two conversions are exact inverses of each other (and of the driver's read below).
export function scrollYToProgress(y: number, metrics: TrackMetrics): number {
    return Math.min(1, Math.max(0, (y - metrics.top) / metrics.range));
}

export function progressToScrollY(progress: number, metrics: TrackMetrics): number {
    return metrics.top + Math.min(1, Math.max(0, progress)) * metrics.range;
}

/** Film progress from the track element's position: 0 when its top meets the viewport top, 1 when the pinned stage reaches the end. */
function readTrackProgress(track: HTMLElement | null): number {
    const metrics = readTrackMetrics(track);
    return metrics ? scrollYToProgress(window.scrollY, metrics) : 0;
}

/**
 * Writes `--film-progress`, `--scene-index` and `--scene-local` on the root element
 * in one pass per frame. CSS derives every per-scene opacity/offset from
 * `--film-progress` and each layer's static `--s`/`--e` window, so a frame costs three
 * custom-property writes instead of one write per scene. The HUD text is updated by
 * its own subscription. Returns the stable driver (for `subscribe`).
 */
export function useFilmProgress(rootRef: RefObject<HTMLElement | null>, trackRef: RefObject<HTMLElement | null>, env?: Partial<FilmDriverEnv>): FilmDriver {
    // The stage ground colour is written only when its rounded value changes (a few times per scene change).
    const lastTone = useRef("");
    const [driver] = useState(() => createFilmDriver({
        read: () => readTrackProgress(trackRef.current),
        write: state => {
            const style = rootRef.current?.style;
            if (!style) return;
            style.setProperty("--film-progress", state.progress.toFixed(4));
            style.setProperty("--scene-index", String(state.sceneIndex));
            style.setProperty("--scene-local", state.local.toFixed(4));
            const tone = toneCss(state.progress);
            if (tone !== lastTone.current) {
                lastTone.current = tone;
                style.setProperty("--stage-tone", tone);
            }
        },
        env,
    }));
    useEffect(() => {
        driver.start();
        return () => driver.stop();
    }, [driver]);
    return driver;
}
