import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {db} from "@/platform/product/store";
import {createProject} from "@/features/projects/commands/projects";
import {addShot, patchShot} from "@/features/video/commands/shots";
import {shotSceneCommit, shotStatusCommit} from "@/features/video/ui/shotSelectionCommit";
import {DraftConflictError} from "@/platform/product/draftConflict";

async function fixture() {
    const project = await createProject("Selection");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    return {project, shot: await addShot(project.id, episode.id)};
}

it("builds status/scene commits with the displayed value as baseline", async () => {
    const {shot} = await fixture();
    expect(shotStatusCommit(shot, "ready").baseline).toEqual({status: shot.status});
    expect(shotStatusCommit(shot, "ready").patch.status).toBeDefined();
    expect(shotSceneCommit({sceneId: undefined}, "none")).toEqual({patch: {sceneId: undefined}, baseline: {sceneId: undefined}});
    expect(shotSceneCommit({sceneId: "a"}, "b")).toEqual({patch: {sceneId: "b"}, baseline: {sceneId: "a"}});
});

it("surfaces a concurrent Agent status change as a conflict instead of overwriting it", async () => {
    const {shot} = await fixture();
    const stale = shotStatusCommit(shot, "ready");
    await patchShot(shot.id, {status: "framed"});
    await expect(patchShot(shot.id, stale.patch, stale.baseline)).rejects.toBeInstanceOf(DraftConflictError);
    expect((await db.shots.get(shot.id))?.status).toBe("framed");
    // Without a concurrent change the same commit applies.
    const fresh = shotStatusCommit((await db.shots.get(shot.id))!, "ready");
    await patchShot(shot.id, fresh.patch, fresh.baseline);
    expect((await db.shots.get(shot.id))?.status).toBe("ready");
});

it("keeps the retained-workspace responsive contract in theme.css under automated test", () => {
    const css = readFileSync(new URL("../packages/studio/src/ui/theme.css", import.meta.url), "utf8");
    const rule = (selector: string) => css.split("}").find(block => block.includes(selector) && !block.includes("@media") ) ?? "";
    const inactive = rule(".app-frame-content[data-context-panel-inactive=true] {");
    expect(inactive).toMatch(/position:\s*absolute/); expect(inactive).toMatch(/visibility:\s*hidden/);
    expect(inactive).toMatch(/opacity:\s*0/); expect(inactive).toMatch(/pointer-events:\s*none/);
    expect(rule(".app-context-panel-host {")).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/\.app-context-panel-host\[data-mode=docked\]\s*{\s*border-left/);
    // Print restores the workspace even while a pane is full-width.
    expect(css).toMatch(/@media print[\s\S]*data-context-panel-inactive=true[\s\S]*visibility:\s*visible/);
});
