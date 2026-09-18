import { describe, expect, it } from "vitest";
import {
  ASPECT_PRESET_IDS,
  normalizeAspectPreset,
  resolutionForAspect,
} from "@/domain/types";

describe("aspect presets", () => {
  it("normalizes unknown values to 16:9 and maps each preset to pixels", () => {
    expect(normalizeAspectPreset(undefined)).toBe("16:9");
    expect(normalizeAspectPreset("nope")).toBe("16:9");
    expect(normalizeAspectPreset("9:16")).toBe("9:16");
    expect(resolutionForAspect("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(resolutionForAspect("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(resolutionForAspect("1:1")).toEqual({ width: 1080, height: 1080 });
    expect(ASPECT_PRESET_IDS).toEqual(["16:9", "9:16", "1:1"]);
  });
});
