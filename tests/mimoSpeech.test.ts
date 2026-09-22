import { describe, expect, it, vi } from "vitest";
import { generateMimoSpeech, listMimoModels, MIMO_MODELS, MIMO_REFERENCE_ENCODED_LIMIT, validateMimoReference } from "@/lib/ai/mimoSpeech";
import type { MimoSpeechSettings } from "@/domain/audio";

const credentials = { baseUrl: "https://proxy.example/mimo/v1/", apiKey: "secret-test-key" };
const wav = new Blob(["RIFF", new Uint8Array(4), "WAVEfmt ", new Uint8Array(32)], { type: "audio/wav" });
async function response(extra: Record<string, unknown> = {}) {
  const encoded = btoa(String.fromCharCode(...new Uint8Array(await wav.arrayBuffer())));
  return Response.json({ choices: [{ finish_reason: "stop", message: { audio: { data: encoded }, ...extra } }] });
}
const input = (mimo: MimoSpeechSettings) => ({ text: "你好。", voice: "mimo_default", mimo });

describe("MiMo native speech", () => {
  it("uses a fixed proxy-preserving endpoint, Bearer auth and separate instruction/target roles", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(await response());
    const result = await generateMimoSpeech(credentials, input({ mode: "preset", instruction: "轻声慢读" }), { fetchImpl });
    expect(result).toMatchObject({ ok: true, model: MIMO_MODELS.preset });
    expect(result.ok && result.blob.type).toBe("audio/wav");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe("https://proxy.example/mimo/v1/chat/completions");
    const init = fetchImpl.mock.calls[0][1]!;
    expect(init).toMatchObject({ method: "POST", redirect: "error", credentials: "omit" });
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer secret-test-key");
    expect(JSON.parse(String(init.body))).toEqual({ model: MIMO_MODELS.preset, stream: false, messages: [{ role: "user", content: "轻声慢读" }, { role: "assistant", content: "你好。" }], audio: { format: "wav", voice: "mimo_default" } });
  });

  it("omits assistant text only for explicitly optimized design and returns actual spoken text", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(await response({ final_text_preview: "自动撰写的播报稿。" }));
    expect(await generateMimoSpeech(credentials, { ...input({ mode: "design", instruction: "温柔女声", optimizeTextPreview: true }), text: "" }, { fetchImpl })).toMatchObject({ ok: true, finalTextPreview: "自动撰写的播报稿。", model: MIMO_MODELS.design });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ model: MIMO_MODELS.design, stream: false, messages: [{ role: "user", content: "温柔女声" }], audio: { format: "wav", optimize_text_preview: true } });
  });

  it("keeps design manuscript intact when optimization is disabled", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(await response());
    await generateMimoSpeech(credentials, input({ mode: "design", instruction: "成熟男声" }), { fetchImpl });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({ messages: [{ role: "user", content: "成熟男声" }, { role: "assistant", content: "你好。" }], audio: { optimize_text_preview: false } });
  });

  it.each([wav, new Blob(["ID3", new Uint8Array(60)], { type: "application/octet-stream" })])("serializes actual WAV/MP3 clone bytes only into transport", async referenceBlob => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(await response());
    const value = { ...input({ mode: "clone", instruction: "", referenceMediaId: "media-1" }), referenceBlob };
    expect(await generateMimoSpeech(credentials, value, { fetchImpl })).toMatchObject({ ok: true, model: MIMO_MODELS.clone });
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body.audio.voice).toMatch(/^data:audio\/(wav|mpeg);base64,/);
    expect(atob(body.audio.voice.split(",")[1]).length).toBe(referenceBlob.size);
    expect(body.messages).toEqual([{ role: "assistant", content: "你好。" }]);
    expect(body.audio).not.toHaveProperty("optimize_text_preview");
    expect(body).not.toHaveProperty("referenceMediaId");
    expect(value.mimo.referenceMediaId).toBe("media-1");
  });

  it("rejects forged MIME, unsupported formats and encoded oversize references before a paid request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const referenceBlob of [new Blob(["not audio"], { type: "audio/wav" }), new Blob(["OggS", new Uint8Array(80)], { type: "audio/wav" }), new Blob([new Uint8Array(MIMO_REFERENCE_ENCODED_LIMIT)])]) {
      expect(await generateMimoSpeech(credentials, { ...input({ mode: "clone", instruction: "", referenceMediaId: "ref" }), referenceBlob }, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("counts the data URI prefix in the encoded limit", async () => {
    const bytes = new Uint8Array(Math.floor(MIMO_REFERENCE_ENCODED_LIMIT / 4) * 3);
    bytes.set(new TextEncoder().encode("ID3"));
    await expect(validateMimoReference(new Blob([bytes]))).rejects.toThrow("10 MB");
  });

  it.each([
    { text: "", voice: "mimo_default", mimo: { mode: "preset", instruction: "" } },
    input({ mode: "design", instruction: "" }),
    input({ mode: "preset", instruction: "", optimizeTextPreview: true }),
    input({ mode: "design", instruction: "低声", referenceMediaId: "foreign" }),
    input({ mode: "clone", instruction: "", referenceMediaId: "missing" }),
    { ...input({ mode: "preset", instruction: "" }), voice: "alloy" },
  ])("rejects invalid mode-specific fields before transport", async value => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await generateMimoSpeech(credentials, value as ReturnType<typeof input>, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["https://name:password@example.com/v1", "https://example.com/v1?key=x", "https://example.com/v1#anchor", "file:///tmp/v1", "https://example.com/chat/completions"])("rejects unsafe or incorrect base %s", async baseUrl => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await generateMimoSpeech({ ...credentials, baseUrl }, input({ mode: "preset", instruction: "" }), { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([null, {}, { choices: [] }, { choices: [{ finish_reason: "length", message: { audio: { data: "UklGRg==" } } }] }, { choices: [{ finish_reason: "stop", message: { audio: { data: "invalid!" } } }] }])("reports malformed or truncated responses without retrying", async body => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
    expect(await generateMimoSpeech(credentials, input({ mode: "preset", instruction: "" }), { fetchImpl })).toMatchObject({ ok: false, kind: "protocol" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("redacts boundary-position and repeated credentials before truncating provider errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { message: "x".repeat(292) + credentials.apiKey + credentials.apiKey + " Bearer private-other-key" } }, { status: 401 }));
    const result = await generateMimoSpeech(credentials, input({ mode: "preset", instruction: "" }), { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "http" });
    expect(!result.ok && result.message).not.toContain("secret-test");
    expect(!result.ok && result.message).not.toContain("private-other-key");
  });

  it("reports HTTP-200 provider errors, network uncertainty and abort without replay", async () => {
    const value = input({ mode: "preset", instruction: "" });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ error: { message: "余额不足" } })).mockRejectedValueOnce(new Error(credentials.apiKey));
    expect(await generateMimoSpeech(credentials, value, { fetchImpl })).toMatchObject({ ok: false, kind: "provider" });
    const network = await generateMimoSpeech(credentials, value, { fetchImpl });
    expect(network).toMatchObject({ ok: false, kind: "network" });
    expect(!network.ok && network.message).not.toContain(credentials.apiKey);
    const controller = new AbortController(); controller.abort();
    expect(await generateMimoSpeech(credentials, value, { fetchImpl, signal: controller.signal })).toMatchObject({ ok: false, kind: "aborted" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses strict read-only model discovery", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: [{ id: MIMO_MODELS.preset }, { id: "mimo-v2.5", context_window: 1000 }] })).mockResolvedValueOnce(Response.json({ data: {} }));
    expect(await listMimoModels(credentials, { fetchImpl })).toMatchObject({ ok: true, models: ["mimo-v2.5", MIMO_MODELS.preset] });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://proxy.example/mimo/v1/models");
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
    expect(await listMimoModels(credentials, { fetchImpl })).toMatchObject({ ok: false });
  });
});

it("decodes a multi-megabyte WAV response without a recursive base64 pattern", async () => {
  const bytes = new Uint8Array(2 * 1024 * 1024);
  bytes.set(new TextEncoder().encode("RIFF")); bytes.set(new TextEncoder().encode("WAVE"), 8);
  let binary = "";
  for (let at = 0; at < bytes.length; at += 32768) binary += String.fromCharCode(...bytes.subarray(at, at + 32768));
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { audio: { data: btoa(binary) } } }] }));
  const result = await generateMimoSpeech(credentials, input({ mode: "preset", instruction: "" }), { fetchImpl });
  expect(result.ok && result.blob.size).toBe(bytes.length);
});
