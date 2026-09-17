import type { ShotColumnId } from "./types";
import { DEFAULT_VISIBLE_COLUMNS } from "./types";

export interface ColumnDef {
  id: ShotColumnId;
  label: string;
  kind: "text" | "number" | "select";
  width: number;
}

export const SHOT_COLUMNS: ColumnDef[] = [
  { id: "durationSec", label: "时长 (秒)", kind: "number", width: 108 },
  { id: "content", label: "内容", kind: "text", width: 220 },
  { id: "characters", label: "角色", kind: "select", width: 180 },
  { id: "scene", label: "场景", kind: "select", width: 160 },
  { id: "notes", label: "备注", kind: "text", width: 180 },
  { id: "category", label: "类别", kind: "text", width: 140 },
  { id: "sound", label: "声音", kind: "text", width: 160 },
  { id: "emotion", label: "情绪", kind: "text", width: 140 },
  { id: "cameraAngle", label: "摄像机角度", kind: "text", width: 150 },
  { id: "cameraGear", label: "摄像机装备", kind: "text", width: 150 },
  { id: "focalLength", label: "镜头焦段", kind: "text", width: 140 },
  { id: "sceneCloseup", label: "场景特写", kind: "text", width: 180 },
];

export function normalizeVisibleColumns(
  visible: ShotColumnId[] | undefined,
): ShotColumnId[] {
  if (!visible || visible.length === 0) return [...DEFAULT_VISIBLE_COLUMNS];
  const known = new Set(SHOT_COLUMNS.map((column) => column.id));
  return visible.filter((id) => known.has(id));
}
