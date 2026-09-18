import { describe, expect, it } from "vitest";
import { defaultImageGeneration, defaultVideoGeneration, generationParameters, IMAGE_RATIOS, parseGenerationDefaults, validateGenerationDefaults, VIDEO_RATIOS } from "@/domain/output";

describe("verified APIMart project defaults", () => {
  it.each(IMAGE_RATIOS)("maps image ratio %s with native size and resolution", (size) => {
    for (const resolution of ["1k", "2k", "4k"]) {
      const image = { ...defaultImageGeneration(), size, resolution };
      expect(validateGenerationDefaults({ image })).toEqual([]);
      expect(generationParameters({ image }, "image")).toEqual({ model: "gpt-image-2", size, resolution, n: 1 });
    }
  });
  it.each(VIDEO_RATIOS)("accepts H3 text ratio %s and 4–15 second integer durations", (aspectRatio) => {
    for (const resolution of ["768P", "2K"]) {
      for (const duration of [4, 5, 15]) {
        const video = { ...defaultVideoGeneration(), aspectRatio, resolution, duration };
        expect(validateGenerationDefaults({ video })).toEqual([]);
        expect(generationParameters({ video }, "video")).toEqual({ model: "MiniMax-H3", aspect_ratio: aspectRatio, resolution, duration });
      }
    }
  });
  it("does not silently coerce unsupported mode-switch combinations", () => {
    const video = { ...defaultVideoGeneration(), mode: "frames" };
    expect(validateGenerationDefaults({ video })).toHaveLength(1);
    expect(() => generationParameters({ video }, "video")).toThrow();
    video.aspectRatio = "adaptive";
    expect(generationParameters({ video }, "video")).toEqual({ model: "MiniMax-H3", resolution: "2K", duration: 5 });
    expect(validateGenerationDefaults({ video: { ...video, mode: "text" } })).not.toEqual([]);
    expect(validateGenerationDefaults({ video: { ...video, mode: "reference" } })).toEqual([]);
  });
  it.each([0, 3, 16, 4.5, NaN, Infinity])("rejects invalid video duration %s", (duration) => {
    expect(validateGenerationDefaults({ video: { ...defaultVideoGeneration(), duration } })).not.toEqual([]);
  });
  it("preserves older/unknown profiles for review but cannot use them as parameters", () => {
    const old = { image: { ...defaultImageGeneration(), model: "future-model", profileVersion: "future", size: "4:1", futureField: "keep" }, futureRoot: { key: 1 } };
    const parsed = parseGenerationDefaults(old)!;
    expect(parsed.image).toMatchObject({ model: "future-model", size: "4:1", extra: { futureField: "keep" } });
    expect(parsed.extra).toEqual({ futureRoot: { key: 1 } });
    expect(parseGenerationDefaults(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    expect(() => generationParameters(parsed, "image")).toThrow();
  });
  it("keeps legacy manual projects unconfigured and rejects malformed settings", () => {
    expect(parseGenerationDefaults(undefined)).toBeUndefined();
    expect(validateGenerationDefaults(undefined)).toEqual([]);
    expect(() => generationParameters({}, "image")).toThrow("尚未配置");
    for (const bad of [null, [], { image: "oops" }, { video: {} }, { image: { ...defaultImageGeneration(), size: 1 } }]) {
      expect(() => parseGenerationDefaults(bad)).toThrow();
    }
    expect(validateGenerationDefaults({ image: { ...defaultImageGeneration(), resolution: "2K" } })).not.toEqual([]);
    expect(validateGenerationDefaults({ video: { ...defaultVideoGeneration(), resolution: "1080P" } })).not.toEqual([]);
  });
});
