import { describe, expect, it, vi } from "vitest";
import { buildAudioSchedule, envelopeGainAt, seekAudioSchedule } from "@/lib/audio/schedule";
import type { AudioScheduleInput } from "@/lib/audio/schedule";
import { encodePcm16Wav, preflightAudioRender } from "@/lib/audio/wav";
import { createWaveformPeaks } from "@/lib/audio/waveform";
import { AudioBufferCache, scheduleAudioNodes, validateScheduleBuffers } from "@/lib/audio/engine";

const fixture = (): AudioScheduleInput => ({
  chapters: [{ id: "chapter", order: 0 }],
  tracks: [{ id: "voice", chapterId: "chapter", gain: 0.5, muted: false, solo: false }],
  takes: [{ id: "take", mediaId: "media", durationSec: 10, sampleRate: 48_000, channels: 1 }],
  clips: [{ id: "clip", chapterId: "chapter", trackId: "voice", takeId: "take", startSec: 2, trimStartSec: 1, trimEndSec: 5, gain: 0.8, fadeInSec: 1, fadeOutSec: 2 }],
});

describe("audio schedule", () => {
  it("preserves initial silence, source trims, effective gain and seek into fades", () => {
    const schedule = buildAudioSchedule(fixture());
    expect(schedule.durationSec).toBe(6);
    expect(schedule.clips[0].offsetSec).toBe(1);
    expect(envelopeGainAt(schedule.clips[0].envelope, 0.5)).toBeCloseTo(0.2);
    expect(envelopeGainAt(schedule.clips[0].envelope, 3)).toBeCloseTo(0.2);
    const [seek] = seekAudioSchedule(schedule, 2.5);
    expect(seek.startSec).toBe(0); expect(seek.offsetSec).toBe(1.5); expect(seek.durationSec).toBe(3.5);
    expect(seek.envelope[0].gain).toBeCloseTo(0.2);
    expect(seekAudioSchedule(schedule, 6)).toEqual([]);
  });

  it("keeps overlaps, applies mute/solo, and concatenates audible chapters in order", () => {
    const input = fixture();
    input.chapters = [{ id: "second", order: 2 }, ...input.chapters];
    input.tracks = [...input.tracks, { id: "music", chapterId: "chapter", gain: 1, muted: false, solo: true }, { id: "last", chapterId: "second", gain: 1, muted: false, solo: false }];
    input.clips = [...input.clips, { ...input.clips[0], id: "music-clip", trackId: "music", startSec: 0 }, { ...input.clips[0], id: "last-clip", chapterId: "second", trackId: "last", startSec: 1 }];
    const schedule = buildAudioSchedule(input);
    expect(schedule.clips.map((clip) => [clip.clipId, clip.startSec])).toEqual([["music-clip", 0], ["last-clip", 5]]);
    expect(schedule.durationSec).toBe(9);
    expect(schedule.chapterOffsets).toEqual({ chapter: 0, second: 4 });
    input.tracks = input.tracks.map((track) => ({ ...track, solo: false }));
    expect(buildAudioSchedule(input).clips).toHaveLength(3);
    input.tracks = input.tracks.map((track) => ({ ...track, muted: true }));
    expect(buildAudioSchedule(input).durationSec).toBe(0);
  });

  it("rejects missing sources and invalid bounds rather than silently omitting clips", () => {
    const input = fixture();
    expect(() => buildAudioSchedule({ ...input, takes: [] })).toThrow("来源缺失");
    expect(() => buildAudioSchedule({ ...input, clips: [{ ...input.clips[0], startSec: NaN }] })).toThrow();
    expect(() => buildAudioSchedule({ ...input, clips: [{ ...input.clips[0], trimEndSec: 11 }] })).toThrow("裁剪");
    expect(() => seekAudioSchedule(buildAudioSchedule(input), -1)).toThrow();
    expect(() => validateScheduleBuffers(buildAudioSchedule(input), new Map())).toThrow("尚未加载");
  });

  it("schedules sample-accurate gain automation and source offsets on the shared graph", () => {
    const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
    const param = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
    const gain = { gain: param, connect: vi.fn(), disconnect: vi.fn() };
    const context = { currentTime: 10, createBufferSource: () => source, createGain: () => gain, destination: {} } as unknown as BaseAudioContext;
    const clips = seekAudioSchedule(buildAudioSchedule(fixture()), 2.5);
    const release = scheduleAudioNodes(context, clips, new Map([["media", {} as AudioBuffer]]));
    expect(source.start).toHaveBeenCalledWith(10, 1.5, 3.5);
    expect(param.setValueAtTime).toHaveBeenCalledWith(0.2, 10);
    expect(param.linearRampToValueAtTime.mock.calls).toEqual([[0.4, 10.5], [0.4, 11.5], [0, 13.5]]);
    release(); expect(source.stop).toHaveBeenCalledOnce(); expect(gain.disconnect).toHaveBeenCalledOnce();
  });
});

