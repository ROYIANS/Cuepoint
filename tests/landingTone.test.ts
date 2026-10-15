import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {sceneProgressWindow} from "../apps/site/src/film/timeline";
import {CREDITS_TONE, SCENE_TONES, STAGE_TEXT, TONE_ENTER, TONE_LEAVE, toneAt, toneCss, type Rgb} from "../apps/site/src/film/tone";

const landingCss = readFileSync(new URL("../apps/site/src/styles/landing.css", import.meta.url), "utf8");

// WCAG 2.x relative luminance and contrast ratio of sRGB colours (0..255 channels).
function luminance([r, g, b]: Rgb): number {
    const linear = (value: number) => {
        const v = value / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(foreground: Rgb, background: Rgb): number {
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The colour a translucent text paints over a ground. */
const over = (text: {color: readonly number[]; alpha: number}, ground: Rgb): Rgb =>
    [0, 1, 2].map(i => text.color[i] * text.alpha + ground[i] * (1 - text.alpha)) as unknown as Rgb;

describe("contrast helper", () => {
    it("matches the known extremes", () => {
        expect(contrast([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
        expect(contrast([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 1);
    });
});

describe("scene tones", () => {
    it("has one ground per stage scene, ends on the application's own grey and makes only the delivery brighter", () => {
        expect(SCENE_TONES).toHaveLength(6);
        expect(toneAt(0)).toEqual(SCENE_TONES[0]);
        expect(toneAt(1)).toEqual(CREDITS_TONE);
        expect(toneCss(1)).toBe("rgb(16, 16, 16)"); // #101010, the page ground below the stage
        const brightness = SCENE_TONES.map(luminance);
        const delivery = brightness[5];
        expect(delivery).toBe(Math.max(...brightness));
        expect(brightness.slice(0, 5).every(value => value < delivery)).toBe(true);
        expect(delivery).toBeLessThan(0.02); // still a dark ground, not a white one
    });

    it("keeps each scene's colour while it holds, and follows progress continuously", () => {
        SCENE_TONES.forEach((tone, index) => {
            const {start, end} = sceneProgressWindow(index);
            for (const local of [TONE_ENTER, 0.4, 0.6, TONE_LEAVE]) {
                if (index === 0 && local < TONE_ENTER) continue;
                expect(toneAt(start + (end - start) * local), `scene ${index} at ${local}`).toEqual(tone);
            }
        });
        let previous = toneAt(0);
        for (let p = 0.0005; p <= 1; p += 0.0005) {
            const tone = toneAt(p);
            for (let channel = 0; channel < 3; channel += 1) expect(Math.abs(tone[channel] - previous[channel])).toBeLessThan(0.8);
            previous = tone;
        }
    });

    it("blends monotonically between two scene colours and is stable for bad input", () => {
        for (let index = 0; index < SCENE_TONES.length; index += 1) {
            const here = sceneProgressWindow(index);
            const from = here.start + (here.end - here.start) * TONE_LEAVE;
            const next = index + 1 < SCENE_TONES.length ? sceneProgressWindow(index + 1) : {start: 1, end: 1};
            const to = index + 1 < SCENE_TONES.length ? next.start + (next.end - next.start) * TONE_ENTER : 1;
            const target = index + 1 < SCENE_TONES.length ? SCENE_TONES[index + 1] : CREDITS_TONE;
            for (let channel = 0; channel < 3; channel += 1) {
                const direction = Math.sign(target[channel] - SCENE_TONES[index][channel]);
                let last = SCENE_TONES[index][channel];
                for (let step = 1; step <= 40; step += 1) {
                    const value = toneAt(from + ((to - from) * step) / 40)[channel];
                    expect((value - last) * direction).toBeGreaterThanOrEqual(-1e-9);
                    last = value;
                }
            }
        }
        expect(toneAt(Number.NaN)).toEqual(SCENE_TONES[0]);
        expect(toneAt(-3)).toEqual(SCENE_TONES[0]);
        expect(toneAt(9)).toEqual(CREDITS_TONE);
    });
});

describe("stage text contrast", () => {
    // Subtitle, slate label, corner marks and the player bar: every ground the film passes through, at least 4.5:1.
    const grounds = (): Rgb[] => {
        const list: Rgb[] = [...SCENE_TONES, CREDITS_TONE];
        for (let p = 0; p <= 1; p += 0.005) list.push(toneAt(p));
        return list;
    };

    it("is at least 4.5:1 for the subtitle, the labels and the player text on every ground", () => {
        for (const ground of grounds()) {
            expect(contrast(over(STAGE_TEXT.subtitle, ground), ground)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(over(STAGE_TEXT.label, ground), ground)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(over(STAGE_TEXT.hud, ground), ground)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("uses the same literals in the stylesheet", () => {
        expect(landingCss).toContain(`color: ${STAGE_TEXT.subtitle.css};`);
        expect(landingCss.split(STAGE_TEXT.label.css).length - 1).toBeGreaterThanOrEqual(2); // slate and marks
        expect(landingCss).toMatch(/\.lp-hud \{[^}]*color: var\(--muted-foreground\)/);
        expect(landingCss).toContain("--stage-tone, #101010");
    });
});
