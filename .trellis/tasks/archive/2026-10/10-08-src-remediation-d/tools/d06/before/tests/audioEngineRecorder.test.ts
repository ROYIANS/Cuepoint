import { describe, expect, it, vi } from "vitest";
import { MicrophoneRecorder } from "@/lib/audio/recorder";
import type { RecorderDependencies } from "@/lib/audio/recorder";

function harness() {
  const track = new EventTarget() as EventTarget & { stop: ReturnType<typeof vi.fn> };
  track.stop = vi.fn();
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  const recorder = {
    state: "inactive", mimeType: "audio/webm;codecs=opus", ondataavailable: null as ((event: { data: Blob }) => void) | null,
    onstop: null as (() => void) | null, onerror: null as (() => void) | null,
    start: vi.fn(() => { recorder.state = "recording"; }),
    stop: vi.fn(() => { recorder.state = "inactive"; }),
  };
  const context = { state: "running", resume: vi.fn(async () => undefined), close: vi.fn(async () => undefined), createAnalyser: () => ({ fftSize: 1024, disconnect: vi.fn(), getFloatTimeDomainData: (data: Float32Array) => data.fill(0.5) }), createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }) };
  const deps: RecorderDependencies = { devices: { getUserMedia: vi.fn(async () => stream) }, isTypeSupported: () => true, createRecorder: () => recorder as unknown as MediaRecorder, createContext: () => context as unknown as AudioContext, now: () => 1000 };
  return { track, stream, recorder, context, deps };
}

describe("microphone recorder lifecycle", () => {
  it("waits for final chunks, preserves actual MIME and stops all capture before audition", async () => {
    const test = harness();
    const capture = new MicrophoneRecorder({}, test.deps);
    await capture.start("microphone");
    expect(capture.state).toBe("recording"); expect(capture.readLevel()).toBe(0.5);
    expect(test.deps.devices.getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: "microphone" }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    test.recorder.ondataavailable?.({ data: new Blob(["first"]) });
    let resolved = false;
    const completed = capture.stop().then((blob) => { resolved = true; return blob; });
    await Promise.resolve(); expect(resolved).toBe(false); expect(capture.state).toBe("stopping");
    test.recorder.ondataavailable?.({ data: new Blob(["last"]) });
    test.recorder.onstop?.();
    const blob = await completed;
    expect(await blob.text()).toBe("firstlast"); expect(blob.type).toBe("audio/webm;codecs=opus");
    expect(test.track.stop).toHaveBeenCalledOnce(); expect(test.context.close).toHaveBeenCalledOnce();
    expect(capture.state).toBe("audition");
    await expect(capture.start()).rejects.toThrow("保留或舍弃");
    capture.markKept(); expect(capture.state).toBe("kept");
  });

  it("stops a permission result arriving after navigation and never starts recording", async () => {
    const test = harness();
    let grant!: (stream: MediaStream) => void;
    test.deps.devices.getUserMedia = () => new Promise((resolve) => { grant = resolve; });
    const capture = new MicrophoneRecorder({}, test.deps);
    const starting = capture.start();
    capture.dispose(); grant(test.stream); await starting;
    expect(test.track.stop).toHaveBeenCalledOnce(); expect(test.recorder.start).not.toHaveBeenCalled();
    expect(test.context.close).toHaveBeenCalledOnce(); expect(capture.state).toBe("discarded");
  });

  it("surfaces permission denial and releases the analysis context", async () => {
    const test = harness();
    test.deps.devices.getUserMedia = vi.fn(async () => { throw new DOMException("Permission denied", "NotAllowedError"); });
    const onError = vi.fn(); const capture = new MicrophoneRecorder({ onError }, test.deps);
    await expect(capture.start()).rejects.toThrow("Permission denied");
    expect(capture.state).toBe("error"); expect(onError).toHaveBeenCalledOnce();
    expect(test.context.close).toHaveBeenCalledOnce();
  });

  it("does not promote partial recording after device loss or discard", async () => {
    const test = harness(); const capture = new MicrophoneRecorder({}, test.deps);
    await capture.start(); test.track.dispatchEvent(new Event("ended"));
    test.recorder.ondataavailable?.({ data: new Blob(["partial"]) }); test.recorder.onstop?.();
    expect(capture.state).toBe("error"); expect(capture.blob).toBeUndefined(); expect(test.track.stop).toHaveBeenCalledOnce();
    await capture.start(); const completed = capture.stop(); capture.discard();
    await expect(completed).rejects.toMatchObject({ name: "AbortError" });
    test.recorder.ondataavailable?.({ data: new Blob(["late"]) }); test.recorder.onstop?.();
    expect(capture.state).toBe("discarded"); expect(capture.blob).toBeUndefined();
  });

  it("rejects empty output rather than falsely saving a take", async () => {
    const test = harness(); const capture = new MicrophoneRecorder({}, test.deps);
    await capture.start(); const complete = capture.stop(); test.recorder.onstop?.();
    await expect(complete).rejects.toThrow("未录到声音"); expect(capture.state).toBe("error");
  });
});
