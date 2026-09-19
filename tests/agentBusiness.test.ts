import { importReferenceFile } from "@/lib/references/import";
import { ownerSnapshot, targetRevision } from "@/lib/agent/businessStore";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import * as repo from "@/db/repo";
import { AtomicToolRollbackError } from "@/db/agentTools";
import { beginAgentRun } from "@/db/agentRuns";
import { BUSINESS_TOOLS, BUSINESS_TOOL_GROUPS } from "@/lib/agent/businessTools";
import type { AgentToolContext } from "@/lib/agent/tools";
import type { AgentRun, AgentToolCall } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { registerPendingDraft } from "@/lib/debouncedDraft";
import { createId } from "@/lib/ids";

const connector: ConnectorConfig = { id: "fixture", definitionId: "openai-compatible", baseUrl: "https://fixture.invalid/v1", apiKey: "not-real", updatedAt: "2026-09-19" };
function tool(name: string) { const result = BUSINESS_TOOLS.find((item) => item.name === name); if (!result) throw new Error(`Missing ${name}`); return result; }
async function begin() { const thread = await repo.createChatThread(); return beginAgentRun({ threadId: thread.id, connector, model: "fixture-model", content: "维护创作数据" }); }
async function prepare(name: string, raw: unknown, run?: AgentRun) {
  run ??= await begin();
  const definition = tool(name), args = definition.parseArguments(raw);
  const callId = createId("call");
  const context: AgentToolContext = { runId: run.id, threadId: run.threadId, callId, signal: new AbortController().signal };
  context.preview = await definition.prepare?.(args, context);
  const call: AgentToolCall = { id: callId, runId: run.id, threadId: run.threadId, providerCallId: callId, step: 1, order: 0, name, title: definition.title, arguments: JSON.stringify(raw), effect: definition.effect, highRisk: definition.highRisk(args), atomic: definition.atomic, preview: context.preview, status: "running", createdAt: "2026-09-19", updatedAt: "2026-09-19" };
  await db.agentToolCalls.add(call);
  return { context, args, execute: () => definition.execute(args, context) as Promise<Record<string, unknown>> };
}
async function execute(name: string, args: unknown) { return (await prepare(name, args)).execute(); }
async function fixture() {
  const result = await execute("project_create", { name: "夜行", mode: "series" });
  return { ownerId: String(result.id), episodeId: String(result.firstEpisodeId) };
}
async function read(name: string, args: unknown) {
  const definition = tool(name), run=await begin();
  return definition.execute(definition.parseArguments(args), { runId: run.id, threadId: run.threadId, callId: "read", signal: new AbortController().signal }) as Promise<Record<string, unknown>>;
}

describe("business operation schemas and permissions", () => {
  it("has distinct strict read, mutation and high-risk deletion tools, no administrative access", () => {
    expect(new Set(BUSINESS_TOOLS.map((item) => item.name)).size).toBe(BUSINESS_TOOLS.length);
    expect(Object.values(BUSINESS_TOOL_GROUPS).flat().slice().sort()).toEqual(BUSINESS_TOOLS.map((item) => item.name).sort());
    expect(BUSINESS_TOOL_GROUPS.read).toEqual(["business_search", "business_detail", "business_read_relations", "business_read_text"]);
    expect(BUSINESS_TOOLS.filter((item) => item.effect === "write").every((item) => item.atomic && item.prepare)).toBe(true);
    for (const item of BUSINESS_TOOLS.filter((item) => item.name.endsWith("_delete") || item.name === "media_delete_orphan")) expect(item.highRisk({})).toBe(true);
    expect(() => tool("project_create").parseArguments({ name: "test", apiKey: "secret" })).toThrow();
    expect(() => tool("project_update").parseArguments({ id: "p", patch: { mode: "film" } })).toThrow();
    expect(() => tool("character_update").parseArguments({ ownerId: "studio", id: "c", patch: { slots: {}, extra: {}, projectId: "other" } })).toThrow();
    expect(() => tool("character_update").parseArguments({ ownerId: "studio", id: "c", patch: { palette: "red" } })).toThrow();
    expect(() => tool("business_search").parseArguments({ kind: "connector" })).toThrow();
    expect(() => tool("business_search").parseArguments({ kind: "project", limit: 51 })).toThrow();
    expect(() => tool("shot_create").parseArguments({ ownerId: "p", episodeId: "e", count: 21 })).toThrow();
    expect(() => tool("project_create").parseArguments({ name: "   " })).toThrow();
    expect(() => tool("shot_update").parseArguments({ ownerId: "p", episodeId: "e", id: "s", patch: {} })).toThrow();
  });
});

