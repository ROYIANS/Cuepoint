import Dexie from "dexie";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { addCharacter, addProp, addScene, addShot, addStyle, createProject, deleteMediaIfOrphan, deleteProject, patchShot, putMedia, setShotSlot } from "@/db/repo";
import { applyProductionProposal, cancelProductionProposal, createProductionProposal, undoProductionProposal } from "@/db/productionProposals";
import { emptySlot } from "@/domain/slot";
import { targetRevision } from "@/lib/productionRevision";
import type { ProductionTarget, ProposalSource } from "@/domain/production";

async function fixture() {
  const project = await createProject("proposal");
  const episode = (await db.episodes.where("projectId").equals(project.id).toArray())[0];
  const shot = await addShot(project.id, episode.id);
  const target: ProductionTarget = {kind:"shot",projectId:project.id,episodeId:episode.id,entityId:shot.id};
  return {project,episode,shot,target};
}
async function media(projectId: string, id: string, mimeType = "image/png") {
  await putMedia({id,projectId,mimeType,filename:id,blob:new Blob([id])});
  return {mediaId:id,kind:mimeType.startsWith("video/") ? "video" as const : "image" as const};
}
describe("reviewed production proposals", () => {
  it("upgrades v6 without changing existing project, shot or media records", async () => {
    const {project,episode,shot} = await fixture();
    await media(project.id,"legacy-media");
    const storedMedia = await db.media.get("legacy-media");
    const stores = Object.fromEntries(db.tables.filter((table) => table.name !== "productionProposals")
      .map((table) => [table.name,[table.schema.primKey.src,...table.schema.indexes.map((index) => index.src)].join(", ")]));
    await db.delete();
    const legacy = new Dexie(db.name);
    legacy.version(6).stores(stores);
    await legacy.open();
    await legacy.table("projects").add(project);
    await legacy.table("episodes").add(episode);
    await legacy.table("shots").add(shot);
    await legacy.table("media").add(storedMedia);
    legacy.close();
    await db.open();
    expect(db.verno).toBe(21);
    expect(await db.searchConnections.count()).toBe(0);
    expect(await db.agentGenerationBatches.count()).toBe(0);
    expect(await db.agentGenerationBatchItems.count()).toBe(0);
    expect(await db.agentTaskWrapups.count()).toBe(0);
    expect(await db.agentTaskWrapupVersions.count()).toBe(0);
    expect(await db.agentTaskRecords.count()).toBe(0);
    expect(await db.agentTaskRecordVersions.count()).toBe(0);
    expect(await db.agentGenerationJobs.count()).toBe(0);
    expect(await db.contextCompactions.count()).toBe(0);
    expect(await db.agentTasks.count()).toBe(0);
    expect(await db.productionProposals.count()).toBe(0);
    expect(await db.projects.get(project.id)).toEqual(project);
    expect(await db.shots.get(shot.id)).toEqual(shot);
    expect((await db.media.get("legacy-media"))?.blob.size).toBe(storedMedia?.blob.size);
  });
  it("persists preview, applies once and restores affected text only", async () => {
    const {project,shot,target} = await fixture();
    const proposal = await createProductionProposal({target,source:{kind:"manual"},change:{kind:"shot-text",patch:{content:"new",durationSec:8}}});
    expect((await db.shots.get(shot.id))?.content).toBe(shot.content);
    db.close(); await db.open();
    expect(await db.productionProposals.get(proposal.id)).toMatchObject({status:"pending"});
    await applyProductionProposal(proposal.id,project.id);
    const applied = await db.shots.get(shot.id);
    expect(applied).toMatchObject({content:"new",durationSec:8,notes:shot.notes});
    await applyProductionProposal(proposal.id,project.id);
    expect(await db.shots.get(shot.id)).toEqual(applied);
    await undoProductionProposal(proposal.id,project.id);
    await undoProductionProposal(proposal.id,project.id);
    expect(await db.shots.get(shot.id)).toEqual(shot);
    await expect(applyProductionProposal(proposal.id,project.id)).rejects.toThrow("状态");
  });
  it("preserves newer manual work during apply, create and undo conflicts", async () => {
    const {project,shot,target} = await fixture();
    const input = {target,source:{kind:"manual" as const},change:{kind:"shot-text" as const,patch:{content:"proposed"}}};
    const proposal = await createProductionProposal(input);
    await patchShot(shot.id,{notes:"manual"});
    await expect(createProductionProposal({...input,expectedRevision:targetRevision(shot)})).rejects.toThrow("已被修改");
    await expect(applyProductionProposal(proposal.id,project.id)).rejects.toThrow("已被修改");
    expect((await db.productionProposals.get(proposal.id))?.status).toBe("pending");
    const fresh = await createProductionProposal(input);
    await applyProductionProposal(fresh.id,project.id);
    await patchShot(shot.id,{content:"later"});
    await expect(undoProductionProposal(fresh.id,project.id)).rejects.toThrow("新的修改");
    expect((await db.shots.get(shot.id))?.content).toBe("later");
    await cancelProductionProposal(proposal.id,project.id);
    await cancelProductionProposal(proposal.id,project.id);
  });
  it("retains both media versions, restores absent result, and cascades project deletion", async () => {
    const {project,shot,target} = await fixture();
    const result = await media(project.id,"after");
    const proposal = await createProductionProposal({target:{...target,slot:"firstFrame"},change:{kind:"slot-result",result},source:{kind:"manual"}});
    await deleteMediaIfOrphan(result.mediaId);
    expect(await db.media.get(result.mediaId)).toBeDefined();
    await applyProductionProposal(proposal.id,project.id);
    await undoProductionProposal(proposal.id,project.id);
    expect((await db.shots.get(shot.id))?.firstFrame.result).toBeUndefined();
    const before = await media(project.id,"before");
    await setShotSlot(shot.id,"firstFrame",{...emptySlot(),result:before});
    const second = await createProductionProposal({target:{...target,slot:"firstFrame"},change:{kind:"slot-result",result},source:{kind:"manual"}});
    await applyProductionProposal(second.id,project.id);
    expect(await db.media.get("before")).toBeDefined();
    await undoProductionProposal(second.id,project.id);
    expect((await db.shots.get(shot.id))?.firstFrame.result).toEqual(before);
    await deleteProject(project.id);
    expect(await db.productionProposals.count()).toBe(0);
    expect(await db.media.count()).toBe(0);
  });
  it("rejects wrong owner, slot, media type and empty/invalid patches", async () => {
    const {project,shot,target} = await fixture();
    const other = await createProject("other");
    const foreign = await media(other.id,"foreign");
    const video = await media(project.id,"video","video/mp4");
    for (const result of [foreign,video,{mediaId:"missing",kind:"image" as const}]) {
      await expect(createProductionProposal({target:{...target,slot:"firstFrame"},change:{kind:"slot-result",result},source:{kind:"manual"}})).rejects.toThrow();
    }
    for (const patch of [{},{durationSec:NaN},{durationSec:-1}]) {
      await expect(createProductionProposal({target,change:{kind:"shot-text",patch},source:{kind:"manual"}})).rejects.toThrow();
    }
    await expect(createProductionProposal({target:{...target,projectId:other.id},change:{kind:"shot-text",patch:{content:"bad"}},source:{kind:"manual"}})).rejects.toThrow();
    expect(await db.shots.get(shot.id)).toEqual(shot);
    expect(await db.productionProposals.count()).toBe(0);
  });
  it("supports all asset image targets and rejects cross-project actions", async () => {
    const {project} = await fixture();
    const result = await media(project.id,"asset");
    const targets: ProductionTarget[] = [
      {kind:"character",projectId:project.id,entityId:(await addCharacter(project.id)).id,slot:"front"},
      {kind:"scene",projectId:project.id,entityId:(await addScene(project.id)).id,slot:"wide"},
      {kind:"prop",projectId:project.id,entityId:(await addProp(project.id)).id,slot:"hero"},
      {kind:"style",projectId:project.id,entityId:(await addStyle(project.id)).id,slot:"look"},
    ];
    for (const target of targets) {
      const proposal = await createProductionProposal({target,source:{kind:"manual"},change:{kind:"slot-result",result}});
      await expect(applyProductionProposal(proposal.id,"other")).rejects.toThrow();
      await applyProductionProposal(proposal.id,project.id);
      await undoProductionProposal(proposal.id,project.id);
      expect((await db.productionProposals.get(proposal.id))?.status).toBe("undone");
    }
  });
  it("rolls back entity write if proposal persistence fails", async () => {
    const {project,shot,target} = await fixture();
    const proposal = await createProductionProposal({target,source:{kind:"manual"},change:{kind:"shot-text",patch:{content:"new"}}});
    const spy = vi.spyOn(db.productionProposals,"put").mockRejectedValueOnce(new Error("disk"));
    await expect(applyProductionProposal(proposal.id,project.id)).rejects.toThrow("disk");
    spy.mockRestore();
    expect(await db.shots.get(shot.id)).toEqual(shot);
    expect((await db.productionProposals.get(proposal.id))?.status).toBe("pending");
  });
  it("binds generation provenance to an explicit captured target revision", async () => {
    const { project, shot, target } = await fixture();
    const result = await media(project.id, "generated");
    const revision = targetRevision(shot);
    const source: ProposalSource = { kind: "generation", intentId: "intent", provider: "apimart", model: "gpt-image-2", sourceRevisions: [{ kind: "shot", id: shot.id, revision }] };
    const input = { target: { ...target, slot: "firstFrame" as const }, change: { kind: "slot-result" as const, result }, source };
    await expect(createProductionProposal(input)).rejects.toThrow("原始版本");
    await expect(createProductionProposal({ ...input, expectedRevision: revision, source: { ...source, sourceRevisions: [{ kind: "shot", id: "other", revision }] } })).rejects.toThrow("原始版本");
    await expect(createProductionProposal({ ...input, expectedRevision: revision, source: { ...source, sourceRevisions: [{ kind: "shot", id: shot.id, revision: "secret" }] } })).rejects.toThrow("版本");
    expect(await createProductionProposal({ ...input, expectedRevision: revision })).toMatchObject({ status: "pending", baseRevision: revision, source });
  });
  it("serializes concurrent apply attempts and leaves deleted or stale media targets untouched", async () => {
    const { project, shot, target } = await fixture();
    const proposal = await createProductionProposal({ target, source: { kind: "manual" }, change: { kind: "shot-text", patch: { content: "new" } } });
    const [left, right] = await Promise.all([applyProductionProposal(proposal.id, project.id), applyProductionProposal(proposal.id, project.id)]);
    expect(left.appliedRevision).toBe(right.appliedRevision);
    expect(left.status).toBe("applied");
    const result = await media(project.id, "deleted-media");
    const mediaProposal = await createProductionProposal({ target: { ...target, slot: "firstFrame" }, source: { kind: "manual" }, change: { kind: "slot-result", result } });
    await db.media.delete(result.mediaId);
    await expect(applyProductionProposal(mediaProposal.id, project.id)).rejects.toThrow("素材");
    expect((await db.productionProposals.get(mediaProposal.id))?.status).toBe("pending");
    expect((await db.shots.get(shot.id))?.firstFrame.result).toBeUndefined();
    await db.shots.delete(shot.id);
    await expect(applyProductionProposal(mediaProposal.id, project.id)).rejects.toThrow("不存在");
    expect((await db.productionProposals.get(mediaProposal.id))?.status).toBe("pending");
  });

});
