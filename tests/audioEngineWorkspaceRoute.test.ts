import { describe, expect, it } from "vitest";
import { shouldRedirectAudioMusicChild } from "@/lib/audio/workspaceRoute";

describe("audio/music workspace child route guard", () => {
  it.each(["audio", "music"])("allows leaving %s while old workspace chrome is still mounted", (kind) => {
    for (const destination of ["/projects", "/assets", "/agents/chat", "/p/other", "/p/other/world", "/p/project-other/world"]) {
      expect(shouldRedirectAudioMusicChild(kind, "project", destination), destination).toBe(false);
    }
  });
  it("allows project home and memory with either trailing slash", () => {
    for (const destination of ["/p/project", "/p/project/", "/p/project/memory", "/p/project/memory/"]) {
      expect(shouldRedirectAudioMusicChild("audio", "project", destination)).toBe(false);
    }
  });
  it("still redirects video-only child paths inside the same audio/music project", () => {
    for (const kind of ["audio", "music"]) for (const destination of ["/p/project/world", "/p/project/e/episode", "/p/project/e/episode/shots"]) {
      expect(shouldRedirectAudioMusicChild(kind, "project", destination)).toBe(true);
    }
    expect(shouldRedirectAudioMusicChild("video", "project", "/p/project/world")).toBe(false);
  });
});
