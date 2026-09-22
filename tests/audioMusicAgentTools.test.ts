import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject, createChatThread } from "@/db/repo";
import { beginAgentRun } from "@/db/agentRuns";
import { saveToolPreview, saveToolRound, transitionToolCall } from "@/db/agentTools";
import { addAudioSegment, getAudioProjectSnapshot, patchAudioSegment } from "@/db/audio";
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
async function begin(projectId: string) {
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
  it("has complete compact allowlists and rejects arbitrary schema fields", () => {
    for (const name of new Set([...AUDIO_TOOL_NAMES, ...MUSIC_TOOL_NAMES])) expect(BUILTIN_TOOLS.some((entry) => entry.name === name), name).toBe(true);
    expect(new Set([...AUDIO_TOOL_NAMES, ...MUSIC_TOOL_NAMES]).size + 8).toBeLessThanOrEqual(36);
    expect(() => tool("audio_create").parseArguments({ projectId: "p", kind: "track", chapterId: "c", name: "voice", role: "voice", order: 0, approved: true })).toThrow();
    expect(() => tool("music_save_draft").parseArguments({ projectId: "p", settings: { ...defaultMusicSettings("flowmusic"), instrumental: true } })).toThrow();
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

  it("rolls back domain changes when tool ledger persistence fails", async () => {
    const project = await createAudioMusicProject("配音", "audio"), run = await begin(project.id);
    const call = await prepareCall(run, "audio_create", { projectId: project.id, kind: "speaker", name: "旁白" });
    const failure = vi.spyOn(db.agentToolCalls, "update").mockRejectedValueOnce(new Error("disk full"));
    try { await expect(call.definition.execute(call.args, call.ctx)).rejects.toThrow("disk full"); }
    finally { failure.mockRestore(); }
    expect(await db.audioSpeakers.count()).toBe(0);
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
    await expect(tool("audio_read").execute({ projectId: project.id, kind: "segments" }, context(run))).rejects.toThrow();
    await expect(tool("music_save_draft").prepare!({ projectId: project.id, id: "missing-revision", settings: defaultMusicSettings() }, context(run))).rejects.toThrow("同时提供");
  });
});
