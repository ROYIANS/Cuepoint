import {describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {addStoryBeat, firstEpisode, patchStoryBeat, reorderBeats} from "@/db/episodes";
import {addShot, patchShot} from "@/db/shots";
import {addCharacter} from "@/db/assets";
import {DraftConflictError} from "@/lib/draftConflict";
import {normalizeEpisodeStory} from "@/domain/types";

async function fixture() {
    const project = await createProject("D08", "series");
    const episode = (await firstEpisode(project.id))!;
    const beat = await addStoryBeat(episode.id);
    const shot = await addShot(project.id, episode.id, {beatId: beat.id});
    return {project, episode, beat, shot};
}
async function beatRow(episodeId: string, beatId: string) {
    return normalizeEpisodeStory((await db.episodes.get(episodeId))?.story).beats.find(beat => beat.id === beatId)!;
}

describe("D08 actual text persistence boundary", () => {
    it.each(["title", "content", "timeOfDay"] as const)("compares %s in the transaction, preserves unrelated beat changes, and permits convergence", async field => {
        const {project, episode, beat} = await fixture();
        const other = await addStoryBeat(episode.id);
        const character = await addCharacter(project.id);
        await patchStoryBeat(episode.id, beat.id, {characterIds: [character.id], sceneId: undefined});
        await reorderBeats(episode.id, [other.id, beat.id]);
        await patchStoryBeat(episode.id, beat.id, {[field]: "mine"}, {[field]: beat[field]});
        expect(await beatRow(episode.id, beat.id)).toMatchObject({[field]: "mine", characterIds: [character.id]});
        expect(normalizeEpisodeStory((await db.episodes.get(episode.id))?.story).beats.map(row => row.id)).toEqual([other.id, beat.id]);
        await patchStoryBeat(episode.id, beat.id, {[field]: "mine"}, {[field]: beat[field]});
        await expect(patchStoryBeat(episode.id, beat.id, {[field]: "stale"}, {[field]: beat[field]})).rejects.toBeInstanceOf(DraftConflictError);
        expect((await beatRow(episode.id, beat.id))[field]).toBe("mine");
    });
    it("serializes competing baseline writers and rolls back the whole patch on a conflict", async () => {
        const {project, episode, beat} = await fixture();
        const results = await Promise.allSettled([
            patchStoryBeat(episode.id, beat.id, {content: "A"}, {content: beat.content}),
            patchStoryBeat(episode.id, beat.id, {content: "B"}, {content: beat.content}),
        ]);
        expect(results.map(result => result.status).sort()).toEqual(["fulfilled", "rejected"]);
        const before = await db.episodes.get(episode.id); const parent = await db.projects.get(project.id);
        await expect(patchStoryBeat(episode.id, beat.id, {title: "must rollback", content: "C"}, {content: beat.content, title: beat.title})).rejects.toBeInstanceOf(DraftConflictError);
        expect(await db.episodes.get(episode.id)).toEqual(before);
        expect(await db.projects.get(project.id)).toEqual(parent);
    });
    it.each(["project", "episode", "beat"] as const)("rejects missing %s only for the new baseline path", async missing => {
        const {project, episode, beat} = await fixture();
        if (missing === "project") await db.projects.delete(project.id);
        if (missing === "episode") await db.episodes.delete(episode.id);
        if (missing === "beat") await db.episodes.update(episode.id, {story: {...normalizeEpisodeStory(episode.story), beats: []}});
        const before = await db.episodes.get(episode.id);
        await expect(patchStoryBeat(episode.id, beat.id, {title: "mine"}, {title: beat.title})).rejects.toThrow(/不存在/);
        expect(await db.episodes.get(episode.id)).toEqual(before);
        // Legacy text/nontext calls still omit/no-op on missing episode/beat, or touch an orphan episode.
        await expect(patchStoryBeat(episode.id, beat.id, {title: "legacy", characterIds: []})).resolves.toBeUndefined();
        if (missing === "beat") expect(normalizeEpisodeStory((await db.episodes.get(episode.id))?.story).beats).toEqual([]);
    });
    it("keeps old nontext behavior and normalizes an absent optional text baseline", async () => {
        const {episode, beat} = await fixture();
        const current = (await db.episodes.get(episode.id))!;
        const story = normalizeEpisodeStory(current.story);
        await db.episodes.update(episode.id, {story: {...story, script: "xy", beats: story.beats.map(row => ({...row, timeOfDay: undefined}))}});
        await patchStoryBeat(episode.id, beat.id, {timeOfDay: "夜"}, {timeOfDay: ""});
        await patchStoryBeat(episode.id, beat.id, {scriptRange: {start: 0, end: 2, excerpt: "xy"}, characterIds: []});
        expect(await beatRow(episode.id, beat.id)).toMatchObject({timeOfDay: "夜", scriptRange: {start: 0, end: 2, excerpt: "xy"}});
    });
    it.each(["shotNumber", "content", "notes", "category", "sound", "emotion", "cameraAngle", "cameraGear", "focalLength", "sceneCloseup"] as const)("shot %s uses the accepted field baseline without replacing unrelated actions", async field => {
        const {shot} = await fixture();
        await patchShot(shot.id, {durationSec: 7, status: "ready"});
        await patchShot(shot.id, {[field]: "mine"}, {[field]: shot[field] ?? ""});
        await expect(patchShot(shot.id, {[field]: "stale"}, {[field]: shot[field] ?? ""})).rejects.toBeInstanceOf(DraftConflictError);
        expect(await db.shots.get(shot.id)).toMatchObject({[field]: "mine", durationSec: 7, status: "ready", beatId: shot.beatId});
    });
    it.each(["project", "episode", "beat", "shot"] as const)("shot text rejects missing %s without resurrecting or mutating a row", async missing => {
        const {project, episode, beat, shot} = await fixture();
        if (missing === "project") await db.projects.delete(project.id);
        if (missing === "episode") await db.episodes.delete(episode.id);
        if (missing === "beat") await db.episodes.update(episode.id, {story: {...normalizeEpisodeStory(episode.story), beats: []}});
        if (missing === "shot") await db.shots.delete(shot.id);
        const before = await db.shots.get(shot.id);
        await expect(patchShot(shot.id, {content: "mine"}, {content: shot.content})).rejects.toThrow();
        expect(await db.shots.get(shot.id)).toEqual(before);
        expect(beat.id).toBe(shot.beatId);
    });
});
