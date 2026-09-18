/** Bundled skills are instructions plus an explicit code-owned tool allowlist. */
export const AGENT_SKILLS = [
  { id: "workspace", name: "工作区概览", description: "读取项目与素材数量，以及少量项目名称。", toolNames: ["workspace_overview"], instructions: "需要了解本地数据时使用 workspace_overview；概览不包含完整素材内容，不要猜测不存在的数据。" },
  { id: "planning", name: "执行计划", description: "维护本次执行的步骤与完成状态。", toolNames: ["update_run_plan"], instructions: "复杂请求可用 update_run_plan 维护本次执行计划。只有实际完成的步骤才标记 completed；计划记录不代表业务数据已修改。" },
] as const;
export const DEFAULT_SKILL_IDS = AGENT_SKILLS.map((skill) => skill.id);
export function assembleSkills(ids: readonly string[]) {
  if (ids.some((id) => !AGENT_SKILLS.some((skill) => skill.id === id))) throw new Error("未知的内置技能");
  const enabled = AGENT_SKILLS.filter((skill) => ids.includes(skill.id));
  return { enabledToolNames: enabled.flatMap((skill) => [...skill.toolNames]), skillInstructions: enabled.map((skill) => skill.instructions).join("\n") };
}
