import { z } from "zod";
import { db } from "@/db/database";
import { executeAtomicTool } from "@/db/agentTools";
import type { AgentRun, AgentToolLoading, AgentToolCall } from "@/domain/agent";
import { toResponseInput } from "@/lib/ai/responsesStream";
import { AGENT_SKILLS, SMART_EXECUTION_INSTRUCTIONS } from "./skills";
import type { ProjectKind } from "@/domain/types";
import type { AgentToolDefinition } from "./tools";

export const DISCOVERY_TOOL_NAME = "load_tool_groups";
export const MAX_LOADED_TOOLS = 36;
const settled = (call: AgentToolCall) => ["completed", "failed", "rejected"].includes(call.status);
const foundation = (name: string) => name === "workspace_overview" || name === "update_run_plan" || name.startsWith("task_");

/** Freeze descriptions, instructions and permission-filtered names at run creation. */
export function createToolLoading(skillIds: readonly string[], allowedNames: readonly string[], projectKind?: ProjectKind): AgentToolLoading | undefined {
  const groups = AGENT_SKILLS.filter((skill) => skillIds.includes(skill.id)).map((skill) => ({ ...skill, toolNames: skill.toolNames.filter((name) => allowedNames.includes(name)) })).filter((skill) => skill.toolNames.length);
  const deferred = groups.filter((skill) => skill.toolNames.some((name) => !foundation(name)));
  if (!deferred.length) return undefined;
  const foundationToolNames = [...new Set([...allowedNames.filter(foundation), DISCOVERY_TOOL_NAME])];
  const preferred = projectKind === "audio" ? "audio-production" : projectKind === "music" ? "music-creation" : undefined;
  const initial = deferred.find((group) => group.id === preferred);
  const loadedToolNames = initial ? [...new Set(initial.toolNames)] : [];
  const preload = new Set([...foundationToolNames, ...loadedToolNames]).size <= MAX_LOADED_TOOLS;
  return {
    version: 1,
    groups: deferred,
    foundationToolNames,
    foundationInstructions: groups.filter((skill) => skill.toolNames.every(foundation)).map((skill) => skill.instructions).join("\n"),
    loadedGroupIds: initial && preload ? [initial.id] : [], loadedToolNames: preload ? loadedToolNames : [],
  };
}
export function getOfferedToolNames(run: Pick<AgentRun, "enabledToolNames" | "toolLoading" | "interactionMode">): string[] {
  if (run.interactionMode === "conversation") return [];
  if (!run.toolLoading) return run.enabledToolNames ?? [];
  const allowed = run.enabledToolNames ?? [];
  return [...new Set([...run.toolLoading.foundationToolNames, ...run.toolLoading.loadedToolNames])].filter((name) => allowed.includes(name));
}
/** A call must have been offered in its own request, not merely loaded later. */
export function toolNamesForCall(run: AgentRun, step: number): string[] {
  if (!run.toolLoading) return run.enabledToolNames ?? [];
  return (run.offeredTools?.find((offer) => offer.step === step)?.names ?? []).filter((name) => run.enabledToolNames?.includes(name));
}
export function toolLoadingInstructions(state: AgentToolLoading): string {
  return [
    SMART_EXECUTION_INSTRUCTIONS,
    state.foundationInstructions,
    "按需工具：已提供定义的业务工具可以直接调用，不必重复加载。当前未提供的工具须先调用 load_tool_groups，系统在同一次执行的下一次模型请求提供定义，收到结果后立即继续，不需要用户发送继续。groupIds 为要保留的完整分组列表（最多 2 组，替换上次加载）；空列表配合 query 只查目录，不执行业务。发现与加载不改变授权。依赖上一步结果的操作放到收到结果后的下一次模型请求。",
    "可用能力目录：\n" + state.groups.map((group) => `${group.id}｜${group.name}：${group.description}`).join("\n"),
    ...state.groups.filter((group) => state.loadedGroupIds.includes(group.id)).map((group) => group.instructions),
  ].filter(Boolean).join("\n");
}
const loadingSchema = z.object({ groupIds: z.array(z.string().min(1).max(80)).max(2), query: z.string().trim().max(100).optional() }).strict();
export const DISCOVERY_TOOLS: readonly AgentToolDefinition[] = [{
  name: DISCOVERY_TOOL_NAME, title: "加载创作工具", description: "按能力目录加载最多两组已授权工具，替换之前的业务组；同次执行的下一次模型请求获得完整定义，无需用户再次发送消息。groupIds=[] 时仅按 query 查询目录，不执行业务。",
  parameters: { type: "object", additionalProperties: false, required: ["groupIds"], properties: { groupIds: { type: "array", maxItems: 2, items: { type: "string", minLength: 1, maxLength: 80 } }, query: { type: "string", maxLength: 100 } } },
  effect: "bookkeeping", atomic: true, highRisk: () => false,
  parseArguments: (raw) => loadingSchema.parse(raw),
  async execute(raw, context) {
    const args = loadingSchema.parse(raw);
    return executeAtomicTool(context, async () => {
      const run = await db.agentRuns.get(context.runId);
      const state = run?.toolLoading;
      const call = await db.agentToolCalls.get(context.callId);
      if (!run || !state || !call || call.name !== DISCOVERY_TOOL_NAME || !toolNamesForCall(run, call.step).includes(DISCOVERY_TOOL_NAME)) throw new Error("本轮未提供工具加载入口");
      if (args.groupIds.some((id) => !state.groups.some((group) => group.id === id))) throw new Error("请求的能力不存在或未启用，请使用可用能力目录中的分组 ID");
      const selected = state.groups.filter((group) => args.groupIds.includes(group.id));
      if (!selected.length) {
        const query = args.query?.toLocaleLowerCase();
        return { groups: state.groups.filter((group) => !query || `${group.id} ${group.name} ${group.description}`.toLocaleLowerCase().includes(query)).map(({ id, name, description }) => ({ id, name, description })), loadedGroupIds: state.loadedGroupIds, note: "仅查询目录；请接着选择 groupIds，系统将在同次执行的下一次模型请求加载定义；不代表业务已执行。" };
      }
      const pending = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).filter((row) => !settled(row));
      const pinned = pending.map((row) => row.name).filter((name) => !state.foundationToolNames.includes(name));
      const loadedToolNames = [...new Set([...selected.flatMap((group) => group.toolNames), ...pinned])].filter((name) => run.enabledToolNames?.includes(name)).sort();
      if (new Set([...state.foundationToolNames, ...loadedToolNames]).size > MAX_LOADED_TOOLS) throw new Error(`同时加载的工具超过 ${MAX_LOADED_TOOLS} 个，请一次选择一个分组，待当前调用完成后再切换。`);
      const next = { ...state, loadedGroupIds: [...new Set([...selected.map((group) => group.id), ...state.loadedGroupIds.filter((id) => state.groups.find((group) => group.id === id)?.toolNames.some((name) => pinned.includes(name)))])], loadedToolNames };
      await db.agentRuns.update(run.id, { toolLoading: next });
      return { loadedGroupIds: next.loadedGroupIds, toolNames: loadedToolNames, effectiveFromStep: (run.modelStep ?? 0) + 1, note: "工具已准备好，系统会在同一次执行的下一次模型请求提供完整参数；请接着调用所需业务工具，无需用户再发送开始或继续。此操作只加载能力，没有执行任何业务。" };
    });
  },
}];

