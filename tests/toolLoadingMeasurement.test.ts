import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun } from "@/db/agentRuns";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { createChatThread } from "@/db/repo";
import { createIpProfile } from "@/db/ipProfiles";
import { assembleSkills, DEFAULT_SKILL_IDS } from "@/lib/agent/skills";
import { filterProjectMemoryTools } from "@/lib/agent/memoryToolNames";
import { createToolLoading, DISCOVERY_TOOL_NAME, getOfferedToolNames, toolLoadingInstructions } from "@/lib/agent/toolLoading";
import { toolSchemas } from "@/lib/agent/tools";
import { estimateTokens } from "@/lib/agent/contextUsage";
import { executeChatRun } from "@/lib/agent/runChat";
import type { AgentRequestMessage } from "@/domain/agent";

it("measures startup, loaded groups and complete deterministic IP-search request chain", async () => {
  const full = assembleSkills(DEFAULT_SKILL_IDS);
  const measure = (projectId?: string, ids: string[] = []) => {
    const allowed = filterProjectMemoryTools(full.enabledToolNames, projectId, "smart");
    const initial = createToolLoading(DEFAULT_SKILL_IDS, allowed)!;
    const state = { ...initial, loadedGroupIds: ids, loadedToolNames: [...new Set(initial.groups.filter((group) => ids.includes(group.id)).flatMap((group) => group.toolNames))] };
    const names = getOfferedToolNames({ enabledToolNames: [...allowed, DISCOVERY_TOOL_NAME], toolLoading: state });
    const schemaTokens = estimateTokens(JSON.stringify(toolSchemas(names))), instructionTokens = estimateTokens(toolLoadingInstructions(state));
    return { toolCount: names.length, schemaTokens, instructionTokens, combinedTokens: schemaTokens + instructionTokens, decreaseFromOriginalBaseline: 1 - (schemaTokens + instructionTokens) / 13_816 };
  };
  const snapshots = { initialUnbound: measure(), initialBound: measure("project"), ip: measure(undefined, ["ip-management"]), material: measure(undefined, ["material-library"]), ipAndMaterial: measure(undefined, ["ip-management", "material-library"]) };
  expect(snapshots.initialUnbound.decreaseFromOriginalBaseline).toBeGreaterThan(0.6);
  expect(snapshots.initialBound.decreaseFromOriginalBaseline).toBeGreaterThan(0.6);
  await createIpProfile({ name: "INFP美食博主", positioning: "安静地记录生活里的美食" });
  await updateGeneralAgentConfig({ enabledSkillIds: [...DEFAULT_SKILL_IDS] });
  const thread = await createChatThread();
  const connector = { id: "measure", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture", updatedAt: "2026-09-21" };
  const run = await beginAgentRun({ threadId: thread.id, connector, model: "fixture", content: "查找我的 INFP 美食博主 IP" });
  const requests: Array<{ step: number; toolCount: number; schemaTokens: number; messageTokens: number; toolResultTokens: number; combinedInputTokens: number }> = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { tools: unknown[]; messages: AgentRequestMessage[] };
    const step = requests.length + 1;
    const schemaTokens = estimateTokens(JSON.stringify(body.tools)), messageTokens = estimateTokens(JSON.stringify(body.messages));
    requests.push({ step, toolCount: body.tools.length, schemaTokens, messageTokens, toolResultTokens: estimateTokens(JSON.stringify(body.messages.filter((message) => message.role === "tool"))), combinedInputTokens: schemaTokens + messageTokens });
    const name = step === 1 ? DISCOVERY_TOOL_NAME : "ip_search";
    const args = step === 1 ? { groupIds: ["ip-management"] } : { query: "INFP" };
    return Response.json({ choices: [{ message: step < 3 ? { content: "", tool_calls: [{ id: `call-${step}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] } : { content: "找到你的 INFP 美食博主 IP。" }, finish_reason: step < 3 ? "tool_calls" : "stop" }] });
  };
  await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
  expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  expect(requests).toHaveLength(3);
  const report = { estimator: "local character heuristic; not provider billing", originalBaseline: { tools: 50, schemaTokens: 11865, instructionTokens: 1951, combinedTokens: 13816 }, snapshots, ipSearch: { requests, totalEstimatedInputTokens: requests.reduce((sum, request) => sum + request.combinedInputTokens, 0), discoveryExtraModelRounds: 1, firstDiscoveryRequestInputTokens: requests[0].combinedInputTokens, note: "3 requests: load IP group -> ip_search -> answer. Includes actual loader and search results in subsequent inputs. Does not include provider output/reasoning/cache and is not a no-discovery A/B billing comparison." } };
  if (process.env.TOOL_LOADING_MEASURE_OUTPUT) writeFileSync(process.env.TOOL_LOADING_MEASURE_OUTPUT, JSON.stringify(report, null, 2) + "\n");
});
