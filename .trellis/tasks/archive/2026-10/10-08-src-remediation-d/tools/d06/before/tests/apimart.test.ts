import { describe, expect, it, vi } from "vitest";
import {
  APIMART_MAX_IMAGE_BYTES,
  getApimartTask,
  listApimartModels,
  submitApimartImageGeneration,
  submitApimartVideoGeneration,
  testApimartConnection,
  uploadApimartImage,
} from "@/lib/ai/apimart";

const credentials = { baseUrl: " https://api.apimart.ai/v1/ ", apiKey: " sk-secret-key " };
const fetchResponse = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => Response.json(body, { status }));
const submitted = { code: 200, data: [{ task_id: "task-1", status: "submitted" }, { task_id: "task-2", status: "pending" }] };

describe("APIMart model discovery and probe", () => {
  it("preserves categories, tags and native schema while explicitly marking metadata gaps", async () => {
    const parameters = {
      method: "POST", endpoint: "https://untrusted.example/collect-key", operation: "video_generation",
      input_schema: { type: "object", required: ["model"], properties: { size: { enum: ["720p"] } } },
    };
    const fetchImpl = fetchResponse({ success: true, data: [
      { id: "gpt-4o", category: "chat", capability_tags: ["Text", "Vision"] },
      { id: "seedance", category: "video", parameters },
      { id: "custom", category: "future-category" },
      { id: "uncatalogued" },
      { id: "malformed", parameters: { input_schema: [] } },
      { id: "malformed-properties", parameters: { input_schema: { properties: [] } } },
    ] });
    const result = await listApimartModels(credentials, { expand: "parameters", category: "video" }, { fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.models).toMatchObject([
      { id: "gpt-4o", category: "chat", capabilityTags: ["Text", "Vision"], parameterStatus: "missing" },
      { id: "seedance", category: "video", parameters, parameterStatus: "available" },
      { id: "custom", category: "future-category" },
      { id: "uncatalogued", category: "unknown", parameterStatus: "missing" },
      { id: "malformed", parameterStatus: "invalid" },
      { id: "malformed-properties", parameterStatus: "invalid" },
    ]);
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://api.apimart.ai/v1/models?expand=parameters&category=video", expect.objectContaining({
      method: "GET", headers: { Authorization: "Bearer sk-secret-key" }, redirect: "error", credentials: "omit",
    }));
  });

  it("uses a read-only probe and never falls back after a missing models route", async () => {
    const fetchImpl = fetchResponse({ error: { message: "missing" } }, 404);
    expect(await testApimartConnection(credentials, { fetchImpl })).toMatchObject({ ok: false, kind: "http", httpStatus: 404 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe("GET");
    expect(await testApimartConnection(credentials, { fetchImpl: fetchResponse({ data: [{ id: "chat" }] }) })).toEqual({ ok: true, modelCount: 1 });
  });

  it.each([{}, { data: {} }, { data: [null] }, { data: [{ id: " " }] }])("rejects malformed model lists %j", async (payload) => {
    expect(await listApimartModels(credentials, {}, { fetchImpl: fetchResponse(payload) })).toMatchObject({ ok: false, kind: "protocol" });
  });

  it("allows an empty authorized model list", async () => {
    expect(await listApimartModels(credentials, {}, { fetchImpl: fetchResponse({ data: [] }) })).toEqual({ ok: true, models: [] });
  });
});

