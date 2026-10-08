import { describe, expect, it } from "vitest";
import { formatTimelineTick, snapTimelinePosition, timelineClipLabel, timelineGeometry } from "@/lib/audio/timeline";
import type { AudioClip, AudioProjectSnapshot } from "@/domain/audio";

describe("script-centered audio timeline geometry", () => {
  it("fits short and long content without an artificial twenty-second viewport", () => {
    const short = timelineGeometry(4, 900);
    expect(short.durationSec).toBeCloseTo(4.32);
    expect(short.width).toBe(788);
    expect(short.step).toBe(.5);
    const long = timelineGeometry(3600, 900);
    expect(long.width).toBe(788);
    expect(long.step).toBeGreaterThanOrEqual(300);
    expect(long.ticks.length).toBeLessThan(20);
    expect(timelineGeometry(0, 300).durationSec).toBe(1);
  });

  it("zooms around a stable content span and selects readable ruler intervals", () => {
    const normal = timelineGeometry(60, 900);
    const zoomed = timelineGeometry(60, 900, 3);
    expect(zoomed.width).toBe(normal.width * 3);
    expect(zoomed.pixelsPerSecond).toBeCloseTo(normal.pixelsPerSecond * 3);
    expect(zoomed.step).toBeLessThan(normal.step);
    expect(zoomed.step * zoomed.pixelsPerSecond).toBeGreaterThanOrEqual(72);
    expect(formatTimelineTick(65, 5)).toBe("1:05");
    expect(formatTimelineTick(.25, .05)).toBe("0:00.25");
  });

  it("snaps either edge to nearby clips/playhead in pixel space and preserves Alt bypass", () => {
    expect(snapTimelinePosition(3.97, 2, [0, 4, 8], 100, true)).toBe(4);
    expect(snapTimelinePosition(5.95, 2, [0, 4, 8], 100, true)).toBe(6);
    expect(snapTimelinePosition(3.8, 2, [4], 100, true)).toBe(3.8);
    expect(snapTimelinePosition(3.97, 2, [4], 100, false)).toBe(3.97);
    expect(snapTimelinePosition(-1, 2, [0], 100, false)).toBe(0);
    expect(snapTimelinePosition(3.8, 2, [4], 20, true)).toBe(4);
  });

  it("shows source-linked script and speaker and falls back for untranscribed imports", () => {
    const clip = { takeId: "take", trackId: "track" } as AudioClip;
    const snapshot = { takes: [{ id: "take", segmentId: "segment", name: "source.wav" }], segments: [{ id: "segment", speakerId: "speaker", text: "欢迎来到今天的故事" }], speakers: [{ id: "speaker", name: "小林" }], tracks: [{ id: "track", role: "voice" }] } as AudioProjectSnapshot;
    expect(timelineClipLabel(clip, snapshot)).toEqual({ title: "欢迎来到今天的故事", speaker: "小林", segmentId: "segment" });
    snapshot.segments = [];
    expect(timelineClipLabel(clip, snapshot)).toEqual({ title: "source.wav", speaker: "旁白", segmentId: undefined });
  });
});
