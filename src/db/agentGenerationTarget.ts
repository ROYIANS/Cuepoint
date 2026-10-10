import {db} from "./database";
import type {ProductionTarget} from "@/domain/production";
import type {GenerationSlot} from "@/domain/types";
import {emptySlot} from "@/domain/slot";
import {targetRevision} from "@/lib/productionRevision";

async function readTargetEntity(target: ProductionTarget) {
    switch (target.kind) {
        case "shot":
            return db.shots.get(target.entityId);
        case "character":
            return db.characters.get(target.entityId);
        case "scene":
            return db.scenes.get(target.entityId);
        case "prop":
            return db.props.get(target.entityId);
        case "style":
        default:
            return db.styles.get(target.entityId);
    }
}

type GenerationEntity = NonNullable<Awaited<ReturnType<typeof readTargetEntity>>>;

async function assertShotEpisode(target: Extract<ProductionTarget, { kind: "shot" }>, entity: GenerationEntity) {
    const episode = await db.episodes.get(target.episodeId);
    if (!episode || episode.projectId !== target.projectId || !("episodeId" in entity) || entity.episodeId !== target.episodeId) throw new Error("生成目标不属于当前故事");
}

/** Reads the current owned target inside the caller's transaction, if any. */
export async function readGenerationTarget(target: ProductionTarget) {
    if (target.projectId !== "studio" && !await db.projects.get(target.projectId)) throw new Error("生成目标项目已删除");
    const entity = await readTargetEntity(target);
    if (!entity || entity.projectId !== target.projectId) throw new Error("生成目标不存在或归属不匹配");
    if (target.kind === "shot") await assertShotEpisode(target, entity);
    if (!target.slot) throw new Error("生成目标缺少素材槽位");
    let slot: GenerationSlot;
    if ("slots" in entity) {
        const slots: Partial<Record<string, GenerationSlot>> = entity.slots;
        slot = slots[target.slot] ?? emptySlot();
    } else if (target.kind === "shot") slot = entity[target.slot];
    else slot = emptySlot();
    return {
        entity,
        slot,
        revision: targetRevision(entity),
        label: "name" in entity ? entity.name : `镜头 ${entity.shotNumber || entity.order + 1}`
    };
}
