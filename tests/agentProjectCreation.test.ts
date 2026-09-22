import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { resolveAgentToolApproval } from "@/db/agentTools";
import { createChatThread, createProject } from "@/db/repo";
import { BUSINESS_TOOLS } from "@/lib/agent/businessTools";
import { BUILTIN_TOOLS } from "@/lib/agent/tools";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { assembleSkills } from "@/lib/agent/skills";
import { createToolLoading, getOfferedToolNames } from "@/lib/agent/toolLoading";
import { describeRunWrites } from "@/lib/agent/runWriteOutcomes";
import { targetRevision } from "@/lib/productionRevision";
import type { AgentRun, AgentToolCall, AgentWireToolCall } from "@/domain/agent";
import type { AgentToolContext } from "@/lib/agent/tools";
import type { ConnectorConfig } from "@/domain/types";

const connector: ConnectorConfig = { id: "local-test", definitionId: "openai-compatible", baseUrl: "https://test.invalid/v1", apiKey: "not-real", updatedAt: "2026-09-22" };
const create = BUSINESS_TOOLS.find(tool => tool.name === "project_create")!;
const wire = (name: string, args: unknown, id = name): AgentWireToolCall => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
function response(protocol: AgentRun["protocol"], calls: AgentWireToolCall[] = []) {
  return protocol === "responses" ? Response.json({ id: "reply", status: "completed", output: calls.length ? calls.map(call => ({ type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments, status: "completed" })) : [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "已完成本地写入", annotations: [] }] }] })
    : Response.json({ choices: [{ message: { content: calls.length ? "" : "已完成本地写入", ...(calls.length ? { tool_calls: calls } : {}) }, finish_reason: calls.length ? "tool_calls" : "stop" }] });
}
async function begin(protocol: AgentRun["protocol"] = "chat-completions", permissionMode: AgentRun["permissionMode"] = "full") {
  const thread = await createChatThread();
  const initial = await beginAgentRun({ threadId: thread.id, connector, model: protocol === "responses" ? "gpt-5.6-luna" : "fixture", content: "创建并写入内容" });
  expect(initial.protocol).toBe(protocol);
  const skillIds = ["story-edit", "audio-production", "music-creation"];
  const capabilities = assembleSkills(skillIds);
  const loading = createToolLoading(skillIds, capabilities.enabledToolNames)!;
  const group = loading.groups.find(row => row.id === "story-edit")!;
  const run: AgentRun = { ...initial, permissionMode, ...capabilities, toolLoading: { ...loading, loadedGroupIds: [group.id], loadedToolNames: group.toolNames } };
  await db.agentRuns.put(run);
  return run;
}
async function direct(raw: unknown = { name: "声音项目", kind: "audio" }, existing?: AgentRun) {
  const run = existing ?? await begin();
  const args = create.parseArguments(raw), callId = crypto.randomUUID();
  const context: AgentToolContext = { runId: run.id, threadId: run.threadId, callId, signal: new AbortController().signal };
  context.preview = await create.prepare!(args, context);
  const call: AgentToolCall = { id: callId, providerCallId: callId, runId: run.id, threadId: run.threadId, step: 1, order: 0, name: create.name, title: create.title, effect: "write", atomic: true, highRisk: false, arguments: JSON.stringify(raw), preview: context.preview, status: "running", createdAt: run.createdAt, updatedAt: run.createdAt };
  await db.agentRuns.update(run.id, { offeredTools: [{ step: 1, names: ["project_create"] }] });
  await db.agentToolCalls.add(call);
  return { run, args, call, context, execute: () => create.execute(args, context) as Promise<{ id: string; firstChapterId?: string; firstDraftId?: string; continuation: { action: string } }> };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("one-time Agent project creation continuity", () => {
  it.each(["chat-completions", "responses"] as const)("creates, reads and writes audio/music/video in one %s execution", async protocol => {
    for (const kind of ["audio", "music", "video"] as const) {
      const run = await begin(protocol), original = structuredClone(run.requestMessages);
      let round = 0, createdId = "", childId = "";
      const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        round++;
        if (round === 1) return response(protocol, [wire("project_create", { name: `测试${kind}`, kind })]);
        const saved = (await db.agentRuns.get(run.id))!;
        createdId = saved.projectId!;
        expect(createdId).toBeTruthy();
        expect(JSON.stringify(body)).toContain(createdId);
        if (kind !== "video") expect(getOfferedToolNames(saved)).toContain(kind === "audio" ? "audio_read" : "music_read");
        if (round === 2) return response(protocol, [kind === "audio" ? wire("audio_read", { kind: "chapters" }) : kind === "music" ? wire("music_read", { kind: "drafts" }) : wire("business_search", { kind: "episode", ownerId: createdId })]);
        if (round === 3) {
          childId = kind === "audio" ? (await db.audioChapters.where("projectId").equals(createdId).first())!.id : kind === "music" ? (await db.musicDrafts.where("projectId").equals(createdId).first())!.id : (await db.episodes.where("projectId").equals(createdId).first())!.id;
          return response(protocol, [kind === "audio" ? wire("audio_create", { projectId: createdId, kind: "segment", chapterId: childId, text: "午安，欢迎收听。", order: 0 }) : kind === "music" ? wire("music_save_draft", { projectId: createdId, id: childId, revision: 1, settings: { engine: "flowmusic", title: "午后", lyrics: "风在唱歌", soundPrompt: "钢琴" } }) : wire("episode_update", { ownerId: createdId, id: childId, patch: { script: "列车驶入站台。" } })]);
        }
        return response(protocol);
      });
      await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl);
      const saved = (await db.agentRuns.get(run.id))!;
      expect(saved.status, saved.error).toBe("completed");
      expect(fetchImpl).toHaveBeenCalledTimes(4);
      expect(saved.requestMessages).toEqual(original);
      expect(saved.enabledToolNames).toEqual(run.enabledToolNames);
      expect(saved.offeredTools?.[0].names).toEqual(getOfferedToolNames(run));
      expect((await db.chatThreads.get(run.threadId))?.projectId).toBe(createdId);
      expect((await db.chatMessages.where("threadId").equals(run.threadId).toArray()).filter(row => row.role === "user")).toHaveLength(1);
      const calls = await db.agentToolCalls.where("runId").equals(run.id).sortBy("step");
      expect(calls.every(call => call.status === "completed")).toBe(true);
      expect(calls[0].arguments).toBe(JSON.stringify({ name: `测试${kind}`, kind }));
      expect(saved.createdProjectBinding).toEqual({ projectId: createdId, callId: calls[0].id });
      expect(describeRunWrites(saved, calls).uncoveredCalls).toBe(0);
      if (kind === "audio") expect((await db.audioSegments.where("projectId").equals(createdId).first())?.text).toBe("午安，欢迎收听。");
      if (kind === "music") expect((await db.musicDrafts.get(childId))?.settings.title).toBe("午后");
      if (kind === "video") expect((await db.episodes.get(childId))?.story?.script).toBe("列车驶入站台。");
    }
  });

  it("keeps create-only opt-out unbound and permits multiple creations", async () => {
    const first = await direct({ name: "只创建", kind: "music", continueInProject: false });
    const a = await first.execute();
    const second = await direct({ name: "再创建", continueInProject: false }, first.run);
    const b = await second.execute();
    expect(a.id).not.toBe(b.id);
    expect(a.continuation.action).toBe("new_project_conversation");
    expect((await db.agentRuns.get(first.run.id))?.createdProjectBinding).toBeUndefined();
    expect((await db.chatThreads.get(first.run.threadId))?.projectId).toBeUndefined();
    await expect(direct({ name: "不能切换归属" }, first.run)).rejects.toThrow("已有其他归属");
    expect(await db.projects.count()).toBe(2);
  });

  it("retains exact completed replay and rejects modified arguments/deleted owner", async () => {
    const f = await direct(), value = await f.execute();
    db.close(); await db.open();
    expect(await f.execute()).toEqual(value);
    await expect(create.execute({ ...f.args as object, name: "另一个" }, f.context)).rejects.toThrow("不匹配");
    await expect(create.execute(f.args, { ...f.context, threadId: "foreign" })).rejects.toThrow("归属");
    await expect(create.execute(f.args, { ...f.context, projectId: "foreign" })).rejects.toThrow("来源不匹配");
    await db.agentRuns.update(f.run.id, { createdProjectBinding: { projectId: value.id, callId: "foreign" } });
    await expect(f.execute()).rejects.toThrow("来源不匹配");
    await db.agentRuns.update(f.run.id, { createdProjectBinding: { projectId: value.id, callId: f.call.id } });
    expect(await db.projects.count()).toBe(1);
    await db.projects.delete(value.id);
    await expect(f.execute()).rejects.toThrow("不存在");
    expect(await db.projects.count()).toBe(0);
  });

  it("rolls back project, seeds, binding and provenance when result persistence fails", async () => {
    const f = await direct();
    vi.spyOn(db.agentToolCalls, "update").mockRejectedValueOnce(new Error("ledger failure"));
    await expect(f.execute()).rejects.toThrow("ledger failure");
    expect(await db.projects.count()).toBe(0); expect(await db.audioChapters.count()).toBe(0); expect(await db.audioTracks.count()).toBe(0);
    expect((await db.agentRuns.get(f.run.id))?.createdProjectBinding).toBeUndefined();
    expect((await db.chatThreads.get(f.run.threadId))?.projectId).toBeUndefined();
  });

  it("rejects same-round reference results before they enter continuation", async () => {
    const f = await direct();
    await db.agentToolCalls.add({ ...f.call, id: "reference", providerCallId: "reference", name: "material_read", effect: "read", status: "completed", result: JSON.stringify({ referenceInput: { projectId: "studio", references: [] } }) });
    await expect(f.execute()).rejects.toThrow("continueInProject=false");
    expect(await db.projects.count()).toBe(0);
    expect((await db.agentRuns.get(f.run.id))?.projectId).toBeUndefined();
  });

  it.each(["job", "batch", "earlier-batch", "sound"])("blocks foreign generation %s even without a business-write call", async kind => {
    const f = await direct();
    // Persisted intent fixtures: creation guard must not rely on tool effect classification.
    const intent = { id: "intent", runId: kind === "earlier-batch" ? "earlier" : f.run.id, threadId: f.run.threadId, projectId: "foreign", createdAt: f.run.createdAt, updatedAt: f.run.createdAt };
    if (kind === "job") await db.agentGenerationJobs.add({
      ...intent, version: 1, callId: "generate", status: "submitted", connectorId: connector.id, provider: "apimart", baseUrl: connector.baseUrl,
      model: "gpt-image-2", kind: "image", target: { kind: "character", projectId: "foreign", entityId: "character", slot: "portrait" },
      baseRevision: "base", sourceRevisions: [], parameters: {}, inputs: [], fingerprint: "fixture",
    });
    else if (kind === "sound") await db.audioGenerationJobs.add({
      id: intent.id, projectId: intent.projectId, createdAt: intent.createdAt, updatedAt: intent.updatedAt, revision: 1,
      intentId: "agent-audio:generate", source: { kind: "agent", callId: "generate", runId: f.run.id }, status: "submitted",
      connector: { id: connector.id, provider: "apimart", baseUrl: connector.baseUrl }, taskIds: ["provider-task"], results: [],
      input: { kind: "music", settings: { engine: "flowmusic", title: "已有任务", lyrics: "歌词", soundPrompt: "钢琴" } },
    });
    else await db.agentGenerationBatches.add({
      ...intent, version: 1, sourceCallId: "batch", originCallId: "batch", title: "已有批次", revision: 1, status: "draft",
      itemIds: ["candidate"], confirmedItemIds: [], entityRevisions: {}, selections: {}, applications: [],
    });
    await expect(f.execute()).rejects.toThrow("生成任务或批次");
    expect(await db.projects.count()).toBe(0);
  });

  it("preloads only the frozen allowed matching group and does not enable disabled tools", async () => {
    const run = await begin();
    await db.agentRuns.update(run.id, { enabledToolNames: run.enabledToolNames!.filter(name => name !== "audio_create") });
    const f = await direct(undefined, run);
    await f.execute();
    const saved = (await db.agentRuns.get(run.id))!;
    expect(getOfferedToolNames(saved)).toContain("audio_read");
    expect(getOfferedToolNames(saved)).not.toContain("audio_create");
    expect(saved.offeredTools).toEqual([{ step: 1, names: ["project_create"] }]);
  });

  it("rejects legacy approval preview before any creation or binding", async () => {
    const f = await direct();
    f.context.preview = { ...f.context.preview!, revision: targetRevision({ tool: "project_create", args: f.args, state: {} }) };
    await expect(f.execute()).rejects.toThrow("目标或影响范围已变化");
    expect(await db.projects.count()).toBe(0);
  });

  it.each(["selected", "request", "continuation", "responses", "audit"])("rejects scope-bound %s reference inputs before creation and preserves create-only fallback", async location => {
    const run = await begin();
    const referenceInput = { projectId: "studio", references: [], images: [{ projectId: "studio", mediaId: "image", filename: "图", mimeType: "image/png", size: 1 }] };
    const item = { role: "user" as const, content: "资料", referenceInput };
    await db.agentRuns.update(run.id, location === "selected" ? { context: { ...run.context!, selectedReferences: { ...referenceInput, envelope: "资料" } } } : location === "request" ? { requestMessages: [...run.requestMessages, item] } : location === "continuation" ? { continuationMessages: [...run.requestMessages, item] } : location === "responses" ? { responseItems: [{ type: "message", role: "user", content: "资料", referenceInput }] } : { referenceAudit: [{ step: 1, preparedAt: run.createdAt, inputs: [referenceInput] }] });
    await expect(direct({ name: "不能绑定" }, run)).rejects.toThrow("continueInProject=false");
    expect(await db.projects.count()).toBe(0);
    const f = await direct({ name: "可仅创建", continueInProject: false }, run);
    await f.execute();
    expect((await db.agentRuns.get(run.id))?.projectId).toBeUndefined();
  });

  it.each(["disabled", "conversation", "task", "stop", "approval"])("blocks %s before project creation", async reason => {
    const f = await direct();
    await db.agentRuns.update(f.run.id, reason === "disabled" ? { enabledToolNames: [] } : reason === "conversation" ? { interactionMode: "conversation" } : reason === "task" ? { taskMode: true } : reason === "stop" ? { status: "interrupted" } : { permissionMode: "ask" });
    await expect(f.execute()).rejects.toThrow();
    expect(await db.projects.count()).toBe(0);
  });

  it("rechecks scope for already approved siblings and a second default creation", async () => {
    const foreign = await createProject("其他项目"), run = await begin("chat-completions", "ask");
    let step = 0;
    const fetchImpl: typeof fetch = async () => ++step === 1 ? response(run.protocol, [wire("project_create", { name: "当前项目", kind: "audio" }, "first"), wire("project_update", { id: foreign.id, patch: { brief: "越界" } }, "foreign"), wire("project_create", { name: "不应创建" }, "second")]) : response(run.protocol);
    await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl);
    const pending = await db.agentToolCalls.where("runId").equals(run.id).sortBy("order");
    expect(pending.every(call => call.status === "awaiting_approval")).toBe(true);
    for (const call of pending) await resolveAgentToolApproval(run.id, call.id, "approve");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetchImpl);
    const calls = await db.agentToolCalls.where("runId").equals(run.id).sortBy("order");
    expect(calls.map(call => call.status)).toEqual(["completed", "failed", "failed"]);
    expect((await db.projects.get(foreign.id))?.brief).not.toBe("越界");
    expect(await db.projects.count()).toBe(2);
  });

  it("keeps old runs and request envelopes frozen, preserves binding when stopped after creation", async () => {
    const old = await begin();
    await finishAgentRun(old.id, "completed", { content: "旧对话" });
    const oldSnapshot = await db.agentRuns.get(old.id);
    const initial = await beginAgentRun({ threadId: old.threadId, connector, model: "fixture", content: "创建项目" });
    const run = { ...initial, permissionMode: "full" as const, toolLoading: undefined };
    await db.agentRuns.put(run);
    const controller = new AbortController();
    const real = create.execute;
    const registry = BUILTIN_TOOLS.map(tool => tool.name === "project_create" ? { ...tool, execute: async (...args: Parameters<typeof real>) => { const result = await real(...args); controller.abort(); return result; } } : tool);
    const fetchImpl = vi.fn<typeof fetch>(async () => response(run.protocol, [wire("project_create", { name: "停止后保留", kind: "audio" })]));
    await executeChatRun(run, connector.apiKey, controller, fetchImpl, registry);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.status).toBe("interrupted"); expect(saved.createdProjectBinding?.projectId).toBe(saved.projectId);
    expect(await db.agentRuns.get(old.id)).toEqual(oldSnapshot);
    expect(saved.requestMessages).toEqual(run.requestMessages);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(await db.projects.count()).toBe(1);
  });
});
