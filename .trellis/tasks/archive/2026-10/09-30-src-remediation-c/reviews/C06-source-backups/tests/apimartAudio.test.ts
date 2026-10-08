import { describe, expect, it, vi } from "vitest";
import { generateApimartSpeech, submitApimartMusic, getApimartMusicTask, downloadApimartAudio, type SpeechInput } from "@/lib/ai/apimartAudio";

const credentials = { baseUrl: "https://api.apimart.ai/v1/", apiKey: "test-secret" };
const speech: SpeechInput = { model: "gpt-4o-mini-tts", input: "你好", voice: "alloy", response_format: "wav", speed: 1 };
const json = (body: unknown) => vi.fn<typeof fetch>(async () => Response.json(body));

describe("APIMart audio wire contracts", () => {
  it("accepts Unicode character limits and sends only a binary speech request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([82, 73, 70, 70]), { headers: { "Content-Type": "audio/wav" } }));
    const result = await generateApimartSpeech(credentials, { ...speech, input: "🎙".repeat(4096) }, { fetchImpl });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://api.apimart.ai/v1/audio/speech", expect.objectContaining({ method: "POST", redirect: "error", credentials: "omit" }));
    expect(await generateApimartSpeech(credentials, { ...speech, input: "🎙".repeat(4097) }, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("does not save successful HTTP JSON errors or HTML as speech", async () => {
    const result = await generateApimartSpeech(credentials, speech, { fetchImpl: json({ error: { message: "test-secret refused Bearer another-secret" } }) });
    expect(result).toMatchObject({ ok: false, kind: "provider" });
    expect(JSON.stringify(result)).not.toContain("test-secret");
    expect(JSON.stringify(result)).not.toContain("another-secret");
    expect(await generateApimartSpeech(credentials, speech, { fetchImpl: vi.fn(async () => new Response("<html>error</html>", { headers: { "Content-Type": "text/html" } })) })).toMatchObject({ ok: false, kind: "protocol" });
  });
  it("preserves Flow native fields and rejects an invented instrumental flag", async () => {
    const fetchImpl = json({ code: 200, data: [{ task_id: "flow-1" }] });
    const input = { model: "flowmusic" as const, sound_prompt: "quiet piano", bpm: "88", length: 120, seed: "0" };
    expect(await submitApimartMusic(credentials, input, { fetchImpl })).toEqual({ ok: true, taskIds: ["flow-1"] });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual(input);
    expect(await submitApimartMusic(credentials, { ...input, instrumental: true } as typeof input, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("validates Suno mode-specific fields and preserves numeric zero", async () => {
    const fetchImpl = json({ code: 200, data: [{ task_id: "suno-1" }] });
    const input = { model: "suno" as const, version: "v6" as const, custom: true, instrumental: true, style: "piano", duration: 90, style_weight: 0 };
    expect((await submitApimartMusic(credentials, input, { fetchImpl })).ok).toBe(true);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual(input);
    expect(await submitApimartMusic(credentials, { ...input, custom: false, prompt: "a song" }, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("queries the music route and preserves all original source indexes", async () => {
    const fetchImpl = json({ code: 200, data: { id: "task/1", status: "completed", progress: 100, cost: 0, result: { music: [
      { audio_url: "https://cdn.example/one.m4a", clip_id: "clip1", duration_seconds: "181.70666667", title: "One" },
      { audio_url: "https://cdn.example/two.wav", title: "Two", duration: 120.1 },
      { audio_url: "https://cdn.example/three", title: "Three" },
    ] } } });
    const result = await getApimartMusicTask(credentials, "task/1", { fetchImpl });
    expect(result).toMatchObject({ ok: true, task: { cost: 0, tracks: [ { audioIndex: 1, clipId: "clip1", duration: 181.70666667 }, { audioIndex: 2, duration: 120.1 }, { audioIndex: 3 } ] } });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.apimart.ai/v1/music/tasks/task%2F1?language=zh");
  });
  it("rejects mismatched task identity and missing tracks", async () => {
    for (const data of [ { id: "other", status: "processing" }, { id: "t", status: "completed", result: { music: [] } } ]) {
      expect(await getApimartMusicTask(credentials, "t", { fetchImpl: json({ code: 200, data }) })).toMatchObject({ ok: false, kind: "protocol" });
    }
  });
  it("retains valid siblings and original indexes beside invalid URLs", async () => {
    expect(await getApimartMusicTask(credentials, "t", { fetchImpl: json({ code: 200, data: { id: "t", status: "completed", result: { music: [{ audio_url: "javascript:alert(1)" }, { audio_url: "https://cdn.example/t.wav" }] } } }) })).toMatchObject({ ok: true, task: { tracks: [{ audioIndex: 2 }], error: "第 1 首音频缺少有效下载地址" } });
  });
  it("keeps unknown states queryable and never retries submissions on its own", async () => {
    expect(await getApimartMusicTask(credentials, "t", { fetchImpl: json({ code: 200, data: { id: "t", status: "unknown" } }) })).toMatchObject({ ok: true, task: { status: "unknown", id: "t" } });
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error("network test-secret"); });
    expect(await submitApimartMusic(credentials, { model: "flowmusic", sound_prompt: "piano" }, { fetchImpl })).toMatchObject({ ok: false, kind: "network" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("downloads without credentials and rejects non-audio responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/mpeg" } }));
    expect((await downloadApimartAudio("https://cdn.example/result", { fetchImpl })).ok).toBe(true);
    expect(fetchImpl.mock.calls[0][1]).toEqual({ signal: undefined, credentials: "omit", redirect: "error" });
    expect(await downloadApimartAudio("https://cdn.example/error", { fetchImpl: json({ error: "no file" }) })).toMatchObject({ ok: false, kind: "protocol" });
  });
});


describe("bounded music task identity", () => {
  it("deduplicates successful submissions in first-seen order, allowing 100 unique tasks", async () => {
    const taskIds = Array.from({ length: 100 }, (_, i) => `task-${i}`);
    const fetchImpl = json({ code: 200, data: [...taskIds, ...taskIds].map(task_id => ({ task_id })) });
    expect(await submitApimartMusic(credentials, { model: "flowmusic", sound_prompt: "piano" }, { fetchImpl })).toEqual({ ok: true, taskIds });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each(["", "  ", ".", "..", "x".repeat(513), "task\u0000", "task\n", "task\u007f", "task\u0085", "task\ud800", "task\udc00", "🎵".repeat(256) + "x", 42, null])("rejects malformed provider ID %j after one paid request", async task_id => {
    const fetchImpl = json({ code: 200, data: [{ task_id: "valid" }, { task_id }] });
    expect(await submitApimartMusic(credentials, { model: "flowmusic", sound_prompt: "piano" }, { fetchImpl })).toMatchObject({ ok: false, kind: "protocol" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects 101 unique provider tasks without accepting a partial set", async () => {
    const fetchImpl = json({ code: 200, data: Array.from({ length: 101 }, (_, i) => ({ task_id: `task-${i}` })) });
    expect(await submitApimartMusic(credentials, { model: "flowmusic", sound_prompt: "piano" }, { fetchImpl })).toMatchObject({ ok: false, kind: "protocol" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each(["", "  ", ".", "..", "x".repeat(513), "task\u0000", "task\n", "task\u007f", "task\u0085", "task\ud800", "task\udc00", "🎵".repeat(256) + "x"])("rejects invalid detail ID %j before fetch", async taskId => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await getApimartMusicTask(credentials, taskId, { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["task/1", "x".repeat(512), " tâche/🎵 ", "%2e%2e", "🎵".repeat(256)])("keeps opaque ID %s inside a real Request detail URL", async taskId => {
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      const request = new Request(url, init);
      expect(new URL(request.url).pathname).toBe(`/v1/music/tasks/${encodeURIComponent(taskId)}`);
      expect(request.method).toBe("GET");
      return Response.json({ code: 200, data: { id: taskId, status: "processing" } });
    });
    expect(await getApimartMusicTask(credentials, taskId, { fetchImpl })).toMatchObject({ ok: true, task: { id: taskId } });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("audio body cancellation", () => {
  it.each(["submit", "detail"] as const)("classifies %s JSON cancellation independently of signal state", async operation => {
    for (const mode of ["signal", "error", "dom", "malformed"] as const) {
      const controller = new AbortController();
      const response = Response.json({});
      vi.spyOn(response, "json").mockImplementation(async () => {
        if (mode === "signal") controller.abort();
        if (mode === "dom") throw new DOMException("cancelled", "AbortError");
        if (mode === "error") throw Object.assign(new Error("cancelled"), { name: "AbortError" });
        throw new SyntaxError("broken JSON");
      });
      const fetchImpl = vi.fn<typeof fetch>(async () => response);
      const options = { fetchImpl, signal: controller.signal };
      const result = operation === "submit"
        ? await submitApimartMusic(credentials, { model: "flowmusic", sound_prompt: "piano" }, options)
        : await getApimartMusicTask(credentials, "task", options);
      expect(result).toMatchObject({ ok: false, kind: mode === "malformed" ? "protocol" : "aborted" });
      expect(fetchImpl).toHaveBeenCalledOnce();
    }
  });

  it("keeps malformed HTTP error bodies as HTTP failures and classifies cancelled bodies as aborted", async () => {
    for (const cancelled of [true, false]) {
      const response = new Response(null, { status: 403 });
      vi.spyOn(response, "json").mockRejectedValue(cancelled ? new DOMException("cancelled", "AbortError") : new SyntaxError("broken JSON"));
      const fetchImpl = vi.fn<typeof fetch>(async () => response);
      expect(await submitApimartMusic(credentials, { model: "flowmusic", sound_prompt: "piano" }, { fetchImpl })).toMatchObject({ ok: false, kind: cancelled ? "aborted" : "http" });
      expect(fetchImpl).toHaveBeenCalledOnce();
    }
  });

  it.each(["speech", "cdn"] as const)("classifies %s binary read and fetch AbortError without an aborted signal", async operation => {
    for (const stage of ["fetch", "body"] as const) {
      for (const error of [new DOMException("cancelled", "AbortError"), Object.assign(new Error("cancelled"), { name: "AbortError" })]) {
        const response = new Response(new Uint8Array([1]), { headers: { "Content-Type": "audio/wav" } });
        vi.spyOn(response, "blob").mockRejectedValue(error);
        const fetchImpl = vi.fn<typeof fetch>(async () => {
          if (stage === "fetch") throw error;
          return response;
        });
        const options = { fetchImpl, signal: new AbortController().signal };
        const result = operation === "speech"
          ? await generateApimartSpeech(credentials, speech, options)
          : await downloadApimartAudio("https://cdn.example/audio.wav", options);
        expect(result).toMatchObject({ ok: false, kind: "aborted" });
        expect(fetchImpl).toHaveBeenCalledOnce();
      }
    }
  });
});
