
export type ProjectMode = "film" | "series";

export function normalizeProjectMode(raw: unknown): ProjectMode {
    return raw === "film" ? "film" : "series";
}

export const ASPECT_PRESET_IDS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;

export type AspectPresetId = (typeof ASPECT_PRESET_IDS)[number];

export const ASPECT_PRESETS: Record<
    AspectPresetId,
    { width: number; height: number; label: string }
> = {
    "21:9": {width: 2520, height: 1080, label: "21:9"},
    "4:3": {width: 1440, height: 1080, label: "4:3"},
    "3:4": {width: 1080, height: 1440, label: "3:4"},
    "16:9": {width: 1920, height: 1080, label: "16:9"},
    "9:16": {width: 1080, height: 1920, label: "9:16"},
    "1:1": {width: 1080, height: 1080, label: "1:1"},
};

export function normalizeAspectPreset(raw: unknown): AspectPresetId {
    return ASPECT_PRESET_IDS.includes(raw as AspectPresetId)
        ? (raw as AspectPresetId)
        : "16:9";
}

export function resolutionForAspect(preset: AspectPresetId): {
    width: number;
    height: number;
} {
    const {width, height} = ASPECT_PRESETS[normalizeAspectPreset(preset)];
    return {width, height};
}
