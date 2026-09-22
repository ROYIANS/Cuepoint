import { describeRunWrites } from "@/lib/agent/runWriteOutcomes";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject, createChatThread } from "@/db/repo";
import { beginAgentRun } from "@/db/agentRuns";
import { saveToolPreview, saveToolRound, transitionToolCall } from "@/db/agentTools";
import { addAudioSegment, addAudioSpeaker, getAudioProjectSnapshot, patchAudioSegment } from "@/db/audio";
import { addMusicWork } from "@/db/music";
import { AUDIO_TOOLS } from "@/lib/agent/audioTools";
import { MUSIC_TOOLS } from "@/lib/agent/musicTools";
import { AUDIO_TOOL_NAMES, MUSIC_TOOL_NAMES } from "@/lib/agent/audioMusicToolNames";
import { BUILTIN_TOOLS } from "@/lib/agent/tools";
import type { AgentToolContext } from "@/lib/agent/tools";
import type { AgentRun } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { defaultMusicSettings } from "@/domain/music";

const registry = [...AUDIO_TOOLS, ...MUSIC_TOOLS];
const tool = (name: string) => registry.find((entry) => entry.name === name)!;
const connector: ConnectorConfig = { id: "test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "test", updatedAt: "2026-09-22" };
async function begin(projectId?: string) {
  const thread = await createChatThread({ projectId });
  const run = await beginAgentRun({ threadId: thread.id, connector, model: "fixture", content: "制作配音" });
  const ready = { ...run, permissionMode: "full" as const, enabledToolNames: registry.map((entry) => entry.name), toolLoading: undefined };
  await db.agentRuns.put(ready); return ready;
}
function context(run: AgentRun, callId = "read"): AgentToolContext {
  return { runId: run.id, threadId: run.threadId, callId, projectId: run.projectId, signal: new AbortController().signal };
}
async function prepareCall(run: AgentRun, name: string, raw: unknown) {
  const definition = tool(name), args = definition.parseArguments(raw);
  await saveToolRound(run.id, "", [{ id: "provider-call", type: "function", function: { name, arguments: JSON.stringify(raw) } }], [{ title: definition.title, effect: definition.effect, atomic: true, highRisk: definition.highRisk(args) }]);
  const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).at(-1)!;
  const ctx = context(run, call.id); const preview = await definition.prepare!(args, ctx);
  await saveToolPreview(run.id, call.id, preview);
  await transitionToolCall(run.id, call.id, ["pending"], "running");
  return { definition, args, ctx: { ...ctx, preview }, call };
}

