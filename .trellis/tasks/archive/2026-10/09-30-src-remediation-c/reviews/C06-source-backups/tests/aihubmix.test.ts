import { describe, expect, it, vi } from "vitest";
import {
  downloadAIHubMixResult, getAIHubMixImageTask, getAIHubMixModelSchema, getAIHubMixVideoTask,
  listAIHubMixModels, submitAIHubMixImageGeneration, submitAIHubMixVideoGeneration, testAIHubMixConnection,
} from "@/lib/ai/aihubmix";
import type { AIHubMixGenerationRequest, AIHubMixImageGenerationRequest, AIHubMixTask } from "@/lib/ai/aihubmix";

const credentials = { baseUrl: " https://aihubmix.com/v1/ ", apiKey: " sk-secret-key " };
const fetchResponse = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => Response.json(body, { status }));
const taskBody = (overrides: Record<string, unknown> = {}) => ({
  id: "task_1", object: "image", model: "model", status: "pending", output: [], error: null,
  created_at: 1000, completed_at: null, expires_at: null, ...overrides,
});
const artifact = (index = 0) => ({ index, type: "file", content_type: "image/png", content_url: `https://aihubmix.com/ai/v1/images/task_1/content/result_${index}`, b64_json: null });
const completedTask = (): AIHubMixTask => ({
  id: "task_1", kind: "image", model: "model", providerStatus: "completed", status: "completed",
  outputs: [{ index: 0, type: "file", contentUrl: artifact().content_url, requiresAuthentication: true }],
});