describe("audio PCM export and resource limits", () => {
  it("encodes valid stereo PCM16 headers, duplicates mono and reports uniform attenuation", async () => {
    const data = new Float32Array([0, 2, -2, 1]);
    const result = encodePcm16Wav({ length: 4, sampleRate: 48_000, numberOfChannels: 1, getChannelData: () => data });
    const bytes = await result.blob.arrayBuffer();
    const view = new DataView(bytes);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(52);
    expect(view.getUint16(22, true)).toBe(2); expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(192_000); expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(16);
    expect(Array.from({ length: 8 }, (_, i) => view.getInt16(44 + 2 * i, true))).toEqual([0, 0, 32767, 32767, -32768, -32768, 16384, 16384]);
    expect(result.attenuation).toBe(0.5); expect(result.attenuationDb).toBeCloseTo(-6.0206);
    expect(data[1]).toBe(2); // Source PCM stays untouched.
  });

  it("retains stereo separation and does not boost quiet output", async () => {
    const channels = [new Float32Array([0.25]), new Float32Array([-0.5])];
    const result = encodePcm16Wav({ length: 1, sampleRate: 48_000, numberOfChannels: 2, getChannelData: (i) => channels[i] });
    const view = new DataView(await result.blob.arrayBuffer());
    expect(view.getInt16(44, true)).toBe(8192); expect(view.getInt16(46, true)).toBe(-16384);
    expect(result.attenuation).toBe(1);
  });

  it("preflights decoded sources and native/output working copies before render allocation", () => {
    const source = { durationSec: 60, sampleRate: 48_000, channels: 2 };
    expect(preflightAudioRender(60, [source]).frames).toBe(2_880_000);
    expect(() => preflightAudioRender(3600, [source])).toThrow("按章节导出");
    expect(() => preflightAudioRender(1, [{ ...source, durationSec: NaN }])).toThrow("元数据");
    expect(() => preflightAudioRender(0, [])).toThrow("没有可导出");
  });

  it("reduces real samples to bounded extrema without missing the last sample", () => {
    const channels = [new Float32Array([0.2, -0.6, 0.3, 0.9, -0.1]), new Float32Array([-0.8, 0.1, 0.7, 0.2, -1])];
    const peaks = createWaveformPeaks({ length: 5, sampleRate: 48_000, numberOfChannels: 2, getChannelData: (i) => channels[i] }, 2);
    expect(peaks[0].min).toBeCloseTo(-0.8); expect(peaks[0].max).toBeCloseTo(0.2);
    expect(peaks[1].min).toBe(-1); expect(peaks[1].max).toBeCloseTo(0.9);
  });

  it("bounds decoded cache with least recently used eviction", () => {
    const cache = new AudioBufferCache(16);
    const buffer = { length: 2, numberOfChannels: 1 } as AudioBuffer;
    cache.set("a", buffer); cache.set("b", buffer); cache.get("a"); cache.set("c", buffer);
    expect(cache.get("b")).toBeUndefined(); expect(cache.get("a")).toBe(buffer);
    cache.clear(); expect(cache.get("c")).toBeUndefined();
  });
});
