import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject, createChatThread } from "@/db/repo";
import { beginAgentRun } from "@/db/agentRuns";
import { resumeAgentRun, saveToolPreview } from "@/db/agentTools";
import { addMusicDraft, patchMusicDraft } from "@/db/music";
import type { MusicSettings } from "@/domain/music";
import type { AgentRun, AgentToolPreview } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { AUDIO_GENERATION_TOOLS, AUDIO_GENERATION_TOOL_NAMES } from "@/lib/agent/audioGenerationTools";
import { approveMusicGenerationReview, parseMusicGenerationReview, readMusicGenerationReview } from "@/lib/agent/musicGenerationReview";
import { MUSIC_REVIEW_MAX_BYTES } from "@/lib/agent/musicGenerationReviewSnapshot";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";

const connector: ConnectorConfig = { id: "apimart", definitionId: "apimart", label: "音乐连接", baseUrl: "https://api.apimart.ai/v1", apiKey: "paid-secret", updatedAt: "2026-09-22" };
const model: ConnectorConfig = { id: "model", definitionId: "openai-compatible", baseUrl: "https://model.example/v1", apiKey: "model-secret", updatedAt: "2026-09-22" };
const settings: MusicSettings = { engine: "flowmusic", title: "风中的歌", soundPrompt: "温柔钢琴", lyrics: "第一句\n第二句", lengthSec: 120 };
const musicTool = AUDIO_GENERATION_TOOLS.find(row => row.name === "music_generate")!;
async function fixture(input = settings) {
  const project = await createAudioMusicProject("音乐项目", "music");
  await db.connectors.put(connector);
  const draft = await addMusicDraft(project.id, { settings: input });
  const thread = await createChatThread({ projectId: project.id });
  const initial = await beginAgentRun({ threadId: thread.id, connector: model, model: "fixture", content: "提交音乐" });
  const run: AgentRun = { ...initial, permissionMode: "full", enabledToolNames: [...AUDIO_GENERATION_TOOL_NAMES], toolLoading: undefined };
  await db.agentRuns.put(run);
  const args = { projectId: project.id, connectorId: connector.id, draftId: draft.id, draftRevision: draft.revision };
  await executeChatRun(run, model.apiKey, new AbortController(), vi.fn(async () => Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: "music-call", type: "function", function: { name: "music_generate", arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] })), AUDIO_GENERATION_TOOLS);
  const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
  expect(call.status, call.error).toBe("awaiting_approval");
  return { project, draft, run, call, args };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("frozen music review and local approval", () => {
  it.each(["newer run", "newer user message", "rebound thread", "disabled tool", "conversation mode", "unknown sibling", "running sibling"])("rejects approval when %s invalidates the current execution", async change => {
    const { call, run } = await fixture();
    if (change === "newer run") await db.agentRuns.put({ ...run, id: "newer-run", createdAt: "2099-01-01T00:00:00.000Z" });
    if (change === "newer user message") {
      const message = (await db.chatMessages.get(run.assistantMessageId))!;
      await db.chatMessages.put({ ...message, id: "newer-message", role: "user", createdAt: "2099-01-01T00:00:00.000Z" });
    }
    if (change === "rebound thread") await db.chatThreads.update(run.threadId, { projectId: "another-project" });
    if (change === "disabled tool") await db.agentRuns.update(run.id, { enabledToolNames: [] });
    if (change === "conversation mode") await db.agentRuns.update(run.id, { interactionMode: "conversation" });
    if (change === "unknown sibling" || change === "running sibling") await db.agentToolCalls.put({ ...call, id: "sibling", providerCallId: "sibling-call", status: change === "unknown sibling" ? "unknown" : "running" });
    expect((await readMusicGenerationReview(call)).status).toBe("unavailable");
    await expect(approveMusicGenerationReview(call)).rejects.toThrow();
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("awaiting_approval");
    expect(await db.audioGenerationJobs.count()).toBe(0);
  });

  it("keeps a multi-approval run parked until every pending decision is resolved", async () => {
    const { call, run } = await fixture();
    const sibling = { ...call, id: "second-music-call", providerCallId: "second-provider-call" };
    await db.agentToolCalls.add(sibling);
    await approveMusicGenerationReview(call);
    await expect(resumeAgentRun(run.id)).rejects.toThrow("待处理");
    expect((await db.agentRuns.get(run.id))?.status).toBe("waiting_approval");
    expect(await readMusicGenerationReview(sibling)).toEqual({ status: "ready" });
    await approveMusicGenerationReview(sibling);
    expect((await resumeAgentRun(run.id)).status).toBe("running");
    expect(await db.audioGenerationJobs.count()).toBe(0);
  });

  it("retains complete long Unicode lyrics/settings and approves once without any paid calls", async () => {
    const long = { ...settings, lyrics: "词".repeat(20000), soundPrompt: "音".repeat(20000) };
    const paid = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", paid);
    const { call } = await fixture(long);
    const snapshot = parseMusicGenerationReview(call.preview?.music)!;
    expect(snapshot.settings).toEqual(long);
    expect(JSON.stringify(call.preview).length).toBeGreaterThan(32768);
    expect(JSON.stringify(snapshot)).not.toContain("paid-secret");
    expect(JSON.stringify(snapshot)).not.toContain("https://");
    expect(await readMusicGenerationReview(call)).toEqual({ status: "ready" });
    await approveMusicGenerationReview(call);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("approved");
    await expect(approveMusicGenerationReview(call)).rejects.toThrow("已处理");
    expect(await db.audioGenerationJobs.count()).toBe(0);
    expect(paid).not.toHaveBeenCalled();
  });

  it.each(["draft", "connector key", "connector endpoint", "connector label", "draft deleted", "connector deleted", "project deleted"])("blocks changed %s without adopting new contents", async change => {
    const { call, draft, project } = await fixture();
    const frozen = structuredClone(call.preview);
    if (change === "draft") await patchMusicDraft(project.id, draft.id, draft.revision, { settings: { ...settings, lyrics: "修改的歌词" } });
    if (change === "connector key") await db.connectors.update(connector.id, { apiKey: "new-secret" });
    if (change === "connector endpoint") await db.connectors.update(connector.id, { baseUrl: "https://new.example/v1" });
    if (change === "connector label") await db.connectors.update(connector.id, { label: "新连接名" });
    if (change === "draft deleted") await db.musicDrafts.delete(draft.id);
    if (change === "connector deleted") await db.connectors.delete(connector.id);
    if (change === "project deleted") await db.projects.delete(project.id);
    expect((await readMusicGenerationReview(call)).status).toBe("stale");
    await expect(approveMusicGenerationReview(call)).rejects.toThrow("重新准备");
    expect((await db.agentToolCalls.get(call.id))?.preview).toEqual(frozen);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("awaiting_approval");
  });

  it("rejects missing/legacy snapshots, forged settings, args and owner mismatches", async () => {
    const { call } = await fixture();
    for (const candidate of [
      { ...call, preview: { ...call.preview!, music: undefined } },
      { ...call, arguments: JSON.stringify({ ...JSON.parse(call.arguments), draftRevision: 999 }) },
      { ...call, preview: { ...call.preview!, music: { ...call.preview!.music!, settings: { ...settings, lyrics: "未见过的歌词" } } } },
      { ...call, runId: "other" }, { ...call, threadId: "other" },
    ]) {
      expect((await readMusicGenerationReview(candidate)).status).not.toBe("ready");
      await expect(approveMusicGenerationReview(candidate)).rejects.toThrow();
    }
    await db.agentToolCalls.update(call.id, { preview: { ...call.preview!, music: undefined } });
    expect((await readMusicGenerationReview(call)).status).toBe("stale");
    expect(await db.audioGenerationJobs.count()).toBe(0);
  });

  it("allows only one of racing approval attempts", async () => {
    const { call } = await fixture();
    const results = await Promise.allSettled([approveMusicGenerationReview(call), approveMusicGenerationReview(call)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });

  it("serializes an edit scheduled during approval and submit-time preflight still rejects that later edit", async () => {
    const { call, project, draft, run } = await fixture();
    const paid = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", paid);
    const prepare = musicTool.prepare!;
    let mutation: Promise<unknown> | undefined;
    vi.spyOn(musicTool, "prepare").mockImplementation(async (args, context) => {
      const fresh = await prepare(args, context);
      // Ignore the ambient approval transaction to model another tab's write.
      mutation = db.transaction("rw!", db.musicDrafts, () => db.musicDrafts.update(draft.id, { settings: { ...settings, lyrics: "后来修改" }, revision: draft.revision + 1 }));
      return fresh;
    });
    await approveMusicGenerationReview(call);
    await mutation;
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("approved");
    expect((await db.musicDrafts.get(draft.id))?.settings).toMatchObject({ lyrics: "后来修改" });
    await resumeChatRun(run.id, model.apiKey, new AbortController(), vi.fn(async () => Response.json({ choices: [{ message: { content: "完成检查" }, finish_reason: "stop" }] })), AUDIO_GENERATION_TOOLS);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("failed");
    expect(await db.audioGenerationJobs.where("projectId").equals(project.id).count()).toBe(0);
    expect(paid).not.toHaveBeenCalled();
  });

  it("rejects unknown snapshot fields, malformed settings and unsupported versions", async () => {
    const { call } = await fixture();
    const snapshot = call.preview!.music!;
    for (const value of [{ ...snapshot, apiKey: "secret" }, { ...snapshot, version: 2 }, { ...snapshot, settings: { ...settings, extra: true } }, { ...snapshot, settings: { ...settings, lengthSec: 999 } }]) {
      expect(parseMusicGenerationReview(value)).toBeUndefined();
    }
  });

  it("bounds music preview bytes at exactly 128 KiB and retains generic preview limits", async () => {
    const { call, run } = await fixture();
    const original = call.preview!;
    async function save(preview: AgentToolPreview, name = "music_generate") {
      await db.agentRuns.update(run.id, { status: "running" });
      await db.agentToolCalls.update(call.id, { name, status: "pending", preview: undefined });
      return saveToolPreview(run.id, call.id, preview);
    }
    const boundary = structuredClone(original);
    boundary.music!.settings = { ...settings, seed: "" };
    const gap = MUSIC_REVIEW_MAX_BYTES - new TextEncoder().encode(JSON.stringify(boundary)).byteLength;
    boundary.music!.settings.seed = "s".repeat(gap);
    await save(boundary);
    expect(new TextEncoder().encode(JSON.stringify((await db.agentToolCalls.get(call.id))!.preview)).byteLength).toBe(MUSIC_REVIEW_MAX_BYTES);
    await expect(save({ ...boundary, summary: boundary.summary + "x" })).rejects.toThrow("超出限制");
    await expect(save(boundary, "audio_generate_speech")).rejects.toThrow("不匹配");
    const generic = { summary: "普通操作", changes: Array.from({ length: 20 }, () => "x".repeat(2000)) };
    await expect(save(generic, "audio_generate_speech")).rejects.toThrow("超出限制");
  });
});
