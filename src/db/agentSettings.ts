import { db } from "@/db/database";
import { GENERAL_AGENT_ID, type AgentConfig, type AgentPermissionMode } from "@/domain/agent";
import { DEFAULT_SKILL_IDS, assembleSkills } from "@/lib/agent/skills";
import { nowIso } from "@/lib/ids";

const SKILL_DEFAULTS_VERSION = 2;

/** May also run in the transaction that creates a run. */
export async function getGeneralAgentConfig(): Promise<AgentConfig> {
  return db.transaction("rw", db.agents, async () => {
    const existing = await db.agents.get(GENERAL_AGENT_ID);
    if (existing) {
      // Enable the foundational creative skills once for existing installations.
      // A saved version prevents later reads from undoing the user's switch choices.
      if ((existing.skillDefaultsVersion ?? 0) < SKILL_DEFAULTS_VERSION) {
        const migrated: AgentConfig = { ...existing, permissionMode: existing.permissionMode ?? "ask",
          enabledSkillIds: (existing.skillDefaultsVersion ?? 0) < 1 ? [...DEFAULT_SKILL_IDS] : existing.enabledSkillIds?.length === 0 ? [] : [...new Set([...(existing.enabledSkillIds ?? DEFAULT_SKILL_IDS), "ip-management", "material-library"])], skillDefaultsVersion: SKILL_DEFAULTS_VERSION, updatedAt: nowIso() };
        await db.agents.put(migrated);
        return migrated;
      }
      return { ...existing, permissionMode: existing.permissionMode ?? "ask", enabledSkillIds: existing.enabledSkillIds ?? [...DEFAULT_SKILL_IDS] };
    }
    const agent: AgentConfig = {
      id: GENERAL_AGENT_ID, name: "创作助手",
      instructions: "你是小光点的通用创作助手，帮助用户梳理创意、剧本和制作计划。准确说明已完成的工作，不要声称执行了没有实际调用的工具或修改了系统数据。",
      permissionMode: "ask", enabledSkillIds: [...DEFAULT_SKILL_IDS], skillDefaultsVersion: SKILL_DEFAULTS_VERSION, updatedAt: nowIso(),
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