describe("complete manual creative workflow through real repository tools", () => {
  it("includes project reference ownership before approving media cleanup", async () => {
    const project = await repo.createProject("资料项目");
    const before = targetRevision(await ownerSnapshot(project.id));
    const reference = await importReferenceFile(project.id, new File(["PRIVATE_REFERENCE_BODY"], "剧本.txt"));
    const detail = await read("business_detail", { kind: "media", ownerId: project.id, id: reference.mediaId });
    expect((detail.data as { usage: unknown[] }).usage).toContainEqual({ kind: "reference", id: reference.id, label: reference.filename });
    expect(JSON.stringify(detail)).not.toContain("PRIVATE_REFERENCE_BODY");
    await expect(prepare("media_delete_orphan", { ownerId: project.id, id: reference.mediaId })).rejects.toThrow("引用");
    expect(await db.media.get(reference.mediaId)).toBeDefined();
    expect(targetRevision(await ownerSnapshot(project.id))).not.toBe(before);
    const ready = targetRevision(await ownerSnapshot(project.id));
    await db.projectReferences.update(reference.id, { status: "unavailable" });
    expect(targetRevision(await ownerSnapshot(project.id))).not.toBe(ready);
  });

  it("creates project → assets → beat → shots, edits/duplicates/reorders and cleans relations on deletion", async () => {
    const scope = await fixture();
    const { ownerId, episodeId } = scope;
    const character = await execute("character_create", { ownerId, fields: { name: "信使", motivation: "送达信件" } });
    const scene = await execute("scene_create", { ownerId, fields: { name: "站台", geography: "两条铁轨" } });
    const prop = await execute("prop_create", { ownerId, fields: { name: "信", continuity: "封口完整" } });
    const style = await execute("style_create", { ownerId, fields: { name: "雨夜", palette: "蓝色" } });
    await execute("project_update", { id: ownerId, patch: { brief: "关于送信的故事", logline: "信使在雨夜出发", setting: { rules: "雨不停" }, defaultStyleId: style.id, defaultDurationSec: 6 } });
    await execute("episode_update", { ownerId, id: episodeId, patch: { title: "出发", script: "信使走进站台。" } });
    const beat = await execute("beat_create", { ...scope, fields: { title: "抵达站台", content: "雨中进站", characterIds: [character.id], sceneId: scene.id } });
    const created = await execute("shot_create", { ...scope, beatId: beat.id, count: 2, fields: { content: "信使走进站台", propIds: [prop.id] } });
    const shots = created.items as Array<{ id: string }>;
    expect(await db.shots.get(shots[0].id)).toMatchObject({ characterIds: [character.id], sceneId: scene.id, propIds: [prop.id], durationSec: 6 });
    await execute("shot_update", { ...scope, id: shots[0].id, patch: { content: "信使回望", durationSec: 8, status: "ready", styleId: null } });
    expect((await db.shots.get(shots[0].id))?.styleId).toBeNull();
    await execute("shot_update", { ...scope, id: shots[0].id, patch: { inheritStyle: true } });
    expect((await db.shots.get(shots[0].id))?.styleId).toBeUndefined();
    await execute("beat_update", { ...scope, id: beat.id, patch: { title: "站台分别" } });
    const copy = await execute("creative_duplicate", { ...scope, kind: "shot", id: shots[0].id });
    await execute("creative_reorder", { ...scope, kind: "shot", orderedIds: [shots[1].id, shots[0].id, copy.id] });
    expect((await db.shots.where("episodeId").equals(episodeId).sortBy("order")).map((row) => row.id)).toEqual([shots[1].id, shots[0].id, copy.id]);
    const beatCopy = await execute("creative_duplicate", { ...scope, kind: "beat", id: beat.id, includeShots: false });
    await execute("creative_reorder", { ...scope, kind: "beat", orderedIds: [(beatCopy.beat as { id: string }).id, beat.id] });
    for (const kind of ["character", "scene", "prop", "style"] as const) {
      const id = { character, scene, prop, style }[kind].id;
      await execute(`${kind}_update`, { ownerId, id, patch: { notes: `更新${kind}` } });
      expect(await db.table(kind === "character" ? "characters" : `${kind}s`).get(String(id))).toMatchObject({ notes: `更新${kind}` });
    }
    await execute("character_delete", { ownerId, id: character.id });
    await execute("scene_delete", { ownerId, id: scene.id });
    await execute("prop_delete", { ownerId, id: prop.id });
    await execute("style_delete", { ownerId, id: style.id });
    expect((await db.shots.get(shots[0].id))?.characterIds).toEqual([]);
    expect((await db.shots.get(shots[0].id))?.sceneId).toBeUndefined();
    expect((await db.shots.get(shots[0].id))?.propIds).toEqual([]);
    expect((await db.projects.get(ownerId))?.defaultStyleId).toBeUndefined();
    await execute("beat_delete", { ...scope, id: beat.id });
    expect((await db.shots.get(shots[0].id))?.beatId).toBeUndefined();
    await execute("shot_delete", { ...scope, id: shots[0].id });
    expect(await db.shots.get(shots[0].id)).toBeUndefined();
    const next = await execute("episode_create", { ownerId, fields: { title: "归来" } });
    await execute("creative_reorder", { ownerId, kind: "episode", orderedIds: [next.id, episodeId] });
    await execute("episode_delete", { ownerId, id: episodeId });
    expect(await db.shots.where("episodeId").equals(episodeId).count()).toBe(0);
    await expect(prepare("episode_delete", { ownerId, id: next.id })).rejects.toThrow("最后");
    const pending = await prepare("project_delete", { id: ownerId });
    expect(pending.context.preview?.changes.join(" ")).toContain("1 个分集");
    await pending.execute();
    expect(await db.projects.get(ownerId)).toBeUndefined();
    expect(await db.episodes.where("projectId").equals(ownerId).count()).toBe(0);
  });

  it.each(["character", "scene", "prop", "style"] as const)("copies studio %s with independent fields/media and rejects duplicate source", async (kind) => {
    const { ownerId } = await fixture();
    const source = await execute(`${kind}_create`, { ownerId: "studio", fields: { name: "来源", notes: "原始设定" } });
    const slot = { character: "front", scene: "wide", prop: "hero", style: "look" }[kind];
    await repo.putMedia({ id: "studio-image", projectId: "studio", filename: "reference.png", mimeType: "image/png", blob: new Blob(["image"]) });
    await execute("slot_update", { kind, ownerId: "studio", id: source.id, slot, patch: { result: { mediaId: "studio-image", kind: "image" } } });
    const copy = await execute("asset_copy_from_studio", { kind, sourceId: source.id, ownerId });
    expect(copy.id).not.toBe(source.id);
    const row = await db.table(kind === "character" ? "characters" : `${kind}s`).get(String(copy.id));
    expect(row.slots[slot].result.mediaId).not.toBe("studio-image");
    expect((await db.media.get(row.slots[slot].result.mediaId))?.projectId).toBe(ownerId);
    await execute(`${kind}_update`, { ownerId, id: copy.id, patch: { notes: "仅项目修改" } });
    expect((await db.table(kind === "character" ? "characters" : `${kind}s`).get(String(source.id))).notes).toBe("原始设定");
    await expect(execute("asset_copy_from_studio", { kind, sourceId: source.id, ownerId })).rejects.toThrow("添加");
    await execute(`${kind}_delete`, { ownerId: "studio", id: source.id });
    expect(await db.media.get(row.slots[slot].result.mediaId)).toBeDefined();
  });
});

