import {
    type Id,
    type Episode,
    normalizeEpisodeStory,
    type EpisodeStory,
    type Shot,
    type MediaRecord,
    type StoryBeat,
    getEpisodeShotFilters,
    type ShotFilters
} from "@/domain/types";
import {db} from "./database";
import {assertDraftBaseline} from "@/lib/draftConflict";
import {slotMediaIds} from "@/domain/slot";
import {createId, nowIso} from "@/lib/ids";
import {
    assertVideoProject,
    touch,
    touchProject,
    PRODUCTION_TABLES,
    assertAssetReferences,
    assertShotReferences,
    assertCompleteOrder
} from "./productionShared";
import {emptyEpisode} from "./productionRecords";
import {deleteMediaIfOrphan} from "./media";

export async function listEpisodes(projectId: Id): Promise<Episode[]> {
    const rows = await db.episodes.where("projectId").equals(projectId).toArray();
    return rows.sort((a, b) => a.order - b.order);
}

export async function firstEpisode(projectId: Id): Promise<Episode | undefined> {
    const episodes = await listEpisodes(projectId);
    return episodes[0];
}

export async function ensureFirstEpisode(projectId: Id): Promise<Episode> {
    return db.transaction("rw", db.projects, db.episodes, async () => {
        await assertVideoProject(projectId);
        const project = await db.projects.get(projectId);
        if (!project) throw new Error("项目不存在");
        const existing = await firstEpisode(projectId);
        if (existing) return existing;
        const episode = emptyEpisode(projectId, 0);
        await db.episodes.add(episode);
        await db.projects.put(touch(project));
        return episode;
    });
}

export async function addEpisode(projectId: Id): Promise<Episode> {
    return db.transaction("rw", db.projects, db.episodes, async () => {
        await assertVideoProject(projectId);
        const project = await db.projects.get(projectId);
        if (!project) throw new Error("项目不存在");
        const existing = await listEpisodes(projectId);
        const nextOrder = existing.reduce((max, episode) => Math.max(max, episode.order), -1) + 1;
        const episode = emptyEpisode(projectId, nextOrder);
        await db.episodes.add(episode);
        await touchProject(projectId);
        return episode;
    });
}

export async function updateEpisode(
    id: Id,
    patch: Partial<Pick<Episode, "title" | "story" | "order">>,
): Promise<void> {
    await db.transaction("rw", db.projects, db.episodes, async () => {
        const episode = await db.episodes.get(id);
        if (!episode) throw new Error("集不存在，无法保存");
        await assertVideoProject(episode.projectId);
        await db.episodes.put(touch({...episode, ...patch}));
        await touchProject(episode.projectId);
    });
}

export async function updateEpisodeDraft(
    id: Id,
    patch: { title?: string; logline?: string; script?: string },
    baseline?: { title?: string; logline?: string; script?: string },
): Promise<void> {
    await db.transaction("rw", db.episodes, db.projects, async () => {
        const episode = await db.episodes.get(id);
        if (!episode) throw new Error("集不存在，无法保存");
        await assertVideoProject(episode.projectId);
        const story = normalizeEpisodeStory(episode.story);
        assertDraftBaseline({title: episode.title, logline: story.logline, script: story.script}, patch, baseline);
        const storyPatch: Partial<Pick<EpisodeStory, "logline" | "script">> = {};
        if (patch.logline !== undefined) storyPatch.logline = patch.logline;
        if (patch.script !== undefined) storyPatch.script = patch.script;
        const nextStory = normalizeEpisodeStory({...story, ...storyPatch});
        await db.episodes.put(touch({
            ...episode,
            ...(patch.title === undefined ? {} : {title: patch.title}),
            story: nextStory,
        }));
        await touchProject(episode.projectId);
    });
}

export interface DeletedEpisodeSnapshot {
    episode: Episode;
    shots: Shot[];
    media: MediaRecord[];
}

export async function deleteEpisode(id: Id): Promise<DeletedEpisodeSnapshot | undefined> {
    return db.transaction("rw", PRODUCTION_TABLES, async () => {
        const episode = await db.episodes.get(id);
        if (!episode) return undefined;
        const siblings = await listEpisodes(episode.projectId);
        if (siblings.length <= 1) throw new Error("不能删除最后一集");
        const shots = await db.shots.where("episodeId").equals(id).toArray();
        const mediaIds = [...new Set(shots.flatMap((shot) =>
            slotMediaIds(shot.firstFrame).concat(slotMediaIds(shot.lastFrame), slotMediaIds(shot.clip)),
        ))];
        const media = (await db.media.bulkGet(mediaIds)).filter(
            (record): record is MediaRecord => record !== undefined,
        );
        await db.shots.where("episodeId").equals(id).delete();
        await db.episodes.delete(id);
        const remaining = await listEpisodes(episode.projectId);
        await Promise.all(remaining.map((item, order) => db.episodes.update(item.id, {order})));
        await touchProject(episode.projectId);
        for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
        return {episode, shots, media};
    });
}

