import { describe, expect, it } from "vitest";
import { getModelBankEntry, loadModelBank } from "@/lib/ai/modelBank";
import { resolveModelMetadata } from "@/lib/ai/modelMetadata";
import { getReasoningPolicy } from "@/lib/ai/reasoningPolicy";
import { formatTokenCount } from "@/lib/agent/contextUsage";
import { verifySnapshot, deriveDataset } from "../scripts/model-bank-snapshot.mjs";
import { readFileSync } from "node:fs";

describe("curated Model Bank", () => {
  it("resolves limits per field, preserving provider priority and provenance", () => {
    const result = resolveModelMetadata("gpt-5.6-luna", { source: "provider", contextWindow: 128000 });
    expect(result.contextWindow).toEqual({ tokens: 128000, source: "provider" });
    expect(result.maxOutputTokens).toMatchObject({ tokens: 128000, source: "model-bank", copiedAt: "2026-09-19" });
    expect(result.maxOutputTokens?.sourceUrl).toContain("ebe586289d55936b738e4dc822dbdd745196b4f3");
    const outputOnly = resolveModelMetadata("gpt-5.6-luna", { source: "provider", maxOutputTokens: 4096 });
    expect(outputOnly.contextWindow).toMatchObject({ tokens: 1050000, source: "model-bank" });
    expect(outputOnly.maxOutputTokens).toEqual({ tokens: 4096, source: "provider" });
  });
  it("does not infer aliases or expose prototype keys, but preserves unknown provider data", () => {
    for (const id of ["constructor", "__proto__", "vendor/gpt-5", "gpt-5-custom"]) {
      expect(getModelBankEntry(id)).toBeUndefined();
      expect(resolveModelMetadata(id).contextWindow).toBeUndefined();
    }
    expect(resolveModelMetadata("custom", { source: "provider", contextWindow: 64000 }).contextWindow?.tokens).toBe(64000);
    expect(resolveModelMetadata(" gpt-5 ").contextWindow?.tokens).toBe(400000);
  });
  it("rejects invalid supplied limits without confusing output and context", () => {
    expect(resolveModelMetadata("gpt-5", { source: "provider", contextWindow: NaN }).contextWindow?.source).toBe("model-bank");
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

describe("full upstream snapshot", () => {
  it("verifies every copied file and reproduces every generated field", () => {
    const manifest = verifySnapshot();
    expect(Object.keys(manifest.files)).toHaveLength(197);
    const generated = deriveDataset();
    expect(generated.providers).toBe(85);
    expect(generated.models).toBe(1855);
    expect(generated.text).toBe(readFileSync("src/lib/ai/modelBank/models.generated.json", "utf8"));
    expect(generated.lookup).toBe(readFileSync("src/lib/ai/modelBank/lookup.generated.json", "utf8"));
  });
  it("retains full records, prices, generation parameters and provider variants", async () => {
    const bank = await loadModelBank();
    const luna = bank.openai.find((model) => model.id === "gpt-5.6-luna")!;
    expect(luna.contextWindowTokens).toBe(1050000);
    expect(luna.pricing).toMatchObject({ units: expect.arrayContaining([expect.objectContaining({ strategy: "tiered", tiers: expect.arrayContaining([expect.objectContaining({ upTo: 272000 })]) })]) });
    const image = bank.openai.find((model) => model.id === "gpt-image-2")!;
    expect(image).toHaveProperty("parameters");
    expect(bank.chatgpt.find((model) => model.id === "gpt-5.6-luna")?.contextWindowTokens).toBe(272000);
    expect(new Set(Object.values(bank).flat().map((model) => model.type))).toEqual(new Set(["chat", "image", "video", "embedding", "tts", "asr", "realtime"]));
  });
  it("uses the requested provider variant before the original vendor fallback", () => {
    expect(getModelBankEntry("gpt-5.6-luna", "chatgpt")?.contextWindow).toBe(272000);
    expect(getModelBankEntry("gpt-5.6-luna", "openai")?.contextWindow).toBe(1050000);
    expect(getModelBankEntry("gpt-5.6-luna", "apimart")?.contextWindow).toBe(1050000);
    expect(getModelBankEntry("gpt-5-2025-08-07")).toBeUndefined();
    expect(getModelBankEntry("claude-opus-4-6", "anthropic")?.providerId).toBe("anthropic");
  });
});
