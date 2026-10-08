import { describe, expect, it } from "vitest";
import { reusableMedia } from "@/lib/mediaPicker";
import type { MediaRecord } from "@/domain/types";

function media(id: string, projectId: string, mimeType: string, filename = id, data = "data"): MediaRecord {
  return { id, projectId, mimeType, filename, blob: new Blob([data], { type: mimeType }) };
}

describe("reusableMedia", () => {
  const records = [
    media("image", "project", "image/png", "车站 Night.png"),
    media("video", "project", "video/mp4", "雨夜.mp4"),
    media("foreign", "other", "image/png"),
    media("studio", "studio", "image/png"),
    media("empty", "project", "image/png", "empty.png", ""),
    media("audio", "project", "audio/mpeg"),
  ];
  it("restricts reuse to existing nonempty media of the same owner and accepted kinds", () => {
    expect(reusableMedia(records, "project", ["image"]).map((item) => item.id)).toEqual(["image"]);
    expect(reusableMedia(records, "project", ["video"]).map((item) => item.id)).toEqual(["video"]);
    expect(reusableMedia(records, "studio", ["image", "video"]).map((item) => item.id)).toEqual(["studio"]);
  });
  it("searches filenames without changing record identity or creating duplicate blobs", () => {
    const result = reusableMedia(records, "project", ["image", "video"], " NIGHT ");
    expect(result).toEqual([records[0]]);
    expect(result[0]).toBe(records[0]);
    expect(reusableMedia(records, "project", ["image"], "雨夜")).toEqual([]);
  });
});
