import { beforeAll, describe, expect, it } from "vitest";
import { initModelCatalog, lookupModelByDefinition } from "@/features/settings/modelCatalog/store";
import { resolveModelMetadata } from "@/features/settings/models/modelMetadata";
import { getReasoningPolicy } from "@/features/settings/models/reasoningPolicy";
import { formatTokenCount } from "@/features/agent/runtime/contextUsage";

describe("model catalog limits through resolveModelMetadata", () => {
  beforeAll(() => initModelCatalog());
  it("resolves limits per field, preserving provider priority and provenance", () => {
    const result = resolveModelMetadata("gpt-5.6-luna", { source: "provider", contextWindow: 128000 });
    expect(result.contextWindow).toEqual({ tokens: 128000, source: "provider" });
    expect(result.maxOutputTokens).toEqual({ tokens: 128000, source: "models-dev", sourceUrl: "https://models.dev" });
    const outputOnly = resolveModelMetadata("gpt-5.6-luna", { source: "provider", maxOutputTokens: 4096 });
    expect(outputOnly.contextWindow).toMatchObject({ tokens: 1050000, source: "models-dev" });
    expect(outputOnly.maxOutputTokens).toEqual({ tokens: 4096, source: "provider" });
  });
  it("does not infer aliases or expose prototype keys, but preserves unknown provider data", () => {
    for (const id of ["constructor", "__proto__", "vendor/gpt-5", "gpt-5-custom"]) {
      expect(lookupModelByDefinition(undefined, id)).toBeUndefined();
      expect(resolveModelMetadata(id).contextWindow).toBeUndefined();
    }
    expect(resolveModelMetadata("custom", { source: "provider", contextWindow: 64000 }).contextWindow?.tokens).toBe(64000);
    expect(resolveModelMetadata(" gpt-5 ").contextWindow?.tokens).toBe(400000);
  });
  it("rejects invalid supplied limits without confusing output and context", () => {
    expect(resolveModelMetadata("gpt-5", { source: "provider", contextWindow: NaN }).contextWindow?.source).toBe("models-dev");
    expect(resolveModelMetadata("unknown", { source: "provider", maxOutputTokens: 1000 }).contextWindow).toBeUndefined();
  });
  it("keeps model references independent of provider wire permissions", () => {
    expect(getReasoningPolicy({ definitionId: "apimart", baseUrl: "https://example.test/v1" }, "gpt-5.6-luna")).toBeUndefined();
    expect(resolveModelMetadata("gpt-5.6-luna").contextWindow?.tokens).toBe(1050000);
    const connector = { definitionId: "aihubmix" as const, baseUrl: "https://example.test/v1" };
    expect(getReasoningPolicy(connector, "gpt-5.6-luna")?.levels).not.toContain("max");
  });
  it("preserves million-scale model capacity precision", () => {
    expect(formatTokenCount(1050000)).toBe("1.05M");
    expect(formatTokenCount(1000000)).toBe("1M");
  });
});
