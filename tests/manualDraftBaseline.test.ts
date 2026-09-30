import {describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {addCharacter, addScene, addProp, addStyle, addShot, createProject, firstEpisode, patchProjectDetails, patchShot, patchCharacter, putMedia, setCharacterSlot, setSceneSlot, setPropSlot, setStyleSlot, setShotSlot} from "@/db/repo";
import {defaultImageGeneration} from "@/domain/output";
import type {GenerationSlot} from "@/domain/types";
import {emptySlot} from "@/domain/slot";
import {DraftConflictError} from "@/lib/draftConflict";

describe("manual draft baselines", () => {
    it("rejects stale slot content before replacing the current slot", async () => {
        const project = await createProject("slots");
        const character = await addCharacter(project.id);
        await setCharacterSlot(character.id, "front", {...emptySlot(), prompt: "other tab"});
        await expect(setCharacterSlot(character.id, "front", {...emptySlot(), prompt: "mine"}, emptySlot()))
            .rejects.toBeInstanceOf(DraftConflictError);
        expect((await db.characters.get(character.id))?.slots.front?.prompt).toBe("other tab");
    });

    it("rejects a stale duration baseline", async () => {
        const project = await createProject("duration");
        const episode = (await firstEpisode(project.id))!;
        const shot = await addShot(project.id, episode.id);
        await patchShot(shot.id, {durationSec: 7});
        await expect(patchShot(shot.id, {durationSec: 9}, {durationSec: shot.durationSec ?? 0}))
            .rejects.toBeInstanceOf(DraftConflictError);
        expect((await db.shots.get(shot.id))?.durationSec).toBe(7);
    });

    it("rejects stale project fields without partially writing independent fields", async () => {
        const project = await createProject("original");
        await patchProjectDetails(project.id, {brief: "other tab"});
        await expect(patchProjectDetails(project.id, {name: "mine", brief: "mine"}, {name: "original", brief: ""}))
            .rejects.toBeInstanceOf(DraftConflictError);
        expect((await db.projects.get(project.id))?.name).toBe("original");
    });
});

const slotCases = ["character", "scene", "prop", "style", "shot"] as const;

async function slotFixture(kind: typeof slotCases[number]) {
    const project = await createProject(kind);
    const episode = (await firstEpisode(project.id))!;
    if (kind === "shot") {
        const row = await addShot(project.id, episode.id);
        return {project, id: row.id, write: (value: GenerationSlot, baseline?: GenerationSlot) => setShotSlot(row.id, "firstFrame", value, baseline),
            other: (value: GenerationSlot) => setShotSlot(row.id, "lastFrame", value), read: async () => (await db.shots.get(row.id))?.firstFrame};
    }
    const row = await ({character: addCharacter, scene: addScene, prop: addProp, style: addStyle}[kind])(project.id);
    switch (kind) {
        case "character": return {project, id: row.id, write: (v: GenerationSlot, b?: GenerationSlot) => setCharacterSlot(row.id, "front", v, b), other: (v: GenerationSlot) => setCharacterSlot(row.id, "side", v), read: async () => (await db.characters.get(row.id))?.slots.front};
        case "scene": return {project, id: row.id, write: (v: GenerationSlot, b?: GenerationSlot) => setSceneSlot(row.id, "wide", v, b), other: (v: GenerationSlot) => setSceneSlot(row.id, "detail", v), read: async () => (await db.scenes.get(row.id))?.slots.wide};
        case "prop": return {project, id: row.id, write: (v: GenerationSlot, b?: GenerationSlot) => setPropSlot(row.id, "hero", v, b), other: (v: GenerationSlot) => setPropSlot(row.id, "detail", v), read: async () => (await db.props.get(row.id))?.slots.hero};
        case "style": return {project, id: row.id, write: (v: GenerationSlot, b?: GenerationSlot) => setStyleSlot(row.id, "look", v, b), other: (v: GenerationSlot) => setStyleSlot(row.id, "light", v), read: async () => (await db.styles.get(row.id))?.slots.look};
    }
}

describe.each(slotCases)("%s slot CAS", kind => {
    it("allows independent slots and equal final values, rejects a third value without media cleanup", async () => {
        const f = await slotFixture(kind);
        await f.other({...emptySlot(), prompt: "independent"});
        await f.write({...emptySlot(), prompt: "mine"}, emptySlot());
        await f.write({...emptySlot(), prompt: "mine"}, emptySlot());
        await putMedia({id: "current", projectId: f.project.id, mimeType: "image/png", filename: "current.png", blob: new Blob(["current"])});
        const current: GenerationSlot = {...emptySlot(), prompt: "theirs", result: {mediaId: "current", kind: "image"}};
        await f.write(current);
        const before = await db.projects.get(f.project.id);
        await expect(f.write(emptySlot(), {...emptySlot(), prompt: "mine"})).rejects.toBeInstanceOf(DraftConflictError);
        expect(await f.read()).toEqual(current);
        expect(await db.media.get("current")).toBeDefined();
        expect(await db.projects.get(f.project.id)).toEqual(before);
    });

    it("checks ordered references and rejects invalid/deleted media; cleanup failure rolls back", async () => {
        const f = await slotFixture(kind);
        for (const id of ["a", "b"]) await putMedia({id, projectId: f.project.id, mimeType: "image/png", filename: id, blob: new Blob([id])});
        const current = {...emptySlot(), referenceImageIds: ["a", "b"]};
        await f.write(current, emptySlot());
        await expect(f.write({...current, prompt: "mine"}, {...current, referenceImageIds: ["b", "a"]})).rejects.toBeInstanceOf(DraftConflictError);
        await expect(f.write({...current, result: {mediaId: "missing", kind: "image"}}, current)).rejects.toThrow("素材");
        await db.media.delete("b");
        await expect(f.write({...current, prompt: "mine"}, current)).rejects.toThrow("素材");
        await putMedia({id: "b", projectId: f.project.id, mimeType: "image/png", filename: "b", blob: new Blob(["b"])});
        const remove = vi.spyOn(db.media, "delete").mockRejectedValueOnce(new Error("cleanup failed"));
        try { await expect(f.write(emptySlot(), current)).rejects.toThrow("cleanup failed"); } finally { remove.mockRestore(); }
        expect(await f.read()).toEqual(current);
        expect(await db.media.get("a")).toBeDefined();
        expect(await db.media.get("b")).toBeDefined();
    });
});

describe("field normalization and independent edits", () => {
    it("preserves entity text and independent project fields, and converges after trimming names", async () => {
        const project = await createProject("original");
        const character = await addCharacter(project.id);
        await patchCharacter(character.id, {name: "latest name"});
        await setCharacterSlot(character.id, "front", {...emptySlot(), prompt: "mine"}, emptySlot());
        expect((await db.characters.get(character.id))?.name).toBe("latest name");
        await patchProjectDetails(project.id, {brief: "latest brief"});
        await patchProjectDetails(project.id, {name: " next "}, {name: "original"});
        await patchProjectDetails(project.id, {name: " next "}, {name: "original"});
        expect((await db.projects.get(project.id))?.brief).toBe("latest brief");
        expect((await db.projects.get(project.id))?.name).toBe("next");
    });

    it("canonicalizes absent duration and defaults; defaults use structure, never property order", async () => {
        const project = await createProject("normalization");
        const episode = (await firstEpisode(project.id))!;
        const shot = await addShot(project.id, episode.id);
        await db.shots.update(shot.id, {durationSec: undefined});
        await patchShot(shot.id, {durationSec: 4}, {durationSec: 0});
        await patchShot(shot.id, {notes: "independent"}, {notes: ""});
        await patchShot(shot.id, {durationSec: 4}, {durationSec: 0});
        expect((await db.shots.get(shot.id))?.notes).toBe("independent");
        await patchProjectDetails(project.id, {generationDefaults: {image: undefined}}, {generationDefaults: {}});
        const image = defaultImageGeneration();
        await patchProjectDetails(project.id, {generationDefaults: {image}}, {generationDefaults: {}});
        const reordered = Object.fromEntries(Object.entries(image).reverse()) as typeof image;
        await patchProjectDetails(project.id, {generationDefaults: {image: {...image, resolution: "2k"}}}, {generationDefaults: {image: reordered}});
        await expect(patchProjectDetails(project.id, {aspectPreset: "1:1", generationDefaults: {}}, {aspectPreset: project.aspectPreset, generationDefaults: {image}})).rejects.toBeInstanceOf(DraftConflictError);
        expect((await db.projects.get(project.id))?.aspectPreset).toBe(project.aspectPreset);
    });

    it("serializes competing slot/project writers", async () => {
        const f = await slotFixture("character");
        const slots = await Promise.allSettled([f.write({...emptySlot(), prompt: "A"}, emptySlot()), f.write({...emptySlot(), prompt: "B"}, emptySlot())]);
        expect(slots.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
        const projects = await Promise.allSettled([patchProjectDetails(f.project.id, {brief: "A"}, {brief: ""}), patchProjectDetails(f.project.id, {brief: "B"}, {brief: ""})]);
        expect(projects.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    });
});
