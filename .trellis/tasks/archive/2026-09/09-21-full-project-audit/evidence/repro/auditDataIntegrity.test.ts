import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  addShot, addStoryBeat, createProject, deleteStoryBeat, emptyProject, emptyShot,
  firstEpisode, patchShot, putMedia, restoreStoryBeat, setShotSlot, upsertConnector,
} from "@/db/repo";
import { emptySlot } from "@/domain/slot";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";
import { validShotMediaId } from "@/lib/shotMedia";

// Audit reproducers assert desired behavior. Confirmed defects intentionally fail
// until their separately scoped repair is implemented; no product code is changed.
describe("full-project audit: data integrity", () => {
  it("keeps one connector when two tabs first save the same provider concurrently", async () => {
    const input = { definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const,
      baseUrl: "https://example.invalid/v1", apiKey: "synthetic-audit-key" };
    await Promise.all([upsertConnector(input), upsertConnector({ ...input, apiKey: "synthetic-second-key" })]);
    expect.soft(await db.connectors.where("definitionId").equals(input.definitionId).count()).toBe(1);
    // ConnectorsPage folds toArray() into a Map, retaining the last primary-key
    // row. upsertConnector instead retrieves the first matching index row.
    await upsertConnector({ ...input, baseUrl: "https://edited.example.invalid/v1" });
    const displayed = new Map((await db.connectors.toArray()).map(row => [row.definitionId, row])).get(input.definitionId)!;
    expect(displayed.baseUrl).toBe("https://edited.example.invalid/v1");
  });

  it("preserves JPEG media readiness across backup/import for a valid .jfif upload", async () => {
    const project = await createProject("audit MIME");
    const episode = (await firstEpisode(project.id))!;
    const shot = await addShot(project.id, episode.id);
    const mediaId = "audit-jpeg";
    await putMedia({ id: mediaId, projectId: project.id, mimeType: "image/jpeg", filename: "reference.jfif",
      blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }) });
    await setShotSlot(shot.id, "firstFrame", { ...emptySlot(), result: { mediaId, kind: "image" } });
    const imported = await importProjectZip(await exportProjectZip(project.id));
    const restored = (await db.shots.where("projectId").equals(imported.id).first())!;
    const media = (await db.media.get(restored.firstFrame.result!.mediaId))!;
    expect({ mimeType: media.mimeType, ready: !!validShotMediaId(restored.firstFrame.result, "image", imported.id,
      new Map([[media.id, media]])) }).toEqual({ mimeType: "image/jpeg", ready: true });
  });

  it("does not overwrite a newer shot assignment when undoing deletion of its previous beat", async () => {
    const project = await createProject("audit beat undo");
    const episode = (await firstEpisode(project.id))!;
    const oldBeat = await addStoryBeat(episode.id);
    const newBeat = await addStoryBeat(episode.id);
    const shot = await addShot(project.id, episode.id, { beatId: oldBeat.id });
    await deleteStoryBeat(episode.id, oldBeat.id);
    // A second tab moves this shot while the first tab still offers delete undo.
    await patchShot(shot.id, { beatId: newBeat.id });
    await restoreStoryBeat(episode.id, oldBeat, 0, [shot.id]);
    expect((await db.shots.get(shot.id))?.beatId).toBe(newBeat.id);
  });

  it("migrates a real v1 store with legacy frame/reference media to the current schema", async () => {
    const project = emptyProject("audit v1");
    const shot = emptyShot(project.id, "unused", 1);
    const { episodeId: _episodeId, firstFrame: _first, lastFrame: _last, clip: _clip, ...legacyShot } = shot;
    await db.delete();
    const legacy = new Dexie(db.name);
    legacy.version(1).stores({ projects: "id, updatedAt", characters: "id, projectId, updatedAt",
      scenes: "id, projectId, updatedAt", shots: "id, projectId, order", media: "id, projectId" });
    await legacy.open();
    await legacy.table("projects").add({ ...project, story: { logline: "old", script: "old script", beats: [] } });
    await legacy.table("shots").add({ ...legacyShot, frame: { ...emptySlot(), result: { mediaId: "frame", kind: "image" } },
      reference: { ...emptySlot(), result: { mediaId: "reference", kind: "image" } } });
    legacy.close();
    await db.open();
    const upgraded = (await db.shots.get(shot.id))!;
    const episode = (await firstEpisode(project.id))!;
    expect(upgraded.episodeId).toBe(episode.id);
    expect(episode.story.script).toBe("old script");
    expect(upgraded.firstFrame.result?.mediaId).toBe("frame");
    expect(upgraded.firstFrame.referenceImageIds).toContain("reference");
    expect(db.tables.map(table => table.name)).toEqual(expect.arrayContaining([
      "searchConnections", "agentGenerationBatches", "projectReferences", "projectMemories",
    ]));
  });
});
