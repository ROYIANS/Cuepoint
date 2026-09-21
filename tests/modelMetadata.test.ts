import { getReasoningPolicy } from "../src/lib/ai/reasoningPolicy";
import { describe, expect, it } from "vitest";
import { collectModelMetadata, parseModelMetadata, resolveModelMetadata } from "../src/lib/ai/modelMetadata";
import { discoverConnectorChatModels } from "../src/lib/ai/connectors";

describe("provider model metadata", () => {
  it("uses conservative capacity for duplicate routes and supports special keys safely", () => {
    const result = collectModelMetadata([["__proto__", { source: "provider", contextWindow: 128000 }], ["__proto__", { source: "provider", contextWindow: 64000 }]]);
    expect(result["__proto__"].contextWindow).toBe(64000);
  });
  it("accepts explicit token limits and rejects malformed limits", () => {
    expect(parseModelMetadata({ context_length: 1050000, max_output: 128000 })).toEqual({ contextWindow: 1050000, maxOutputTokens: 128000, source: "provider" });
    for (const value of [0, -1, Infinity, NaN, 2.5, "128K"]) expect(parseModelMetadata({ context_length: value })).toBeUndefined();
    expect(parseModelMetadata({ max_output: 4096 })).toEqual({ maxOutputTokens: 4096, source: "provider" });
    expect(parseModelMetadata(null)).toBeUndefined();
  });
  it("carries AIHubMix public directory context through chat discovery", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ success: true, data: [{ model_id: "example", types: "llm", context_length: 200000 }] }))) as typeof fetch;
    const result = await discoverConnectorChatModels({ definitionId: "aihubmix", baseUrl: "https://example.test/v1", apiKey: "fixture" }, { fetchImpl });
    expect(result.ok && result.metadata?.example.contextWindow).toBe(200000);
  });
  it("carries OpenAI-compatible model metadata without inventing absent limits", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ data: [{ id: "example", context_window: 64000 }, { id: "unknown" }] }))) as typeof fetch;
    const result = await discoverConnectorChatModels({ definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture" }, { fetchImpl });
    expect(result.ok && result.metadata?.example.contextWindow).toBe(64000);
    expect(result.ok && result.metadata?.unknown).toBeUndefined();
  });
});

describe("malformed directory metadata", () => {
  it("does not traverse non-array data", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ data: {} }))) as typeof fetch;
    const result = await discoverConnectorChatModels({ definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture" }, { fetchImpl });
    expect(result).toEqual({ ok: true, models: [], incompatibleModels: [] });
  });
});

it("separates reference capacity from gateway reasoning support without guessing aliases", () => {
  expect(getReasoningPolicy({ definitionId: "apimart", baseUrl: "https://api.apimart.ai/v1" }, "gpt-5.6-luna")).toBeUndefined();
  expect(resolveModelMetadata("gpt-5.6-luna").contextWindow?.tokens).toBe(1_050_000);
  expect(resolveModelMetadata("custom-gpt-5.6-luna").contextWindow).toBeUndefined();
});
