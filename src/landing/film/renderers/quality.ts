import type {Quality} from "./particles";

export type QualityInput = {
    hardwareConcurrency?: number;
    deviceMemory?: number;
    /** Viewport width in CSS px. */
    width: number;
    coarsePointer: boolean;
    saveData: boolean;
};

/**
 * Initial quality tier from the device. Unknown values (Safari and Firefox expose
 * no deviceMemory) are not penalised. Narrow or touch screens never get "high".
 */
export function detectQuality({hardwareConcurrency, deviceMemory, width, coarsePointer, saveData}: QualityInput): Quality {
    if (saveData) return "low";
    const cores = hardwareConcurrency ?? 4;
    const memory = deviceMemory ?? 8;
    if (cores <= 2 || memory <= 2) return "low";
    if (coarsePointer || width < 700) return cores <= 4 || memory <= 4 ? "low" : "medium";
    return cores >= 8 && memory >= 8 ? "high" : "medium";
}

const ORDER: readonly Quality[] = ["high", "medium", "low"];

/** The next lower tier, or undefined when already at the lowest. */
export function lowerQuality(quality: Quality): Quality | undefined {
    return ORDER[ORDER.indexOf(quality) + 1];
}

export const FRAME_BUDGET_MS = 22;
const WARMUP_FRAMES = 20;
const WINDOW_FRAMES = 60;
const MIN_SAMPLES = 40;

export type AdaptiveQuality = {
    /** Feeds one frame time (ms); returns the new, lower tier when the p95 over the window exceeds the budget. */
    push: (frameMs: number) => Quality | undefined;
    current: () => Quality;
};

/**
 * Rolling-p95 downgrade: the first frames after start (and after every downgrade)
 * are ignored, then the 95th percentile of the last 60 frame times must stay within
 * the budget. Tiers only go down; going back up would make a borderline device flap.
 */
export function createAdaptiveQuality(initial: Quality, budgetMs = FRAME_BUDGET_MS): AdaptiveQuality {
    let quality = initial;
    let skipped = 0;
    const samples: number[] = [];
    return {
        current: () => quality,
        push(frameMs) {
            if (!Number.isFinite(frameMs) || frameMs <= 0) return undefined;
            if (skipped < WARMUP_FRAMES) {
                skipped += 1;
                return undefined;
            }
            samples.push(frameMs);
            if (samples.length > WINDOW_FRAMES) samples.shift();
            if (samples.length < MIN_SAMPLES) return undefined;
            const sorted = [...samples].sort((a, b) => a - b);
            const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
            if (p95 <= budgetMs) return undefined;
            const next = lowerQuality(quality);
            if (!next) return undefined;
            quality = next;
            skipped = 0;
            samples.length = 0;
            return next;
        },
    };
}
