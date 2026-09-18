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
    expect(getConnectorDefinition("openai-compatible")?.title).toBe("OpenAI 兼容");
  });
});
