import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authHeaders,
  chatCompletionsUrl,
  maskApiKey,
  modelsUrl,
  normalizeBaseUrl,
  testConnection,
} from "@/lib/ai/openaiCompatible";

describe("openaiCompatible helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes base URLs by trimming and stripping trailing slashes", () => {
    expect(normalizeBaseUrl(" https://api.openai.com/v1/ ")).toBe("https://api.openai.com/v1");
    expect(normalizeBaseUrl("https://api.deepseek.com/v1///")).toBe("https://api.deepseek.com/v1");
    expect(modelsUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1/models");
    expect(chatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("builds a Bearer Authorization header", () => {
    expect(authHeaders(" sk-test ")).toEqual({
      Authorization: "Bearer sk-test",
      "Content-Type": "application/json",
    });
  });

  it("masks API keys for display", () => {
    expect(maskApiKey("sk-abcdefghijklmnop")).toBe("sk-…mnop");
    expect(maskApiKey("short")).toBe("••••••••");
    expect(maskApiKey("")).toBe("");
  });

  it("testConnection succeeds via GET /models", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [{ id: "gpt-4o-mini" }, { id: "gpt-4o" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await testConnection({
      baseUrl: "https://api.openai.com/v1/",
      apiKey: "sk-test",
    });

    expect(result).toEqual({ ok: true, via: "models", modelCount: 2 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/models");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer sk-test",
      },
    });
  });

  it("testConnection falls back to chat when /models is 404", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("/models")) {
        return new Response("missing", { status: 404 });
      }
      return Response.json({ id: "chatcmpl_1" });
    });

    const result = await testConnection(
      {
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test",
        defaultModel: "custom-model",
      },
      fetchMock as typeof fetch,
    );

    expect(result).toEqual({ ok: true, via: "chat" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const chatCall = fetchMock.mock.calls[1];
    expect(chatCall?.[0]).toBe("https://api.example.com/v1/chat/completions");
    expect(JSON.parse(String(chatCall?.[1]?.body))).toMatchObject({
      model: "custom-model",
      max_tokens: 1,
    });
  });

  it("testConnection reports auth failures clearly", async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":"invalid_api_key"}', { status: 401 }));

    const result = await testConnection(
      { baseUrl: "https://api.openai.com/v1", apiKey: "bad" },
      fetchMock as typeof fetch,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("鉴权失败");
      expect(result.message).toContain("401");
    }
  });

  it("testConnection validates required fields", async () => {
    expect(await testConnection({ baseUrl: "", apiKey: "sk" })).toEqual({
      ok: false,
      message: "请填写 Base URL",
    });
    expect(await testConnection({ baseUrl: "https://x/v1", apiKey: "  " })).toEqual({
      ok: false,
      message: "请填写 API Key",
    });
  });
});