describe("audio/music Agent local tools", () => {
  it("persists a receipt with real script changes and replays it without a second write", async () => {
    const project = await createAudioMusicProject("配音", "audio"), run = await begin(project.id);
    const chapter = (await getAudioProjectSnapshot(project.id)).chapters[0];
    const call = await prepareCall(run, "audio_create", { projectId: project.id, kind: "segment", chapterId: chapter.id, text: "午安", order: 0 });
    const result = await call.definition.execute(call.args, call.ctx);
    const segment = (await db.audioSegments.toArray())[0];
    expect(result).toMatchObject({ writeReceipt: { version: 1, entries: [{ kind: "audio_segment", operation: "created", id: segment.id, ownerId: project.id, revision: segment.revision }] } });
    expect(await call.definition.execute(call.args, call.ctx)).toEqual(result);
    expect(await db.audioSegments.count()).toBe(1);
    const saved = (await db.agentToolCalls.get(call.call.id))!;
    expect(JSON.parse(saved.result!)).toEqual(result);
    expect(describeRunWrites(run, [saved])).toMatchObject({ total: 1, uncoveredCalls: 0, groups: [{ label: "新增脚本段落", count: 1 }] });
    expect(await db.audioTakes.count()).toBe(0);
    expect(await db.audioClips.count()).toBe(0);
  });

  it("resolves omitted audio project IDs from durable binding in lists and text pages", async () => {
    const project = await createAudioMusicProject("配音", "audio"), run = await begin(project.id);
    const chapter = (await getAudioProjectSnapshot(project.id)).chapters[0];
    const segment = await addAudioSegment(project.id, { chapterId: chapter.id, text: "当前项目的台词", notes: "轻声", order: 0 });
    const speaker = await addAudioSpeaker(project.id, { name: "旁白", voice: "茉莉", speed: 1, mimo: { mode: "preset", instruction: "自然讲述" } });
    const reader = tool("audio_read"), ctx = { ...context(run), projectId: undefined };
    for (const kind of ["chapters", "speakers", "segments", "takes", "tracks", "clips"]) {
      const raw = { kind };
      const args = reader.parseArguments(raw);
      expect(await reader.execute(args, ctx)).toMatchObject({ projectId: project.id });
      expect(args).not.toHaveProperty("projectId");
      expect(raw).toEqual({ kind });
    }
    for (const [field, text] of [["text", segment.text], ["notes", segment.notes]] as const) {
      expect(await reader.execute(reader.parseArguments({ kind: "segments", id: segment.id, field }), ctx))
        .toMatchObject({ projectId: project.id, id: segment.id, text });
    }
    expect(await reader.execute(reader.parseArguments({ kind: "speakers", id: speaker.id, field: "instruction" }), ctx))
      .toMatchObject({ projectId: project.id, id: speaker.id, text: "自然讲述" });
  });

  it("returns music project identity for optional list, detail and lyric reads", async () => {
    const project = await createAudioMusicProject("音乐", "music"), run = await begin(project.id);
    const work = await addMusicWork(project.id, { title: "晚安", notes: "轻柔", lyrics: "夜色渐深", favorite: false, mediaId: "music-sample", durationSec: 1, sampleRate: 48000, channels: 1 },
      { id: "music-sample", projectId: project.id, filename: "music.wav", mimeType: "audio/wav", blob: new Blob(["sample"]) });
    const reader = tool("music_read"), ctx = { ...context(run), projectId: undefined };
    for (const kind of ["drafts", "works"]) {
      expect(await reader.execute(reader.parseArguments({ kind }), ctx)).toMatchObject({ projectId: project.id });
    }
    expect(await reader.execute(reader.parseArguments({ kind: "works", id: work.id }), ctx))
      .toMatchObject({ projectId: project.id, items: [{ id: work.id }] });
    for (const [field, text] of [["lyrics", work.lyrics], ["notes", work.notes]] as const) {
      expect(await reader.execute(reader.parseArguments({ kind: "works", id: work.id, field }), ctx))
        .toMatchObject({ projectId: project.id, id: work.id, text });
    }
  });

  it.each(["audio", "music"] as const)("recovers from an explicit wrong %s project ID without reopening the conversation", async (kind) => {
    const project = await createAudioMusicProject("当前作品", kind), other = await createAudioMusicProject("其他作品", kind), run = await begin(project.id);
    const reader = tool(`${kind}_read`), readKind = kind === "audio" ? "chapters" : "drafts";
    const wrong = reader.parseArguments({ projectId: other.id, kind: readKind });
    const error = await reader.execute(wrong, context(run)).catch((reason: Error) => reason);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(project.id);
    expect((error as Error).message).toContain("projectId");
    expect((error as Error).message).toContain("当前对话已绑定项目");
    expect((error as Error).message).toContain("无需重新打开");
    expect((error as Error).message).not.toMatch(/请重新打开|请重新进入|目标项目绑定的对话/);
    expect(wrong).toMatchObject({ projectId: other.id });
    const result = await reader.execute(reader.parseArguments({ projectId: project.id, kind: readKind }), context(run)) as { projectId: string; items: { id: string; revision: number }[] };
    expect(result.projectId).toBe(project.id);
    if (kind === "audio") {
      const chapter = result.items[0];
      const args = { projectId: result.projectId, kind: "chapter", id: chapter.id, revision: chapter.revision, patch: { title: "恢复后编辑" } };
      await expect(tool("audio_update").prepare!({ ...args, projectId: other.id }, context(run))).rejects.toThrow(project.id);
      const call = await prepareCall(run, "audio_update", args);
      await call.definition.execute(call.args, call.ctx);
      expect((await db.audioChapters.get(chapter.id))?.title).toBe("恢复后编辑");
      expect((await getAudioProjectSnapshot(other.id)).chapters[0].title).not.toBe("恢复后编辑");
    } else {
      const args = { projectId: result.projectId, settings: { ...defaultMusicSettings("flowmusic"), soundPrompt: "恢复后的钢琴" } };
      await expect(tool("music_save_draft").prepare!({ ...args, projectId: other.id }, context(run))).rejects.toThrow(project.id);
      const call = await prepareCall(run, "music_save_draft", args);
      await call.definition.execute(call.args, call.ctx);
      expect((await db.musicDrafts.where("projectId").equals(project.id).toArray()).some(row => row.settings.engine === "flowmusic" && row.settings.soundPrompt === "恢复后的钢琴")).toBe(true);
      expect((await db.musicDrafts.where("projectId").equals(other.id).toArray()).some(row => row.settings.engine === "flowmusic" && row.settings.soundPrompt === "恢复后的钢琴")).toBe(false);
    }
  });

  it.each(["audio", "music"] as const)("keeps %s reads and edits guarded for unbound, forged and deleted scopes", async (kind) => {
    const project = await createAudioMusicProject("当前作品", kind), other = await createAudioMusicProject("其他作品", kind);
    const run = await begin(project.id), unbound = await begin();
    const reader = tool(`${kind}_read`), readArgs = reader.parseArguments({ kind: kind === "audio" ? "chapters" : "drafts" });
    const writer = tool(kind === "audio" ? "audio_create" : "music_save_draft");
    const writeArgs = writer.parseArguments(kind === "audio" ? { projectId: project.id, kind: "speaker", name: "旁白" } : { projectId: project.id, settings: defaultMusicSettings() });
    const cases = [
      { ctx: context(unbound), error: "当前对话尚未绑定项目" },
      { ctx: { ...context(run), projectId: other.id }, error: "归属不匹配" },
      { ctx: { ...context(run), threadId: unbound.threadId }, error: "归属不匹配" },
      { ctx: { ...context(run), runId: "missing-run" }, error: "归属不匹配" },
    ];
    for (const { ctx, error } of cases) {
      await expect(reader.execute(readArgs, ctx)).rejects.toThrow(error);
      await expect(writer.prepare!(writeArgs, ctx)).rejects.toThrow(error);
      await expect(writer.execute(writeArgs, ctx)).rejects.toThrow(error);
    }
    // A model-supplied ID cannot grant authority to an unbound conversation.
    await expect(reader.execute({ ...readArgs as object, projectId: project.id }, context(unbound))).rejects.toThrow("当前对话尚未绑定项目");
    await db.projects.delete(project.id);
    await expect(reader.execute(readArgs, context(run))).rejects.toThrow("不存在");
    await expect(writer.prepare!(writeArgs, context(run))).rejects.toThrow("不存在");
    await expect(writer.execute(writeArgs, context(run))).rejects.toThrow("不存在");
    expect(await db.audioSpeakers.count()).toBe(0);
  });

  it("has complete compact allowlists and rejects arbitrary schema fields", () => {
    for (const name of new Set([...AUDIO_TOOL_NAMES, ...MUSIC_TOOL_NAMES])) expect(BUILTIN_TOOLS.some((entry) => entry.name === name), name).toBe(true);
    expect(new Set([...AUDIO_TOOL_NAMES, ...MUSIC_TOOL_NAMES]).size + 8).toBeLessThanOrEqual(36);
    expect(() => tool("audio_create").parseArguments({ projectId: "p", kind: "track", chapterId: "c", name: "voice", role: "voice", order: 0, approved: true })).toThrow();
    expect(() => tool("music_save_draft").parseArguments({ projectId: "p", settings: { ...defaultMusicSettings("flowmusic"), instrumental: true } })).toThrow();
  });

  it("creates MiMo voices by default while preserving explicit APIMart profiles", async () => {
    const project = await createAudioMusicProject("音色", "audio");
    for (const [name, fields] of [["默认", {}], ["旧音色", { voice: "alloy", speed: 1.2 }], ["MiMo 预置", { voice: "茉莉" }]] as const) {
      const run = await begin(project.id);
      const call = await prepareCall(run, "audio_create", { projectId: project.id, kind: "speaker", name, ...fields });
      await call.definition.execute(call.args, call.ctx);
    }
    const rows = await db.audioSpeakers.where("projectId").equals(project.id).toArray();
    expect(rows.find(row => row.name === "默认")).toMatchObject({ voice: "mimo_default", speed: 1, mimo: { mode: "preset", instruction: "" } });
    expect(rows.find(row => row.name === "MiMo 预置")).toMatchObject({ voice: "茉莉", mimo: { mode: "preset", instruction: "" } });
    const legacy = rows.find(row => row.name === "旧音色")!;
    expect(legacy).toMatchObject({ voice: "alloy", speed: 1.2 });
    expect(legacy.mimo).toBeUndefined();
  });

  it("creates script and ledger atomically, and replay does not duplicate records", async () => {
    const project = await createAudioMusicProject("配音", "audio"), run = await begin(project.id);
    const chapter = (await getAudioProjectSnapshot(project.id)).chapters[0];
    const call = await prepareCall(run, "audio_create", { projectId: project.id, kind: "segment", chapterId: chapter.id, text: "第一段", order: 0 });
    const result = await call.definition.execute(call.args, call.ctx);
    expect(await call.definition.execute(call.args, call.ctx)).toEqual(result);
    expect(await db.audioSegments.count()).toBe(1);
    expect(await db.agentToolCalls.get(call.call.id)).toMatchObject({ status: "completed" });
  });

  it("creates and clears a reusable MiMo speaker profile through the tool ledger", async () => {
    const project = await createAudioMusicProject("配音", "audio"), run = await begin(project.id);
    const call = await prepareCall(run, "audio_create", { projectId: project.id, kind: "speaker", name: "旁白", voice: "mimo_default", speed: 1, mimo: { mode: "design", instruction: "沉稳磁性的男声".repeat(500) } });
    await call.definition.execute(call.args, call.ctx);
    const speaker = (await db.audioSpeakers.toArray())[0];
    expect(speaker.mimo).toEqual({ mode: "design", instruction: "沉稳磁性的男声".repeat(500) });
    const reader = tool("audio_read");
    const page = await reader.execute(reader.parseArguments({ projectId: project.id, kind: "speakers" }), context(run));
    expect(JSON.stringify(page).length).toBeLessThan(1500);
    const full = await reader.execute(reader.parseArguments({ projectId: project.id, kind: "speakers", id: speaker.id, field: "instruction", textOffset: 300 }), context(run));
    expect(full).toMatchObject({ text: speaker.mimo!.instruction.slice(300, 4300), totalLength: speaker.mimo!.instruction.length });
    const updateRun = await begin(project.id);
    const update = await prepareCall(updateRun, "audio_update", { projectId: project.id, id: speaker.id, revision: speaker.revision, kind: "speaker", patch: { voice: "alloy", mimo: null } });
    await update.definition.execute(update.args, update.ctx);
    expect((await db.audioSpeakers.get(speaker.id))?.mimo).toBeUndefined();
  });

  it("rolls back domain changes when tool ledger persistence fails", async () => {
    const project = await createAudioMusicProject("配音", "audio"), run = await begin(project.id);
    const call = await prepareCall(run, "audio_create", { projectId: project.id, kind: "speaker", name: "旁白" });
    const failure = vi.spyOn(db.agentToolCalls, "update").mockRejectedValueOnce(new Error("disk full"));
    try { await expect(call.definition.execute(call.args, call.ctx)).rejects.toThrow("disk full"); }
    finally { failure.mockRestore(); }
    expect(await db.audioSpeakers.count()).toBe(0);
    expect((await db.agentToolCalls.get(call.call.id))?.result).toBeUndefined();
  });

  it("rejects wrong project and stale preview while preserving the latest manual edit", async () => {
    const project = await createAudioMusicProject("A", "audio"), other = await createAudioMusicProject("B", "audio"), run = await begin(project.id);
    await expect(tool("audio_read").execute({ projectId: other.id, kind: "segments" }, context(run))).rejects.toThrow("绑定");
    const chapter = (await getAudioProjectSnapshot(project.id)).chapters[0];
    const segment = await addAudioSegment(project.id, { chapterId: chapter.id, text: "原文", notes: "", order: 0 });
    const args = { projectId: project.id, kind: "segment", id: segment.id, revision: segment.revision, patch: { text: "Agent 编辑" } };
    const call = await prepareCall(run, "audio_update", args);
    await patchAudioSegment(project.id, segment.id, segment.revision, { text: "手工编辑" });
    await expect(call.definition.execute(call.args, call.ctx)).rejects.toThrow();
    expect((await db.audioSegments.get(segment.id))?.text).toBe("手工编辑");
  });

  it("paginates real script text and never exposes full large text through indexes", async () => {
    const project = await createAudioMusicProject("配音", "audio"), run = await begin(project.id);
    const chapter = (await getAudioProjectSnapshot(project.id)).chapters[0];
    const segment = await addAudioSegment(project.id, { chapterId: chapter.id, text: "声".repeat(6000), notes: "", order: 0 });
    const list = await tool("audio_read").execute({ projectId: project.id, kind: "segments" }, context(run));
    expect(JSON.stringify(list).length).toBeLessThan(2000);
    expect(list).toMatchObject({ items: [{ text: { totalLength: 6000, truncated: true } }] });
    expect(await tool("audio_read").execute({ projectId: project.id, kind: "segments", id: segment.id, field: "text", textOffset: 4000 }, context(run))).toMatchObject({ text: "声".repeat(2000), nextOffset: null });
  });

  it("saves a real music draft without generating work and protects engine scope", async () => {
    const project = await createAudioMusicProject("音乐", "music"), run = await begin(project.id);
    const call = await prepareCall(run, "music_save_draft", { projectId: project.id, settings: { ...defaultMusicSettings("flowmusic"), soundPrompt: "安静的钢琴", lengthSec: 60 } });
    await call.definition.execute(call.args, call.ctx);
    expect((await db.musicDrafts.where("projectId").equals(project.id).toArray()).some((draft) => draft.settings.engine === "flowmusic")).toBe(true);
    expect(await db.musicWorks.count()).toBe(0); expect(await db.audioGenerationJobs.count()).toBe(0);
    expect(describeRunWrites(run, await db.agentToolCalls.where("runId").equals(run.id).toArray())).toMatchObject({ total: 1, groups: [{ label: "新增音乐草稿", count: 1 }] });
    await expect(tool("audio_read").execute({ projectId: project.id, kind: "segments" }, context(run))).rejects.toThrow();
    await expect(tool("music_save_draft").prepare!({ projectId: project.id, id: "missing-revision", settings: defaultMusicSettings() }, context(run))).rejects.toThrow("同时提供");
  });
});
