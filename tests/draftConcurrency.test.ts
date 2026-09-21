import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { addCharacter, addStoryBeat, createProject, firstEpisode, patchCharacter, updateEpisodeDraft, updateSeriesLogline, updateWorldSetting } from "@/db/repo";
import { DebouncedDraftController } from "@/lib/debouncedDraft";
import { changedDraftFields, DraftConflictError } from "@/lib/draftConflict";

describe("concurrent text drafts", () => {
  it("rebases clean text fields while preserving dirty values and their original comparison baseline", () => {
    const controller = new DebouncedDraftController({ title: "old title", script: "old script" }, async () => {}, () => {});
    controller.change({ title: "my title", script: "old script" });
    controller.rebase({ title: "their title", script: "their script" });
    expect(controller.snapshot.value).toEqual({ title: "my title", script: "their script" });
    expect(controller.snapshot.baseline).toEqual({ title: "old title", script: "their script" });
    controller.useLatest();
    expect(controller.snapshot.value).toEqual({ title: "their title", script: "their script" });
    expect(controller.isSettled).toBe(true);
    controller.dispose();
  });

  it("defers external rebasing during a save and preserves edits made while that save completes", async () => {
    let complete!: () => void;
    const controller = new DebouncedDraftController({ title: "old", script: "old script" },
      () => new Promise<void>(resolve => { complete = resolve; }), () => {});
    controller.change({ title: "first title", script: "old script" });
    const saving = controller.flush();
    controller.change({ title: "second title", script: "my script" });
    expect(controller.rebase({ title: "first title", script: "their script" })).toBe(false);
    expect(controller.snapshot.baseline.title).toBe("old");
    complete();
    await saving;
    controller.rebase({ title: "first title", script: "their script" });
    expect(controller.snapshot.value).toEqual({ title: "second title", script: "my script" });
    expect(controller.snapshot.baseline).toEqual({ title: "first title", script: "old script" });
    controller.useLatest();
    controller.dispose();
  });

  it("refreshes a clean string editor, but does not replace an unsaved string", () => {
    const controller = new DebouncedDraftController("first", async () => {}, () => {});
    controller.rebase("second");
    expect(controller.snapshot.value).toBe("second");
    controller.change("mine");
    controller.rebase("theirs");
    expect(controller.snapshot.value).toBe("mine");
    expect(controller.snapshot.baseline).toBe("second");
    controller.useLatest();
    expect(controller.snapshot.value).toBe("theirs");
    controller.dispose();
  });

  it("saves only edited story fields even when another tab changes a clean field before live-query refresh", async () => {
    const project = await createProject("draft CAS");
    const episode = (await firstEpisode(project.id))!;
    const baseline = { title: "", script: "", logline: "" };
    await updateEpisodeDraft(episode.id, { script: "other tab's script" });
    const beat = await addStoryBeat(episode.id);
    const draft = { ...baseline, title: "my title" };
    await updateEpisodeDraft(episode.id, changedDraftFields(draft, baseline), baseline);
    const stored = (await db.episodes.get(episode.id))!;
    expect(stored.title).toBe("my title");
    expect(stored.story.script).toBe("other tab's script");
    expect(stored.story.beats.map(item => item.id)).toContain(beat.id);
  });

  it("rejects same-field conflict atomically, retains the draft and blocks backup until explicit resolution", async () => {
    const project = await createProject("draft conflict");
    const episode = (await firstEpisode(project.id))!;
    type Draft = { title: string; script: string; logline: string };
    const initial = { title: "", script: "", logline: "" };
    const controller: DebouncedDraftController<Draft> = new DebouncedDraftController(initial,
      value => updateEpisodeDraft(episode.id, changedDraftFields(value, controller.snapshot.baseline), controller.snapshot.baseline), () => {});
    controller.change({ ...initial, title: "my title", script: "my script" });
    await updateEpisodeDraft(episode.id, { script: "their script" });
    await expect(controller.flushOrThrow()).rejects.toBeInstanceOf(DraftConflictError);
    expect(controller.snapshot.value.script).toBe("my script");
    expect(controller.snapshot.status).toBe("error");
    expect((await db.episodes.get(episode.id))?.title).toBe("");
    controller.rebase({ ...initial, script: "their script" });
    controller.useLatest();
    await controller.flushOrThrow();
    expect(controller.snapshot.value.script).toBe("their script");
    controller.dispose();
  });

  it("serializes concurrent CAS writes so only one conflicting editor succeeds", async () => {
    const project = await createProject("parallel CAS");
    const episode = (await firstEpisode(project.id))!;
    const results = await Promise.allSettled([
      updateEpisodeDraft(episode.id, { script: "A" }, { script: "" }),
      updateEpisodeDraft(episode.id, { script: "B" }, { script: "" }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });

  it("applies the same conflict contract to world, series and optional asset fields", async () => {
    const project = await createProject("all draft consumers");
    await updateWorldSetting(project.id, { background: "new background" });
    await updateWorldSetting(project.id, { worldview: "my world" }, { worldview: "" });
    await expect(updateWorldSetting(project.id, { background: "stale background" }, { background: "" })).rejects.toBeInstanceOf(DraftConflictError);
    await updateSeriesLogline(project.id, "new logline", "");
    await expect(updateSeriesLogline(project.id, "stale logline", "")).rejects.toBeInstanceOf(DraftConflictError);
    const character = await addCharacter(project.id);
    await patchCharacter(character.id, { personality: "new personality" }, { personality: "" });
    await expect(patchCharacter(character.id, { personality: "stale personality" }, { personality: "" })).rejects.toBeInstanceOf(DraftConflictError);
  });
});
