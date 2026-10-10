import {db} from "@/db/database";
import {addMusicDraft} from "@/db/music";
import {flushPendingDrafts} from "@/lib/debouncedDraft";
import {
    linkMusicVariants,
    musicVariant,
    type MusicVariant,
    newVariantSettings,
    type VariantLinks
} from "./draftVariants";

export async function switchMusicVariant({projectId, draftId, target, links}: {
    projectId: string; draftId: string; target: MusicVariant; links: VariantLinks;
}) {
    await flushPendingDrafts(projectId);
    const current = await db.musicDrafts.get(draftId);
    if (!current || current.projectId !== projectId) throw new Error("创作草稿不存在");
    const targetId = links[current.id]?.[target];
    const retained = targetId ? await db.musicDrafts.get(targetId) : undefined;
    const row = retained?.projectId === projectId && musicVariant(retained.settings) === target ? retained
        : await addMusicDraft(projectId, {settings: newVariantSettings(current.settings, target)});
    return {draftId: row.id, links: linkMusicVariants(links, current, row)};
}
