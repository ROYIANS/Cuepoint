import {sceneProgressWindow} from "./timeline";

// Each scene has a ground colour: a cool or warm shift inside the dark grey family, never a
// saturated brand colour. Only the delivery scene is brighter (still a dark colour, not white).
// The colour is a function of film progress, so it follows scrolling and playback alike (it is
// not a timed fade); the stage background reads it from the --stage-tone custom property.
export type Rgb = readonly [number, number, number];

export const SCENE_TONES: readonly Rgb[] = [
    [0x0c, 0x0c, 0x0e], // leader: near black
    [0x14, 0x15, 0x1f], // spark: deep indigo
    [0x12, 0x18, 0x1c], // script: dark slate teal
    [0x1b, 0x18, 0x14], // agent: warm grey
    [0x0f, 0x15, 0x12], // vault: green-tinted near black
    [0x20, 0x1c, 0x16], // delivery: warm cream, the brightest ground of the film
];

/** The credits ground: the application's own dark grey, so the pinned stage hands over to the page seamlessly. */
export const CREDITS_TONE: Rgb = [0x10, 0x10, 0x10];

/** A scene keeps its colour from this local progress to HOLD_END; the blend to the next scene happens in between. */
export const TONE_ENTER = 0.25;
export const TONE_LEAVE = 0.8;

const smooth = (x: number) => x * x * (3 - 2 * x);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

type Stop = { at: number; color: Rgb };

const STOPS: readonly Stop[] = (() => {
    const stops: Stop[] = [];
    SCENE_TONES.forEach((color, index) => {
        const {start, end} = sceneProgressWindow(index);
        stops.push({at: index === 0 ? 0 : start + (end - start) * TONE_ENTER, color});
        stops.push({at: start + (end - start) * TONE_LEAVE, color});
    });
    stops.push({at: 1, color: CREDITS_TONE});
    return stops;
})();

/** Ground colour (0..255 channels, fractional) at film progress p. Continuous, and constant while a scene holds. */
export function toneAt(progress: number): Rgb {
    const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    for (let i = 1; i < STOPS.length; i += 1) {
        if (p <= STOPS[i].at) {
            const a = STOPS[i - 1];
            const b = STOPS[i];
            const span = b.at - a.at;
            return span > 0 ? mix(a.color, b.color, smooth((p - a.at) / span)) : b.color;
        }
    }
    return STOPS[STOPS.length - 1].color;
}

/** `rgb(r, g, b)` with whole channels, for a custom property. */
export function toneCss(progress: number): string {
    const [r, g, b] = toneAt(progress);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// Text colours drawn on the stage ground. landing.css uses the same literals (a test checks it).
// The slate and the corner marks are translucent, so contrast is computed on the blended colour.
export const STAGE_TEXT = {
    subtitle: {color: [244, 240, 232], alpha: 1, css: "rgb(244, 240, 232)"},
    label: {color: [214, 208, 198], alpha: 0.82, css: "rgba(214, 208, 198, 0.82)"},
    hud: {color: [159, 159, 159], alpha: 1, css: "oklch(0.7 0 0)"},
} as const;
