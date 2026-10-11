import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import type {ProductStore} from "@/lib/storage/types";
import {createNativeProbe} from "./helpers/nativeProductProbe";
import {interceptStoreTable} from "./helpers/storeFaults";
import {createAudioMusicProject, createProject} from "@/db/projects";
import {patchMusicDraft} from "@/db/music";
import {switchMusicVariant} from "@/components/music/switchMusicVariant";
import {addCharacter, setCharacterSlot} from "@/db/assets";
import {addShot} from "@/db/shots";
import {applyProductionProposal, createProductionProposal} from "@/db/productionProposals";
import {deleteProject} from "@/db/cascadeCommands";
import {putMedia} from "@/db/media";
import {emptySlot} from "@/domain/slot";
import type {ProductionTarget} from "@/domain/production";

interface Owner {
    readonly store: ProductStore;
    reopen(): Promise<void>;
    close(): Promise<void>;
}
async function owner(storage: "indexeddb" | "sqlite"): Promise<Owner> {
    if (storage === "sqlite") return createNativeProbe();
    return {store: db, async reopen() {db.close(); await db.open();}, async close() {}};
}
afterEach(() => vi.restoreAllMocks());

describe.each(["indexeddb", "sqlite"] as const)("%s shared UI command durability", storage => {
    it("persists all variant links with drafts, reuses their IDs after reopening and preserves independent text", async () => {
        const session = await owner(storage);
        try {
            const project = await createAudioMusicProject("持久音乐关联", "music", undefined, session.store);
            const initial = (await session.store.musicDrafts.where("projectId").equals(project.id).toArray())[0];
            const custom = await switchMusicVariant({projectId: project.id, draftId: initial.id, target: "suno-custom"}, session.store);
            const record = (await session.store.musicDrafts.get(custom.draftId))!;
            if (record.settings.engine !== "suno") throw new Error("Unexpected music engine");
            await patchMusicDraft(project.id, record.id, record.revision, {settings: {...record.settings, prompt: "[Verse]\n独立歌词", style: "木吉他"}}, session.store);
            const flow = await switchMusicVariant({projectId: project.id, draftId: custom.draftId, target: "flowmusic"}, session.store);
            await session.reopen();
            expect(await switchMusicVariant({projectId: project.id, draftId: flow.draftId, target: "suno-simple"}, session.store)).toEqual({draftId: initial.id});
            expect(await switchMusicVariant({projectId: project.id, draftId: initial.id, target: "suno-custom"}, session.store)).toEqual(custom);
            expect((await session.store.musicDrafts.get(custom.draftId))?.settings).toMatchObject({prompt: "[Verse]\n独立歌词", style: "木吉他"});
            expect(await session.store.musicDrafts.where("projectId").equals(project.id).count()).toBe(3);
            const links = (await session.store.projects.get(project.id))?.musicVariantLinks;
            for (const id of [initial.id, custom.draftId, flow.draftId]) expect(links?.[id]).toEqual({"suno-simple": initial.id, "suno-custom": custom.draftId, flowmusic: flow.draftId});
        } finally {await session.close();}
    });
    it("rolls back a created draft when its final variant association fails", async () => {
        const session = await owner(storage);
        try {
            const project = await createAudioMusicProject("关联原子性", "music", undefined, session.store);
            const initial = (await session.store.musicDrafts.where("projectId").equals(project.id).toArray())[0];
            const before = await session.store.projects.get(project.id);
            let created = false;
            const fault = interceptStoreTable(session.store, "projects", "update", async (tx, args, next) => {
                if ((args[1] as {musicVariantLinks?: unknown}).musicVariantLinks) {
                    created = await tx.musicDrafts.where("projectId").equals(project.id).count() === 2;
                    await next(); throw new Error("final association failed");
                }
                return next();
            });
            try {await expect(switchMusicVariant({projectId: project.id, draftId: initial.id, target: "flowmusic"}, session.store)).rejects.toThrow("final association failed");}
            finally {fault.mockRestore();}
            expect(created).toBe(true);
            await session.reopen();
            expect(await session.store.musicDrafts.where("projectId").equals(project.id).count()).toBe(1);
            expect(await session.store.projects.get(project.id)).toEqual(before);
            const result = await switchMusicVariant({projectId: project.id, draftId: initial.id, target: "flowmusic"}, session.store);
            expect((await session.store.projects.get(project.id))?.musicVariantLinks?.[initial.id]?.flowmusic).toBe(result.draftId);
        } finally {await session.close();}
    });
    it("restores slot and binary metadata after a later real cleanup deletion fails", async () => {
        const session = await owner(storage);
        try {
            const project = await createProject("槽位回滚", undefined, undefined, undefined, session.store);
            const character = await addCharacter(project.id, session.store);
            await putMedia({id: "slot-binary", projectId: project.id, filename: "local.png", mimeType: "image/png", blob: new Blob(["actual content"], {type: "image/png"})}, session.store);
            const slot = {...emptySlot(), result: {mediaId: "slot-binary", kind: "image" as const}};
            await setCharacterSlot(character.id, "front", slot, undefined, session.store);
            const before = await session.store.projects.get(project.id);
            let deleted = false;
            const fault = interceptStoreTable(session.store, "media", "delete", async (tx, _args, next) => {
                await next(); deleted = !await tx.media.get("slot-binary"); throw new Error("later cleanup failed");
            });
            try {await expect(setCharacterSlot(character.id, "front", emptySlot(), slot, session.store)).rejects.toThrow("later cleanup failed");}
            finally {fault.mockRestore();}
            expect(deleted).toBe(true); await session.reopen();
            expect((await session.store.characters.get(character.id))?.slots.front).toEqual(slot);
            expect(await session.store.media.get("slot-binary")).toBeDefined();
            expect(await session.store.projects.get(project.id)).toEqual(before);
        } finally {await session.close();}
    });
    it("restores shot and proposal when the final applied proposal persistence fails", async () => {
        const session = await owner(storage);
        try {
            const project = await createProject("提案回滚", undefined, undefined, undefined, session.store);
            const episode = (await session.store.episodes.where("projectId").equals(project.id).toArray())[0];
            const shot = await addShot(project.id, episode.id, undefined, session.store);
            const target: ProductionTarget = {kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shot.id};
            const proposal = await createProductionProposal({target, source: {kind: "manual"}, change: {kind: "shot-text", patch: {content: "proposal"}}}, session.store);
            let changed = false;
            const fault = interceptStoreTable(session.store, "productionProposals", "put", async (tx, _args, next) => {
                changed = (await tx.shots.get(shot.id))?.content === "proposal"; await next(); throw new Error("proposal receipt failed");
            });
            try {await expect(applyProductionProposal(proposal.id, project.id, session.store)).rejects.toThrow("proposal receipt failed");}
            finally {fault.mockRestore();}
            expect(changed).toBe(true); await session.reopen();
            expect(await session.store.shots.get(shot.id)).toEqual(shot);
            expect((await session.store.productionProposals.get(proposal.id))?.status).toBe("pending");
        } finally {await session.close();}
    });
    it("restores a complete project after its final deletion fails", async () => {
        const session = await owner(storage);
        try {
            const project = await createProject("级联回滚", undefined, undefined, undefined, session.store);
            const episode = (await session.store.episodes.where("projectId").equals(project.id).toArray())[0];
            const shot = await addShot(project.id, episode.id, undefined, session.store);
            const beforeProject = await session.store.projects.get(project.id);
            const beforeEpisode = await session.store.episodes.get(episode.id);
            let deleted = false;
            const fault = interceptStoreTable(session.store, "projects", "delete", async (tx, _args, next) => {
                await next(); deleted = !await tx.projects.get(project.id) && !await tx.shots.get(shot.id); throw new Error("final project delete failed");
            });
            try {await expect(deleteProject(project.id, session.store)).rejects.toThrow("final project delete failed");}
            finally {fault.mockRestore();}
            expect(deleted).toBe(true); await session.reopen();
            expect(await session.store.projects.get(project.id)).toEqual(beforeProject);
            expect(await session.store.shots.get(shot.id)).toEqual(shot);
            expect(await session.store.episodes.get(episode.id)).toEqual(beforeEpisode);
        } finally {await session.close();}
    });
});
