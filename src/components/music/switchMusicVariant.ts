import {db} from "@/db/database";
import {addMusicDraft} from "@/db/music";
import {AUDIO_TRANSACTION_TABLES} from "@/db/audioShared";
import type {ProductStore} from "@/lib/storage/types";
import {flushPendingDrafts} from "@/lib/debouncedDraft";
import {linkMusicVariants, musicVariant, type MusicVariant, newVariantSettings} from "./draftVariants";

export async function switchMusicVariant({projectId, draftId, target}: {
    projectId: string; draftId: string; target: MusicVariant;
}, store: ProductStore = db) {
    await flushPendingDrafts(projectId);
    return store.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        const project = await db.projects.get(projectId);
        const current = await db.musicDrafts.get(draftId);
        if (!project || project.kind !== "music" || !current || current.projectId !== projectId) throw new Error("创作草稿不存在");
        const links = project.musicVariantLinks ?? {};
        const targetId = links[current.id]?.[target];
        const retained = targetId ? await db.musicDrafts.get(targetId) : undefined;
        const row = retained?.projectId === projectId && musicVariant(retained.settings) === target ? retained
            : await addMusicDraft(projectId, {settings: newVariantSettings(current.settings, target)}, db);
        await db.projects.update(projectId, {musicVariantLinks: linkMusicVariants(links, current, row)});
        return {draftId: row.id};
    });
}
