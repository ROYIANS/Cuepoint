import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject, createChatThread } from "@/db/repo";
import { beginAgentRun, interruptThreadRuns } from "@/db/agentRuns";
import { resolveAgentToolApproval } from "@/db/agentTools";
import { addAudioSegment, addAudioSpeaker, patchAudioSpeaker } from "@/db/audio";
import { addMusicDraft, patchMusicDraft } from "@/db/music";
import { defaultMusicSettings } from "@/domain/music";
import type { AgentPermissionMode, AgentRun } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { AUDIO_GENERATION_TOOLS, AUDIO_GENERATION_TOOL_NAMES } from "@/lib/agent/audioGenerationTools";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { getProjectContext, refreshRunProjectContext } from "@/lib/agent/projectContext";
import { encodePcm16Wav } from "@/lib/audio/wav";

const chatConnector: ConnectorConfig = { id: "model", definitionId: "openai-compatible", baseUrl: "https://model.example/v1", apiKey: "model-secret", updatedAt: "2026-09-22" };
const generationConnector: ConnectorConfig = { id: "apimart", definitionId: "apimart", label: "声音", baseUrl: "https://api.apimart.ai/v1", apiKey: "paid-secret", updatedAt: "2026-09-22" };
const answer = () => Response.json({ choices: [{ message: { content: "处理完成" }, finish_reason: "stop" }] });
const toolResponse = (name: string, args: unknown) => Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: "paid-call", type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] });

async function fixture(kind: "audio" | "music", mode: AgentPermissionMode = "full") {
  const project = await createAudioMusicProject("声音作品", kind);
  await db.connectors.put(generationConnector);
  const thread = await createChatThread({ projectId: project.id });
  const initial = await beginAgentRun({ threadId: thread.id, connector: chatConnector, model: "fixture", content: "生成声音" });
  const run: AgentRun = { ...initial, permissionMode: mode, enabledToolNames: [...AUDIO_GENERATION_TOOL_NAMES], toolLoading: undefined };
  await db.agentRuns.put(run);
  const draft = kind === "music" ? await addMusicDraft(project.id, { settings: { ...defaultMusicSettings("flowmusic"), soundPrompt: "温柔钢琴" } }) : undefined;
  const name = kind === "audio" ? "audio_generate_speech" : "music_generate";
  const args = kind === "audio" ? { projectId: project.id, connectorId: generationConnector.id, text: "你好", voice: "alloy", speed: 1 }
    : { projectId: project.id, connectorId: generationConnector.id, draftId: draft!.id, draftRevision: draft!.revision };
  return { project, run, draft, name, args };
}
async function awaiting(run: AgentRun, name: string, args: unknown) {
  await executeChatRun(run, chatConnector.apiKey, new AbortController(), vi.fn(async () => toolResponse(name, args)), AUDIO_GENERATION_TOOLS);
  const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
  expect(calls).toHaveLength(1); expect(calls[0].status, calls[0].error).toBe("awaiting_approval");
  expect(calls[0].requiresConfirmation).toBe(true);
  return calls[0];
}

afterEach(() => vi.unstubAllGlobals());