describe("business isolation, versioned approval and atomic outcomes", () => {
  it("rejects missing/studio/foreign ownership and rolls back invalid references", async () => {
    const scope = await fixture(), other = await fixture();
    await expect(prepare("project_delete", { id: "studio" })).rejects.toThrow();
    await expect(prepare("character_create", { ownerId: "missing" })).rejects.toThrow();
    await expect(prepare("episode_create", { ownerId: "studio" })).rejects.toThrow();
    await expect(prepare("beat_create", { ownerId: scope.ownerId, episodeId: other.episodeId })).rejects.toThrow();
    const source = await execute("character_create", { ownerId: other.ownerId });
    await expect(prepare("character_update", { ownerId: scope.ownerId, id: source.id, patch: { notes: "不能写" } })).rejects.toThrow();
    const before = await db.shots.count();
    await expect(execute("shot_create", { ...scope, count: 2, fields: { characterIds: [source.id] } })).rejects.toThrow();
    expect(await db.shots.count()).toBe(before);
    await expect(read("business_detail", { kind: "character", id: source.id, ownerId: scope.ownerId })).rejects.toThrow();
    await expect(read("business_search", { kind: "character" })).rejects.toThrow();
    await expect(execute("project_update", { id: scope.ownerId, patch: { generationDefaults: { video: { provider: "apimart", model: "MiniMax-H3", profileVersion: "2026-09-18", mode: "frames", aspectRatio: "16:9", duration: 5, resolution: "2K" } } } })).rejects.toThrow("比例");
  });
  it("revalidates target and delete cascade after approval without overwriting user changes", async () => {
    const scope = await fixture();
    const asset = await execute("character_create", { ownerId: scope.ownerId, fields: { name: "用户角色" } });
    const pending = await prepare("character_update", { ownerId: scope.ownerId, id: asset.id, patch: { notes: "AI计划" } });
    expect(pending.context.preview?.changes).toContain("备注：AI计划");
    await repo.patchCharacter(String(asset.id), { notes: "用户先改" });
    await expect(pending.execute()).rejects.toThrow("已变化");
    expect((await db.characters.get(String(asset.id)))?.notes).toBe("用户先改");
    const remove = await prepare("character_delete", { ownerId: scope.ownerId, id: asset.id });
    const shot = await repo.addShot(scope.ownerId, scope.episodeId);
    await repo.patchShot(shot.id, { characterIds: [String(asset.id)] });
    await expect(remove.execute()).rejects.toThrow("已变化");
    expect((await db.shots.get(shot.id))?.characterIds).toEqual([asset.id]);
  });
  it("flushes pending drafts before capture and before applying, and blocks failed drafts", async () => {
    const { ownerId } = await fixture();
    const asset = await execute("character_create", { ownerId });
    let value = "草稿一";
    const unregister = registerPendingDraft(ownerId, () => repo.patchCharacter(String(asset.id), { notes: value }));
    try {
      const pending = await prepare("character_update", { ownerId, id: asset.id, patch: { name: "AI命名" } });
      expect((await db.characters.get(String(asset.id)))?.notes).toBe("草稿一");
      value = "草稿二";
      await expect(pending.execute()).rejects.toThrow("已变化");
      expect((await db.characters.get(String(asset.id)))?.notes).toBe("草稿二");
    } finally { unregister(); }
    const safe = await prepare("character_update", { ownerId, id: asset.id, patch: { name: "不会写入" } });
    const broken = registerPendingDraft(ownerId, async () => { throw new Error("保存失败"); });
    try { await expect(prepare("character_update", { ownerId, id: asset.id, patch: { notes: "change" } })).rejects.toThrow(); }
    finally {
      await expect(safe.execute()).rejects.toBeInstanceOf(AtomicToolRollbackError);
      broken();
    }
  });
  it("replays completed create results once and rolls back if the result ledger cannot commit", async () => {
    const pending = await prepare("project_create", { name: "只创建一次" });
    const first = await pending.execute();
    expect(await pending.execute()).toEqual(first);
    expect(await db.projects.count()).toBe(1);
    expect((await db.agentToolCalls.get(pending.context.callId))?.status).toBe("completed");
    const failing = await prepare("project_create", { name: "不能落库" });
    const spy = vi.spyOn(db.agentToolCalls, "update").mockRejectedValueOnce(new Error("ledger failed"));
    try { await expect(failing.execute()).rejects.toThrow("ledger failed"); } finally { spy.mockRestore(); }
    expect(await db.projects.count()).toBe(1);
    expect(await db.episodes.count()).toBe(1);
  });
});

