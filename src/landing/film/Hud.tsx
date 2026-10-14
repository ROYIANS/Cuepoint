import {useEffect, useRef, type KeyboardEvent, type PointerEvent} from "react";
import {IconControl} from "../ui/IconControl";
import {FILM_PLAY_SECONDS, playbackToProgress, progressToPlaybackTime, SCENE_TIMES, sceneIndexAtTime, sceneLabel} from "./playback";
import {SCENES} from "./scenes";
import {frameToTimecode} from "./timeline";
import type {FilmDriver} from "./useFilmProgress";
import {usePlaybackState, type Playback} from "./usePlayback";

const CONSISTENT = 0.004;

// Timecode, scene label and seek bar are written straight to the DOM from the driver and
// controller subscriptions: one write per change, never React state. While the film plays the
// controller's clock is the truth (progress is flat during holds); otherwise the time is derived
// from the scroll progress, unless a paused/finished clock still matches it.
export function Hud({driver, playback}: {driver: FilmDriver; playback: Playback}) {
    const timecode = useRef<HTMLSpanElement>(null);
    const scene = useRef<HTMLSpanElement>(null);
    const bar = useRef<HTMLDivElement>(null);
    const dragging = useRef<{wasPlaying: boolean} | null>(null);
    const state = usePlaybackState(playback);

    useEffect(() => {
        const show = (seconds: number) => {
            const index = sceneIndexAtTime(seconds);
            const code = frameToTimecode(seconds / FILM_PLAY_SECONDS, FILM_PLAY_SECONDS);
            if (timecode.current && timecode.current.textContent !== code) timecode.current.textContent = code;
            const label = SCENES[index]?.short ?? "";
            if (scene.current && scene.current.textContent !== label) scene.current.textContent = label;
            const element = bar.current;
            if (!element) return;
            element.style.setProperty("--film-time", (seconds / FILM_PLAY_SECONDS).toFixed(4));
            const now = String(Math.round(seconds));
            if (element.getAttribute("aria-valuenow") !== now) element.setAttribute("aria-valuenow", now);
            const text = sceneLabel(index);
            if (element.getAttribute("aria-valuetext") !== text) element.setAttribute("aria-valuetext", text);
        };
        const offDriver = driver.subscribe(({progress}) => {
            const current = playback.state();
            const clock = playback.time();
            const trusted = current === "playing" || (current !== "idle" && Math.abs(playbackToProgress(clock) - progress) < CONSISTENT);
            show(trusted ? clock : progressToPlaybackTime(progress));
        });
        const offFrame = playback.onFrame(show);
        return () => {
            offDriver();
            offFrame();
        };
    }, [driver, playback]);

    const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (!(rect.width > 0)) return;
        playback.seekTime(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * FILM_PLAY_SECONDS);
    };
    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragging.current = {wasPlaying: playback.state() === "playing"};
        playback.pause();
        seekFromPointer(event);
    };
    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (dragging.current) seekFromPointer(event);
    };
    const endDrag = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragging.current;
        dragging.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (drag?.wasPlaying) playback.play();
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const current = sceneIndexAtTime(playback.time());
        const starts = SCENE_TIMES.map(times => times.holdStart);
        let target: number | undefined;
        if (event.key === "ArrowRight") target = starts[Math.min(SCENE_TIMES.length - 1, current + 1)];
        else if (event.key === "ArrowLeft") target = current === 0 ? 0 : starts[current - 1];
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = FILM_PLAY_SECONDS;
        if (target === undefined) return;
        event.preventDefault();
        playback.seekTime(target);
    };

    const label = state === "playing" ? "暂停" : state === "finished" ? "重播" : "播放";
    return (
        <div className="lp-hud" role="group" aria-label="放映控制">
            <IconControl className="lp-ic-sm" icon={state === "playing" ? "pause" : state === "finished" ? "replay" : "play"} label={label} reveal="tip" umami="film-toggle" onClick={() => playback.toggle()} />
            <span className="lp-hud-time" ref={timecode} aria-hidden="true">00:00:00:00</span>
            <span className="lp-hud-scene" ref={scene} aria-hidden="true">片头</span>
            <div
                className="lp-hud-bar"
                ref={bar}
                role="slider"
                tabIndex={0}
                aria-label="放映进度"
                aria-valuemin={0}
                aria-valuemax={FILM_PLAY_SECONDS}
                aria-valuenow={0}
                aria-valuetext={sceneLabel(0)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onKeyDown}
            >
                <span className="lp-hud-track" />
                {SCENE_TIMES.slice(1).map(times => <i key={times.start} className="lp-hud-tick" style={{left: `${(times.start / FILM_PLAY_SECONDS) * 100}%`}} />)}
            </div>
        </div>
    );
}

// Film-edge sprocket holes: a tall repeating-gradient strip moved with transform.
export function Perforations() {
    return (
        <>
            <div className="lp-perf lp-perf-left" aria-hidden="true"><span /></div>
            <div className="lp-perf lp-perf-right" aria-hidden="true"><span /></div>
        </>
    );
}
