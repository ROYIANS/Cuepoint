import {
  connectorDisplayName,
  connectorProviderKey,
  getConnectorDefinition,
} from "@/lib/ai/catalog";
import { describe, expect, it } from "vitest";

describe("connectorDisplayName", () => {
  it("prefers a custom label, else catalog title", () => {
    expect(
      connectorDisplayName({ definitionId: "openai-compatible", label: "家里的网关" }),
    ).toBe("家里的网关");
    expect(connectorDisplayName({ definitionId: "deepseek" })).toBe("DeepSeek");
  });
});

describe("connectorProviderKey", () => {
  it("maps catalog ids to icon providers", () => {
    expect(connectorProviderKey("deepseek")).toBe("deepseek");
    expect(connectorProviderKey("openai-compatible")).toBe("openai");
    expect(connectorProviderKey("apimart")).toBe("apimart");
    expect(connectorProviderKey("aihubmix")).toBe("aihubmix");
    expect(getConnectorDefinition("openai-compatible")?.title).toBe("OpenAI 兼容");
  });
});

it("exposes APIMart media capabilities independently of compatible chat protocol", () => {
  expect(getConnectorDefinition("apimart")).toMatchObject({
    protocol: "openai-compatible",
    defaultBaseUrl: "https://api.apimart.ai/v1",
    capabilities: ["chat", "image", "video"],
  });
  expect(connectorDisplayName({ definitionId: "apimart" })).toBe("APIMart");
  expect(getConnectorDefinition("deepseek")?.capabilities).toEqual(["chat"]);
});

it("registers AIHubMix with a compatible chat base and media capabilities", () => {
  expect(getConnectorDefinition("aihubmix")).toMatchObject({ title: "AIHubMix", defaultBaseUrl: "https://aihubmix.com/v1", protocol: "openai-compatible", capabilities: ["chat", "image", "video"] });
});

it("registers MiMo speech and chat with its official v1 base", () => {
  expect(getConnectorDefinition("mimo")).toMatchObject({ title: "MiMo", defaultBaseUrl: "https://api.xiaomimimo.com/v1", protocol: "openai-compatible", capabilities: ["chat", "audio"] });
  expect(connectorDisplayName({ definitionId: "mimo" })).toBe("MiMo");
});