describe("business reads and media reuse", () => {
  it("pages scoped searches and long text without exposing blobs/extensions/credentials", async () => {
    const scope = await fixture();
    await repo.updateEpisodeDraft(scope.episodeId, { script: "长".repeat(100000) });
    const first = await execute("character_create", { ownerId: scope.ownerId, fields: { name: "雨中信使", notes: "谨慎" } });
    await execute("character_create", { ownerId: scope.ownerId, fields: { name: "雨中旅人" } });
    await repo.patchCharacter(String(first.id), { extra: { apiKey: "private-extension" } });
    const result = await read("business_search", { kind: "character", ownerId: scope.ownerId, query: "雨中", limit: 1 });
    expect((result.items as unknown[]).length).toBe(1); expect(result.nextOffset).toBe(1);
    expect((await read("business_search", { kind: "character", ownerId: "studio" })).total).toBe(0);
    const detail = await read("business_detail", { kind: "episode", id: scope.episodeId, ownerId: scope.ownerId });
    expect(detail.truncated).toBe(true); expect(JSON.stringify(detail).length).toBeLessThan(65536);
    const text = await read("business_read_text", { kind: "episode", id: scope.episodeId, ownerId: scope.ownerId, field: "story.script", offset: 12000, limit: 12000 });
    expect(text.text).toBe("长".repeat(12000)); expect(text.nextOffset).toBe(24000);
    expect(JSON.stringify(await read("business_detail", { kind: "character", id: first.id, ownerId: scope.ownerId }))).not.toContain("private-extension");
    await expect(read("business_read_text", { kind: "character", id: first.id, ownerId: scope.ownerId, field: "extra.apiKey" })).rejects.toThrow();
  });
  it("reuses only correct-owner real media, preserves shared references and deletes only orphans", async () => {
    const scope = await fixture();
    const asset = await execute("character_create", { ownerId: scope.ownerId });
    for (const [id, projectId, mimeType] of [["image", scope.ownerId, "image/png"], ["video", scope.ownerId, "video/mp4"], ["foreign", "studio", "image/png"], ["orphan", scope.ownerId, "image/png"]]) {
      await repo.putMedia({ id, projectId, filename: `${id}.bin`, mimeType, blob: new Blob(["fixture"]) });
    }
    const target = { kind: "character", ownerId: scope.ownerId, id: asset.id, slot: "front" };
    await execute("slot_update", { ...target, patch: { prompt: "真实参考", referenceImageIds: ["image"], referenceVideoIds: ["video"], result: { mediaId: "image", kind: "image" } } });
    await execute("slot_update", { ...target, slot: "side", patch: { result: { mediaId: "image", kind: "image" } } });
    expect(await db.media.count()).toBe(4);
    const detail = await read("business_detail", { kind: "media", ownerId: scope.ownerId, id: "image" });
    expect((detail.data as { usageCount: number }).usageCount).toBe(2);
    expect(JSON.stringify(detail)).not.toContain("blob");
    await expect(prepare("slot_update", { ...target, patch: { referenceImageIds: ["foreign"] } })).rejects.toThrow();
    await expect(prepare("slot_update", { ...target, patch: { result: { mediaId: "video", kind: "video" } } })).rejects.toThrow("图片");
    await expect(prepare("media_delete_orphan", { ownerId: scope.ownerId, id: "image" })).rejects.toThrow("引用");
    await execute("slot_update", { ...target, patch: { referenceImageIds: [], referenceVideoIds: [], result: null } });
    expect(await db.media.get("image")).toBeDefined();
    expect(await db.media.get("video")).toBeUndefined();
    await execute("media_delete_orphan", { ownerId: scope.ownerId, id: "orphan" });
    expect(await db.media.get("orphan")).toBeUndefined();
    const stale = await prepare("slot_update", { ...target, patch: { referenceImageIds: ["image"] } });
    await execute("slot_update", { ...target, slot: "side", patch: { result: null } });
    await expect(stale.execute()).rejects.toThrow();
    expect((await db.characters.get(String(asset.id)))?.slots.front?.referenceImageIds).toEqual([]);
  });
});

