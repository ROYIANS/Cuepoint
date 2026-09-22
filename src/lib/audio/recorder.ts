export type RecordingState = "idle" | "requesting" | "recording" | "stopping" | "audition" | "kept" | "discarded" | "error";
export interface RecorderOptions {
  onState?: (state: RecordingState) => void;
  onError?: (error: Error) => void;
}
export interface RecorderDependencies {
  devices: Pick<MediaDevices, "getUserMedia">;
  isTypeSupported: (mime: string) => boolean;
  createRecorder: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  createContext: () => AudioContext;
  now: () => number;
}

export const RECORDING_MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"] as const;

/** Enumeration never requests permission; labels may be blank until Start is clicked. */
export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) throw new Error("当前浏览器不支持麦克风设备选择");
  return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
}

function browserDependencies(): RecorderDependencies {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("当前环境不支持录音，请使用 HTTPS 或本机浏览器");
  return { devices: navigator.mediaDevices, isTypeSupported: (mime) => MediaRecorder.isTypeSupported(mime), createRecorder: (stream, options) => new MediaRecorder(stream, options), createContext: () => new AudioContext(), now: () => performance.now() };
}

/** Call start only from an explicit recording gesture, never on mount or from Agent tools. */
export class MicrophoneRecorder {
  state: RecordingState = "idle";
  private dependencies: RecorderDependencies | undefined;
  private recorder: MediaRecorder | undefined;
  private stream: MediaStream | undefined;
  private context: AudioContext | undefined;
  private analyser: AnalyserNode | undefined;
  private analysisSource: MediaStreamAudioSourceNode | undefined;
  private meterData: Float32Array<ArrayBuffer> | undefined;
  private chunks: Blob[] = [];
  private chunkBytes = 0;
  private epoch = 0;
  private disposed = false;
  private startedAt = 0;
  private stoppedAt = 0;
  private completed: Blob | undefined;
  private completion: Promise<Blob> | undefined;
  private resolve: ((blob: Blob) => void) | undefined;
  private reject: ((error: Error) => void) | undefined;
  private endedListeners: { track: MediaStreamTrack; listener: () => void }[] = [];
  constructor(private readonly options: RecorderOptions = {}, dependencies?: RecorderDependencies) { this.dependencies = dependencies; }

