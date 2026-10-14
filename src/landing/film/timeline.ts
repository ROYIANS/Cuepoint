import {STAGE_SCENES, TOTAL_WEIGHT} from "./scenes";

/** Nominal running time shown by the HUD timecode (a presentation device, not a real duration). */
export const FILM_SECONDS = 96;
const FILM_FPS = 24;
/** Width of a scene's fade in/out, in progress units. */
export const SCENE_FADE = 0.03;

// Scene i spans [BOUNDS[i], BOUNDS[i + 1]); the last bound is exactly 1.
const BOUNDS: readonly number[] = (() => {
    const bounds = [0];
    let sum = 0;
    for (const scene of STAGE_SCENES) {
        sum += scene.weight;
        bounds.push(sum / TOTAL_WEIGHT);
    }
    bounds[bounds.length - 1] = 1;
    return bounds;
})();

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

/** Progress window of a stage scene; flow scenes and invalid indexes get an empty window at 1. */
export function sceneProgressWindow(sceneIndex: number): {start: number; end: number} {
    if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || sceneIndex >= STAGE_SCENES.length) return {start: 1, end: 1};
    return {start: BOUNDS[sceneIndex], end: BOUNDS[sceneIndex + 1]};
}

/**
 * Maps film progress to a stage scene. Non-finite input (NaN, Infinity) counts as 0;
 * finite values are clamped to [0, 1]. A scene owns its start and not its end, so a
 * boundary belongs to the following scene; progress 1 belongs to the last stage scene
 * with local = 1.
 */
export function progressToFrame(progress: number): {sceneIndex: number; local: number; progress: number} {
    const p = clamp01(progress);
    const last = STAGE_SCENES.length - 1;
    let sceneIndex = last;
    for (let index = 0; index < last; index += 1) {
        if (p < BOUNDS[index + 1]) {
            sceneIndex = index;
            break;
        }
    }
    const {start, end} = sceneProgressWindow(sceneIndex);
    const local = end > start ? Math.min(1, Math.max(0, (p - start) / (end - start))) : 0;
    return {sceneIndex, local, progress: p};
}

/** "HH:MM:SS:FF" for a linear mapping of progress onto totalSeconds; invalid input gives zeros. */
export function frameToTimecode(progress: number, totalSeconds: number, fps = FILM_FPS): string {
    const zero = "00:00:00:00";
    if (!Number.isFinite(progress) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return zero;
    if (!Number.isInteger(fps) || fps <= 0) return zero;
    const frames = Math.floor(clamp01(progress) * totalSeconds * fps + 1e-9);
    const seconds = Math.floor(frames / fps);
    const pad = (value: number) => String(value).padStart(2, "0");
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, frames % fps].map(pad).join(":");
}