describe("business review regressions", () => {
  it.each(["missing", "foreign", "wrong-kind"])("rejects %s studio media before approval and at the repository copy boundary", async (condition) => {
    const { ownerId } = await fixture();
    const source = await repo.addCharacter("studio");
    if (condition !== "missing") await repo.putMedia({ id: "damaged", projectId: condition === "foreign" ? ownerId : "studio", filename: "damaged", mimeType: condition === "wrong-kind" ? "video/mp4" : "image/png", blob: new Blob(["content"]) });
    // Legacy/corrupt source can predate the strict slot API.
    await db.characters.update(source.id, { slots: { front: { prompt: "", referenceImageIds: [], referenceVideoIds: [], result: { mediaId: "damaged", kind: "image" } } } });
    await expect(prepare("asset_copy_from_studio", { kind: "character", sourceId: source.id, ownerId })).rejects.toThrow();
    await expect(repo.copyStudioCharacter(ownerId, source.id)).rejects.toThrow();
    expect(await db.characters.where("projectId").equals(ownerId).count()).toBe(0);
  });
  it("binds studio-copy media metadata and enforces new IDs for physical replacement", async () => {
    const { ownerId } = await fixture();
    const source = await repo.addCharacter("studio");
    const media = { id: "immutable", projectId: "studio", filename: "first.png", mimeType: "image/png", blob: new Blob(["first"]) };
    await repo.putMedia(media);
    await repo.setCharacterSlot(source.id, "front", { prompt: "", referenceImageIds: [media.id], referenceVideoIds: [] });
    const pending = await prepare("asset_copy_from_studio", { kind: "character", sourceId: source.id, ownerId });
    await expect(repo.putMedia({ ...media, blob: new Blob(["second"]) })).rejects.toThrow();
    // Simulate a legacy/external metadata change outside the append-only repository.
    await db.media.update(media.id, { filename: "changed.png" });
    await expect(pending.execute()).rejects.toThrow("已变化");
    expect(await db.characters.where("projectId").equals(ownerId).count()).toBe(0);
  });
  it("reports proposal and generation retention before orphan deletion approval", async () => {
    const scope = await fixture();
    const asset = await repo.addCharacter(scope.ownerId);
    await repo.putMedia({ id: "retained", projectId: scope.ownerId, filename: "result.png", mimeType: "image/png", blob: new Blob(["result"]) });
    const target = { kind: "character" as const, projectId: scope.ownerId, entityId: asset.id, slot: "front" as const };
    await db.agentGenerationJobs.add({ version: 1, id: "job", runId: "r", threadId: "t", callId: "c", projectId: scope.ownerId, connectorId: "connector", provider: "apimart", baseUrl: "https://fixture.invalid", model: "gpt-image-2", kind: "image", target, baseRevision: "rev", sourceRevisions: [], parameters: {}, inputs: [], fingerprint: "fingerprint", status: "downloaded", result: { mediaId: "retained", kind: "image" }, createdAt: "2026", updatedAt: "2026" });
    const detail = await read("business_detail", { kind: "media", ownerId: scope.ownerId, id: "retained" });
    expect((detail.data as { retention: unknown }).retention).toEqual({ generationJobs: 1, proposals: 0 });
    expect(JSON.stringify(detail)).not.toContain("connector");
    await expect(prepare("media_delete_orphan", { ownerId: scope.ownerId, id: "retained" })).rejects.toThrow("生成任务保留");
    await repo.deleteMediaIfOrphan("retained");
    expect(await db.media.get("retained")).toBeDefined();
    await execute("project_delete", { id: scope.ownerId });
    expect(await db.agentGenerationJobs.get("job")).toBeUndefined();
    expect(await db.media.get("retained")).toBeUndefined();
  });
  it("returns all supported scalar reference IDs rather than truncating at 50", async () => {
    const { ownerId } = await fixture();
    const character = await repo.addCharacter(ownerId);
    const ids = Array.from({ length: 100 }, (_, index) => `reference-${index}`);
    await db.characters.update(character.id, { slots: { front: { prompt: "", referenceImageIds: ids, referenceVideoIds: [] } } });
    const detail = await read("business_detail", { kind: "character", ownerId, id: character.id });
    expect((detail.data as { record: { slots: { front: { referenceImageIds: string[] } } } }).record.slots.front.referenceImageIds).toEqual(ids);
    expect(detail.truncated).toBe(false);
    const rest = await read("business_read_relations", { kind: "character", ownerId, id: character.id, field: "slots.front.referenceImageIds", offset: 50, limit: 50 });
    expect(rest.ids).toEqual(ids.slice(50));
    expect(rest.nextOffset).toBeNull();
  });
});