export async function restoreEpisode(snapshot: DeletedEpisodeSnapshot): Promise<void> {
    const {episode, shots, media} = snapshot;
    await db.transaction(
        "rw",
        PRODUCTION_TABLES,
        async () => {
            if (await db.episodes.get(episode.id)) return;
            if (!(await db.projects.get(episode.projectId))) throw new Error("项目不存在");
            for (const beat of normalizeEpisodeStory(episode.story).beats) await assertAssetReferences(episode.projectId, beat);
            const siblings = await db.episodes.where("projectId").equals(episode.projectId).toArray();
            for (const sibling of siblings) {
                if (sibling.order >= episode.order) {
                    await db.episodes.put({...sibling, order: sibling.order + 1});
                }
            }
            await db.episodes.add(episode);
            for (const shot of shots) {
                if (shot.episodeId !== episode.id || shot.projectId !== episode.projectId) throw new Error("镜头与集不属于同一项目");
                await assertShotReferences(shot);
                if (await db.shots.get(shot.id)) throw new Error("镜头已存在，无法恢复");
            }
            if (shots.length > 0) await db.shots.bulkPut(shots);
            if (media.length > 0) await db.media.bulkPut(media);
            await touchProject(episode.projectId);
        },
    );
}

export async function reorderEpisodes(projectId: Id, orderedIds: Id[]): Promise<void> {
    await db.transaction("rw", db.episodes, db.projects, async () => {
        await assertVideoProject(projectId);
        if (!(await db.projects.get(projectId))) throw new Error("项目不存在");
        const episodes = await db.episodes.where("projectId").equals(projectId).toArray();
        assertCompleteOrder(episodes.map((episode) => episode.id), orderedIds);
        const byId = new Map(episodes.map((episode) => [episode.id, episode]));
        await Promise.all(
            orderedIds.map((id, order) => db.episodes.put(touch({...byId.get(id)!, order}))),
        );
        await touchProject(projectId);
    });
}

export async function addStoryBeat(
    episodeId: Id,
    options?: { scriptRange?: StoryBeat["scriptRange"] },
): Promise<StoryBeat> {
    return db.transaction("rw", db.episodes, db.projects, async () => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) throw new Error("集不存在");
        await assertVideoProject(episode.projectId);
        const story = normalizeEpisodeStory(episode.story);
        const requestedRange = options?.scriptRange;
        const validRange =
            requestedRange &&
            Number.isInteger(requestedRange.start) &&
            Number.isInteger(requestedRange.end) &&
            requestedRange.start >= 0 &&
            requestedRange.end > requestedRange.start &&
            story.script.slice(requestedRange.start, requestedRange.end) === requestedRange.excerpt
                ? requestedRange
                : undefined;
        const beat: StoryBeat = {
            id: createId("beat"),
            title: `场 ${story.beats.length + 1}`,
            content: requestedRange?.excerpt ?? "",
            characterIds: [],
            timeOfDay: "",
            ...(validRange ? {scriptRange: validRange} : {}),
        };
        await db.episodes.put(touch({
            ...episode,
            story: {...story, beats: [...story.beats, beat]},
        }));
        await touchProject(episode.projectId);
        return beat;
    });
}

export async function patchStoryBeat(
    episodeId: Id,
    beatId: Id,
    patch: Partial<
        Pick<
            StoryBeat,
            "title" | "content" | "characterIds" | "sceneId" | "timeOfDay" | "scriptRange"
        >
    >,
): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) return;
        await assertAssetReferences(episode.projectId, patch);
        const story = normalizeEpisodeStory(episode.story);
        await db.episodes.put(touch({
            ...episode,
            story: {
                ...story,
                beats: story.beats.map((beat) => (beat.id === beatId ? {...beat, ...patch} : beat)),
            },
        }));
        await touchProject(episode.projectId);
    });
}

export async function reorderBeats(episodeId: Id, orderedIds: Id[]): Promise<void> {
    await db.transaction("rw", db.episodes, db.shots, db.projects, async () => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) throw new Error("集不存在");
        await assertVideoProject(episode.projectId);
        const story = normalizeEpisodeStory(episode.story);
        assertCompleteOrder(story.beats.map((beat) => beat.id), orderedIds);
        const byId = new Map(story.beats.map((beat) => [beat.id, beat]));
        const shots = await db.shots.where("episodeId").equals(episodeId).toArray();
        if (shots.some((shot) => shot.projectId !== episode.projectId)) {
            throw new Error("镜头与集不属于同一项目");
        }
        const rank = new Map(orderedIds.map((id, index) => [id, index]));
        shots.sort(
            (left, right) =>
                (rank.get(left.beatId ?? "") ?? Number.POSITIVE_INFINITY) -
                (rank.get(right.beatId ?? "") ?? Number.POSITIVE_INFINITY) ||
                left.order - right.order,
        );
        await db.episodes.put(touch({
            ...episode,
            story: {...story, beats: orderedIds.map((id) => byId.get(id)!)},
        }));
        await Promise.all(
            shots.map((shot, index) => db.shots.put({...shot, order: index + 1})),
        );
        await touchProject(episode.projectId);
    });
}

