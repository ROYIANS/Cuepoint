import { describe, expect, it } from "vitest";
import { detectAudioMime, audioMimeExtension } from "@/lib/audio/mime";

describe("audio container detection", () => {
  it.each([
    [new Blob(["RIFF0000WAVEfmt "]), "audio/wav"],
    [new Blob(["fLaC0000"]), "audio/flac"],
    [new Blob(["OggS0000"]), "audio/ogg"],
    [new Blob(["ID3\u0004\u0000\u0000"]), "audio/mpeg"],
    [new Blob([new Uint8Array([0xff, 0xfb, 0x90, 0x64])]), "audio/mpeg"],
    [new Blob([new Uint8Array([0xff, 0xf1, 0x50, 0x80, 0, 0x1f, 0xfc])]), "audio/aac"],
    [new Blob(["0000ftypM4A "]), "audio/mp4"],
    [new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f])]), "audio/webm"],
  ])("detects real signatures without MIME or file extension", async (blob, expected) => {
    expect(await detectAudioMime(blob)).toBe(expected);
  });
  it("prioritizes file content over a stale transport MIME", async () => {
    expect(await detectAudioMime(new Blob(["RIFF0000WAVEfmt "], { type: "audio/mpeg" }))).toBe("audio/wav");
  });
  it("retains recognized declared MIME only as fallback", async () => {
    expect(await detectAudioMime(new Blob(["codec payload"], { type: "audio/webm;codecs=opus" }))).toBe("audio/webm");
  });
  it.each([new Blob([]), new Blob(["<html>failure</html>"], { type: "text/html" }), new Blob(["unknown"], { type: "application/octet-stream" }), new Blob(["RIFFbad"]), new Blob([new Uint8Array([0xff, 0x00, 0, 0])])])("rejects unknown/truncated content instead of inventing MIME", async (blob) => {
    await expect(detectAudioMime(blob)).rejects.toThrow("无法识别");
  });
  it("maps codec MIME parameters to the correct extension", () => {
    expect(audioMimeExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(audioMimeExtension("audio/mp4")).toBe("m4a");
    expect(audioMimeExtension("audio/wav")).toBe("wav");
    expect(() => audioMimeExtension("application/octet-stream")).toThrow();
  });
});
