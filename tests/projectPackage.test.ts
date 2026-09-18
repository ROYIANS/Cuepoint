import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  addCharacter,
  addProp,
  addScene,
  addShot,
  addStyle,
  appendChatMessage,
  copyStudioCharacter,
  copyStudioProp,
  copyStudioScene,
  copyStudioStyle,
  createChatThread,
  createProject,
  patchCharacter,
  patchProp,
  patchShot,
  patchStyle,
  putMedia,
  updateProject,
  updateShotSettings,
  upsertConnector,
} from "@/db/repo";
import { emptySlot } from "@/domain/slot";
import { PACKAGE_FORMAT, STUDIO_LIBRARY_ID } from "@/domain/types";
import { exportProjectZip, importProjectZip, PackageError } from "@/lib/projectPackage";

describe("project packages", () => {
  it("round-trips props, styles, nested extra data, and inferred media MIME", async () => {
    const project = await createProject("package");
    const prop = await addProp(project.id);
    const style = await addStyle(project.id);
    const mediaId = "med_package";
    await putMedia({
      id: mediaId,
      projectId: project.id,
      mimeType: "image/png",
      filename: "reference.png",
      blob: new Blob(["image"]),
    });
    await patchProp(prop.id, {
      extra: { nested: { retained: true } },
      slots: { hero: { ...emptySlot(), result: { mediaId, kind: "image" } } },
    });
    await patchStyle(style.id, { extra: { palette: ["red", "blue"] } });

    const imported = await importProjectZip(await exportProjectZip(project.id));
    const importedProp = await db.props.where("projectId").equals(imported.id).first();
    const importedStyle = await db.styles.where("projectId").equals(imported.id).first();
    const importedMediaId = importedProp?.slots.hero?.result?.mediaId;
    const importedMedia = importedMediaId ? await db.media.get(importedMediaId) : undefined;

    expect(importedProp?.extra).toEqual({ nested: { retained: true } });
    expect(importedStyle?.extra).toEqual({ palette: ["red", "blue"] });
    expect(importedMedia?.mimeType).toBe("image/png");
    expect(imported.mode).toBe("film");
  });

  it("round-trips all four snapshot types with source metadata", async () => {
    const project = await createProject("snapshot package");
    const studioCharacter = await addCharacter(STUDIO_LIBRARY_ID);
    const studioScene = await addScene(STUDIO_LIBRARY_ID);
    const studioProp = await addProp(STUDIO_LIBRARY_ID);
    const studioStyle = await addStyle(STUDIO_LIBRARY_ID);
    const mediaId = "med_studio_package";
    await putMedia({
      id: mediaId,
      projectId: STUDIO_LIBRARY_ID,
      mimeType: "video/mp4",
      filename: "reference.mp4",
      blob: new Blob(["video"], { type: "video/mp4" }),
    });
    await patchCharacter(studioCharacter.id, {
      slots: {
        front: {
          ...emptySlot(),
          referenceVideoIds: [mediaId],
          result: { mediaId, kind: "video" },
        },
      },
    });

    await Promise.all([
      copyStudioCharacter(project.id, studioCharacter.id),
      copyStudioScene(project.id, studioScene.id),
      copyStudioProp(project.id, studioProp.id),
      copyStudioStyle(project.id, studioStyle.id),
    ]);
    const imported = await importProjectZip(await exportProjectZip(project.id));
    const [characters, scenes, props, styles] = await Promise.all([
      db.characters.where("projectId").equals(imported.id).toArray(),
      db.scenes.where("projectId").equals(imported.id).toArray(),
      db.props.where("projectId").equals(imported.id).toArray(),
      db.styles.where("projectId").equals(imported.id).toArray(),
    ]);
    const importedMediaId = characters[0]?.slots.front?.result?.mediaId;

    expect([characters.length, scenes.length, props.length, styles.length]).toEqual([
      1, 1, 1, 1,
    ]);
    expect([
      characters[0]?.extra?.sourceAssetId,
      scenes[0]?.extra?.sourceAssetId,
      props[0]?.extra?.sourceAssetId,
      styles[0]?.extra?.sourceAssetId,
    ]).toEqual([studioCharacter.id, studioScene.id, studioProp.id, studioStyle.id]);
    expect((await db.media.get(importedMediaId!))?.projectId).toBe(imported.id);
  });

  it("round-trips series mode and treats a missing legacy mode as series", async () => {
    const series = await createProject("series", "series");
    const importedSeries = await importProjectZip(await exportProjectZip(series.id));
    expect(importedSeries.mode).toBe("series");

    const legacyZip = new JSZip();
    legacyZip.file("manifest.json", JSON.stringify({ format: PACKAGE_FORMAT }));
    legacyZip.file("project.json", JSON.stringify({ name: "legacy" }));
    const importedLegacy = await importProjectZip(
      await legacyZip.generateAsync({ type: "blob" }),
    );
    expect(importedLegacy.mode).toBe("series");
    expect(importedLegacy.aspectPreset).toBe("16:9");
    expect(importedLegacy.coverMediaId).toBeUndefined();
    expect(importedLegacy.shotSettings.workspaceView).toBe("design");
  });

  it("round-trips aspect preset and cover media that is only referenced by the project", async () => {
    const project = await createProject("output package", "film", "9:16");
    const mediaId = "med_project_cover";
    await putMedia({
      id: mediaId,
      projectId: project.id,
      mimeType: "image/png",
      filename: "cover.png",
      blob: new Blob(["cover-bytes"]),
    });
    await updateProject(project.id, { coverMediaId: mediaId });

    const imported = await importProjectZip(await exportProjectZip(project.id));
    expect(imported.aspectPreset).toBe("9:16");
    expect(imported.coverMediaId).toBeDefined();
    expect(imported.coverMediaId).not.toBe(mediaId);
    const cover = await db.media.get(imported.coverMediaId!);
    expect(cover?.projectId).toBe(imported.id);
    expect(cover?.mimeType).toBe("image/png");
    expect(await cover?.blob.text()).toBe("cover-bytes");
  });

  it("round-trips the shot workspace preference", async () => {
    const project = await createProject("media workspace");
    await updateProject(project.id, {
      shotSettings: { ...project.shotSettings, workspaceView: "media" },
    });

    const imported = await importProjectZip(await exportProjectZip(project.id));
    expect(imported.shotSettings.workspaceView).toBe("media");
  });

  it("round-trips shot status and defaults missing status to draft", async () => {
    const project = await createProject("shot status");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shot = await addShot(project.id, episode.id);
    await patchShot(shot.id, { status: "framed" });
    await updateShotSettings(project.id, {
      filters: {
        statuses: ["framed"],
        beatIds: [],
        gaps: ["missingClip"],
      },
    });

    const imported = await importProjectZip(await exportProjectZip(project.id));
    const importedShot = (await db.shots.where("projectId").equals(imported.id).first())!;
    expect(importedShot.status).toBe("framed");
    expect(imported.shotSettings.filters).toEqual({
      statuses: ["framed"],
      beatIds: [],
      gaps: ["missingClip"],
    });

    const legacyZip = new JSZip();
    legacyZip.file("manifest.json", JSON.stringify({ format: PACKAGE_FORMAT }));
    legacyZip.file("project.json", JSON.stringify({ name: "legacy status" }));
    legacyZip.file(
      "shots.json",
      JSON.stringify([{ id: "legacy-shot", order: 1, shotNumber: "1" }]),
    );
    const legacy = await importProjectZip(await legacyZip.generateAsync({ type: "blob" }));
    const legacyShot = (await db.shots.where("projectId").equals(legacy.id).first())!;
    expect(legacyShot.status).toBe("draft");
    expect(legacy.shotSettings.filters).toEqual({
      statuses: [],
      beatIds: [],
      gaps: [],
    });
  });

  it("remaps legacy beat ids within each episode scope", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ format: PACKAGE_FORMAT }));
    zip.file("project.json", JSON.stringify({ name: "scoped beats", mode: "series" }));
    zip.file("episodes.json", JSON.stringify([
      {
        id: "episode-1",
        order: 0,
        story: {
          beats: [{ id: "beat_0", title: "第一集场次", characterIds: [], timeOfDay: "" }],
        },
      },
      {
        id: "episode-2",
        order: 1,
        story: {
          beats: [{ id: "beat_0", title: "第二集场次", characterIds: [], timeOfDay: "" }],
        },
      },
    ]));
    zip.file("shots.json", JSON.stringify([
      { id: "shot-1", episodeId: "episode-1", beatId: "beat_0", order: 1 },
      { id: "shot-2", episodeId: "episode-2", beatId: "beat_0", order: 1 },
    ]));

    const imported = await importProjectZip(await zip.generateAsync({ type: "blob" }));
    const episodes = await db.episodes.where("projectId").equals(imported.id).sortBy("order");
    const shots = await db.shots.where("projectId").equals(imported.id).toArray();
    const firstBeatId = episodes[0]?.story.beats[0]?.id;
    const secondBeatId = episodes[1]?.story.beats[0]?.id;

    expect(firstBeatId).toBeDefined();
    expect(secondBeatId).toBeDefined();
    expect(firstBeatId).not.toBe(secondBeatId);
    expect(shots.find((shot) => shot.episodeId === episodes[0]?.id)?.beatId).toBe(firstBeatId);
    expect(shots.find((shot) => shot.episodeId === episodes[1]?.id)?.beatId).toBe(secondBeatId);
  });

  it("rejects invalid optional JSON before writing any records", async () => {
    const before = await db.projects.count();
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ format: PACKAGE_FORMAT }));
    zip.file("project.json", JSON.stringify({ name: "broken" }));
    zip.file("characters.json", "{");
    const blob = await zip.generateAsync({ type: "blob" });

    await expect(importProjectZip(blob)).rejects.toBeInstanceOf(PackageError);
    expect(await db.projects.count()).toBe(before);
  });

  it.each(["openai-compatible", "deepseek", "apimart", "aihubmix"] as const)("does not include %s API keys in project ZIP export", async (definitionId) => {
    const project = await createProject("secrets stay local");
    await upsertConnector({
      definitionId,
      protocol: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-secret-should-not-export",
    });

    const zip = await JSZip.loadAsync(await exportProjectZip(project.id));
    const names = Object.keys(zip.files);
    expect(names.some((name) => name.toLowerCase().includes("connector"))).toBe(false);

    const texts = await Promise.all(
      names
        .filter((name) => name.endsWith(".json"))
        .map(async (name) => zip.file(name)!.async("string")),
    );
    expect(texts.join("\n")).not.toContain("sk-secret-should-not-export");
    expect(await db.connectors.count()).toBe(1);
  });

  it("does not include agent chat threads or messages in project ZIP export", async () => {
    const project = await createProject("chat stays local");
    const thread = await createChatThread({ title: "secret-chat-thread-title" });
    await appendChatMessage({
      threadId: thread.id,
      role: "user",
      content: "chat-secret-should-not-export",
      status: "complete",
    });

    const zip = await JSZip.loadAsync(await exportProjectZip(project.id));
    const names = Object.keys(zip.files);
    expect(names.some((name) => name.toLowerCase().includes("chat"))).toBe(false);

    const texts = await Promise.all(
      names
        .filter((name) => name.endsWith(".json"))
        .map(async (name) => zip.file(name)!.async("string")),
    );
    const joined = texts.join("\n");
    expect(joined).not.toContain("secret-chat-thread-title");
    expect(joined).not.toContain("chat-secret-should-not-export");
    expect(await db.chatThreads.count()).toBe(1);
    expect(await db.chatMessages.count()).toBe(1);
  });
});
