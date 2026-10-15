import {type RefObject, useEffect, useState, useSyncExternalStore} from "react";
import {FILM_PLAY_SECONDS, playbackToProgress, progressToPlaybackTime} from "./playback";
import {progressToScrollY, readTrackMetrics, scrollYToProgress, type TrackMetrics} from "./useFilmProgress";

export type PlaybackState = "idle" | "playing" | "paused" | "finished";

export type PlaybackEnv = {
    raf: (callback: (time: number) => void) => number;
    caf: (id: number) => void;
    now: () => number;
    isHidden: () => boolean;
    metrics: () => TrackMetrics | undefined;
    scrollY: () => number;
    scrollTo: (y: number) => void;
    /** Forces instant scrolling while the film plays; returns the restore function. */
    lockScroll: () => () => void;
    /** Listens for the viewer taking over (wheel, touch, pointer, navigation keys) and for the page being hidden. */
    listen: (onInterrupt: () => void) => () => void;
};

export type Playback = {
    state: () => PlaybackState;
    /** Playback time in seconds. */
    time: () => number;
    play: () => void;
    pause: () => void;
    toggle: () => void;
    seek: (progress: number) => void;
    seekTime: (seconds: number) => void;
    /** True when Space may start/stop the film: playing, or the stage is in view. */
    keyToggleAllowed: () => boolean;
    /** Notified only when the state changes. */
    subscribe: (listener: () => void) => () => void;
    /** Notified with the playback time on every frame, seek and finish (not React state). */
    onFrame: (listener: (seconds: number) => void) => () => void;
    /** Stops playback and releases listeners, frames and the scroll lock. The controller stays usable. */
    dispose: () => void;
};

const MAX_FRAME_MS = 100;
/** After the last scene the page glides from the end of the stage to the top of the credits. */
export const CREDITS_SCROLL_SECONDS = 1.6;
const SAME_POSITION = 0.002;

const easeInOut = (x: number): number => x * x * (3 - 2 * x);

const OWN_CONTROL = "button, a, summary, input, textarea, select, [role=slider], [contenteditable]";
const TEXT_ENTRY = "input, textarea, select, [role=slider], [contenteditable]";
const NAVIGATION_KEYS = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);

function within(target: EventTarget | null, selector: string): boolean {
    return target instanceof Element && target.closest(selector) !== null;
}

// Interruption is judged from input events, never from `scroll`: the controller's own scrolling
// must not look like the viewer. Controls handle their own pointer input, so they are exempt.
function listenForInterrupt(onInterrupt: () => void): () => void {
    const onPointer = (event: Event) => {
        if (!within(event.target, OWN_CONTROL)) onInterrupt();
    };
    const onKey = (event: KeyboardEvent) => {
        if (NAVIGATION_KEYS.has(event.key) && !within(event.target, TEXT_ENTRY)) onInterrupt();
    };
    const onVisibility = () => {
        if (document.hidden) onInterrupt();
    };
    window.addEventListener("wheel", onInterrupt, {passive: true});
    window.addEventListener("touchstart", onPointer, {passive: true});
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
        window.removeEventListener("wheel", onInterrupt);
        window.removeEventListener("touchstart", onPointer);
        window.removeEventListener("pointerdown", onPointer);
        window.removeEventListener("keydown", onKey);
        document.removeEventListener("visibilitychange", onVisibility);
    };
}

function defaultEnv(track: () => HTMLElement | null): PlaybackEnv {
    return {
        raf: callback => window.requestAnimationFrame(callback),
        caf: id => window.cancelAnimationFrame(id),
        now: () => performance.now(),
        isHidden: () => document.hidden,
        metrics: () => readTrackMetrics(track()),
        scrollY: () => window.scrollY,
        scrollTo: y => window.scrollTo({top: y, behavior: "instant"}),
        lockScroll: () => {
            const style = document.documentElement.style;
            const previous = style.scrollBehavior;
            style.scrollBehavior = "auto";
            return () => {
                style.scrollBehavior = previous;
            };
        },
        listen: listenForInterrupt,
    };
}

/**
 * Automatic screening: advances a playback clock and writes the matching scroll position every
 * frame. Frames run only while playing; state listeners hear state changes only.
 */
