import {afterEach, describe, expect, it, vi} from "vitest";
import {getVideoWorkspaceRepository} from "@/lib/videoWorkspaceRepository";
import {nativeWorkspace} from "@/lib/nativeWorkspace";
import {DraftConflictError} from "@/lib/draftConflict";

afterEach(() => vi.restoreAllMocks());

describe("shared video repository browser commands", () => {
    it("keeps ordered owner reads and complete-order rejection in the existing database", async () => {
        const native = vi.spyOn(nativeWorkspace, "request");
        const repository = getVideoWorkspaceRepository();
        expect(repository.runtime).toBe("browser");
        const project = await repository.createProject("Browser series", "series", "9:16");
        const [first] = await repository.episodes(project.id);
        const second = await repository.addEpisode(project.id);
        const [left, right] = await repository.addShots(project.id, first.id, 2);
        const other = await repository.addShot(project.id, second.id);
        await repository.reorderShots(first.id, [right.id, left.id]);
        expect((await repository.shots(first.id)).map(shot => shot.id)).toEqual([right.id, left.id]);
        await expect(repository.reorderShots(first.id, [right.id, other.id])).rejects.toThrow();
        expect((await repository.shots(first.id)).map(shot => shot.id)).toEqual([right.id, left.id]);
        expect((await repository.snapshot(project.id))?.project.aspectPreset).toBe("9:16");
        expect(native).not.toHaveBeenCalled();
    });

    it("retains field conflicts and lets an unrelated later edit survive a bulk inverse", async () => {
        const repository = getVideoWorkspaceRepository();
        const project = await repository.createProject("Draft ownership");
        const [episode] = await repository.episodes(project.id);
        const shot = await repository.addShot(project.id, episode.id);
        await repository.patchShot(shot.id, {content: "first edit"}, {content: ""});
        await expect(repository.patchShot(shot.id, {content: "stale edit"}, {content: ""})).rejects.toBeInstanceOf(DraftConflictError);
        await repository.patchShot(shot.id, {notes: "separate field"}, {notes: ""});
        const inverse = await repository.patchEpisodeShots(episode.id, [shot.id], {status: "approved"});
        expect(inverse).toBeDefined();
        await repository.patchShot(shot.id, {notes: "later unrelated edit"}, {notes: "separate field"});
        await repository.undoEpisodeShotBulkPatch(inverse!);
        expect((await repository.shots(episode.id))[0]).toMatchObject({content: "first edit", notes: "later unrelated edit", status: "draft"});
    });

    it("restores actually deleted episode data and retains the last-episode guard", async () => {
        const repository = getVideoWorkspaceRepository();
        const project = await repository.createProject("Restore round trip", "series");
        const [first] = await repository.episodes(project.id);
        const second = await repository.addEpisode(project.id);
        const beat = await repository.addStoryBeat(first.id);
        const shot = await repository.addShot(project.id, first.id, {beatId: beat.id});
        const deleted = await repository.deleteEpisode(first.id);
        expect(await repository.episode(first.id)).toBeNull();
        expect(await repository.shots(first.id)).toEqual([]);
        await expect(repository.deleteEpisode(second.id)).rejects.toThrow("不能删除最后一集");
        expect(deleted).toBeDefined();
        await repository.restoreEpisode(deleted!);
        expect((await repository.episodes(project.id)).map(episode => episode.id)).toEqual([first.id, second.id]);
        expect((await repository.episode(first.id))?.story.beats[0].id).toBe(beat.id);
        expect((await repository.shots(first.id))[0].id).toBe(shot.id);
    });
});