describe("paid audio/music Agent approval and recovery", () => {
  it("advertises configured MiMo as default without silently falling back", async () => {
    const f = await fixture("audio");
    const capabilities = AUDIO_GENERATION_TOOLS.find(row => row.name === "audio_generation_capabilities")!;
    const ctx = { runId: f.run.id, threadId: f.run.threadId, callId: "read", projectId: f.project.id, signal: new AbortController().signal };
    expect(await capabilities.execute({}, ctx)).toMatchObject({ defaultSpeech: { provider: "mimo", connectorId: null } });
    const speech = AUDIO_GENERATION_TOOLS.find(row => row.name === f.name)!;
    await expect(speech.prepare!({ projectId: f.project.id, text: "你好" }, ctx)).rejects.toThrow("MiMo");
    await db.connectors.put({ ...generationConnector, id: "mimo", definitionId: "mimo", baseUrl: "https://api.xiaomimimo.com/v1" });
    expect(await capabilities.execute({}, ctx)).toMatchObject({ defaultSpeech: { provider: "mimo", connectorId: "mimo", profile: { voice: "mimo_default" } } });
    expect(await speech.prepare!({ projectId: f.project.id, text: "你好" }, ctx)).toMatchObject({ summary: "生成配音（付费）" });
  });

  it("inherits saved segment voice, blocks edits after review, and keeps explicit legacy arguments", async () => {
    const f = await fixture("audio");
    await db.connectors.put({ ...generationConnector, id: "mimo", definitionId: "mimo", baseUrl: "https://api.xiaomimimo.com/v1" });
    const speaker = await addAudioSpeaker(f.project.id, { name: "叙述者", voice: "茉莉", speed: 1, mimo: { mode: "preset", instruction: "轻声" } });
    const chapter = (await db.audioChapters.where("projectId").equals(f.project.id).first())!;
    const segment = await addAudioSegment(f.project.id, { chapterId: chapter.id, speakerId: speaker.id, text: "你好", notes: "", order: 0 });
    const args = { projectId: f.project.id, text: "你好", segmentId: segment.id, segmentRevision: segment.revision };
    const call = await awaiting(f.run, f.name, args);
    expect(JSON.stringify(call.preview)).toContain("茉莉");
    expect(JSON.stringify(call.preview)).toContain("轻声");
    await patchAudioSpeaker(f.project.id, speaker.id, speaker.revision, { voice: "冰糖" });
    const paidFetch = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", paidFetch);
    await resolveAgentToolApproval(f.run.id, call.id, "approve");
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), AUDIO_GENERATION_TOOLS);
    expect(paidFetch).not.toHaveBeenCalled();
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("failed");
    // A saved MiMo speaker must not reinterpret an explicitly supplied legacy call.
    const speech = AUDIO_GENERATION_TOOLS.find(row => row.name === f.name)!;
    const preview = await speech.prepare!({ ...f.args, segmentId: segment.id, segmentRevision: segment.revision }, { runId: f.run.id, threadId: f.run.threadId, callId: "legacy", projectId: f.project.id, signal: new AbortController().signal });
    expect(JSON.stringify(preview)).toContain("APIMart");
  });

  it("uses default inherited speaker for generation and recovers after that speaker is deleted", async () => {
    const f = await fixture("audio");
    await db.connectors.put({ ...generationConnector, id: "mimo", definitionId: "mimo", baseUrl: "https://api.xiaomimimo.com/v1" });
    const speaker = await addAudioSpeaker(f.project.id, { name: "叙述者", voice: "茉莉", speed: 1, mimo: { mode: "preset", instruction: "轻声" } });
    const args = { projectId: f.project.id, text: "你好", speakerId: speaker.id, speakerRevision: speaker.revision };
    const source = encodePcm16Wav({ length: 48, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48) }).blob;
    vi.stubGlobal("OfflineAudioContext", class { async decodeAudioData() { return { length: 48, duration: .001, numberOfChannels: 2, sampleRate: 48000 }; } });
    const encoded = Buffer.from(await source.arrayBuffer()).toString("base64");
    const paidFetch = vi.fn<typeof fetch>(async () => Response.json({ choices: [{ finish_reason: "stop", message: { audio: { data: encoded } } }] }));
    vi.stubGlobal("fetch", paidFetch);
    const call = await awaiting(f.run, f.name, args);
    await resolveAgentToolApproval(f.run.id, call.id, "approve");
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), AUDIO_GENERATION_TOOLS);
    expect((await db.audioGenerationJobs.toArray())[0]).toMatchObject({ status: "saved", connector: { id: "mimo" }, input: { voice: "茉莉", mimo: { instruction: "轻声" } } });
    await db.audioSpeakers.delete(speaker.id);
    const definition = AUDIO_GENERATION_TOOLS.find(row => row.name === f.name)!;
    const recovered = await definition.execute(args, { runId: f.run.id, threadId: f.run.threadId, callId: call.id, projectId: f.project.id, signal: new AbortController().signal });
    expect(recovered).toMatchObject({ status: "saved" });
    expect(paidFetch).toHaveBeenCalledOnce();
  });

  it("saves approved speech as one take and preserves the completed result across continuation failure", async () => {
    const f = await fixture("audio");
    const source = encodePcm16Wav({ length: 48, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48) }).blob;
    // Native decoding needs a browser; this seam isolates paid transport,
    // durable source promotion and tool-ledger replay from codec availability.
    vi.stubGlobal("OfflineAudioContext", class {
      async decodeAudioData() { return { length: 48, duration: .001, numberOfChannels: 2, sampleRate: 48000 }; }
    });
    const paidFetch = vi.fn<typeof fetch>(async () => new Response(source, { headers: { "Content-Type": "audio/wav" } }));
    vi.stubGlobal("fetch", paidFetch);
    const call = await awaiting(f.run, f.name, f.args);
    await resolveAgentToolApproval(f.run.id, call.id, "approve");
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => new Response("unavailable", { status: 500 })), AUDIO_GENERATION_TOOLS);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("completed");
    expect(await db.audioTakes.count()).toBe(1);
    expect((await db.audioGenerationJobs.toArray())[0].status).toBe("saved");
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), AUDIO_GENERATION_TOOLS);
    expect(paidFetch).toHaveBeenCalledOnce(); expect(await db.audioTakes.count()).toBe(1);
  });

  it("reviews MiMo clone reference bytes and rejects a changed sample before POST", async () => {
    const f = await fixture("audio");
    await db.connectors.put({ ...generationConnector, id: "mimo", definitionId: "mimo", baseUrl: "https://api.xiaomimimo.com/v1" });
    const wav = (value: number) => encodePcm16Wav({ length: 48, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48).fill(value) }).blob;
    await db.media.add({ id: "voice-reference", projectId: f.project.id, filename: "角色样本.wav", mimeType: "audio/wav", blob: wav(0) });
    const args = { ...f.args, connectorId: "mimo", voice: "mimo_default", mimo: { mode: "clone", instruction: "轻声讲述", referenceMediaId: "voice-reference" } };
    const paidFetch = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", paidFetch);
    const call = await awaiting(f.run, f.name, args);
    expect(JSON.stringify(call.preview)).toContain("角色样本.wav");
    expect(JSON.stringify(call.preview)).toContain("轻声讲述");
    expect(JSON.stringify(call.preview)).not.toContain("base64");
    await db.media.update("voice-reference", { blob: wav(.3) });
    await resolveAgentToolApproval(f.run.id, call.id, "approve");
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), AUDIO_GENERATION_TOOLS);
    expect(paidFetch).not.toHaveBeenCalled();
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("failed");
  });

  it("submits approved MiMo design once and keeps optimized speech separate from manuscript", async () => {
    const f = await fixture("audio");
    await db.connectors.put({ ...generationConnector, id: "mimo", definitionId: "mimo", baseUrl: "https://api.xiaomimimo.com/v1" });
    const chapter = await db.audioChapters.where("projectId").equals(f.project.id).first();
    const segment = await addAudioSegment(f.project.id, { chapterId: chapter!.id, text: "原文", notes: "", order: 0 });
    const source = encodePcm16Wav({ length: 48, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48) }).blob;
    vi.stubGlobal("OfflineAudioContext", class { async decodeAudioData() { return { length: 48, duration: .001, numberOfChannels: 2, sampleRate: 48000 }; } });
    const encoded = Buffer.from(await source.arrayBuffer()).toString("base64");
    const paidFetch = vi.fn<typeof fetch>(async () => Response.json({ choices: [{ finish_reason: "stop", message: { audio: { data: encoded }, final_text_preview: "润色后的播报" } }] }));
    vi.stubGlobal("fetch", paidFetch);
    const args = { ...f.args, connectorId: "mimo", text: "原文", voice: "mimo_default", segmentId: segment.id, segmentRevision: segment.revision, mimo: { mode: "design", instruction: "温柔女声", optimizeTextPreview: true } };
    const call = await awaiting(f.run, f.name, args);
    expect(JSON.stringify(call.preview)).toContain("允许智能润色");
    await resolveAgentToolApproval(f.run.id, call.id, "approve");
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), AUDIO_GENERATION_TOOLS);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("completed");
    expect((await db.audioSegments.get(segment.id))?.text).toBe("原文");
    expect((await db.audioTakes.toArray())[0].textSnapshot).toBe("润色后的播报");
    expect(paidFetch).toHaveBeenCalledOnce();
    const body = JSON.parse(String(paidFetch.mock.calls[0][1]?.body));
    expect(body.model).toBe("mimo-v2.5-tts-voicedesign");
    expect(body.messages).toEqual([{ role: "user", content: "温柔女声" }, { role: "assistant", content: "原文" }]);
  });

  it.each(["ask", "assist", "full"] as const)("requires review for both music and speech before effects in %s mode", async (mode) => {
    const paidFetch = vi.fn<typeof fetch>(async () => Response.json({ code: 200, data: [{ task_id: "remote-task" }] }));
    vi.stubGlobal("fetch", paidFetch);
    for (const kind of ["audio", "music"] as const) {
      const f = await fixture(kind, mode);
      const call = await awaiting(f.run, f.name, f.args);
      expect(call.preview?.summary).toContain("付费");
      expect(paidFetch).not.toHaveBeenCalled(); expect(await db.audioGenerationJobs.count()).toBe(0);
      // Reject speech here: browser decoding is covered by engine tests. The
      // approved music branch verifies the actual paid transport and ledger.
      await resolveAgentToolApproval(f.run.id, call.id, kind === "audio" ? "reject" : "approve");
      await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), AUDIO_GENERATION_TOOLS);
      expect((await db.agentToolCalls.get(call.id))?.status).toBe(kind === "audio" ? "rejected" : "completed");
    }
    expect(paidFetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(await db.audioGenerationJobs.count()).toBe(1);
    expect((await db.audioGenerationJobs.toArray())[0].status).toBe("submitted");
  });

  it("blocks submission when the approved music draft changed before execution", async () => {
    const f = await fixture("music");
    const paidFetch = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", paidFetch);
    const call = await awaiting(f.run, f.name, f.args);
    await patchMusicDraft(f.project.id, f.draft!.id, f.draft!.revision, { settings: { ...defaultMusicSettings("flowmusic"), soundPrompt: "用户修改" } });
    await resolveAgentToolApproval(f.run.id, call.id, "approve");
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), AUDIO_GENERATION_TOOLS);
    expect(paidFetch).not.toHaveBeenCalled(); expect(await db.audioGenerationJobs.count()).toBe(0);
    expect((await db.musicDrafts.get(f.draft!.id))?.settings).toMatchObject({ soundPrompt: "用户修改" });
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("failed");
  });

  it("recovers a submitted call through GET after a changed draft without replaying the POST", async () => {
    const f = await fixture("music");
    const paidFetch = vi.fn<typeof fetch>(async (_url, init) => init?.method === "POST"
      ? Response.json({ code: 200, data: [{ task_id: "remote-task" }] })
      : Response.json({ code: 200, data: { id: "remote-task", status: "running", progress: 20 } }));
    vi.stubGlobal("fetch", paidFetch);
    const call = await awaiting(f.run, f.name, f.args);
    await resolveAgentToolApproval(f.run.id, call.id, "approve");
    // Interrupt exactly at the crash window: remote task saved, tool result not
    // yet durable. Use the real tool implementation and normal run recovery.
    let interruptOnce = true;
    const interruptedRegistry = AUDIO_GENERATION_TOOLS.map((tool) => tool.name !== "music_generate" ? tool : { ...tool,
      async execute(args: unknown, ctx: Parameters<typeof tool.execute>[1]) {
        const result = await tool.execute(args, ctx);
        if (interruptOnce) { interruptOnce = false; await interruptThreadRuns(ctx.threadId); throw new DOMException("Page closed", "AbortError"); }
        return result;
      } });
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), interruptedRegistry);
    expect((await db.audioGenerationJobs.toArray())[0].taskIds).toEqual(["remote-task"]);
    await patchMusicDraft(f.project.id, f.draft!.id, f.draft!.revision, { settings: { ...defaultMusicSettings("flowmusic"), soundPrompt: "新作品方向" } });
    await resumeChatRun(f.run.id, chatConnector.apiKey, new AbortController(), vi.fn(async () => answer()), AUDIO_GENERATION_TOOLS);
    expect(paidFetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(paidFetch.mock.calls.some(([url, init]) => String(url).includes("/music/tasks/remote-task") && init?.method === "GET")).toBe(true);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("completed");
  });

  it.each(["audio", "music"] as const)("uses bounded %s context without video records, keys or foreign projects", async (kind) => {
    const f = await fixture(kind);
    await createAudioMusicProject("FOREIGN_PRIVATE", "audio");
    if (kind === "audio") {
      const chapter = await db.audioChapters.where("projectId").equals(f.project.id).first();
      await addAudioSegment(f.project.id, { chapterId: chapter!.id, text: "脚本".repeat(2000), notes: "", order: 0 });
    }
    const snapshot = await getProjectContext(f.project.id);
    const facts = JSON.parse(snapshot.content);
    expect(facts.kind).toBe(kind); expect(facts).not.toHaveProperty("episodes"); expect(facts).not.toHaveProperty("shots");
    expect(snapshot.coverage.episodes).toEqual({ total: 0, included: 0 });
    expect(snapshot.content).not.toContain("paid-secret"); expect(snapshot.content).not.toContain("FOREIGN_PRIVATE");
    expect(snapshot.content.length).toBeLessThan(10000);
    const refreshed = await refreshRunProjectContext(f.run.id);
    expect(JSON.stringify(refreshed.projectContext)).not.toContain("paid-secret");
    if (kind === "audio") { expect(facts.segments[0].text.length).toBe(160); expect(snapshot.coverage.truncated).toBe(true); }
    else expect(facts.drafts.some((draft: { engine: string }) => draft.engine === "flowmusic")).toBe(true);
  });
});
