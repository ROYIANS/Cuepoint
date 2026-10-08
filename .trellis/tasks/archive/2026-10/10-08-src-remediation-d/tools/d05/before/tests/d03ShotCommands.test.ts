import {describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {addShot, patchShot, setShotSlot} from "@/db/shots";
import {putMedia} from "@/db/media";
import {applyShotBulkCommand, deleteShotSelectionCommand, reorderShotGroupCommand} from "@/components/shots/shotEditorCommands";
import {TEXT_SHOT_FIELDS, textShotPatch} from "@/components/shots/shotColumnFields";
import {emptySlot} from "@/domain/slot";

async function seed() {
    const project = await createProject("D03 commands");
    const episode = await db.episodes.where("projectId").equals(project.id).first();
    if (!episode) throw new Error("missing episode");
    const shots = [];
    for (let i = 0; i < 4; i++) shots.push(await addShot(project.id, episode.id));
    return {project, episode, shots};
}

describe("D03 actual shot command consumers", () => {
    it("restores the atomic latest before while keeping an unrelated later edit", async () => {
        const {episode, shots} = await seed();
        await patchShot(shots[0].id, {notes: "after render"});
        const undo = await applyShotBulkCommand({episodeId: episode.id, selectedIds: [shots[0].id], patch: {notes: "bulk"}, label: "bulk"});
        await patchShot(shots[0].id, {content: "later"});
        await undo?.restore();
        expect(await db.shots.get(shots[0].id)).toMatchObject({notes: "after render", content: "later"});
    });
    it("retains the deleted media bytes and latest row in the undo closure", async () => {
        const {project, episode, shots} = await seed();
        await putMedia({id: "d03-delete", projectId: project.id, filename: "a.png", mimeType: "image/png", blob: new Blob(["latest bytes"])});
        await setShotSlot(shots[0].id, "firstFrame", {...emptySlot(), result: {mediaId: "d03-delete", kind: "image"}});
        await patchShot(shots[0].id, {content: "after render"});
        const undo = await deleteShotSelectionCommand({episodeId: episode.id, selectedIds: [shots[0].id]});
        expect(await db.shots.get(shots[0].id)).toBeUndefined();
        await undo?.restore();
        expect(await db.shots.get(shots[0].id)).toMatchObject({content: "after render"});
        expect(await (await db.media.get("d03-delete"))?.blob.text()).toBe("latest bytes");
    });
    it("reorders the visible group in the full episode and restores full order", async () => {
        const {episode, shots} = await seed();
        const fullOrder = shots.map(row => row.id);
        const undo = await reorderShotGroupCommand({episodeId: episode.id, fullOrder, groupIds: [shots[0].id, shots[2].id], activeId: shots[0].id, overId: shots[2].id});
        const order = async () => (await db.shots.where("episodeId").equals(episode.id).sortBy("order")).map(row => row.id);
        expect(await order()).toEqual([shots[2].id, shots[1].id, shots[0].id, shots[3].id]);
        await undo?.restore();
        expect(await order()).toEqual(fullOrder);
        expect(await reorderShotGroupCommand({episodeId: episode.id, fullOrder, groupIds: fullOrder, activeId: fullOrder[0], overId: fullOrder[0]})).toBeUndefined();
        expect(await deleteShotSelectionCommand({episodeId: episode.id, selectedIds: []})).toBeUndefined();
    });
    it("maps every text column to exactly one allowed text field", () => {
        expect(Object.keys(TEXT_SHOT_FIELDS)).toHaveLength(9);
        for (const id of Object.keys(TEXT_SHOT_FIELDS) as (keyof typeof TEXT_SHOT_FIELDS)[]) expect(textShotPatch(id, "value")).toEqual({[id]: "value"});
    });
});
