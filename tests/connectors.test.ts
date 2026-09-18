import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { streamChatCompletions } from "@/lib/ai/chatStream";
import { appendChatMessage, createChatThread, deleteConnector, listConnectors, upsertConnector } from "@/db/repo";
import { discoverConnectorChatModels, listConnectorModels, runWithCompatibleChatModel, testConnectorConnection } from "@/lib/ai/connectors";

const apimart = {
  definitionId: "apimart" as const,
  baseUrl: "https://api.apimart.ai/v1",
  apiKey: "test-key",
};

const aihubmix = { definitionId: "aihubmix" as const, baseUrl: "https://aihubmix.com/v1", apiKey: "test-key" };

describe("connector routing", () => {
  it("discovers all APIMart models for connection checks, but only categorized chat models for chat", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
      success: true,
      data: [
        { id: "seedance-2.0", category: "video" },
        { id: "gemini-3.1-flash-image-preview", category: "image" },
        { id: "whisper-1", category: "audio" },
        { id: "custom-unknown", category: "unknown" },
        { id: "legacy-missing" },
        { id: "future-category", category: "future" },
        { id: "gpt-chat", category: "chat" },
      ],
    }));
    const all = await listConnectorModels(apimart, "all", fetchImpl);
    expect(all.ok && all.models).toHaveLength(7);
    expect(await listConnectorModels(apimart, "chat", fetchImpl)).toEqual({ ok: true, models: ["gpt-chat"] });
    expect(String(fetchImpl.mock.calls[0][0])).toBe(`${apimart.baseUrl}/models?expand=category`);
  });

  it("never falls back to a POST when the APIMart read-only probe fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("missing", { status: 404 }));
    const result = await testConnectorConnection(apimart, fetchImpl);
    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]?.method ?? "GET").toBe("GET");
  });

  it("accepts a valid media-only APIMart catalog as connected", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
      data: [{ id: "seedance-2.0", category: "video" }],
    }));
    expect(await testConnectorConnection(apimart, fetchImpl)).toEqual({ ok: true, via: "models", modelCount: 1 });
    expect(await listConnectorModels(apimart, "chat", fetchImpl)).toEqual({ ok: true, models: [] });
  });

  it.each(["deepseek", "openai-compatible"] as const)("preserves %s discovery and chat-probe fallback", async (definitionId) => {
    const connector = { ...apimart, definitionId };
    const discover = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [{ id: "custom" }] }));
    expect(await listConnectorModels(connector, "chat", discover)).toEqual({ ok: true, models: ["custom"] });
    expect(String(discover.mock.calls[0][0])).toBe(`${connector.baseUrl}/models`);
    const probe = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(Response.json({ id: "reply" }));
    expect(await testConnectorConnection(connector, probe)).toEqual({ ok: true, via: "chat" });
    expect(JSON.parse(String(probe.mock.calls[1][1]?.body)).model).toBe(
      definitionId === "deepseek" ? "deepseek-chat" : "gpt-4o-mini",
    );
  });

  it("propagates malformed APIMart discovery instead of showing an empty catalog", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: {} }));
    expect((await listConnectorModels(apimart, "chat", fetchImpl)).ok).toBe(false);
  });
});

it.each([apimart, aihubmix])("persists and edits one $definitionId record without disturbing existing providers", async (connector) => {
  const existing = await upsertConnector({
    definitionId: "deepseek", protocol: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1", apiKey: "existing-key",
  });
  const first = await upsertConnector({ ...connector, protocol: "openai-compatible" });
  const edited = await upsertConnector({ ...connector, protocol: "openai-compatible", apiKey: "updated-key" });
  expect(edited.id).toBe(first.id);
  db.close();
  await db.open();
  expect(await listConnectors()).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: first.id, definitionId: connector.definitionId, apiKey: "updated-key" }),
    expect.objectContaining({ id: existing.id, definitionId: "deepseek", apiKey: "existing-key" }),
  ]));
  expect(await db.connectors.count()).toBe(2);
  await deleteConnector(first.id);
  expect(await listConnectors()).toEqual([existing]);
});