  get elapsedSec() {
    if (!this.dependencies || !["recording", "stopping", "audition", "kept"].includes(this.state)) return 0;
    return Math.max(0, ((this.state === "recording" ? this.dependencies.now() : this.stoppedAt) - this.startedAt) / 1000);
  }
  get blob() { return this.completed; }
  private change(state: RecordingState) { this.state = state; this.options.onState?.(state); }
  private releaseCapture() {
    for (const { track, listener } of this.endedListeners) track.removeEventListener("ended", listener);
    this.endedListeners = [];
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = undefined;
    this.analysisSource?.disconnect(); this.analyser?.disconnect();
    this.analysisSource = undefined; this.analyser = undefined; this.meterData = undefined;
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => undefined);
    this.context = undefined;
  }
  private fail(error: Error) {
    this.epoch++;
    if (this.recorder?.state !== "inactive") { try { this.recorder?.stop(); } catch { /* Device may already be gone. */ } }
    this.releaseCapture(); this.recorder = undefined; this.chunks = []; this.completed = undefined;
    this.reject?.(error); this.resolve = undefined; this.reject = undefined;
    this.change("error"); this.options.onError?.(error);
  }
  async start(deviceId?: string): Promise<void> {
    if (this.disposed) throw new Error("录音器已关闭");
    if (["requesting", "recording", "stopping"].includes(this.state)) throw new Error("已有录音正在进行");
    if (this.state === "audition") throw new Error("请先保留或舍弃当前录音");
    this.dependencies ??= browserDependencies();
    const deps = this.dependencies;
    const epoch = ++this.epoch;
    this.completed = undefined; this.chunks = []; this.chunkBytes = 0;
    this.change("requesting");
    this.completion = new Promise<Blob>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    // Device failure may occur before the UI calls stop; retain rejection for that call.
    void this.completion.catch(() => undefined);
    try {
      this.context = deps.createContext();
      const resume = this.context.resume();
      void resume.catch(() => undefined);
      const stream = await deps.devices.getUserMedia({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (epoch !== this.epoch || this.disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream;
      await resume;
      if (epoch !== this.epoch || this.disposed) return;
      const mimeType = RECORDING_MIME_TYPES.find((mime) => deps.isTypeSupported(mime));
      const recorder = deps.createRecorder(stream, mimeType ? { mimeType } : {});
      this.recorder = recorder;
      this.analyser = this.context!.createAnalyser(); this.analyser.fftSize = 1024;
      this.meterData = new Float32Array(this.analyser.fftSize);
      this.analysisSource = this.context!.createMediaStreamSource(stream);
      this.analysisSource.connect(this.analyser); // Intentionally no speaker monitoring.
      for (const track of stream.getAudioTracks()) {
        const listener = () => { if (epoch === this.epoch && this.state === "recording") this.fail(new Error("麦克风已断开，未保存当前录音")); };
        track.addEventListener("ended", listener); this.endedListeners.push({ track, listener });
      }
      recorder.ondataavailable = (event) => {
        if (epoch !== this.epoch || !event.data.size) return;
        this.chunkBytes += event.data.size;
        if (this.chunkBytes > 32 * 1024 * 1024) { this.fail(new Error("本次录音超过 32 MB，请分段录制")); return; }
        this.chunks.push(event.data);
      };
      recorder.onerror = () => { if (epoch === this.epoch) this.fail(new Error("录音设备发生错误，未保存当前录音")); };
      recorder.onstop = () => {
        if (epoch !== this.epoch) return;
        this.stoppedAt = deps.now(); this.releaseCapture();
        const mime = recorder.mimeType || this.chunks[0]?.type;
        const blob = new Blob(this.chunks, { type: mime || "application/octet-stream" });
        this.chunks = []; this.recorder = undefined;
        if (!blob.size) { this.fail(new Error("未录到声音，请检查麦克风后重试")); return; }
        this.completed = blob; this.change("audition");
        this.resolve?.(blob); this.resolve = undefined; this.reject = undefined;
      };
      recorder.start(1000); this.startedAt = deps.now(); this.change("recording");
    } catch (error) {
      if (epoch !== this.epoch || this.disposed) return;
      const failure = error instanceof Error ? error : new Error("无法访问麦克风");
      this.fail(failure); throw failure;
    }
  }
  stop(): Promise<Blob> {
    if (this.state === "audition" && this.completed) return Promise.resolve(this.completed);
    if (this.state === "stopping" && this.completion) return this.completion;
    if (this.state !== "recording" || !this.recorder || !this.completion) return Promise.reject(new Error("没有正在进行的录音"));
    this.stoppedAt = this.dependencies!.now(); this.change("stopping");
    try { this.recorder.stop(); } catch (error) { this.fail(error instanceof Error ? error : new Error("无法结束录音")); }
    return this.completion;
  }
  /** UI validates/decode and durably saves the Blob before marking it kept. */
  markKept() { if (this.state !== "audition") throw new Error("录音尚未完成"); this.change("kept"); }
  readLevel(): number {
    if (!this.analyser || !this.meterData) return 0;
    this.analyser.getFloatTimeDomainData(this.meterData);
    return Math.sqrt(this.meterData.reduce((sum, value) => sum + value * value, 0) / this.meterData.length);
  }
  discard() {
    this.epoch++;
    if (this.recorder?.state !== "inactive") { try { this.recorder?.stop(); } catch { /* Already stopped. */ } }
    this.releaseCapture(); this.recorder = undefined; this.chunks = []; this.completed = undefined;
    this.reject?.(new DOMException("录音已舍弃", "AbortError")); this.resolve = undefined; this.reject = undefined;
    this.change("discarded");
  }
  dispose() { this.disposed = true; this.discard(); }
}
