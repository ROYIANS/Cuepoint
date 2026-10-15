import type {Id} from "./../../../platform/identity";
import type {Character} from "./assets";
import {nowIso} from "../../../platform/identity";
import {createId} from "../../../platform/identity";
import type {Scene} from "./assets";
import type {Prop} from "./assets";
import type {VisualStyle} from "./assets";

export function emptyCharacter(projectId: Id, name = "未命名角色"): Character {
    const at = nowIso();
    return {
        id: createId("chr"),
        projectId,
        name,
        bio: "",
        appearance: "",
        notes: "",
        slots: {},
        createdAt: at,
        updatedAt: at,
    };
}

export function emptyScene(projectId: Id, name = "未命名场景"): Scene {
    const at = nowIso();
    return {
        id: createId("scn"),
        projectId,
        name,
        location: "",
        timeOfDay: "",
        atmosphere: "",
        notes: "",
        slots: {},
        createdAt: at,
        updatedAt: at,
    };
}

export function emptyProp(projectId: Id, name = "未命名道具"): Prop {
    const at = nowIso();
    return {
        id: createId("prp"),
        projectId,
        name,
        kind: "",
        notes: "",
        slots: {},
        createdAt: at,
        updatedAt: at,
    };
}

export function emptyStyle(projectId: Id, name = "未命名风格"): VisualStyle {
    const at = nowIso();
    return {
        id: createId("sty"),
        projectId,
        name,
        notes: "",
        slots: {},
        createdAt: at,
        updatedAt: at,
    };
}