export function createPlayback(options: {
    env?: Partial<PlaybackEnv>;
    track?: () => HTMLElement | null
} = {}): Playback {
    const env: PlaybackEnv = {...defaultEnv(options.track ?? (() => null)), ...options.env};
    const stateListeners = new Set<() => void>();
    const frameListeners = new Set<(seconds: number) => void>();
    let state: PlaybackState = "idle";
    let t = 0;
    let outro = -1; // seconds into the glide to the credits; -1 while the film itself is playing
    let frameId: number | undefined;
    let last = 0;
    let release: (() => void) | undefined;
    let stopListening: (() => void) | undefined;

    const setState = (next: PlaybackState) => {
        if (state === next) return;
        state = next;
        for (const listener of [...stateListeners]) listener();
    };
    const emitFrame = () => {
        for (const listener of [...frameListeners]) listener(t);
    };
    const cancelFrame = () => {
        if (frameId !== undefined) env.caf(frameId);
        frameId = undefined;
    };
    const teardown = () => {
        cancelFrame();
        stopListening?.();
        stopListening = undefined;
        release?.();
        release = undefined;
    };

    function finish() {
        teardown();
        outro = -1;
        t = FILM_PLAY_SECONDS;
        setState("finished");
        emitFrame();
    }

    function tick() {
        frameId = undefined;
        if (state !== "playing") return;
        if (env.isHidden()) {
            pause();
            return;
        }
        const now = env.now();
        const dt = Math.min(Math.max(now - last, 0), MAX_FRAME_MS) / 1000;
        last = now;
        const metrics = env.metrics();
        if (!metrics) {
            pause();
            return;
        }
        if (outro < 0) {
            t = Math.min(FILM_PLAY_SECONDS, t + dt);
            env.scrollTo(progressToScrollY(playbackToProgress(t), metrics));
            emitFrame();
            if (t >= FILM_PLAY_SECONDS) outro = 0;
        } else {
            outro += dt;
            const k = easeInOut(Math.min(1, outro / CREDITS_SCROLL_SECONDS));
            const from = progressToScrollY(1, metrics);
            env.scrollTo(from + (metrics.end - from) * k);
            if (outro >= CREDITS_SCROLL_SECONDS) {
                finish();
                return;
            }
        }
        frameId = env.raf(tick);
    }

    function pause() {
        if (state !== "playing") return;
        teardown();
        setState("paused");
    }

    function play() {
        if (state === "playing") return;
        const metrics = env.metrics();
        if (!metrics) return;
        const progress = scrollYToProgress(env.scrollY(), metrics);
        if (state === "finished" || progress >= 1 - SAME_POSITION / 2) {
            t = 0;
            env.scrollTo(metrics.top);
        } else if (Math.abs(playbackToProgress(t) - progress) > SAME_POSITION) {
            t = progressToPlaybackTime(progress);
        }
        outro = -1;
        release = env.lockScroll();
        stopListening = env.listen(pause);
        setState("playing");
        last = env.now();
        frameId = env.raf(tick);
    }

    function seekTime(seconds: number) {
        const metrics = env.metrics();
        if (!metrics) return;
        t = Math.min(FILM_PLAY_SECONDS, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
        outro = -1;
        env.scrollTo(progressToScrollY(playbackToProgress(t), metrics));
        if (state === "playing") last = env.now();
        else setState("paused");
        emitFrame();
    }

    return {
        state: () => state,
        time: () => t,
        play,
        pause,
        toggle: () => (state === "playing" ? pause() : play()),
        seek: progress => seekTime(progressToPlaybackTime(progress)),
        seekTime,
        keyToggleAllowed: () => {
            if (state === "playing") return true;
            if (state === "finished") return false;
            const metrics = env.metrics();
            return metrics !== undefined && scrollYToProgress(env.scrollY(), metrics) < 1 - SAME_POSITION / 2;
        },
        subscribe: listener => {
            stateListeners.add(listener);
            return () => void stateListeners.delete(listener);
        },
        onFrame: listener => {
            frameListeners.add(listener);
            return () => void frameListeners.delete(listener);
        },
        dispose: () => {
            if (state === "playing") {
                teardown();
                setState("paused");
            } else {
                teardown();
            }
        },
    };
}

export function usePlayback(trackRef: RefObject<HTMLElement | null>): Playback {
    const [playback] = useState(() => createPlayback({track: () => trackRef.current}));
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === "Escape") {
                playback.pause();
            } else if ((event.key === " " || event.code === "Space") && !within(event.target, "button, a, summary, details, input, textarea, select, [role=button], [contenteditable]") && playback.keyToggleAllowed()) {
                event.preventDefault();
                playback.toggle();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            playback.dispose();
        };
    }, [playback]);
    return playback;
}

export function usePlaybackState(playback: Playback): PlaybackState {
    return useSyncExternalStore(playback.subscribe, playback.state, () => "idle" as const);
}