describe("generation retention lifecycle integration", () => {
  it("deleting a thread removes its jobs and recycles only media no longer retained elsewhere", async () => {
    const { ownerId } = await fixture();
    const first = await repo.createChatThread(), second = await repo.createChatThread();
    const asset = await repo.addCharacter(ownerId);
    for (const id of ["applied", "unassigned", "other-job"]) await repo.putMedia({ id, projectId: ownerId, filename: `${id}.png`, mimeType: "image/png", blob: new Blob([id]) });
    await repo.setCharacterSlot(asset.id, "front", { prompt: "", referenceImageIds: [], referenceVideoIds: [], result: { mediaId: "applied", kind: "image" } });
    for (const [id, threadId, mediaId] of [["j1", first.id, "applied"], ["j2", first.id, "unassigned"], ["j3", first.id, "other-job"], ["j4", second.id, "other-job"]]) {
      await db.agentGenerationJobs.add({ version: 1, id, runId: "r", threadId, callId: id, projectId: ownerId, connectorId: "c", provider: "apimart", baseUrl: "https://fixture.invalid", model: "gpt-image-2", kind: "image", target: { kind: "character", projectId: ownerId, entityId: asset.id, slot: "front" }, baseRevision: "revision", sourceRevisions: [], parameters: {}, inputs: [], fingerprint: id, status: "downloaded", result: { mediaId, kind: "image" }, createdAt: "2026", updatedAt: "2026" });
    }
    await repo.deleteChatThread(first.id);
    expect(await db.agentGenerationJobs.where("threadId").equals(first.id).count()).toBe(0);
    expect(await db.agentGenerationJobs.get("j4")).toBeDefined();
    expect(await db.media.get("unassigned")).toBeUndefined();
    expect(await db.media.get("applied")).toBeDefined();
    expect(await db.media.get("other-job")).toBeDefined();
  });
});
