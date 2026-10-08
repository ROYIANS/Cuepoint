import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { GENERAL_AGENT_ID } from "@/domain/agent";
import { defaultImageGeneration, defaultVideoGeneration } from "@/domain/output";
import type { ConnectorConfig } from "@/domain/types";
import type { GenerationPreference, GenerationSelection } from "@/domain/generationPreferences";
import { getGenerationPreferences, getGenerationPreferenceState, saveGenerationPreference } from "@/db/generationPreferences";
import { inspectGenerationPreferences, recommendGenerationSelection, validateGenerationPreference } from "@/lib/agent/generationSelection";

const apimart: ConnectorConfig = { id: "apimart-a", definitionId: "apimart", baseUrl: "https://apimart.invalid/v1", apiKey: "fake-key-never-saved", updatedAt: "2026" };
const aihubmix: ConnectorConfig = { id: "aihubmix-a", definitionId: "aihubmix", baseUrl: "https://aihubmix.invalid/v1", apiKey: "another-fake-key", updatedAt: "2026" };
const image: GenerationPreference = { connectorId: apimart.id, model: "gpt-image-2", parameters: { size: "16:9", resolution: "2k" } };
const video: GenerationPreference = { connectorId: aihubmix.id, model: "veo-3.1-fast-generate-preview", parameters: { resolution: "1080p", duration: 8, aspectRatio: "16:9" } };
const aiImage: GenerationSelection = { connectorId: aihubmix.id, model: "gpt-image-2", parameters: { size: "1024x1024", quality: "high" } };
const connectors = [apimart, aihubmix];
async function seed() { await db.connectors.bulkAdd(connectors); }