describe("APIMart native generation submission", () => {
  it("posts image parameters unchanged and preserves every returned task", async () => {
    const fetchImpl = fetchResponse(submitted);
    const input = { model: "gpt-image-1", prompt: "城市夜景", n: 2, size: "1536x1024", quality: "high", image_urls: ["https://upload.example/reference.png"] };
    expect(await submitApimartImageGeneration(credentials, input, { fetchImpl })).toEqual({ ok: true, tasks: [
      { id: "task-1", providerStatus: "submitted" }, { id: "task-2", providerStatus: "pending" },
    ] });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://api.apimart.ai/v1/images/generations", expect.objectContaining({
      method: "POST", headers: { Authorization: "Bearer sk-secret-key", "Content-Type": "application/json" }, body: JSON.stringify(input),
    }));
  });

  it.each([
    { model: "seedance-2.0", prompt: "平移镜头", size: "720p", generate_audio: true, image_with_roles: [{ url: "https://upload.example/first.png", role: "first_frame" }, { url: "https://upload.example/last.png", role: "last_frame" }] },
    { model: "sora-2", prompt: "平移镜头", aspect_ratio: "16:9", duration: 10, watermark: false },
  ])("retains video native fields for $model", async (input) => {
    const fetchImpl = fetchResponse(submitted);
    expect((await submitApimartVideoGeneration(credentials, input, { fetchImpl })).ok).toBe(true);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.apimart.ai/v1/videos/generations");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(input);
  });

  it.each([{ code: 200, data: [] }, { code: 200, data: [{ task_id: "" }] }, { code: 200, data: [{ task_id: "good" }, {}] }, { data: [{ task_id: "task" }] }])("rejects invalid submit envelopes %j", async (payload) => {
    expect(await submitApimartImageGeneration(credentials, { model: "any" }, { fetchImpl: fetchResponse(payload) })).toMatchObject({ ok: false, kind: "protocol" });
  });

  it("accepts Ext 202 object task ids without treating them as multiple tasks", async () => {
    const fetchImpl = fetchResponse({ code: 202, data: { id: "ext-task-1", status: "submitted", poll_url: "https://api.apimart.ai/v1/tasks/ext-task-1" } });
    expect(await submitApimartImageGeneration(credentials, { model: "gpt-image-2.5-ext", prompt: "夜景", version: "flare" }, { fetchImpl })).toEqual({
      ok: true, tasks: [{ id: "ext-task-1", providerStatus: "submitted" }],
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("keeps Image 2 and video success on code 200 task-id arrays", async () => {
    const imageFetch = fetchResponse({ code: 200, data: [{ task_id: "image-2", status: "submitted" }] });
    expect(await submitApimartImageGeneration(credentials, { model: "gpt-image-2", prompt: "街景" }, { fetchImpl: imageFetch })).toEqual({
      ok: true, tasks: [{ id: "image-2", providerStatus: "submitted" }],
    });
    const videoFetch = fetchResponse({ code: 202, data: { id: "video-object" } });
    expect(await submitApimartVideoGeneration(credentials, { model: "MiniMax-H3", prompt: "镜头" }, { fetchImpl: videoFetch })).toMatchObject({ ok: false, kind: "protocol" });
    expect(videoFetch).toHaveBeenCalledOnce();
  });

  it("attaches Ext response-version and idempotency headers only for Ext image submits", async () => {
    const extFetch = fetchResponse({ code: 200, data: [{ task_id: "ext-1", status: "submitted" }] });
    expect((await submitApimartImageGeneration(credentials, { model: "gpt-image-2.5-ext", prompt: "夜景", version: "sunburst", resolution: "2K" }, {
      fetchImpl: extFetch, idempotencyKey: "job-stable-id",
    })).ok).toBe(true);
    expect(extFetch).toHaveBeenCalledExactlyOnceWith("https://api.apimart.ai/v1/images/generations", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer sk-secret-key",
        "Content-Type": "application/json",
        "X-APIMart-Response-Version": "2026-07-27",
        "Idempotency-Key": "job-stable-id",
      },
    }));
    const flareFetch = fetchResponse(submitted);
    expect((await submitApimartImageGeneration(credentials, { model: "gpt-image-2.5-flare", prompt: "街景", quality: "auto" }, {
      fetchImpl: flareFetch, idempotencyKey: "job-stable-id",
    })).ok).toBe(true);
    expect(flareFetch.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: "Bearer sk-secret-key",
      "Content-Type": "application/json",
    });
    const videoFetch = fetchResponse(submitted);
    expect((await submitApimartVideoGeneration(credentials, { model: "MiniMax-H3", prompt: "镜头" }, {
      fetchImpl: videoFetch, idempotencyKey: "job-stable-id",
    })).ok).toBe(true);
    expect(videoFetch.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: "Bearer sk-secret-key",
      "Content-Type": "application/json",
    });
  });

  it("does not retry an ambiguous paid submission failure or expose raw transport errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new TypeError("request failed with sk-secret-key"); });
    const result = await submitApimartVideoGeneration(credentials, { model: "any" }, { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "network" });
    expect(JSON.stringify(result)).not.toContain("sk-secret-key");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects empty models and non-finite parameters before serialization or submission", async () => {
    const fetchImpl = fetchResponse(submitted);
    for (const input of [{ model: " " }, { model: "sora-2", duration: Number.NaN }]) {
      expect(await submitApimartVideoGeneration(credentials, input, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("APIMart image uploads", () => {
  it("uploads File as multipart without a manual content-type and preserves provider metadata", async () => {
    const file = new File(["image"], "frame.png", { type: "image/png" });
    const fetchImpl = fetchResponse({ url: "https://upload.apimart.ai/frame.png", filename: "frame.png", content_type: "image/png", bytes: 5, created_at: 1000 });
    expect(await uploadApimartImage(credentials, file, { fetchImpl })).toEqual({ ok: true, image: {
      url: "https://upload.apimart.ai/frame.png", filename: "frame.png", contentType: "image/png", bytes: 5, createdAt: 1000, expiresAt: 260200,
    } });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.apimart.ai/v1/uploads/images");
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    const body = init?.body;
    expect(body).toBeInstanceOf(FormData);
    if (!(body instanceof FormData)) return;
    const uploaded = body.get("file");
    expect(uploaded).toBeInstanceOf(File);
    expect((uploaded as File).name).toBe("frame.png");
    expect(await (uploaded as File).text()).toBe("image");
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])("accepts supported Blob type %s", async (type) => {
    const fetchImpl = fetchResponse({ url: "https://upload.example/reference" });
    expect((await uploadApimartImage(credentials, new Blob(["data"], { type }), { fetchImpl, filename: "custom-image" })).ok).toBe(true);
  });

  it("enforces the documented size boundary and rejects empty or unsupported files before fetch", async () => {
    const fetchImpl = fetchResponse({ url: "https://upload.example/reference" });
    for (const file of [new Blob([], { type: "image/png" }), new Blob(["svg"], { type: "image/svg+xml" }), new Blob([new Uint8Array(APIMART_MAX_IMAGE_BYTES + 1)], { type: "image/png" })]) {
      expect(await uploadApimartImage(credentials, file, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await uploadApimartImage(credentials, new Blob([new Uint8Array(APIMART_MAX_IMAGE_BYTES)], { type: "image/png" }), { fetchImpl })).ok).toBe(true);
  });

  it.each([{}, { data: { url: "https://upload.example/image" } }, { url: "javascript:alert(1)" }])("rejects malformed upload envelopes %j", async (body) => {
    expect(await uploadApimartImage(credentials, new Blob(["image"], { type: "image/png" }), { fetchImpl: fetchResponse(body) })).toMatchObject({ ok: false, kind: "protocol" });
  });
});

describe("APIMart one-shot task query", () => {
  it.each(["pending", "processing", "completed", "failed", "cancelled", "future-status"])("preserves task state %s", async (status) => {
    const fetchImpl = fetchResponse({ code: 200, data: { id: "task/1?", status, progress: 80,
      ...(status === "completed" ? { result: { images: [{ url: ["https://media.example/1"] }] } } : {}),
      ...(status === "failed" ? { error: { code: 451, message: "sk-secret-key rejected", type: "policy" } } : {}),
    } });
    const result = await getApimartTask(credentials, "task/1?", { fetchImpl });
    expect(result).toMatchObject({ ok: true, task: { id: "task/1?", status: status === "future-status" ? "unknown" : status, providerStatus: status, progress: 80 } });
    if (status === "failed") {
      expect(result).toMatchObject({ task: { error: { code: 451, message: "[已隐藏] rejected", type: "policy" } } });
    }
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://api.apimart.ai/v1/tasks/task%2F1%3F?language=zh", expect.objectContaining({ method: "GET" }));
  });

  it("preserves all output URLs, their expiry and cost/timing metadata without fetching media", async () => {
    const fetchImpl = fetchResponse({ code: 200, data: { id: "task", status: "completed", progress: 100, cost: 0.15, credits_cost: 1.5, created: 1000, completed: 1019, estimated_time: 60, actual_time: 19,
      result: { images: [{ url: ["https://media.example/1", "https://media.example/2"], expires_at: 2000 }, { url: "https://media.example/3", expires_at: 2100 }], videos: [{ url: ["https://media.example/video1", "https://media.example/video2"], expires_at: 2200 }] },
    } });
    const result = await getApimartTask(credentials, "task", { fetchImpl });
    expect(result).toMatchObject({ ok: true, task: { images: [{ urls: ["https://media.example/1", "https://media.example/2"], expiresAt: 2000 }, { urls: ["https://media.example/3"], expiresAt: 2100 }], videos: [{ urls: ["https://media.example/video1", "https://media.example/video2"], expiresAt: 2200 }], cost: 0.15, creditsCost: 1.5, createdAt: 1000, completedAt: 1019, estimatedTime: 60, actualTime: 19 } });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([{}, { id: "task" }, { id: "other", status: "pending" }, { id: "task", status: "completed" }, { id: "task", status: "completed", result: { images: [{ url: [] }] } }, { id: "task", status: "pending", result: [] }, { id: "task", status: "completed", result: { videos: [{ url: ["https://media.example/a", 2] }] } }])("rejects malformed status data %j", async (data) => {
    expect(await getApimartTask(credentials, "task", { fetchImpl: fetchResponse({ code: 200, data }) })).toMatchObject({ ok: false, kind: "protocol" });
  });
});

describe("APIMart errors and cancellation", () => {
  it.each([200, 401, 429, 500])("reports provider errors and redacts keys for HTTP %s", async (status) => {
    const result = await listApimartModels(credentials, {}, { fetchImpl: fetchResponse({ error: { code: 402, type: "payment_required", message: "invalid sk-secret-key Bearer other-token" } }, status) });
    expect(result).toMatchObject({ ok: false, kind: status === 200 ? "provider" : "http", httpStatus: status, providerCode: 402, providerType: "payment_required" });
    expect(JSON.stringify(result)).not.toMatch(/sk-secret-key|other-token/);
  });

  it.each([{ success: false, message: "rejected" }, { code: 402, message: "balance" }])("detects unsuccessful provider envelope %j", async (body) => {
    expect(await listApimartModels(credentials, {}, { fetchImpl: fetchResponse(body) })).toMatchObject({ ok: false, kind: "provider" });
  });

  it("handles invalid JSON and HTML errors without exposing raw response text", async () => {
    expect(await listApimartModels(credentials, {}, { fetchImpl: async () => new Response("invalid JSON") })).toMatchObject({ ok: false, kind: "protocol" });
    const result = await listApimartModels(credentials, {}, { fetchImpl: async () => new Response("<html>sk-secret-key</html>", { status: 502 }) });
    expect(result).toMatchObject({ ok: false, kind: "http", httpStatus: 502 });
    expect(JSON.stringify(result)).not.toContain("sk-secret-key");
  });

  it("forwards the abort signal and does not retry or remotely cancel a submitted job", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    expect(await submitApimartVideoGeneration(credentials, { model: "sora-2" }, { fetchImpl, signal: controller.signal })).toMatchObject({ ok: false, kind: "aborted" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    fetchImpl.mockClear();
    expect(await getApimartTask(credentials, "task", { fetchImpl, signal: controller.signal })).toMatchObject({ ok: false, kind: "aborted" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recognizes abort during response body consumption", async () => {
    const response = new Response();
    vi.spyOn(response, "json").mockRejectedValue(new DOMException("aborted", "AbortError"));
    expect(await testApimartConnection(credentials, { fetchImpl: async () => response })).toMatchObject({ ok: false, kind: "aborted" });
  });

  it.each([
    { baseUrl: "", apiKey: "key" }, { baseUrl: "https://api.apimart.ai/v1", apiKey: "" },
    { baseUrl: "https://name:password@example.com/v1", apiKey: "key" },
    { baseUrl: "https://example.com/v1?token=abc", apiKey: "key" },
    { baseUrl: "data:text/plain,test", apiKey: "key" },
  ])("validates credentials before sending auth %j", async (input) => {
    const fetchImpl = fetchResponse({ data: [] });
    expect(await listApimartModels(input, {}, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
