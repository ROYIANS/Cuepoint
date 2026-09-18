import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { addCharacter, addProp, addScene, addShot, addStoryBeat, addStyle, createProject, patchCharacter, patchProjectDetails, patchShot, patchStoryBeat, putMedia } from "@/db/repo";
import { buildProductionContext } from "@/lib/productionContext";
import { targetRevision, validateProductionTarget } from "@/lib/productionRevision";
import { defaultImageGeneration, defaultVideoGeneration } from "@/domain/output";
import { emptySlot } from "@/domain/slot";

export async function fixture() {
  const project = await createProject("A");
  const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
  const shot = await addShot(project.id, episode.id);
  await patchProjectDetails(project.id, { generationDefaults: { image: defaultImageGeneration(), video: defaultVideoGeneration() } });
  return { project, episode, shot };
}

describe("production revision and targets", () => {
  it("matches SHA-256 for known canonical values including Unicode and multi-block content", () => {
    for (const value of [null, "", "abc", "镜头🙂".repeat(100)]) {
      const expected = createHash("sha256").update(JSON.stringify(value)).digest("hex");
      expect(targetRevision(value)).toBe(`sha256-v1:${expected}`);
    }
  });
  it("canonicalizes object key order and detects nested changes without exposing content", () => {
    expect(targetRevision({ b: 2, a: { z: 1, c: [2, 1] } })).toBe(targetRevision({ a: { c: [2, 1], z: 1 }, b: 2 }));
    expect(targetRevision({ extra: { apiKey: "secret" } })).not.toContain("secret");
    expect(targetRevision({ content: "a", updatedAt: "same" })).not.toBe(targetRevision({ content: "b", updatedAt: "same" }));
    expect(targetRevision([1, 2])).not.toBe(targetRevision([2, 1]));
    expect(targetRevision({ x: undefined })).not.toBe(targetRevision({}));
    expect(() => targetRevision(new Blob())).toThrow("不支持");
  });
  it("enforces target kind, ownership identifiers and each slot family", () => {
    expect(validateProductionTarget({ kind: "shot", projectId: "p", episodeId: "e", entityId: "s" }).slot).toBeUndefined();
    for (const [kind, slot] of [["character", "front"], ["scene", "wide"], ["prop", "hero"], ["style", "look"]]) {
      expect(validateProductionTarget({ kind, slot, projectId: "p", entityId: "a" }).slot).toBe(slot);
      expect(() => validateProductionTarget({ kind, slot: "clip", projectId: "p", entityId: "a" })).toThrow("槽位");
    }
    for (const raw of [null, {}, { kind: "shot", projectId: "p", entityId: "s" }, { kind: "character", projectId: "", entityId: "a", slot: "front" }, { kind: "toString", projectId: "p", entityId: "a", slot: "front" }]) expect(() => validateProductionTarget(raw)).toThrow();
  });
});

describe("scoped production context", () => {
  it("projects linked creative content, inherited settings and safe media metadata only", async () => {
    const { project, episode, shot } = await fixture();
    const character = await addCharacter(project.id); const scene = await addScene(project.id); const prop = await addProp(project.id); const style = await addStyle(project.id);
    const beat = await addStoryBeat(episode.id);
    await patchStoryBeat(episode.id, beat.id, { characterIds: [character.id], sceneId: scene.id, content: "beat" });
    await patchCharacter(character.id, { personality: "坚定", extra: { apiKey: "SECRET_CHARACTER" } });
    await patchProjectDetails(project.id, { defaultStyleId: style.id });
    await db.projects.update(project.id, { extra: { apiKey: "SECRET_PROJECT" } });
    await db.connectors.put({ id: "connector", definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://example.test", apiKey: "SECRET_CONNECTOR", updatedAt: "today" });
    await putMedia({ id: "image", projectId: project.id, filename: "one.png", mimeType: "image/png", blob: new Blob(["SECRET_BYTES"]) });
    await patchShot(shot.id, { beatId: beat.id, propIds: [prop.id], durationSec: 8, firstFrame: { ...emptySlot(), result: { mediaId: "image", kind: "image" } } });
    const unlinked = await addCharacter(project.id);
    await patchCharacter(unlinked.id, { name: "UNLINKED_CHARACTER" });
    const context = await buildProductionContext(project.id, episode.id, shot.id);
    expect(context.assets.characters).toMatchObject([{ id: character.id, personality: "坚定" }]);
    expect(context.assets.scenes).toMatchObject([{ id: scene.id }]);
    expect(context.assets.props).toMatchObject([{ id: prop.id }]);
    expect(context.style).toMatchObject({ source: "project-default", value: { id: style.id } });
    expect(context.shot).toMatchObject({ durationSec: 8, timingSource: "authored" });
    expect(context.output.video?.duration).toBe(5);
    expect(context.media).toEqual([{ id: "image", filename: "one.png", mimeType: "image/png", size: 12, kind: "image" }]);
    expect(context.sourceRevisions.find((row) => row.kind === "shot")?.revision).toBe(targetRevision(await db.shots.get(shot.id)));
    for (const forbidden of ["SECRET_CHARACTER", "SECRET_PROJECT", "SECRET_CONNECTOR", "SECRET_BYTES", "UNLINKED_CHARACTER", '"blob"', '"extra"']) expect(JSON.stringify(context)).not.toContain(forbidden);
  });
  it("excludes foreign records and reports missing links/media without silently repairing authored links", async () => {
    const { project, episode, shot } = await fixture();
    const other = await createProject("other"); const foreign = await addCharacter(other.id);
    await patchCharacter(foreign.id, { name: "FOREIGN_SECRET" });
    await db.shots.update(shot.id, { characterIds: [foreign.id, "missing"], beatId: "missingBeat", firstFrame: { ...emptySlot(), result: { mediaId: "missingMedia", kind: "image" } } });
    const context = await buildProductionContext(project.id, episode.id, shot.id);
    expect(context.assets.characters).toEqual([]);
    expect(context.media).toEqual([]);
    expect(context.warnings).toHaveLength(4);
    expect(JSON.stringify(context)).not.toContain("FOREIGN_SECRET");
    expect(context.shot.characterIds).toEqual([foreign.id, "missing"]);
  });
  it("preserves explicit style and no-style distinctions", async () => {
    const { project, episode, shot } = await fixture(); const style = await addStyle(project.id);
    await patchProjectDetails(project.id, { defaultStyleId: style.id });
    await patchShot(shot.id, { styleId: null });
    expect((await buildProductionContext(project.id, episode.id, shot.id)).style).toMatchObject({ source: "none", value: undefined });
    await patchShot(shot.id, { styleId: style.id });
    expect((await buildProductionContext(project.id, episode.id, shot.id)).style).toMatchObject({ source: "shot-override", value: { id: style.id } });
  });
  it("rejects cross-project or deleted context roots", async () => {
    const { project, episode, shot } = await fixture(); const other = await createProject("other");
    await expect(buildProductionContext(other.id, episode.id, shot.id)).rejects.toThrow("归属");
    await db.shots.delete(shot.id);
    await expect(buildProductionContext(project.id, episode.id, shot.id)).rejects.toThrow("不存在");
  });
});