describe("generation preferences persistence", () => {
  it("reads missing preferences without creating an AgentConfig and saves each modality atomically", async () => {
    expect(await getGenerationPreferenceState()).toEqual({ preferences: {}, issues: {} });
    expect(await db.agents.count()).toBe(0);
    await seed();
    await Promise.all([saveGenerationPreference("image", image), saveGenerationPreference("video", video)]);
    expect(await getGenerationPreferences()).toEqual({ image, video });
    const agent = (await db.agents.get(GENERAL_AGENT_ID))!;
    expect(JSON.stringify(agent.generationPreferences)).not.toContain("fake-key");
    expect(Object.keys(agent.generationPreferences?.image ?? {}).sort()).toEqual(["connectorId", "model", "parameters"]);
    expect(JSON.stringify(agent.generationPreferences)).not.toMatch(/validation|参数配置校验|target|prompt|inputs/);
    const permissions = agent.permissionMode, skills = agent.enabledSkillIds;
    await saveGenerationPreference("image", { ...image, parameters: { size: "1:1", resolution: "4k" } });
    expect(await db.agents.get(GENERAL_AGENT_ID)).toMatchObject({ permissionMode: permissions, enabledSkillIds: skills });
    await saveGenerationPreference("image", null);
    expect(await getGenerationPreferences()).toEqual({ video });
  });

  it("checks connector availability/provider/model every save and read without silently rewriting stale choices", async () => {
    await seed();
    await saveGenerationPreference("image", image);
    await saveGenerationPreference("video", video);
    await db.connectors.delete(apimart.id);
    const state = await getGenerationPreferenceState();
    expect(state.preferences).toEqual({ video });
    expect(state.issues.image?.[0]).toContain("已删除");
    expect((await db.agents.get(GENERAL_AGENT_ID))?.generationPreferences?.image).toEqual(image);
    await expect(getGenerationPreferences()).rejects.toThrow("已删除");
    await expect(saveGenerationPreference("image", image)).rejects.toThrow("已删除");
    // Repairing another modality must not silently forget the stale image preference.
    await saveGenerationPreference("video", { ...video, parameters: { duration: 4, resolution: "720p", aspectRatio: "9:16" } });
    expect((await db.agents.get(GENERAL_AGENT_ID))?.generationPreferences?.image).toEqual(image);
    await saveGenerationPreference("image", null);
    expect((await getGenerationPreferenceState()).issues).toEqual({});
    await db.connectors.update(aihubmix.id, { definitionId: "deepseek" });
    expect((await getGenerationPreferenceState()).issues.video?.[0]).toContain("暂不支持");
  });

  it("rejects prompts, targets, references, credentials and input-dependent defaults before any write", async () => {
    await seed();
    for (const extra of [{ prompt: "secret prompt" }, { target: { id: "target" } }, { inputs: [] }, { apiKey: "secret" }]) {
      await expect(saveGenerationPreference("image", { ...image, ...extra } as GenerationPreference)).rejects.toThrow();
    }
    for (const parameters of [{ ...image.parameters, prompt: "secret" }, { ...image.parameters, mode: "text" }]) {
      await expect(saveGenerationPreference("image", { ...image, parameters } as GenerationPreference)).rejects.toThrow();
    }
    await expect(saveGenerationPreference("video", { connectorId: apimart.id, model: "MiniMax-H3", parameters: { aspectRatio: "adaptive", duration: 5, resolution: "2K" } })).rejects.toThrow("本次");
    expect(await db.agents.count()).toBe(0);
  });

  it("validates modality and provider-specific combinations rather than only matching a model name", async () => {
    await seed();
    await expect(saveGenerationPreference("image", { ...image, connectorId: aihubmix.id })).rejects.toThrow();
    await expect(saveGenerationPreference("video", image)).rejects.toThrow();
    await expect(saveGenerationPreference("image", video)).rejects.toThrow();
    await expect(saveGenerationPreference("video", { ...video, parameters: { duration: 4, resolution: "1080p" } })).rejects.toThrow("8 秒");
    await expect(saveGenerationPreference("video", { connectorId: apimart.id, model: "MiniMax-H3", parameters: { duration: 3 } })).rejects.toThrow("4–15");
    await expect(saveGenerationPreference("video", { connectorId: apimart.id, model: "MiniMax-H3", parameters: { duration: 4.5 } })).rejects.toThrow();
    await db.connectors.update(apimart.id, { apiKey: "  " });
    await expect(saveGenerationPreference("image", image)).rejects.toThrow("尚未配置");
    expect(await db.agents.count()).toBe(0);
  });

  it("persists GPT Image 2.5 quality and Ext version without merging incompatible fields", async () => {
    await seed();
    const flare: GenerationPreference = {
      connectorId: apimart.id, model: "gpt-image-2.5-flare",
      parameters: { size: "16:9", resolution: "2k", quality: "auto" },
    };
    const ext: GenerationPreference = {
      connectorId: apimart.id, model: "gpt-image-2.5-ext",
      parameters: { size: "1:1", resolution: "4k", version: "sunburst" },
    };
    await saveGenerationPreference("image", flare);
    expect(await getGenerationPreferences()).toEqual({ image: flare });
    await expect(saveGenerationPreference("image", {
      connectorId: apimart.id, model: "gpt-image-2", parameters: { size: "16:9", resolution: "1k", quality: "auto" },
    })).rejects.toThrow();
    await expect(saveGenerationPreference("image", {
      connectorId: apimart.id, model: "gpt-image-2.5-ext", parameters: { size: "2:1", resolution: "1k", version: "flare" },
    })).rejects.toThrow();
    await saveGenerationPreference("image", ext);
    expect(await getGenerationPreferences()).toEqual({ image: ext });
    expect(recommendGenerationSelection({
      kind: "image", connectors, projectDefaults: { image: defaultImageGeneration("9:16", "gpt-image-2.5-sunburst") },
    })).toMatchObject({
      source: "project", status: "ready",
      recommendation: { model: "gpt-image-2.5-sunburst", parameters: { size: "9:16", resolution: "1k", quality: "auto" } },
    });
  });
});

