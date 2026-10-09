import {db} from "./database";
import {createId, nowIso} from "@/lib/ids";
import {
    type Character,
    type Scene,
    type Prop,
    type VisualStyle,
    type Id,
    isStudioLibrary,
    type GenerationSlot
} from "@/domain/types";
import {slotMediaIds} from "@/domain/slot";
import {PRODUCTION_TABLES, touch} from "./productionShared";
import {deleteMediaIfOrphans, assertSlotMedia} from "./media";

/** Release only unused project copies. Failure rolls back both the binding and media. */
export async function releaseMaterialUse(useId: string): Promise<void> {
    await db.transaction("rw", [...PRODUCTION_TABLES, db.materialEvents], async () => {
        const use = await db.materialUses.get(useId);
        if (!use) throw new Error("这条使用记录已不存在，请刷新后重试");
        const settings = {character: db.characters, scene: db.scenes, prop: db.props, style: db.styles};
        if (use.targetKind !== "media" && await settings[use.targetKind].get(use.targetId)) {
            throw new Error("项目中的创作设定仍然存在。请先在项目中删除该设定，再移除使用记录");
        }
        await db.materialUses.delete(useId);
        const otherUses = await db.materialUses.toArray();
        const mediaIds = [...new Set(use.mediaIds)];
        const otherMediaIds = new Set(otherUses.flatMap((other) => other.mediaIds));
        if (mediaIds.some((mediaId) => otherMediaIds.has(mediaId))) {
            throw new Error("此副本仍有其他素材使用记录，暂时不能移除");
        }
        for (const mediaId of mediaIds) await db.media.update(mediaId, {libraryRetained: false});
        await deleteMediaIfOrphans(mediaIds);
        if ((await db.media.bulkGet(mediaIds)).some((record) => record !== undefined)) {
            throw new Error("此副本仍被项目封面、创作设定、镜头或任务历史使用，暂时不能移除");
        }
        await db.materialEvents.add({
            id: createId("mev"), materialId: use.materialId,
            action: "release", createdAt: nowIso(), detail: `移除项目 ${use.projectId} 中未使用的 v${use.revision} 副本`
        });
    });
}

type SnapshotAsset = Character | Scene | Prop | VisualStyle;

type SnapshotKind = "character" | "scene" | "prop" | "style";

const SNAPSHOT_PREFIX: Record<SnapshotKind, string> = {
    character: "chr",
    scene: "scn",
    prop: "prp",
    style: "sty",
};

async function copyStudioSnapshot<T extends SnapshotAsset>(
    projectId: Id,
    kind: SnapshotKind,
    sourceId: Id,
): Promise<T> {
    if (isStudioLibrary(projectId)) throw new Error("目标必须是项目");
    return db.transaction(
        "rw",
        [db.projects, db.characters, db.scenes, db.props, db.styles, db.media],
        async () => {
            const project = await db.projects.get(projectId);
            if (!project) throw new Error("项目不存在");

            const source =
                kind === "character"
                    ? await db.characters.get(sourceId)
                    : kind === "scene"
                        ? await db.scenes.get(sourceId)
                        : kind === "prop"
                            ? await db.props.get(sourceId)
                            : await db.styles.get(sourceId);
            if (!source || !isStudioLibrary(source.projectId)) {
                throw new Error("工作室资产不存在");
            }

            const destinationAssets =
                kind === "character"
                    ? await db.characters.where("projectId").equals(projectId).toArray()
                    : kind === "scene"
                        ? await db.scenes.where("projectId").equals(projectId).toArray()
                        : kind === "prop"
                            ? await db.props.where("projectId").equals(projectId).toArray()
                            : await db.styles.where("projectId").equals(projectId).toArray();
            if (destinationAssets.some((asset) => asset.extra?.sourceAssetId === sourceId)) {
                throw new Error("该工作室资产已添加到项目");
            }

            const mediaMap = new Map<Id, Id>();
            const slots: Record<string, GenerationSlot> = {};
            for (const [slotKey, slot] of Object.entries(source.slots ?? {})) {
                if (!slot) continue;
                await assertSlotMedia(source.projectId, slot);
                for (const oldMediaId of new Set(slotMediaIds(slot))) {
                    if (mediaMap.has(oldMediaId)) continue;
                    const media = await db.media.get(oldMediaId);
                    if (!media) throw new Error("来源素材已失效，请重新选择");
                    const newMediaId = createId("med");
                    mediaMap.set(oldMediaId, newMediaId);
                    await db.media.add({
                        ...media,
                        id: newMediaId,
                        projectId,
                    });
                }
                const mapMedia = (id?: Id) => (id ? mediaMap.get(id) : undefined);
                slots[slotKey] = {
                    prompt: slot.prompt,
                    referenceImageIds: slot.referenceImageIds
                        .map(mapMedia)
                        .filter((id): id is Id => Boolean(id)),
                    referenceVideoIds: slot.referenceVideoIds
                        .map(mapMedia)
                        .filter((id): id is Id => Boolean(id)),
                    result:
                        slot.result && mapMedia(slot.result.mediaId)
                            ? {
                                ...slot.result,
                                mediaId: mapMedia(slot.result.mediaId)!,
                            }
                            : undefined,
                };
            }

            const at = nowIso();
            const copy = {
                ...structuredClone(source),
                id: createId(SNAPSHOT_PREFIX[kind]),
                projectId,
                slots,
                createdAt: at,
                updatedAt: at,
                extra: {
                    ...(source.extra ?? {}),
                    sourceAssetId: source.id,
                },
            } as unknown as T;

            if (kind === "character") await db.characters.add(copy as Character);
            else if (kind === "scene") await db.scenes.add(copy as Scene);
            else if (kind === "prop") await db.props.add(copy as Prop);
            else await db.styles.add(copy as VisualStyle);
            await db.projects.put(touch(project));
            return copy;
        },
    );
}

export function copyStudioCharacter(projectId: Id, sourceId: Id): Promise<Character> {
    return copyStudioSnapshot<Character>(projectId, "character", sourceId);
}

export function copyStudioScene(projectId: Id, sourceId: Id): Promise<Scene> {
    return copyStudioSnapshot<Scene>(projectId, "scene", sourceId);
}

export function copyStudioProp(projectId: Id, sourceId: Id): Promise<Prop> {
    return copyStudioSnapshot<Prop>(projectId, "prop", sourceId);
}

export function copyStudioStyle(projectId: Id, sourceId: Id): Promise<VisualStyle> {
    return copyStudioSnapshot<VisualStyle>(projectId, "style", sourceId);
}
