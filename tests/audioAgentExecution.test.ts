import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject, createChatThread, createProject } from "@/db/repo";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { executeChatRun } from "@/lib/agent/runChat";
import { getOfferedToolNames, MAX_LOADED_TOOLS } from "@/lib/agent/toolLoading";
import { getTaskContext } from "@/lib/agent/taskContext";
import { SMART_EXECUTION_INSTRUCTIONS } from "@/lib/agent/skills";
import { describeRunExecution } from "@/lib/agent/executionSummary";
import type { AgentRun, AgentWireToolCall } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";

const connector: ConnectorConfig = { id: "execution-chat", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "chat-secret", updatedAt: "2026-09-22" };
const skills = ["workspace", "planning", "audio-production", "music-creation"];
const call = (name: string, args: unknown, id: string): AgentWireToolCall => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
function reply(protocol: AgentRun["protocol"], calls: AgentWireToolCall[] = []) {
  if (protocol === "responses") return Response.json({ id: "response", status: "completed", output: calls.length
    ? calls.map(item => ({ type: "function_call", call_id: item.id, name: item.function.name, arguments: item.function.arguments }))
    : [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "已写入脚本", annotations: [] }] }] });
  return Response.json({ choices: [{ message: { content: calls.length ? "" : "已写入脚本", ...(calls.length ? { tool_calls: calls } : {}) }, finish_reason: calls.length ? "tool_calls" : "stop" }] });
}
function names(body: Record<string, unknown>): string[] {
  return ((body.tools ?? []) as Array<{ name?: string; function?: { name: string } }>).map(tool => tool.name ?? tool.function!.name);
}
function toolResult(body: Record<string, unknown>, protocol: AgentRun["protocol"], id: string) {
  if (protocol === "responses") {
    const items = body.input as Array<{ type?: string; call_id?: string; output?: string }>;
    return JSON.parse(items.find(item => item.type === "function_call_output" && item.call_id === id)!.output!);
  }
  const messages = body.messages as Array<{ role: string; tool_call_id?: string; content: string }>;
  return JSON.parse(messages.find(item => item.role === "tool" && item.tool_call_id === id)!.content);
}
async function begin(kind: "audio" | "music", protocol: AgentRun["protocol"] = "chat-completions") {
  await updateGeneralAgentConfig({ permissionMode: "full", enabledSkillIds: skills });
  const project = await createAudioMusicProject("广播作品", kind);
  const thread = await createChatThread({ projectId: project.id });
  const initial = await beginAgentRun({ threadId: thread.id, connector, model: "fixture", content: "开始写入完整脚本" });
  const run = { ...initial, protocol };
  await db.agentRuns.put(run);
  return { project, thread, run };
}
afterEach(() => vi.unstubAllGlobals());