describe("AIHubMix discovery and connection probe", () => {
  it("uses a public catalog without credentials and preserves classification metadata and duplicates", async () => {
    const fetchImpl = fetchResponse({ success: true, data: [
      { model_id: "vision", types: " llm,t2t ", endpoints: "chat_completions, responses", input_modalities: "text,image", output_modalities: "text", features: "reasoning", schema_checked: true },
      { model_id: "legacy-image", types: "t2i" }, { model_id: "legacy-video", types: "t2v" }, { model_id: "rank", types: "reranking" },
      { model_id: "custom", types: "future" }, { model_id: "unknown" }, { model_id: "vision", types: "image_generation" },
      { model_id: "broken", types: "llm", endpoints: 8 }, { model_id: "broken-array", types: ["llm", 3] },
    ] });
    const result = await listAIHubMixModels({ ...credentials, apiKey: "" }, { fetchImpl });
    expect(result).toMatchObject({ ok: true, models: [
      { id: "vision", types: ["llm"], endpoints: ["chat_completions", "responses"], inputModalities: ["text", "image"], outputModalities: ["text"], features: ["reasoning"], schemaChecked: true, metadataStatus: "available" },
      { types: ["image_generation"] }, { types: ["video"] }, { types: ["rerank"] }, { types: ["future"] },
      { id: "unknown", types: [], metadataStatus: "missing" }, { id: "vision", types: ["image_generation"] },
      { metadataStatus: "invalid" }, { metadataStatus: "invalid" },
    ] });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://aihubmix.com/api/v1/models", expect.objectContaining({ method: "GET", headers: {}, redirect: "error", credentials: "omit" }));
  });

  it("preserves unfamiliar type names even when they match object prototype keys", async () => {
    expect(await listAIHubMixModels(credentials, { fetchImpl: fetchResponse({ success: true, data: [
      { model_id: "custom", types: "constructor,__proto__,tostring" },
    ] }) })).toMatchObject({ ok: true, models: [{ types: ["constructor", "__proto__", "tostring"] }] });
  });

  it.each([{}, { data: [] }, { success: true, data: {} }, { success: true, data: [{}] }, { success: true, data: [{ model_id: " " }] }])("rejects malformed public catalog %j", async (body) => {
    expect(await listAIHubMixModels(credentials, { fetchImpl: fetchResponse(body) })).toMatchObject({ ok: false, kind: "protocol" });
  });

  it("keeps an empty public directory distinct from credential validation", async () => {
    expect(await listAIHubMixModels(credentials, { fetchImpl: fetchResponse({ success: true, data: [] }) })).toEqual({ ok: true, models: [] });
    const fetchImpl = fetchResponse({ object: "list", data: [], has_more: false, next_after: null });
    expect(await testAIHubMixConnection(credentials, { fetchImpl })).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://aihubmix.com/ai/v1/images?limit=1", expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer sk-secret-key" } }));
  });

  it.each([{}, { object: "list", data: [] }, { object: "list", data: [null], has_more: false, next_after: null }, { success: true, data: [{ model_id: "public" }] }])("does not validate a key using an invalid list %j", async (body) => {
    expect(await testAIHubMixConnection(credentials, { fetchImpl: fetchResponse(body) })).toMatchObject({ ok: false, kind: "protocol" });
  });

  it.each([401, 403, 404])("never falls back to generation after probe failure %s", async (status) => {
    const fetchImpl = fetchResponse({ error: { code: "async_not_enabled", message: "Enable async" } }, status);
    expect(await testAIHubMixConnection(credentials, { fetchImpl })).toMatchObject({ ok: false, kind: "http", httpStatus: status, providerCode: "async_not_enabled" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe("GET");
  });
});

describe("AIHubMix optional model schema", () => {
  it("selects native POST by path, encodes model names and does not execute returned endpoint URLs", async () => {
    const schema = { type: "object", properties: { extra: { type: "object" } }, required: ["model", "prompt"] };
    const fetchImpl = fetchResponse({ modality: "image", endpoints: [
      { path: "/v1/images/generations", method: "POST", request: { schema: {} } },
      { path: "/ai/v1/images/generations", method: "GET", request: { schema: {} } },
      { path: "/ai/v1/images/generations", method: "POST", endpoint: "https://untrusted.example/collect-key", request: { schema } },
    ] });
    expect(await getAIHubMixModelSchema(credentials, "vendor/model", "image", { fetchImpl })).toEqual({ ok: true, status: "available", path: "/ai/v1/images/generations", schema });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://aihubmix.com/call/schema/models/vendor%2Fmodel/endpoints", expect.objectContaining({ headers: {} }));
  });

  it.each([
    [{ modality: "video", endpoints: [] }, "missing"],
    [{ modality: "image", endpoints: [] }, "invalid"],
    [{ modality: "video" }, "invalid"],
    [{ modality: "video", endpoints: [{ path: "/ai/v1/videos", method: "POST", request: { schema: { properties: [] } } }] }, "invalid"],
    [{ modality: "video", endpoints: [null] }, "invalid"],
  ])("distinguishes missing and malformed schemas", async (body, status) => {
    expect(await getAIHubMixModelSchema(credentials, "model", "video", { fetchImpl: fetchResponse(body) })).toMatchObject({ ok: true, status });
  });

  it.each([404, 500])("keeps schema HTTP %s as an explicit failure", async (status) => {
    expect(await getAIHubMixModelSchema(credentials, "model", "image", { fetchImpl: fetchResponse({ error: { code: "model_not_found", message: "missing" } }, status) })).toMatchObject({ ok: false, kind: "http", httpStatus: status });
  });
});

describe("AIHubMix native submissions", () => {
  it.each([undefined, false, true])("preserves image sync/async choice %s, references, masks and extension fields", async (async) => {
    const input = { model: "gpt-image-2", prompt: "街景", ...(async === undefined ? {} : { async }), n: 2,
      images: [{ url: "https://reference.example/1" }], mask: { b64_json: "YWJj" }, size: "1024x1024", extra: { quality: "high" }, response_format: "b64_json" };
    const fetchImpl = fetchResponse(taskBody({ status: "completed", output: [artifact(), { index: 1, type: "file", b64_json: "YWJj", content_url: null }] }));
    expect(await submitAIHubMixImageGeneration(credentials, input, { fetchImpl })).toMatchObject({ ok: true, task: { outputs: [{ index: 0, contentUrl: artifact().content_url }, { index: 1, b64Json: "YWJj" }] } });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://aihubmix.com/ai/v1/images/generations", expect.objectContaining({ method: "POST", body: JSON.stringify(input), headers: { Authorization: "Bearer sk-secret-key", "Content-Type": "application/json" } }));
  });

  it("preserves video duration and reference roles and performs exactly one native submission", async () => {
    const input = { model: "seedance", prompt: "缓慢推镜", duration: 8,
      input_references: [{ type: "image_url", url: "https://ref.example/image" }],
      frame_images: [{ frame_type: "first_frame", image_url: { url: "https://ref.example/first-frame" } }],
      generate_audio: true, extra: { custom: "value" } };
    const fetchImpl = fetchResponse(taskBody({ object: "video", status: "in_progress" }));
    expect(await submitAIHubMixVideoGeneration(credentials, input, { fetchImpl })).toMatchObject({ ok: true, task: { kind: "video", status: "running" } });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://aihubmix.com/ai/v1/videos", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
  });

  it.each([{ model: "", prompt: "x" }, { model: "m", prompt: " " }, { model: "m", prompt: "x", async: "true" }, { model: "m", prompt: "x", n: NaN }])("rejects invalid parameters before paying %j", async (input) => {
    const fetchImpl = fetchResponse(taskBody());
    expect(await submitAIHubMixImageGeneration(credentials, input as AIHubMixImageGenerationRequest, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([1.5, -1, NaN])("rejects invalid duration %s", async (duration) => {
    const fetchImpl = fetchResponse(taskBody());
    expect(await submitAIHubMixVideoGeneration(credentials, { model: "m", prompt: "p", duration }, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects cycles without throwing or submitting", async () => {
    const input: AIHubMixGenerationRequest = { model: "m", prompt: "p" };
    input.extra = input as { [key: string]: string };
    const fetchImpl = fetchResponse(taskBody());
    expect(await submitAIHubMixImageGeneration(credentials, input, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("AIHubMix separate task details", () => {
  it.each([["pending", "queued"], ["in_progress", "running"], ["completed", "completed"], ["failed", "failed"], ["cancelled", "cancelled"], ["future", "unknown"], ["constructor", "unknown"], ["__proto__", "unknown"], [undefined, "unknown"]])("normalizes %s without inferring completion", async (status, expected) => {
    const fetchImpl = fetchResponse(taskBody({ status, ...(status === "completed" ? { output: [artifact()] } : {}) }));
    expect(await getAIHubMixImageTask(credentials, "task_1", { fetchImpl })).toMatchObject({ ok: true, task: { id: "task_1", status: expected, createdAt: 1000, completedAt: null, expiresAt: null } });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://aihubmix.com/ai/v1/images/task_1", expect.objectContaining({ method: "GET" }));
  });

  it("keeps a failed task as a successful read with redacted error details", async () => {
    const fetchImpl = fetchResponse(taskBody({ object: "video", status: "failed", error: { code: "upstream_rejected", message: "sk-secret-key denied", upstream_detail: { nested: ["Bearer other-secret", "sk-secret-key"] } } }));
    const result = await getAIHubMixVideoTask(credentials, "task_1", { fetchImpl });
    expect(result).toMatchObject({ ok: true, task: { status: "failed", error: { code: "upstream_rejected", message: "[已隐藏] denied" } } });
    expect(JSON.stringify(result)).not.toMatch(/sk-secret-key|other-secret/);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://aihubmix.com/ai/v1/videos/task_1");
  });

  it("preserves all outputs and timestamps without fetching media", async () => {
    const fetchImpl = fetchResponse(taskBody({ status: "completed", completed_at: 1010, expires_at: 2000, output: [artifact(1), artifact(0)] }));
    expect(await getAIHubMixImageTask(credentials, "task_1", { fetchImpl })).toMatchObject({ ok: true, task: { completedAt: 1010, expiresAt: 2000, outputs: [{ index: 1, requiresAuthentication: true }, { index: 0 }] } });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([
    {}, taskBody({ id: "other" }), taskBody({ object: "video" }), taskBody({ status: "completed" }), taskBody({ output: null }),
    taskBody({ output: [{ index: 0, type: "file" }] }), taskBody({ output: [artifact(), artifact()] }),
    taskBody({ created_at: "1000" }), taskBody({ output: [artifact(), { ...artifact(1), b64_json: 8 }] }), taskBody({ error: "failed" }),
  ])("rejects wrong identity, kind and malformed task data %j", async (body) => {
    expect(await getAIHubMixImageTask(credentials, "task_1", { fetchImpl: fetchResponse(body) })).toMatchObject({ ok: false, kind: "protocol" });
  });
});

describe("AIHubMix protected result retrieval", () => {
  it("explicitly fetches the selected result with auth and returns a Blob", async () => {
    const task = completedTask();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("image bytes", { headers: { "Content-Type": "image/png" } }));
    const result = await downloadAIHubMixResult(credentials, task, task.outputs[0]!, { fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await result.blob.text()).toBe("image bytes");
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(artifact().content_url, expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer sk-secret-key" }, redirect: "error", credentials: "omit" }));
  });

  it("supports proxy prefixes and the video's fixed content route", async () => {
    const proxy = { baseUrl: "https://proxy.example/provider/v1", apiKey: "key" };
    const task: AIHubMixTask = { ...completedTask(), kind: "video", outputs: [{ index: 0, type: "file", requiresAuthentication: true, contentUrl: "/provider/ai/v1/videos/task_1/content" }] };
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("video", { headers: { "Content-Type": "video/mp4" } }));
    expect((await downloadAIHubMixResult(proxy, task, task.outputs[0]!, { fetchImpl })).ok).toBe(true);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://proxy.example/provider/ai/v1/videos/task_1/content");
  });

  it.each([
    "https://evil.example/ai/v1/images/task_1/content/result_0",
    "https://name:password@aihubmix.com/ai/v1/images/task_1/content/result_0",
    "https://aihubmix.com/ai/v1/images/other/content/result_0",
    "https://aihubmix.com/ai/v1/images/task_1/content/result_0?redirect=evil",
    "https://aihubmix.com/ai/v1/images/task_1/content/result_0#fragment",
    "https://aihubmix.com/ai/v1/images/task_1/content/%2fother",
    "https://aihubmix.com/ai/v1/images/task_1/content/%252fother",
    "https://aihubmix.com/ai/v1/images/task_1/content/../other",
    "https://aihubmix.com/v1/chat/completions", "javascript:alert(1)",
  ])("does not leak a key to untrusted URL %s", async (contentUrl) => {
    const task = completedTask(); task.outputs[0]!.contentUrl = contentUrl;
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await downloadAIHubMixResult(credentials, task, task.outputs[0]!, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects unselected output, pending tasks and inline-only content without fetch", async () => {
    const task = completedTask(); const fetchImpl = vi.fn<typeof fetch>();
    expect(await downloadAIHubMixResult(credentials, task, { ...task.outputs[0]!, index: 3 }, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(await downloadAIHubMixResult(credentials, { ...task, status: "running" }, task.outputs[0]!, { fetchImpl })).toMatchObject({ ok: false, providerCode: "result_not_ready" });
    task.outputs[0]!.contentUrl = undefined; task.outputs[0]!.b64Json = "YWJj";
    expect(await downloadAIHubMixResult(credentials, task, task.outputs[0]!, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([[409, "result_not_ready"], [410, "artifact_expired"], [429, "too_many_downloads"]])("preserves result HTTP %s", async (status, code) => {
    const task = completedTask();
    expect(await downloadAIHubMixResult(credentials, task, task.outputs[0]!, { fetchImpl: fetchResponse({ error: { code, message: "not available" } }, status as number) })).toMatchObject({ ok: false, kind: "http", httpStatus: status, providerCode: code });
  });

  it("does not return JSON errors or empty files as binary success", async () => {
    const task = completedTask();
    expect(await downloadAIHubMixResult(credentials, task, task.outputs[0]!, { fetchImpl: fetchResponse({ error: { code: "upstream", message: "failed" } }) })).toMatchObject({ ok: false, kind: "provider" });
    expect(await downloadAIHubMixResult(credentials, task, task.outputs[0]!, { fetchImpl: async () => new Response("") })).toMatchObject({ ok: false, kind: "protocol" });
  });
});

describe("AIHubMix failure and abort boundaries", () => {
  it.each([200, 401, 429, 500])("redacts keys from request errors HTTP %s", async (status) => {
    const result = await listAIHubMixModels(credentials, { fetchImpl: fetchResponse({ error: { code: "sk-secret-key", type: "Bearer other-secret", message: "sk-secret-key refused" } }, status) });
    expect(result).toMatchObject({ ok: false, kind: status === 200 ? "provider" : "http", httpStatus: status });
    expect(JSON.stringify(result)).not.toMatch(/sk-secret-key|other-secret/);
  });

  it("does not retry a lost paid response or expose the transport error", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error("sk-secret-key transport"); });
    const result = await submitAIHubMixVideoGeneration(credentials, { model: "m", prompt: "p" }, { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "network" });
    expect(JSON.stringify(result)).not.toContain("sk-secret-key");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("handles malformed success JSON and HTML failures", async () => {
    expect(await listAIHubMixModels(credentials, { fetchImpl: async () => new Response("invalid") })).toMatchObject({ ok: false, kind: "protocol" });
    expect(await listAIHubMixModels(credentials, { fetchImpl: async () => new Response("sk-secret-key", { status: 502 }) })).toMatchObject({ ok: false, kind: "http", httpStatus: 502 });
  });

  it("forwards abort without retries or remote cancellation and skips pre-aborted requests", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => { expect(init?.signal).toBe(controller.signal); controller.abort(); throw new DOMException("abort", "AbortError"); });
    expect(await submitAIHubMixVideoGeneration(credentials, { model: "m", prompt: "p" }, { fetchImpl, signal: controller.signal })).toMatchObject({ ok: false, kind: "aborted" });
    expect(fetchImpl).toHaveBeenCalledOnce(); fetchImpl.mockClear();
    expect(await testAIHubMixConnection(credentials, { fetchImpl, signal: controller.signal })).toMatchObject({ ok: false, kind: "aborted" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recognizes abort during JSON and binary consumption", async () => {
    const jsonResponse = new Response(); vi.spyOn(jsonResponse, "json").mockRejectedValue(new DOMException("abort", "AbortError"));
    expect(await testAIHubMixConnection(credentials, { fetchImpl: async () => jsonResponse })).toMatchObject({ ok: false, kind: "aborted" });
    const binaryResponse = new Response("x"); vi.spyOn(binaryResponse, "blob").mockRejectedValue(new DOMException("abort", "AbortError"));
    const task = completedTask();
    expect(await downloadAIHubMixResult(credentials, task, task.outputs[0]!, { fetchImpl: async () => binaryResponse })).toMatchObject({ ok: false, kind: "aborted" });
  });

  it.each(["", "https://aihubmix.com", "https://aihubmix.com/v2", "https://name:pass@aihubmix.com/v1", "https://aihubmix.com/v1?key=secret", "https://aihubmix.com/v1#hash", "data:text/plain,v1"])("rejects unsupported base URL %s before sending auth", async (baseUrl) => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await testAIHubMixConnection({ ...credentials, baseUrl }, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects empty keys only on protected operations and routes through configured proxy prefixes", async () => {
    const fetchImpl = fetchResponse({ object: "list", data: [], has_more: false, next_after: null });
    expect(await testAIHubMixConnection({ ...credentials, apiKey: "" }, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await testAIHubMixConnection({ ...credentials, baseUrl: "https://proxy.example/aihubmix/v1/" }, { fetchImpl })).toEqual({ ok: true });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://proxy.example/aihubmix/ai/v1/images?limit=1");
  });
});
