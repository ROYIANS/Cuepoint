import type {Id} from "./../../../platform/identity";
import type {Episode} from "./episodes";
import {nowIso} from "../../../platform/identity";
import {createId} from "../../../platform/identity";
import {emptyEpisodeStory} from "./story";
import {normalizeShotFilters} from "./shots";
import type {Shot} from "./shots";
import {emptySlot} from "../../library/models/slot";

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