// These tests exercise the exact guard wrapping Agent mutations and the real chat transport.
describe.each([apimart, aihubmix])("$definitionId chat send compatibility boundary", (connector) => {
  const modelResponse = { data: [
    { id: "image-model", category: "image" },
    { id: "video-model", category: "video" },
    { id: "audio-model", category: "audio" },
    { id: "chat-model", category: "chat" },
    { id: "unknown-model", category: "unknown" },
  ] };
  function transport() {
    return vi.fn<typeof fetch>(async (url) => String(url).includes("/models")
      ? Response.json(connector.definitionId === "apimart" ? modelResponse : { success: true, data: modelResponse.data.map((row) => ({ model_id: row.id, types: ({ chat: "llm", image: "image_generation", video: "video", audio: "tts", unknown: "" })[row.category] })) })
      : Response.json({ choices: [{ message: { content: "reply" } }] }));
  }
  function sendAction(model: string, fetchImpl: typeof fetch) {
    return vi.fn(async () => {
      const thread = await createChatThread({ model });
      await appendChatMessage({ threadId: thread.id, role: "user", content: "draft", status: "complete" });
      return streamChatCompletions({ ...connector, model, messages: [{ role: "user", content: "draft" }] }, { fetchImpl });
    });
  }

  it.each(["image-model", "video-model", "audio-model"])("rejects known %s before any mutation or chat POST while preserving history", async (model) => {
    const oldThread = await createChatThread({ model });
    await appendChatMessage({ threadId: oldThread.id, role: "user", content: "saved history", status: "complete" });
    const fetchImpl = transport();
    const action = sendAction(model, fetchImpl);
    expect(await runWithCompatibleChatModel(connector, model, action, { fetchImpl })).toMatchObject({ ok: false, message: expect.stringContaining("无法用于对话") });
    expect(action).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
    expect(await db.chatThreads.count()).toBe(1);
    expect(await db.chatMessages.toArray()).toEqual([expect.objectContaining({ content: "saved history" })]);
  });

  it.each(["unknown-model", "custom-video-chat", "chat-model"])("allows %s after successful metadata validation", async (model) => {
    const fetchImpl = transport();
    const action = sendAction(model, fetchImpl);
    expect(await runWithCompatibleChatModel(connector, model, action, { fetchImpl })).toMatchObject({ ok: true, value: { ok: true, content: "reply" } });
    expect(action).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls.map((call) => call[1]?.method)).toEqual(["GET", "POST"]);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).model).toBe(model);
    expect(await db.chatMessages.count()).toBe(1);
  });

  it("preserves generic manual models without requiring category discovery", async () => {
    const fetchImpl = transport();
    const action = sendAction("image-model", fetchImpl);
    expect(await runWithCompatibleChatModel({ ...connector, definitionId: "openai-compatible" }, "image-model", action, { fetchImpl })).toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
  });

  it.each([Response.json({ error: { message: "offline" } }, { status: 503 }), Response.json({ data: {} })])("rejects failed/unusable metadata before mutations", async (response) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
    let draft = "unsent draft";
    const mutateAndSend = sendAction("custom", fetchImpl);
    const action = vi.fn(async () => {
      draft = "";
      return mutateAndSend();
    });
    expect(await runWithCompatibleChatModel(connector, "custom", action, { fetchImpl })).toMatchObject({ ok: false, message: expect.stringContaining("无法确认") });
    expect(action).not.toHaveBeenCalled();
    expect(draft).toBe("unsent draft");
    expect(await db.chatThreads.count()).toBe(0);
    expect(await db.chatMessages.count()).toBe(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each(["switch", "abort"] as const)("does not mutate or POST if %s happens while discovery is pending", async (mode) => {
    let resolve!: (value: Response) => void;
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>((done) => { resolve = done; }));
    const controller = new AbortController();
    let current = true;
    const action = sendAction("chat-model", fetchImpl);
    const pending = runWithCompatibleChatModel(connector, "chat-model", action, { fetchImpl, signal: controller.signal, isCurrent: () => current });
    expect(action).not.toHaveBeenCalled();
    if (mode === "switch") current = false;
    else controller.abort();
    resolve(Response.json(connector.definitionId === "apimart" ? modelResponse : { success: true, data: modelResponse.data.map((row) => ({ model_id: row.id, types: ({ chat: "llm", image: "image_generation", video: "video", audio: "tts", unknown: "" })[row.category] })) }));
    expect(await pending).toMatchObject({ ok: false, aborted: true });
    expect(action).not.toHaveBeenCalled();
    expect(await db.chatThreads.count()).toBe(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects blank models before creating an empty thread or calling a provider", async () => {
    const fetchImpl = transport();
    const action = sendAction("", fetchImpl);
    expect(await runWithCompatibleChatModel(connector, " ", action, { fetchImpl })).toMatchObject({ ok: false });
    expect(action).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await db.chatThreads.count()).toBe(0);
  });
});

describe("AIHubMix catalog compatibility and read-only probe", () => {
  it("uses public metadata, separates input vision from media output, and resolves duplicate conflicts", async () => {
    const rows = [
      { model_id: "vision-chat", types: "llm", input_modalities: "text,image,video", output_modalities: "text", endpoints: "chat_completions,responses" },
      { model_id: "unannotated-endpoints", types: "llm" },
      { model_id: "legacy-chat", types: "t2t" },
      { model_id: "image", types: "t2i" },
      { model_id: "video", types: "t2v" },
      { model_id: "embedding", types: "embedding" },
      { model_id: "rerank", types: "reranking" },
      { model_id: "responses-only", types: "llm", endpoints: "responses" },
      { model_id: "mixed-output", types: "llm", output_modalities: "text,image" },
      { model_id: "conflict", types: "llm" },
      { model_id: "conflict", types: "image_generation" },
      { model_id: "uncertain", types: "llm" },
      { model_id: "uncertain" },
      { model_id: "future", types: "future" },
      { model_id: "malformed", types: "llm", endpoints: 42 },
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ success: true, data: rows }));
    const result = await discoverConnectorChatModels(aihubmix, { fetchImpl });
    expect(result).toEqual({ ok: true, models: ["legacy-chat", "unannotated-endpoints", "vision-chat"], incompatibleModels: ["image", "video", "embedding", "rerank", "responses-only", "mixed-output", "conflict"] });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://aihubmix.com/api/v1/models");
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).has("Authorization")).toBe(false);
    const all = await listConnectorModels(aihubmix, "all", fetchImpl);
    expect(all.ok && all.models).toHaveLength(13);
  });

  it("tests key access via authenticated task-list GET, not the public model directory", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ object: "list", data: [], has_more: false, next_after: null }));
    expect(await testConnectorConnection(aihubmix, fetchImpl)).toEqual({ ok: true, via: "authenticated-read" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe("https://aihubmix.com/ai/v1/images?limit=1");
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer test-key");
  });

  it.each([401, 403, 404, 500])("does not use public discovery or paid fallback after HTTP %s", async (status) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ error: { message: "denied" } }, { status }));
    expect(await testConnectorConnection(aihubmix, fetchImpl)).toMatchObject({ ok: false });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
  });
});
