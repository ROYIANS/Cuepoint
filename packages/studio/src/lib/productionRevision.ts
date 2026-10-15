import {sha256Bytes} from "./sha256";
import type {ProductionTarget} from "../domain/production";
import {CHARACTER_SLOTS, PROP_SLOTS, SCENE_SLOTS, STYLE_SLOTS} from "../domain/types";
import {SHOT_PICTURE_FIELDS} from "../domain/slot";

function canonical(value: unknown): string {
    if (value === undefined) return '["undefined"]';
    if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `["array",${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        return `["object",${Object.keys(value).sort().map((key) => `${JSON.stringify(key)},${canonical((value as Record<string, unknown>)[key])}`).join(",")}]`;
    }
    throw new Error("版本快照包含不支持的数据类型");
}

// Synchronous SHA-256 keeps revision checks inside IndexedDB transactions. The
// token includes ALL entity content, including timestamps/extra, but reveals none
// of that content. It is a conflict token, never an authorization credential.
export function targetRevision(value: unknown): string {
    const input = new TextEncoder().encode(canonical(value));
    return `sha256-v1:${sha256Bytes(input)}`;
}

export function validateProductionTarget(raw: unknown): ProductionTarget {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("生成目标格式无效");
    const value = raw as Record<string, unknown>;
    for (const key of ["projectId", "entityId"]) {
        if (typeof value[key] !== "string" || !value[key].trim()) throw new Error("生成目标缺少归属或标识");
    }
    const common = {projectId: value.projectId as string, entityId: value.entityId as string};
    if (value.kind === "shot") {
        if (typeof value.episodeId !== "string" || !value.episodeId.trim()) throw new Error("镜头目标缺少集标识");
        if (value.slot !== undefined && !SHOT_PICTURE_FIELDS.includes(value.slot as never)) throw new Error("镜头素材槽位无效");
        return {
            kind: "shot", ...common,
            episodeId: value.episodeId, ...(value.slot === undefined ? {} : {slot: value.slot as "firstFrame" | "lastFrame" | "clip"})
        };
    }
    const slots = {character: CHARACTER_SLOTS, scene: SCENE_SLOTS, prop: PROP_SLOTS, style: STYLE_SLOTS};
    if (typeof value.kind !== "string" || !Object.hasOwn(slots, value.kind)) throw new Error("生成目标类型无效");
    const kind = value.kind as keyof typeof slots;
    if (!slots[kind].some(({id}) => id === value.slot)) throw new Error("资产素材槽位无效");
    return {kind, ...common, slot: value.slot} as ProductionTarget;
}
