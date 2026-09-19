import type { ProjectMemory } from "@/domain/projectMemory";

export const CATEGORY_LABELS = {
  convention: "项目规范",
  preference: "创作偏好",
  decision: "关键决策",
  lesson: "经验教训",
};
export const STATUS_LABELS = {
  active: "已确认",
  disabled: "已停用",
  superseded: "已被替代",
  pending_review: "待复核",
};
export const memoryDate = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const sourceLabel = (memory: ProjectMemory) =>
  memory.source.kind === "manual"
    ? "手动记录"
    : memory.source.kind === "imported"
      ? "项目备份"
      : "任务总结";
