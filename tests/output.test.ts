import { describe, expect, it } from "vitest";
import {
  APIMART_IMAGE_MODELS, defaultImageGeneration, defaultVideoGeneration, generationParameters,
  IMAGE_EXT_RATIOS, IMAGE_QUALITIES, IMAGE_RATIOS, OUTPUT_PROFILE_VERSION, parseGenerationDefaults,
  validateGenerationDefaults, VIDEO_RATIOS,
} from "@/domain/output";

describe("verified APIMart project defaults", () => {
  it.each(IMAGE_RATIOS)("maps image ratio %s with native size and resolution", (size) => {
    for (const resolution of ["1k", "2k", "4k"]) {
      const image = { ...defaultImageGeneration(), size, resolution };
      expect(validateGenerationDefaults({ image })).toEqual([]);
      expect(generationParameters({ image }, "image")).toEqual({ model: "gpt-image-2", size, resolution, n: 1 });
    }
  });
  it("keeps OUTPUT_PROFILE_VERSION and defaults new projects to Image 2", () => {
    expect(OUTPUT_PROFILE_VERSION).toBe("2026-09-18");
    expect(defaultImageGeneration()).toMatchObject({ model: "gpt-image-2", profileVersion: OUTPUT_PROFILE_VERSION });
    expect(defaultImageGeneration()).not.toHaveProperty("quality");
    expect(defaultImageGeneration()).not.toHaveProperty("version");
  });
  it.each(APIMART_IMAGE_MODELS)("accepts verified APIMart image model %s with model-specific fields", (model) => {
    const image = defaultImageGeneration("16:9", model);
    expect(validateGenerationDefaults({ image })).toEqual([]);
    const parameters = generationParameters({ image }, "image");
    expect(parameters).toMatchObject({ model, size: "16:9", resolution: "1k", n: 1 });
    if (model === "gpt-image-2.5-flare" || model === "gpt-image-2.5-sunburst") {
      expect(image.quality).toBe("auto");
      expect(parameters.quality).toBe("auto");
      expect(parameters).not.toHaveProperty("version");
    } else if (model === "gpt-image-2.5-ext") {
      expect(image.version).toBe("flare");
      expect(parameters.version).toBe("flare");
      expect(parameters).not.toHaveProperty("quality");
    } else {
      expect(parameters).not.toHaveProperty("quality");
      expect(parameters).not.toHaveProperty("version");
    }
  });
  it("rejects Image 2 quality, Ext quality, Ext-unsupported sizes and invalid 2.5 quality", () => {
    expect(validateGenerationDefaults({ image: { ...defaultImageGeneration(), quality: "auto" } })).not.toEqual([]);
    expect(validateGenerationDefaults({ image: { ...defaultImageGeneration("16:9", "gpt-image-2.5-ext"), quality: "auto" } })).not.toEqual([]);
    expect(validateGenerationDefaults({ image: { ...defaultImageGeneration("16:9", "gpt-image-2.5-ext"), size: "2:1" } })).not.toEqual([]);
    expect(validateGenerationDefaults({ image: { ...defaultImageGeneration("16:9", "gpt-image-2.5-flare"), quality: "ultra" } })).not.toEqual([]);
    expect(validateGenerationDefaults({ image: { ...defaultImageGeneration("16:9", "gpt-image-2.5-flare"), version: "flare" } })).not.toEqual([]);
    for (const size of IMAGE_EXT_RATIOS) {
      expect(validateGenerationDefaults({ image: { ...defaultImageGeneration("16:9", "gpt-image-2.5-ext"), size } })).toEqual([]);
    }
    for (const quality of IMAGE_QUALITIES) {
      expect(validateGenerationDefaults({ image: { ...defaultImageGeneration("16:9", "gpt-image-2.5-sunburst"), quality } })).toEqual([]);
    }
  });
  it("parses quality and version as known image keys instead of extra bags", () => {
    const parsed = parseGenerationDefaults({
      image: { ...defaultImageGeneration("1:1", "gpt-image-2.5-flare"), quality: "xhigh", version: undefined, futureField: "keep" },
    })!;
    expect(parsed.image).toMatchObject({ model: "gpt-image-2.5-flare", quality: "xhigh", extra: { futureField: "keep" } });
    expect(parsed.image).not.toHaveProperty("version");
    const ext = parseGenerationDefaults({ image: { ...defaultImageGeneration("1:1", "gpt-image-2.5-ext"), version: "sunburst" } })!;
    expect(ext.image).toMatchObject({ version: "sunburst" });
    expect(ext.image?.extra).toBeUndefined();
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
