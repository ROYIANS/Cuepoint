import { prepareRunContext } from "@/lib/agent/contextCompaction";
import { buildContextMessages } from "@/lib/agent/contextPlanner";
import { toResponseInput } from "@/lib/ai/responsesStream";
import { filterProjectMemoryTools } from "@/lib/agent/memoryToolNames";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createChatThread } from "@/db/repo";
import { beginAgentRun } from "@/db/agentRuns";
import { resolveAgentToolApproval, saveToolRound, startModelStep } from "@/db/agentTools";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { BUILTIN_TOOLS, toolSchemas, type AgentToolDefinition } from "@/lib/agent/tools";
import { assembleSkills, DEFAULT_SKILL_IDS } from "@/lib/agent/skills";
import { estimateTokens } from "@/lib/agent/contextUsage";
import { createToolLoading, DISCOVERY_TOOL_NAME, getOfferedToolNames, refreshRunToolLoading, toolLoadingInstructions, toolNamesForCall } from "@/lib/agent/toolLoading";
import type { AgentRun, AgentWireToolCall } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";

const connector: ConnectorConfig = { id: "loading-cx", name: "loading", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret", updatedAt: "2026-09-21" };
async function begin(protocol: "chat-completions" | "responses" = "chat-completions", permissionMode: "full" | "ask" = "full") {
  await updateGeneralAgentConfig({ permissionMode, enabledSkillIds: ["workspace", "planning", "business-read", "story-edit", "asset-edit"] });
  const thread = await createChatThread();
  const run = await beginAgentRun({ threadId: thread.id, connector, model: "test-model", content: "查找项目，再整理角色" });
  await db.agentRuns.update(run.id, { protocol });
  return { ...run, protocol };
}
const call = (name: string, args: unknown, id: string): AgentWireToolCall => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
function reply(protocol: AgentRun["protocol"], calls: AgentWireToolCall[] = []) {
  if (protocol === "responses") return Response.json({ id: "response", status: "completed", output: calls.length ? calls.map((item) => ({ type: "function_call", call_id: item.id, name: item.function.name, arguments: item.function.arguments })) : [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "完成", annotations: [] }] }] });
  return Response.json({ choices: [{ message: { content: calls.length ? "" : "完成", ...(calls.length ? { tool_calls: calls } : {}) }, finish_reason: calls.length ? "tool_calls" : "stop" }] });
}
const load = (ids: string[], id = "load-1") => call(DISCOVERY_TOOL_NAME, { groupIds: ids }, id);
function names(body: Record<string, unknown>): string[] {
  return (body.tools as Array<{ name?: string; function?: { name: string } }>).map((tool) => tool.name ?? tool.function!.name);
}

