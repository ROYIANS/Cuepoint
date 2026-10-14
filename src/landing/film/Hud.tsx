import {useEffect, useRef} from "react";
import {SCENES} from "./scenes";
import {FILM_SECONDS, frameToTimecode} from "./timeline";
import type {FilmDriver} from "./useFilmProgress";

// Timecode and scene label are written straight to text nodes from the driver's
// subscription: one write per change, never React state. The progress bar is
// pure CSS from --film-progress.
export function Hud({driver}: {driver: FilmDriver}) {
    const timecode = useRef<HTMLSpanElement>(null);
    const scene = useRef<HTMLSpanElement>(null);
    useEffect(() => driver.subscribe(({progress, sceneIndex}) => {
        const code = frameToTimecode(progress, FILM_SECONDS);
        if (timecode.current && timecode.current.textContent !== code) timecode.current.textContent = code;
        const label = SCENES[sceneIndex]?.short ?? "";
        if (scene.current && scene.current.textContent !== label) scene.current.textContent = label;
    }), [driver]);
    return (
        <div className="lp-hud" aria-hidden="true">
            <span className="lp-hud-time" ref={timecode}>00:00:00:00</span>
            <span className="lp-hud-scene" ref={scene}>片头</span>
            <span className="lp-hud-bar" />
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