export async function duplicateBeat(
    episodeId: Id,
    beatId: Id,
    options?: { includeShots?: boolean },
): Promise<{ beat: StoryBeat; shots: Shot[] }> {
    return db.transaction("rw", PRODUCTION_TABLES, async () => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) throw new Error("集不存在");
        await assertVideoProject(episode.projectId);
        const story = normalizeEpisodeStory(episode.story);
        const sourceIndex = story.beats.findIndex((beat) => beat.id === beatId);
        if (sourceIndex < 0) throw new Error("场次不存在");
        const source = story.beats[sourceIndex]!;
        const beat: StoryBeat = structuredClone({
            ...source,
            id: createId("beat"),
            title: `${source.title} 副本`,
        });
        await assertAssetReferences(episode.projectId, beat);
        story.beats.splice(sourceIndex + 1, 0, beat);

        const created: Shot[] = [];
        if (options?.includeShots) {
            const shots = (await db.shots.where("episodeId").equals(episodeId).toArray()).sort(
                (left, right) => left.order - right.order,
            );
            if (shots.some((shot) => shot.projectId !== episode.projectId)) {
                throw new Error("镜头与集不属于同一项目");
            }
            const sourceShots = shots.filter((shot) => shot.beatId === beatId);
            const lastSourceOrder = sourceShots.at(-1)?.order ?? shots.length;
            for (const shot of shots) {
                if (shot.order > lastSourceOrder) {
                    await db.shots.put({...shot, order: shot.order + sourceShots.length});
                }
            }
            for (const [index, sourceShot] of sourceShots.entries()) {
                const copy = structuredClone({
                    ...sourceShot,
                    id: createId("sht"),
                    beatId: beat.id,
                    order: lastSourceOrder + index + 1,
                });
                await assertShotReferences(sourceShot);
                await db.shots.add(copy);
                created.push(copy);
            }
        }

        await db.episodes.put(touch({...episode, story}));
        await touchProject(episode.projectId);
        return {beat, shots: created};
    });
}

export async function restoreStoryBeat(
    episodeId: Id,
    beat: StoryBeat,
    index: number,
    shotIds: Id[] = [],
): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) throw new Error("集不存在");
        await assertVideoProject(episode.projectId);
        await assertAssetReferences(episode.projectId, beat);
        const story = normalizeEpisodeStory(episode.story);
        if (story.beats.some((item) => item.id === beat.id)) return;
        const beats = [...story.beats];
        beats.splice(Math.max(0, Math.min(index, beats.length)), 0, beat);
        await db.episodes.put(touch({...episode, story: {...story, beats}}));
        for (const shotId of shotIds) {
            const shot = await db.shots.get(shotId);
            if (shot?.episodeId === episodeId && shot.projectId === episode.projectId && !shot.beatId) await db.shots.put({
                ...shot,
                beatId: beat.id
            });
        }
        await touchProject(episode.projectId);
    });
}

export async function deleteStoryBeat(episodeId: Id, beatId: Id): Promise<void> {
    await db.transaction("rw", db.episodes, db.shots, db.projects, async () => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) return;
        const project = await db.projects.get(episode.projectId);
        const story = normalizeEpisodeStory(episode.story);
        const next = {...episode, story: {...story, beats: story.beats.filter((beat) => beat.id !== beatId)}};
        next.shotFilters = getEpisodeShotFilters({
            ...next,
            shotFilters: getEpisodeShotFilters(episode, project)
        }, project);
        await db.episodes.put(touch(next));
        await db.shots.where("episodeId").equals(episodeId).filter((shot) => shot.beatId === beatId)
            .modify((shot) => {
                delete shot.beatId;
            });
        await touchProject(episode.projectId);
    });
}

export async function updateEpisodeShotFilters(episodeId: Id, patch: Partial<ShotFilters>): Promise<void> {
    await db.transaction("rw", db.episodes, db.projects, async () => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) throw new Error("集不存在");
        await assertVideoProject(episode.projectId);
        const project = await db.projects.get(episode.projectId);
        const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
        const shotFilters = getEpisodeShotFilters({
            ...episode, shotFilters: {...getEpisodeShotFilters(episode, project), ...definedPatch},
        }, project);
        await db.episodes.update(episodeId, {shotFilters, updatedAt: nowIso()});
        await touchProject(episode.projectId);
    });
}
