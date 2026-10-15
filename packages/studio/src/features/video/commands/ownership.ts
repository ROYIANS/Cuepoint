import type {Shot} from "./../models/shots";
import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import {normalizeEpisodeStory} from "./../models/story";
import {assertAssetReferences} from "../../library/commands/relations";
import type {Id} from "./../../../platform/identity";
import type {Project} from "./../../projects/models/project";
import {getProjectKind} from "./../../projects/models/project";

export async function assertShotReferences(shot: Shot, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await assertVideoProject(shot.projectId, db);
    const episode = await db.episodes.get(shot.episodeId);
    if (!episode || episode.projectId !== shot.projectId) throw new Error("镜头与集不属于同一项目");
    if (shot.beatId !== undefined && !normalizeEpisodeStory(episode.story).beats.some((beat) => beat.id === shot.beatId)) throw new Error("场次不属于当前集");
    await assertAssetReferences(shot.projectId, shot, db);
}

export async function assertVideoProject(projectId: Id, store?: ProductStore): Promise<Project> {
    const db = store ?? productDb;
    const project = await db.projects.get(projectId);
    if (!project) throw new Error("项目不存在");
    if (getProjectKind(project) !== "video") throw new Error("此操作仅适用于视频项目");
    return project;
}