/** Replace only the upcoming skill layer; preserve request history and paired tool envelopes. */
export async function refreshRunToolLoading(runId: string): Promise<AgentRun> {
  return db.transaction("rw", [db.agentRuns, db.agentToolCalls], async () => {
    const run = await db.agentRuns.get(runId);
    if (!run || run.status !== "running") throw new Error("执行已停止");
    if (!run.toolLoading) return run;
    if ((await db.agentToolCalls.where("runId").equals(runId).toArray()).some((call) => !settled(call))) throw new Error("请先处理工具步骤，再切换能力");
    const skillInstructions = toolLoadingInstructions(run.toolLoading);
    if (skillInstructions === run.skillInstructions) return run;
    const messages = run.continuationMessages ?? run.requestMessages;
    const oldBase = run.context?.baseMessages ?? [messages[0]];
    if (!oldBase[0] || oldBase[0].role !== "system" || JSON.stringify(messages.slice(0, oldBase.length)) !== JSON.stringify(oldBase)) throw new Error("技能上下文信封不匹配");
    const baseMessages = [{ ...oldBase[0], content: [run.agentSnapshot.instructions, skillInstructions].filter(Boolean).join("\n") }, ...oldBase.slice(1)];
    const oldResponseBase = toResponseInput(oldBase);
    if (run.responseItems && JSON.stringify(run.responseItems.slice(0, oldResponseBase.length)) !== JSON.stringify(oldResponseBase)) throw new Error("Responses 技能信封不匹配");
    const next: AgentRun = { ...run, skillInstructions, ...(run.context ? { context: { ...run.context, baseMessages } } : {}), continuationMessages: [...baseMessages, ...messages.slice(oldBase.length)], ...(run.responseItems ? { responseItems: [...toResponseInput(baseMessages), ...run.responseItems.slice(oldResponseBase.length)] } : {}) };
    await db.agentRuns.put(next);
    return next;
  });
}
