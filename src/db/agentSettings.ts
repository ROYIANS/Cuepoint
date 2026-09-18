import { db } from "@/db/database";
import { GENERAL_AGENT_ID, type AgentConfig, type AgentPermissionMode } from "@/domain/agent";
import { DEFAULT_SKILL_IDS, assembleSkills } from "@/lib/agent/skills";
import { nowIso } from "@/lib/ids";

/** May also run in the transaction that creates a run. */
export async function getGeneralAgentConfig(): Promise<AgentConfig> {
  return db.transaction("rw", db.agents, async () => {
    const existing = await db.agents.get(GENERAL_AGENT_ID);
    if (existing) return { ...existing, permissionMode: existing.permissionMode ?? "ask", enabledSkillIds: existing.enabledSkillIds ?? [...DEFAULT_SKILL_IDS] };
    const agent: AgentConfig = {
      id: GENERAL_AGENT_ID, name: "创作助手",
      instructions: "你是小光点的通用创作助手，帮助用户梳理创意、剧本和制作计划。准确说明已完成的工作，不要声称执行了没有实际调用的工具或修改了系统数据。",
      permissionMode: "ask", enabledSkillIds: [...DEFAULT_SKILL_IDS], updatedAt: nowIso(),
    };
    await db.agents.add(agent);
    return agent;
  });
}
export async function updateGeneralAgentConfig(patch: { permissionMode?: AgentPermissionMode; enabledSkillIds?: string[] }): Promise<void> {
  if (patch.permissionMode !== undefined && !["ask", "assist", "full"].includes(patch.permissionMode)) throw new Error("未知授权模式");
  if (patch.enabledSkillIds) assembleSkills(patch.enabledSkillIds);
  await db.transaction("rw", db.agents, async () => {
    const agent = await getGeneralAgentConfig();
    await db.agents.update(agent.id, { ...patch, updatedAt: nowIso() });
  });
}
