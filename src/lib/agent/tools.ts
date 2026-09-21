import { WEB_TOOLS } from "./webTools";
import { REFERENCE_TOOLS } from "./referenceTools";
import { MEMORY_TOOLS } from "./memoryTools";
import { frozenProjectScope } from "./projectScope";
import { TASK_TOOLS } from "./taskTools";
import { GENERATION_TOOLS } from "./generationTools";
import { BUSINESS_TOOLS } from "./businessTools";
import { z } from "zod";
import { ToolValidationError, toolArgumentError } from "./toolErrors";
import { db } from "@/db/database";
import { updateRunPlanAndComplete } from "@/db/agentTools";
import type { AgentPermissionMode, AgentPlanItem, AgentToolEffect, AgentToolSchema, AgentToolPreview, AgentToolCall } from "@/domain/agent";

export interface AgentToolContext { projectId?: string; runId: string; threadId: string; callId: string; signal: AbortSignal; preview?: AgentToolPreview }
export interface AgentToolDefinition {
  name: string; title: string; description: string; parameters: Record<string, unknown>;
  effect: AgentToolEffect;
  parseArguments(raw: unknown): unknown;
  highRisk(args: unknown): boolean;
  atomic?: boolean;
  requiresConfirmation?: boolean;
  recovery?: "generation" | "repeatable";
  prepare?(args: unknown, context: AgentToolContext): Promise<AgentToolPreview>;
  execute(args: unknown, context: AgentToolContext): Promise<unknown>;
}
export function requiresToolApproval(mode: AgentPermissionMode, tool: Pick<AgentToolDefinition, "effect" | "highRisk" | "requiresConfirmation">, args: unknown): boolean {
  if (!["ask", "assist", "full"].includes(mode)) throw new Error("未知授权模式");
  if (tool.requiresConfirmation) return true;
  if (mode === "full") return false;
  if (tool.highRisk(args)) return true;
  return mode === "ask" && (tool.effect === "write" || tool.effect === "network");
}
const planSchema = z.object({ reason: z.string().trim().min(1).max(1000).optional(), steps: z.array(z.object({ id: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(240), status: z.enum(["pending", "in_progress", "completed"]) }).strict()).max(30) }).strict().refine((value) => new Set(value.steps.map((step) => step.id)).size === value.steps.length && value.steps.filter((step) => step.status === "in_progress").length <= 1, "步骤标识必须唯一，最多一个步骤进行中");
export const BUILTIN_TOOLS: readonly AgentToolDefinition[] = [
  { name: "workspace_overview", title: "查看工作区概览", description: "读取工作区项目和角色、场景、道具、风格的数量，最多返回 10 个最近项目名称，不读取密钥或完整业务内容。",
    parameters: { type: "object", properties: {}, additionalProperties: false }, effect: "read", highRisk: () => false,
    parseArguments: (raw) => z.object({}).strict().parse(raw),
    async execute(_args, context) {
      const {signal}=context;
      signal.throwIfAborted();
      const projectId=await frozenProjectScope(context);
      if(projectId){const project=await db.projects.get(projectId);return {project:{id:projectId,name:project!.name},counts:{characters:await db.characters.where("projectId").equals(projectId).count(),scenes:await db.scenes.where("projectId").equals(projectId).count(),props:await db.props.where("projectId").equals(projectId).count(),styles:await db.styles.where("projectId").equals(projectId).count()}};}
      return db.transaction("r", [db.projects, db.characters, db.scenes, db.props, db.styles], async () => ({
        counts: { projects: await db.projects.count(), characters: await db.characters.count(), scenes: await db.scenes.count(), props: await db.props.count(), styles: await db.styles.count() },
        projects: (await db.projects.orderBy("updatedAt").reverse().limit(10).toArray()).map((project) => ({ id: project.id, name: project.name.slice(0, 200) })),
      }));
    },
  },
  { name: "update_run_plan", title: "更新执行计划", description: "维护当前执行及其关联任务的共享计划（最多 30 项），每项有唯一 id、title 和 pending/in_progress/completed 状态。不会修改项目或素材。",
    parameters: { type: "object", additionalProperties: false, required: ["steps"], properties: { reason: { type: "string", minLength: 1, maxLength: 1000 }, steps: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, required: ["id", "title", "status"], properties: { id: { type: "string", minLength: 1, maxLength: 80 }, title: { type: "string", minLength: 1, maxLength: 240 }, status: { type: "string", enum: ["pending", "in_progress", "completed"] } } } } } },
    effect: "bookkeeping", atomic: true, highRisk: () => false, parseArguments: (raw) => planSchema.parse(raw),
    async execute(args, { runId, callId, signal }) { signal.throwIfAborted(); return JSON.parse(await updateRunPlanAndComplete(runId, callId, (args as { steps: AgentPlanItem[] }).steps, (args as { reason?: string }).reason)); },
  },
  ...TASK_TOOLS,
  ...BUSINESS_TOOLS,
  ...GENERATION_TOOLS,
  ...MEMORY_TOOLS,
  ...REFERENCE_TOOLS,
  ...WEB_TOOLS,
];
export function toolSchemas(names: readonly string[], registry: readonly AgentToolDefinition[] = BUILTIN_TOOLS): AgentToolSchema[] {
  return names.map((name) => {
    const tool = registry.find((item) => item.name === name);
    if (!tool) throw new Error("启用的工具不存在");
    return { type: "function", function: { name, description: tool.description, parameters: tool.parameters } };
  });
}
export function validateToolCall(name: string, raw: string, enabled: readonly string[], registry: readonly AgentToolDefinition[] = BUILTIN_TOOLS) {
  const tool = registry.find((item) => item.name === name);
  if (!enabled.includes(name) || !tool) throw new Error("模型请求了未启用或未知的工具");
  if (raw.length > 32_768) throw new ToolValidationError(tool.title, name, [{ path: "参数", constraint: "工具参数超过大小限制，最多 32768 个字符", received: raw.length }]);
  let args: unknown;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); args = tool.parseArguments(parsed); } catch (cause) { throw toolArgumentError(tool.title, name, tool.parameters, parsed, cause); }
  return { tool, args };
}

/** Supplement known legacy validation failures without rewriting their saved history. */
export function getLegacyToolValidationFailure(call: Pick<AgentToolCall, "name" | "title" | "status" | "error" | "arguments">) {
  if (call.status !== "failed" || call.error !== `工具 ${call.title} 的参数无效`) return;
  try { validateToolCall(call.name, call.arguments, [call.name]); }
  catch (error) { if (error instanceof ToolValidationError) return error.failure; }
}