describe("progressive tool loading", () => {
  it("keeps permission ceiling separate and reduces initial schema plus guidance by over 60%", async () => {
    const full = assembleSkills(DEFAULT_SKILL_IDS);
    const state = createToolLoading(DEFAULT_SKILL_IDS, full.enabledToolNames)!;
    const initial = getOfferedToolNames({ toolLoading: state, enabledToolNames: [...full.enabledToolNames, DISCOVERY_TOOL_NAME] });
    for (const projectId of [undefined, "project-fixture"]) {
      const allowed = filterProjectMemoryTools(full.enabledToolNames, projectId, "smart");
      const scopedState = createToolLoading(DEFAULT_SKILL_IDS, allowed)!;
      const scopedInitial = getOfferedToolNames({ enabledToolNames: [...allowed, DISCOVERY_TOOL_NAME], toolLoading: scopedState });
      const before = estimateTokens(JSON.stringify(toolSchemas(allowed))) + estimateTokens(full.skillInstructions);
      const after = estimateTokens(JSON.stringify(toolSchemas(scopedInitial))) + estimateTokens(toolLoadingInstructions(scopedState));
      expect(after / before).toBeLessThan(0.4);
      // Compare the original approved 13,816-token baseline as well, not just the enlarged registry.
      expect(after / 13_816).toBeLessThan(0.4);
    }
    expect(initial).toEqual(["workspace_overview", "update_run_plan", DISCOVERY_TOOL_NAME]);
    const baseline = estimateTokens(JSON.stringify(toolSchemas(full.enabledToolNames))) + estimateTokens(full.skillInstructions);
    const actual = estimateTokens(JSON.stringify(toolSchemas(initial))) + estimateTokens(toolLoadingInstructions(state));
    expect(actual / baseline).toBeLessThan(0.4);
    const run = await begin();
    expect(run.enabledToolNames).toContain("project_create");
    expect(getOfferedToolNames(run)).not.toContain("project_create");
    expect(run.skillInstructions).not.toContain("删除按用户明确目标执行");
  });
  it.each(["chat-completions", "responses"] as const)("dispatches only loaded definitions and replaces guidance on %s", async (protocol) => {
    const run = await begin(protocol);
    const bodies: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length === 1) return reply(protocol, [load(["story-edit"])]);
      if (bodies.length === 2) return reply(protocol, [load(["asset-edit"], "load-2")]);
      return reply(protocol);
    });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    expect(names(bodies[0])).toEqual(["workspace_overview", "update_run_plan", DISCOVERY_TOOL_NAME]);
    expect(names(bodies[1])).toContain("project_create");
    expect(names(bodies[2])).toContain("character_create");
    expect(names(bodies[2])).not.toContain("project_create");
    expect(JSON.stringify(bodies[2])).not.toContain("删除按用户明确目标执行");
    expect(JSON.stringify(bodies[2])).toContain("工作室 ownerId 使用 studio");
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.offeredTools?.map((step) => step.names)).toEqual(bodies.map(names));
    expect(saved.requestMessages[0].content).not.toContain("删除按用户明确目标执行");
  });
  it("rejects same-step load plus never-offered call before executing either", async () => {
    const run = await begin();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => reply(run.protocol, [load(["story-edit"]), call("project_create", {}, "sneak")])));
    expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
    expect(await db.agentToolCalls.count()).toBe(0);
    expect(await db.projects.count()).toBe(0);
    expect((await db.agentRuns.get(run.id))?.toolLoading?.loadedGroupIds).toEqual([]);
  });
  it("rejects disabled groups atomically without broadening authority", async () => {
    const run = await begin();
    let round = 0;
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => reply(run.protocol, ++round === 1 ? [load(["web-research"])] : [])));
    const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    expect(calls[0]).toMatchObject({ status: "failed", error: expect.stringContaining("未启用") });
    expect((await db.agentRuns.get(run.id))?.toolLoading?.loadedGroupIds).toEqual([]);
  });
  it("enforces per-step offers even if a ledger envelope bypasses the transport", async () => {
    const run = await begin();
    await startModelStep(run.id, 32);
    await expect(saveToolRound(run.id, "", [call("business_search", {}, "forged")], [{ title: "search", effect: "read", highRisk: false }])).rejects.toThrow("本轮未提供");
    expect(toolNamesForCall(run, 1)).toEqual([]);
  });
  it("restores loaded state and approval without replaying loading or completed effects", async () => {
    const run = await begin("chat-completions", "ask");
    const effect = vi.fn(async () => ({ changed: true }));
    const tool: AgentToolDefinition = { name: "project_create", title: "创建", description: "fixture", parameters: { type: "object", properties: {} }, parseArguments: () => ({}), effect: "write", highRisk: () => false, execute: effect };
    const registry = BUILTIN_TOOLS.map((item) => item.name === tool.name ? tool : item);
    let round = 0;
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => reply(run.protocol, ++round === 1 ? [load(["story-edit"])] : [call(tool.name, {}, "write")])), registry);
    expect((await db.agentRuns.get(run.id))?.status).toBe("waiting_approval");
    const pending = await db.agentToolCalls.where("runId").equals(run.id).filter((item) => item.status === "awaiting_approval").first();
    await updateGeneralAgentConfig({ enabledSkillIds: [] });
    await resolveAgentToolApproval(run.id, pending!.id, "approve");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => reply(run.protocol)), registry);
    expect(effect).toHaveBeenCalledTimes(1);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.status).toBe("completed");
    expect(saved.toolLoading?.loadedGroupIds).toEqual(["story-edit"]);
    expect(await db.agentToolCalls.where("runId").equals(run.id).count()).toBe(2);
  });
  it("pins same-round approved tools when switching groups and executes each once", async () => {
    const run = await begin("chat-completions", "ask");
    const effect = vi.fn(async () => ({ changed: true }));
    const tool: AgentToolDefinition = { name: "project_create", title: "创建", description: "fixture", parameters: { type: "object", properties: {} }, parseArguments: () => ({}), effect: "write", highRisk: () => false, execute: effect };
    const registry = BUILTIN_TOOLS.map((item) => item.name === tool.name ? tool : item);
    let round = 0;
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => reply(run.protocol, ++round === 1 ? [load(["story-edit"])] : [load(["asset-edit"], "switch"), call(tool.name, {}, "write")])), registry);
    const pending = await db.agentToolCalls.where("runId").equals(run.id).filter((item) => item.status === "awaiting_approval").first();
    expect((await db.agentRuns.get(run.id))?.toolLoading?.loadedGroupIds).toEqual(["story-edit"]);
    await resolveAgentToolApproval(run.id, pending!.id, "approve");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(names(body)).toContain("project_create");
      expect(names(body)).toContain("character_create");
      return reply(run.protocol);
    }), registry);
    expect(effect).toHaveBeenCalledTimes(1);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });
  it.each(["chat-completions", "responses"] as const)("retains loaded skills and opaque live envelopes through %s compaction", async (protocol) => {
    const run = await begin(protocol);
    const history = Array.from({ length: 6 }, (_, index) => ({ id: `old-${index}`, role: index % 2 ? "assistant" as const : "user" as const, content: "previous ".repeat(1000) }));
    const state = { ...run.toolLoading!, loadedGroupIds: ["story-edit"], loadedToolNames: run.toolLoading!.groups.find((group) => group.id === "story-edit")!.toolNames };
    const instructions = toolLoadingInstructions(state);
    const baseMessages = buildContextMessages(run.agentSnapshot.instructions, instructions, history, "continue");
    const tail = [{ role: "user" as const, content: "Live document evidence must survive intact", sourceToolCallId: "saved-read" }];
    const responseTail = [{ type: "reasoning" as const, summary: [], encrypted_content: "opaque-unchanged" }, ...toResponseInput(tail)];
    await db.agentRuns.update(run.id, { toolLoading: state, skillInstructions: instructions, context: { ...run.context!, history, draft: "continue", baseMessages, capacity: 24000, policy: { ...run.context!.policy, autoCompress: true } }, continuationMessages: [...baseMessages, ...tail], ...(protocol === "responses" ? { responseItems: [...toResponseInput(baseMessages), ...responseTail] } : {}) });
    const fetcher = vi.fn(async () => protocol === "responses" ? Response.json({ status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "历史目标已保留。", annotations: [] }] }] }) : Response.json({ choices: [{ message: { content: "历史目标已保留。" }, finish_reason: "stop" }] }));
    const next = await prepareRunContext(run.id, toolSchemas(getOfferedToolNames({ ...run, toolLoading: state })), connector.apiKey, new AbortController().signal, fetcher);
    expect(next.context?.summaryId).toBeDefined();
    expect(next.context?.baseMessages[0].content).toContain("删除按用户明确目标执行");
    expect(next.continuationMessages?.at(-1)).toEqual(tail[0]);
    if (protocol === "responses") expect(next.responseItems?.slice(-2)).toEqual(responseTail);
    expect(next.toolLoading).toEqual(state);
  });
  it("keeps legacy snapshots and conversation mode compatible", async () => {
    const run = await begin();
    const legacy = { ...run, toolLoading: undefined };
    await db.agentRuns.put(legacy);
    expect(getOfferedToolNames(await refreshRunToolLoading(run.id))).toEqual(run.enabledToolNames);
    expect(toolNamesForCall(legacy, 123)).toEqual(run.enabledToolNames);
    const thread = await createChatThread();
    const conversation = await beginAgentRun({ threadId: thread.id, connector, model: "test", content: "你好", interactionMode: "conversation" });
    expect(conversation.toolLoading).toBeUndefined();
    expect(getOfferedToolNames(conversation)).toEqual([]);
    expect(conversation.skillInstructions).toBe("");
  });
});
