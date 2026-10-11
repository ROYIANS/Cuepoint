import {
    type AspectPresetId,
    type Character,
    DEFAULT_SHOT_SETTINGS,
    DEFAULT_VISIBLE_COLUMNS,
    emptyEpisodeStory,
    emptySeriesStory,
    emptySetting,
    type Episode,
    type Id,
    normalizeAspectPreset,
    normalizeShotFilters,
    type Project,
    type ProjectMode,
    type Prop,
    type Scene,
    type Shot,
    type VisualStyle
} from "@/domain/types";
import {createId, nowIso} from "@/lib/ids";
import {emptySlot} from "@/domain/slot";

export function emptyProject(
    name: string,
    mode: ProjectMode = "film",
    aspectPreset: AspectPresetId = "16:9",
): Project {
    const at = nowIso();
    return {
        id: createId("prj"),
        name: name.trim() || "未命名项目",
        mode,
        aspectPreset: normalizeAspectPreset(aspectPreset),
        createdAt: at,
        updatedAt: at,
        columnSettings: {visible: [...DEFAULT_VISIBLE_COLUMNS]},
        shotSettings: {
            ...DEFAULT_SHOT_SETTINGS,
            filters: {statuses: [], beatIds: [], gaps: []},
        },
        story: emptySeriesStory(),
        setting: emptySetting(),
    };
}

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

export function emptyEpisode(projectId: Id, order: number, title = ""): Episode {
    const at = nowIso();
    return {
        id: createId("ep"),
        projectId,
        order,
        title,
        story: emptyEpisodeStory(),
        shotFilters: normalizeShotFilters(undefined),
        createdAt: at,
        updatedAt: at,
    };
}

export function emptyShot(
    projectId: Id,
    episodeId: Id,
    order: number,
    shotNumber: string,
    durationSec: number,
    beatId?: Id,
): Shot {
    return {
        id: createId("sht"),
        projectId,
        episodeId,
        order,
        shotNumber,
        status: "draft",
        firstFrame: emptySlot(),
        lastFrame: emptySlot(),
        clip: emptySlot(),
        category: "",
        durationSec,
        content: "",
        notes: "",
        sceneCloseup: "",
        sound: "",
        emotion: "",
        cameraAngle: "",
        cameraGear: "",
        focalLength: "",
        characterIds: [],
        ...(beatId ? {beatId} : {}),
    };
}
