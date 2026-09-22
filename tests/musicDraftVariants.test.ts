import { describe, expect, it } from "vitest";
import { linkMusicVariants, musicVariant, newVariantSettings, parseVariantLinks } from "../src/components/music/draftVariants";
import { db } from "../src/db/database";
import { createAudioMusicProject } from "../src/db/repo";
import { addMusicDraft, patchMusicDraft } from "../src/db/music";
import type { MusicSettings } from "../src/domain/music";

const simple: MusicSettings = { engine: "suno", version: "v6-mini", custom: false, instrumental: false, title: "清晨", prompt: "阳光下的轻快流行", style: "", negativeTags: "" };
describe("music creation variants", () => {
  it("does not turn a description into lyrics or lyrics into a description", () => {
    const custom = newVariantSettings(simple, "suno-custom");
    expect(custom).toMatchObject({ custom: true, prompt: "", title: "清晨", version: "v6-mini" });
    if (custom.engine !== "suno") throw new Error("wrong engine");
    custom.prompt = "[Verse]\n我的第一句歌词";
    expect(newVariantSettings(custom, "suno-simple")).toMatchObject({ custom: false, prompt: "" });
    expect(simple.prompt).toBe("阳光下的轻快流行");
  });
  it("keeps provider-specific data in its original draft when changing engines", () => {
    const flow: MusicSettings = { engine: "flowmusic", title: "清晨", soundPrompt: "木吉他", lyrics: "歌词", bpm: "108", lengthSec: 120, seed: "7" };
    expect(newVariantSettings(flow, "suno-custom")).toMatchObject({ engine: "suno", custom: true, prompt: "", style: "" });
    expect(flow).toMatchObject({ bpm: "108", lengthSec: 120, seed: "7", lyrics: "歌词" });
    expect(newVariantSettings(simple, "flowmusic")).toEqual({ engine: "flowmusic", title: "清晨", soundPrompt: "", lyrics: "" });
  });
  it("round-trips a draft family across reload and resolves back to the same IDs", () => {
    const a = { id: "mdr_a", settings: simple };
    const b = { id: "mdr_b", settings: newVariantSettings(simple, "suno-custom") };
    const c = { id: "mdr_c", settings: newVariantSettings(simple, "flowmusic") };
    const linked = linkMusicVariants(linkMusicVariants({}, a, b), b, c);
    const restored = parseVariantLinks(JSON.stringify(linked));
    for (const draft of [a, b, c]) {
      expect(restored[draft.id]).toEqual({ "suno-simple": "mdr_a", "suno-custom": "mdr_b", flowmusic: "mdr_c" });
    }
    expect(restored.mdr_c[musicVariant(a.settings)]).toBe(a.id);
    expect(restored.mdr_unrelated).toBeUndefined();
  });
  it("persists both modes independently and restores their association after a reload", async () => {
    const project = await createAudioMusicProject("音乐草稿保留", "music");
    const original = (await db.musicDrafts.where("projectId").equals(project.id).toArray())[0];
    const description = await patchMusicDraft(project.id, original.id, original.revision, { settings: simple });
    const custom = await addMusicDraft(project.id, { settings: newVariantSettings(description.settings, "suno-custom") });
    if (custom.settings.engine !== "suno") throw new Error("wrong engine");
    await patchMusicDraft(project.id, custom.id, custom.revision, { settings: { ...custom.settings, prompt: "[Verse]\n这是独立保存的歌词", style: "木吉他", durationSec: 120 } });
    const stored = JSON.stringify(linkMusicVariants({}, description, custom));
    const restored = parseVariantLinks(stored);
    const reloadedDescription = await db.musicDrafts.get(restored[custom.id]["suno-simple"]!);
    const reloadedLyrics = await db.musicDrafts.get(restored[description.id]["suno-custom"]!);
    expect(reloadedDescription?.settings).toEqual(simple);
    expect(reloadedLyrics?.settings).toMatchObject({ custom: true, prompt: "[Verse]\n这是独立保存的歌词", style: "木吉他", durationSec: 120 });
    expect(await db.musicDrafts.where("projectId").equals(project.id).count()).toBe(2);
  });
  it("safely ignores invalid preference storage", () => {
    expect(parseVariantLinks("broken")).toEqual({});
    expect(parseVariantLinks("[]")).toEqual({});
    expect(parseVariantLinks('{"mdr_a":{"flowmusic":7,"suno-simple":"mdr_b"}}')).toEqual({ mdr_a: { "suno-simple": "mdr_b" } });
  });
});
