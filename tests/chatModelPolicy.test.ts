import { describe, expect, it } from "vitest";
import {
  buildChatModelOptions,
  chatModelIssue,
  getChatModelPolicy,
  type ChatModelCatalog,
} from "@/lib/ai/chatModelPolicy";

const connector = { id: "apimart-1", definitionId: "apimart" as const, baseUrl: "https://api.apimart.ai/v1", apiKey: "test-key" };
const catalog: ChatModelCatalog = {
  connector, status: "ready", models: ["chat-model"],
  incompatibleModels: ["image-model", "video-model", "audio-model"],
};

describe.each(["apimart", "aihubmix"] as const)("%s shared chat model selection policy", (definitionId) => {
  const scopedConnector = { ...connector, definitionId };
  const scopedCatalog = { ...catalog, connector: scopedConnector };
  it.each(catalog.incompatibleModels)("excludes %s from suggestions, saved selection and exact manual search", (model) => {
    const policy = getChatModelPolicy(scopedConnector, scopedCatalog);
    expect(buildChatModelOptions([model, "chat-model"], model, ` ${model} `, policy)).toEqual(["chat-model"]);
    expect(chatModelIssue(model, policy)).toContain("无法用于对话");
  });

  it("allows unknown custom names without guessing capabilities from model names", () => {
    const policy = getChatModelPolicy(scopedConnector, scopedCatalog);
    expect(buildChatModelOptions(catalog.models, "custom-image-chat", "custom-video-chat", policy)).toEqual([
      "chat-model", "custom-image-chat", "custom-video-chat",
    ]);
    expect(chatModelIssue("custom-image-chat", policy)).toBeUndefined();
  });

  it.each(["loading", "error"] as const)("retains known restrictions during %s and does not offer unverified custom entries", (status) => {
    const policy = getChatModelPolicy(scopedConnector, { ...scopedCatalog, status });
    expect(chatModelIssue("image-model", policy)).toContain("无法用于对话");
    expect(chatModelIssue("unknown-custom", policy)).toContain("无法确认");
    expect(buildChatModelOptions(catalog.models, "image-model", "unknown-custom", policy)).toEqual([]);
  });

  it.each([
    { ...scopedConnector, id: "other-connection" },
    { ...scopedConnector, baseUrl: "https://other.example/v1" },
    { ...scopedConnector, apiKey: "rotated-key" },
  ])("does not reuse metadata after connector/credentials change: %j", (other) => {
    const policy = getChatModelPolicy(other, scopedCatalog);
    expect(policy).toEqual({ verified: false, incompatibleModels: [] });
    expect(buildChatModelOptions(catalog.models, "image-model", "custom", policy)).toEqual([]);
    const refreshed = getChatModelPolicy(other, { connector: other, status: "ready", models: [], incompatibleModels: [] });
    expect(buildChatModelOptions([], "image-model", "", refreshed)).toEqual(["image-model"]);
  });

  it("preserves generic provider manual and saved choices even when APIMart categorized that ID as media", () => {
    const policy = getChatModelPolicy({ ...connector, definitionId: "openai-compatible" }, catalog);
    expect(buildChatModelOptions([], "image-model", "custom", policy)).toEqual(["custom", "image-model"]);
    expect(chatModelIssue("image-model", policy)).toBeUndefined();
  });

  it("starts provider discovery unverified without presenting saved/manual choices as compatible", () => {
    const policy = getChatModelPolicy(scopedConnector, undefined);
    expect(policy.verified).toBe(false);
    expect(buildChatModelOptions([], "old-choice", "new-choice", policy)).toEqual([]);
  });
});
