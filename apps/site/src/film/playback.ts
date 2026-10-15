import {type SceneId, STAGE_SCENES} from "./scenes";
import {progressToFrame, sceneProgressWindow} from "./timeline";

// Pacing of the automatic screening. Scroll progress is weighted by scene length and has no
// rests; a screening needs the opposite: each scene arrives, STAYS on its finished picture for a
// moment, then leaves. `playbackToProgress` turns a running time into scroll progress with those
// rests built in (progress is constant while a scene holds), and `progressToPlaybackTime` is its
// inverse, so playback can resume from wherever the viewer scrolled to.
//
// A scene lasts `seconds`: it eases from local 0 to `holdLocal` (the picture is complete), holds
// for `holdSeconds`, then spends EXIT_SECONDS easing on to local 1, which is the next scene's
// local 0 (its opening transition, e.g. the title dissolving into dust, plays out of that).
export type SceneBeat = {
    readonly id: SceneId;
    /** Total time of the scene, hold included. */
    readonly seconds: number;
    /** Local progress (0..1) at which the picture is complete and stable. */
    readonly holdLocal: number;
    readonly holdSeconds: number;
};

/** Time for the scene's last stretch, from the hold to the next scene's start (springs need ~1 s to settle). */
export const EXIT_SECONDS = 1.6;

// holdLocal comes from each renderer's plan and from the DOM layer's fade-out window
// (--fade is 0.03 of the film, i.e. 0.16-0.2 of a scene: the text is fully opaque up to ~0.8):
//  leader   title targeted at 0.74 (TITLE_FORMED in renderers/leader.ts); the DOM text fades in 0.76-0.80
//  spark    the last character is revealed at 0.78 (GATHER_END 0.16 + TYPE_SPAN 0.62)
//  script   the sixth cell is 97% lit at 0.84 (LIGHT_START 0.2 + 5 * LIGHT_GAP 0.11 + 0.9 * LIGHT_SPAN)
//  agent    the last row (summary) is fully lit at 0.77 (ROW_START[5] 0.70 + ROW_SPAN 0.07 in renderers/agent.ts);
//           this scene is 1.2 long, so its text stays opaque to ~0.84
//  vault    the storage label has faded in at 0.78 (STORE_LABEL_START 0.70 + 0.08 in renderers/vault.ts); text opaque to ~0.80
//  delivery the third file lands at 0.71 (GROUP_START[2] 0.56 + GROUP_SPAN 0.15 in renderers/delivery.ts)
export const SCENE_BEATS: readonly SceneBeat[] = [
    {id: "leader", seconds: 9, holdLocal: 0.8, holdSeconds: 2.4},
    {id: "spark", seconds: 10, holdLocal: 0.8, holdSeconds: 3.2},
    {id: "script", seconds: 11, holdLocal: 0.84, holdSeconds: 3.2},
    {id: "agent", seconds: 10, holdLocal: 0.82, holdSeconds: 3.2},
    {id: "vault", seconds: 10, holdLocal: 0.8, holdSeconds: 3.2},
    {id: "delivery", seconds: 10, holdLocal: 0.78, holdSeconds: 3.2},
];

/** The one source of the film's running time (timecode, seek bar, controller). */
export const FILM_PLAY_SECONDS: number = SCENE_BEATS.reduce((sum, beat) => sum + beat.seconds, 0);

export type SceneTimes = {
    /** Scene start; end of the previous scene. */
    readonly start: number;
    /** The picture is complete and progress stops moving. */
    readonly holdStart: number;
    readonly holdEnd: number;
    readonly end: number;
};

export const SCENE_TIMES: readonly SceneTimes[] = (() => {
    let cursor = 0;
    return SCENE_BEATS.map(beat => {
        const holdStart = cursor + beat.seconds - beat.holdSeconds - EXIT_SECONDS;
        const times = {start: cursor, holdStart, holdEnd: holdStart + beat.holdSeconds, end: cursor + beat.seconds};
        cursor += beat.seconds;
        return times;
    });
})();

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

const ease = (x: number): number => x * x * (3 - 2 * x);

// Inverse of the smoothstep on [0, 1].
function unease(y: number): number {
    return 0.5 - Math.sin(Math.asin(1 - 2 * clamp01(y)) / 3);
}

/** Index of the scene playing at time t (clamped to the film). */
export function sceneIndexAtTime(t: number): number {
    const time = Math.min(FILM_PLAY_SECONDS, Math.max(0, Number.isFinite(t) ? t : 0));
    const last = SCENE_TIMES.length - 1;
    for (let index = 0; index < last; index += 1) if (time < SCENE_TIMES[index].end) return index;
    return last;
}

/** Scroll progress at playback time t. Monotonic, continuous, flat during every hold. */
export function playbackToProgress(t: number): number {
    const time = Math.min(FILM_PLAY_SECONDS, Math.max(0, Number.isFinite(t) ? t : 0));
    const index = sceneIndexAtTime(time);
    const beat = SCENE_BEATS[index];
    const times = SCENE_TIMES[index];
    let local: number;
    if (time < times.holdStart) local = beat.holdLocal * ease((time - times.start) / (times.holdStart - times.start));
    else if (time < times.holdEnd) local = beat.holdLocal;
    else if (time >= times.end) local = 1;
    else local = beat.holdLocal + (1 - beat.holdLocal) * ease((time - times.holdEnd) / (times.end - times.holdEnd));
    const {start, end} = sceneProgressWindow(index);
    return index === SCENE_TIMES.length - 1 && local >= 1 ? 1 : start + local * (end - start);
}

/**
 * Playback time at which `playbackToProgress` gives this progress. On a hold (a flat stretch)
 * it returns the start of the hold; it inverts the moving stretches exactly.
 */
export function progressToPlaybackTime(progress: number): number {
    const {sceneIndex, local} = progressToFrame(progress);
    const beat = SCENE_BEATS[sceneIndex];
    const times = SCENE_TIMES[sceneIndex];
    // The tolerance keeps a hold's own progress (computed forward) on the hold, not a hair past it.
    if (local <= beat.holdLocal + 1e-9) return times.start + unease(local / beat.holdLocal) * (times.holdStart - times.start);
    return times.holdEnd + unease((local - beat.holdLocal) / (1 - beat.holdLocal)) * (times.end - times.holdEnd);
}

const NUMERALS = ["", "一", "二", "三", "四", "五", "六"];

/** "片头" / "第一幕 · 灵感 → 剧本": how a stage scene is announced and named on the seek bar. */
export function sceneLabel(sceneIndex: number): string {
    const scene = STAGE_SCENES[sceneIndex];
    if (!scene) return "";
    return sceneIndex === 0 ? scene.title : `第${NUMERALS[sceneIndex] ?? sceneIndex}幕 · ${scene.title}`;
}