describe("bound sound project execution readiness", () => {
  it.each(["chat-completions", "responses"] as const)("distinguishes a promise-only %s reply from actual execution without issuing hidden retries", async protocol => {
    const { project, run } = await begin("audio", protocol);
    const text = "我会先读取项目，再写入脚本。请再发送一次开始。";
    const fetcher = vi.fn<typeof fetch>(async () => protocol === "responses"
      ? Response.json({ id: "promise", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] }] })
      : Response.json({ choices: [{ message: { content: text }, finish_reason: "stop" }] }));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    const saved = (await db.agentRuns.get(run.id))!;
    const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    expect(describeRunExecution(saved, calls)).toMatchObject({ kind: "reply", label: "仅回复，未调用工具", modelSteps: 1, counts: { total: 0 } });
    expect(describeRunExecution(saved, calls).offeredTools).toBeGreaterThan(0);
    expect((await db.chatMessages.get(saved.assistantMessageId))?.content).toBe(text);
    expect(await db.audioSegments.where("projectId").equals(project.id).count()).toBe(0);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(["chat-completions", "responses"] as const)("does not count tool loading on %s as creative work", async protocol => {
    const { project, run } = await begin("audio", protocol);
    let requests = 0;
    const fetcher = vi.fn<typeof fetch>(async () => reply(protocol, ++requests === 1
      ? [call("load_tool_groups", { groupIds: ["audio-production"] }, "load-only")]
      : []));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    const saved = (await db.agentRuns.get(run.id))!;
    const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    expect(describeRunExecution(saved, calls)).toMatchObject({ kind: "preparation", label: "仅准备，未执行业务", modelSteps: 2 });
    expect(await db.audioSegments.where("projectId").equals(project.id).count()).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(["chat-completions", "responses"] as const)("keeps failed reads visible when the %s model finishes afterwards", async protocol => {
    const { run } = await begin("audio", protocol);
    let requests = 0;
    const fetcher = vi.fn<typeof fetch>(async () => reply(protocol, ++requests === 1
      ? [call("audio_read", { kind: "segments", id: "missing-segment" }, "failed-read")]
      : []));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    const saved = (await db.agentRuns.get(run.id))!;
    const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    expect(saved.status).toBe("completed");
    expect(describeRunExecution(saved, calls).counts).toMatchObject({ total: 1, failed: 1, completed: 0 });
    expect(describeRunExecution(saved, calls).label).not.toBe("已完成");
    expect(calls[0].status).toBe("failed");
  });

  it.each(["audio", "music"] as const)("offers the enabled %s group immediately and on the next user turn", async kind => {
    const { project, thread, run } = await begin(kind);
    const group = kind === "audio" ? "audio-production" : "music-creation";
    const otherRead = kind === "audio" ? "music_read" : "audio_read";
    expect(run.toolLoading?.loadedGroupIds).toEqual([group]);
    expect(getOfferedToolNames(run)).toContain(`${kind}_read`);
    expect(getOfferedToolNames(run)).not.toContain(otherRead);
    expect(getOfferedToolNames(run).length).toBeLessThanOrEqual(MAX_LOADED_TOOLS);
    expect(run.skillInstructions).toContain(SMART_EXECUTION_INSTRUCTIONS);
    const wrongProject = await createAudioMusicProject("界面中的其他项目", kind === "audio" ? "music" : "audio");
    expect(await getTaskContext(thread.id, "", false, "smart", wrongProject.id)).toMatchObject({ projectKind: kind });
    expect(run.projectId).toBe(project.id);
    await finishAgentRun(run.id, "completed", { content: "第一轮结束" });
    const next = await beginAgentRun({ threadId: thread.id, connector, model: "fixture", content: "继续修改下一段" });
    expect(next.toolLoading?.loadedGroupIds).toEqual([group]);
    expect(getOfferedToolNames(next)).toContain(`${kind}_read`);
  });

  it.each(["audio", "music"] as const)("does not preload disabled %s skills", async kind => {
    const { project, run } = await begin(kind);
    await finishAgentRun(run.id, "completed");
    await updateGeneralAgentConfig({ enabledSkillIds: skills.filter(id => id !== (kind === "audio" ? "audio-production" : "music-creation")) });
    const thread = await createChatThread({ projectId: project.id });
    const next = await beginAgentRun({ threadId: thread.id, connector, model: "fixture", content: "开始" });
    expect(next.enabledToolNames).not.toContain(`${kind}_read`);
    expect(next.toolLoading?.loadedGroupIds).toEqual([]);
    expect(getOfferedToolNames(next)).not.toContain(`${kind}_read`);
  });

  it.each(["unbound", "video"] as const)("leaves sound groups deferred in %s conversations", async kind => {
    await updateGeneralAgentConfig({ permissionMode: "full", enabledSkillIds: skills });
    const project = kind === "video" ? await createProject("影片") : undefined;
    const thread = await createChatThread({ projectId: project?.id });
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "fixture", content: "开始" });
    expect(run.enabledToolNames).toContain("audio_read");
    expect(run.enabledToolNames).toContain("music_read");
    expect(run.toolLoading?.loadedGroupIds).toEqual([]);
    expect(getOfferedToolNames(run)).not.toContain("audio_read");
    expect(getOfferedToolNames(run)).not.toContain("music_read");
  });

  it.each(["chat-completions", "responses"] as const)("reads then writes actual audio content in one %s execution without a second user turn", async protocol => {
    const { project, run } = await begin("audio", protocol);
    const bodies: Record<string, unknown>[] = [];
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)); bodies.push(body);
      expect(names(body)).toContain("audio_read");
      expect(names(body)).toContain("audio_create");
      if (bodies.length === 1) return reply(protocol, [call("audio_read", { kind: "chapters" }, "read-chapters")]);
      if (bodies.length === 2) {
        const result = toolResult(body, protocol, "read-chapters");
        expect(result.projectId).toBe(project.id);
        expect(result.items).toHaveLength(1);
        return reply(protocol, [call("audio_create", { projectId: result.projectId, kind: "segment", chapterId: result.items[0].id, text: "大家午安，欢迎来到今天的电台。", order: 0 }, "write-script")]);
      }
      expect(toolResult(body, protocol, "write-script")).toMatchObject({ projectId: project.id, text: "大家午安，欢迎来到今天的电台。", writeReceipt: { version: 1, entries: [{ kind: "audio_segment", operation: "created", ownerId: project.id }] } });
      return reply(protocol);
    });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "completed", modelStep: 3 });
    expect(await db.audioSegments.where("projectId").equals(project.id).toArray()).toMatchObject([{ text: "大家午安，欢迎来到今天的电台。", order: 0 }]);
    const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    expect(calls.sort((a, b) => a.step - b.step).map(row => row.name)).toEqual(["audio_read", "audio_create"]);
    expect(calls.every(row => row.status === "completed")).toBe(true);
    expect(await db.chatMessages.where("threadId").equals(run.threadId).filter(row => row.role === "user").count()).toBe(1);
  });

  it.each(["chat-completions", "responses"] as const)("stops at paid confirmation in %s despite immediate tool availability", async protocol => {
    const { project, run } = await begin("audio", protocol);
    await db.connectors.put({ id: "mimo", definitionId: "mimo", baseUrl: "https://api.xiaomimimo.com/v1", apiKey: "paid-secret", updatedAt: "2026-09-22" });
    const paidFetch = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", paidFetch);
    const fetcher = vi.fn<typeof fetch>(async () => reply(protocol, [call("audio_generate_speech", { projectId: project.id, text: "午安，欢迎收听。" }, "paid-speech")]));
    expect(getOfferedToolNames(run)).toContain("audio_generate_speech");
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "waiting_approval" });
    expect((await db.agentToolCalls.where("runId").equals(run.id).toArray())[0]).toMatchObject({ status: "awaiting_approval", requiresConfirmation: true });
    expect(await db.audioGenerationJobs.count()).toBe(0);
    expect(await db.audioTakes.count()).toBe(0);
    expect(paidFetch).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps conversation mode tool-free even on a bound audio project", async () => {
    const { project, run: initial } = await begin("audio");
    await finishAgentRun(initial.id, "completed");
    const thread = await createChatThread({ projectId: project.id });
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "fixture", content: "只讨论思路", interactionMode: "conversation" });
    expect(run.skillInstructions).toBe("");
    expect(run.toolLoading).toBeUndefined();
    expect(getOfferedToolNames(run)).toEqual([]);
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => { expect(JSON.parse(String(init?.body)).tools).toBeUndefined(); return reply(run.protocol); });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect(await db.agentToolCalls.count()).toBe(0);
    expect(await db.audioSegments.count()).toBe(0);
  });

  it("honors Stop before dispatch and freezes preloaded capabilities across a retry", async () => {
    const { run } = await begin("audio");
    const abort = new AbortController(); abort.abort();
    const fetcher = vi.fn<typeof fetch>();
    await executeChatRun(run, connector.apiKey, abort, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "cancelled" });
    expect(await db.audioSegments.count()).toBe(0);
    await updateGeneralAgentConfig({ enabledSkillIds: [], permissionMode: "ask" });
    const retry = await beginAgentRun({ threadId: run.threadId, connector, model: "fixture", retryOfRunId: run.id });
    expect(retry.toolLoading).toEqual(run.toolLoading);
    expect(retry.enabledToolNames).toEqual(run.enabledToolNames);
    expect(retry.skillInstructions).toEqual(run.skillInstructions);
    expect(retry.permissionMode).toBe("full");
    expect(getOfferedToolNames(retry)).toContain("audio_create");
  });
});