describe("independent generation recommendations", () => {
  it("prioritizes explicit > project > global > AI without modifying any input draft", () => {
    const original = structuredClone(aiImage);
    const defaults = { image: defaultImageGeneration("9:16") };
    const common = { kind: "image" as const, connectors, projectDefaults: defaults, preferences: { image }, aiSuggestion: aiImage };
    const explicit = recommendGenerationSelection({ ...common, explicitSelection: aiImage });
    expect(explicit).toMatchObject({ source: "explicit", status: "ready", recommendation: aiImage });
    const project = recommendGenerationSelection(common);
    expect(project).toMatchObject({ source: "project", status: "ready", recommendation: { connectorId: apimart.id, parameters: { size: "9:16", resolution: "1k" } } });
    expect(recommendGenerationSelection({ ...common, projectDefaults: undefined })).toMatchObject({ source: "global", recommendation: image });
    expect(recommendGenerationSelection({ ...common, projectDefaults: undefined, preferences: undefined })).toMatchObject({ source: "ai", recommendation: aiImage });
    expect(aiImage).toEqual(original);
    project.recommendation!.parameters.size = "1:1";
    expect(defaults.image.size).toBe("9:16");
    explicit.recommendation!.parameters.size = "auto";
    expect(aiImage).toEqual(original);
  });

  it("returns ambiguity rather than choosing an arbitrary provider connection or a lower-priority default", () => {
    const extra = { ...apimart, id: "apimart-b" };
    const args = { kind: "image" as const, projectDefaults: { image: defaultImageGeneration() }, preferences: { image }, aiSuggestion: aiImage };
    expect(recommendGenerationSelection({ ...args, connectors: [...connectors, extra] })).toMatchObject({ source: "project", status: "ambiguous", draft: { model: "gpt-image-2" }, candidateConnectorIds: [apimart.id, extra.id] });
    expect(recommendGenerationSelection({ ...args, connectors: [aihubmix] })).toMatchObject({ source: "project", status: "needs-selection", candidateConnectorIds: [] });
    expect(recommendGenerationSelection({ ...args, connectors: [...connectors, { ...extra, apiKey: "" }] })).toMatchObject({ source: "project", status: "ready", recommendation: { connectorId: apimart.id } });
    expect(recommendGenerationSelection({ ...args, connectors: [...connectors, extra], explicitSelection: { ...image, connectorId: extra.id } })).toMatchObject({ source: "explicit", status: "ready", recommendation: { connectorId: extra.id } });
  });

  it("does not override an invalid explicit choice or silently fall back from stale project/global defaults", () => {
    const base = { kind: "image" as const, connectors, preferences: { image }, aiSuggestion: aiImage };
    expect(recommendGenerationSelection({ ...base, explicitSelection: { ...image, connectorId: "deleted" } })).toMatchObject({ source: "explicit", status: "needs-selection" });
    expect(recommendGenerationSelection({ ...base, projectDefaults: { image: { ...defaultImageGeneration(), profileVersion: "old" } } })).toMatchObject({ source: "project", status: "needs-selection" });
    expect(recommendGenerationSelection({ ...base, preferenceIssues: { image: ["原默认连接已删除"] } })).toMatchObject({ source: "global", status: "needs-selection", issues: ["原默认连接已删除"] });
    expect(recommendGenerationSelection({ ...base, preferences: { image: { ...image, connectorId: "missing" } } })).toMatchObject({ source: "global", status: "needs-selection" });
    expect(recommendGenerationSelection({ kind: "video", connectors, preferences: { image } })).toMatchObject({ source: "none", status: "needs-selection" });
  });

  it("supports conditional project modes without persisting fixture prompts, targets or input roles", () => {
    const config = { ...defaultVideoGeneration(), mode: "frames", aspectRatio: "adaptive" };
    const result = recommendGenerationSelection({ kind: "video", connectors, projectDefaults: { video: config } });
    expect(result).toMatchObject({ source: "project", status: "ready", recommendation: { connectorId: apimart.id, model: "MiniMax-H3", parameters: { mode: "frames", aspectRatio: "adaptive", duration: 5, resolution: "2K" } } });
    expect(JSON.stringify(result)).not.toMatch(/validation|参数配置校验|target|prompt|inputs/);
    expect(() => validateGenerationPreference("video", result.recommendation, connectors)).toThrow();
  });

  it("accepts sanitized connector capability records and surfaces malformed stored data without leaking it", () => {
    const safe = connectors.map(({ id, definitionId }) => ({ id, definitionId, configured: true }));
    expect(recommendGenerationSelection({ kind: "image", connectors: safe, aiSuggestion: aiImage })).toMatchObject({ source: "ai", status: "ready" });
    const state = inspectGenerationPreferences({ image: { ...image, apiKey: "never-return-this-secret" }, video }, safe);
    expect(state.preferences).toEqual({ video });
    expect(state.issues.image).toHaveLength(1);
    expect(JSON.stringify(state)).not.toContain("never-return-this-secret");
    expect(inspectGenerationPreferences(null, safe).issues.image).toHaveLength(1);
    expect(inspectGenerationPreferences({ image, extra: "unknown" }, safe).preferences).toEqual({});
  });
});
