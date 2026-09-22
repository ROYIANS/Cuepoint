import type { AgentRun, AgentToolCall } from "@/domain/agent";
import { readWriteReceipt, type WriteReceiptEntry } from "./writeReceipt";

export const WRITE_KIND_LABELS: Record<WriteReceiptEntry["kind"], string> = {
  project: "项目", episode: "分集", beat: "场次", shot: "镜头", character: "角色",
  scene: "场景", prop: "道具", style: "风格", audio_chapter: "章节",
  audio_speaker: "音色配置", audio_segment: "脚本段落", audio_track: "音轨",
  audio_clip: "时间线片段", music_draft: "音乐草稿", music_work: "作品资料",
};
export const WRITE_OPERATION_LABELS = { created: "新增", updated: "更新", deleted: "删除" } as const;
const businessKinds = new Set(["project", "episode", "beat", "shot", "character", "scene", "prop", "style"]);
const audioKinds = new Set(["audio_chapter", "audio_speaker", "audio_segment", "audio_track"]);

function permitsEntry(name: string, entry: WriteReceiptEntry): boolean {
  if (name === "project_create") return entry.operation === "created" && ["project", "episode", "audio_chapter", "audio_track", "music_draft"].includes(entry.kind);
  if (businessKinds.has(entry.kind)) return name === `${entry.kind}_${{ created: "create", updated: "update", deleted: "delete" }[entry.operation]}`;
  if (name === "audio_create" || name === "audio_update") return audioKinds.has(entry.kind) && entry.operation === (name === "audio_create" ? "created" : "updated");
  if (name === "audio_place_take") return entry.kind === "audio_clip" && entry.operation === "created";
  if (name === "audio_edit_clip") return entry.kind === "audio_clip" && entry.operation === "updated";
  if (name === "audio_remove_clip") return entry.kind === "audio_clip" && entry.operation === "deleted";
  if (name === "music_save_draft") return entry.kind === "music_draft" && entry.operation !== "deleted";
  if (name === "music_reuse_work") return entry.kind === "music_draft" && entry.operation === "created";
  return name === "music_update_work" && entry.kind === "music_work" && entry.operation === "updated";
}

export interface RunWriteOutcome extends WriteReceiptEntry { callId: string }
export interface RunWriteOutcomes {
  entries: RunWriteOutcome[];
  total: number;
  omitted: number;
  uncoveredCalls: number;
  groups: Array<{ label: string; count: number }>;
}

/** Saved tool receipts describe historical direct effects, never the current state or goal completion. */
export function describeRunWrites(run: Pick<AgentRun, "id" | "threadId" | "projectId" | "createdProjectBinding">, calls: readonly AgentToolCall[]): RunWriteOutcomes {
  const entries: RunWriteOutcome[] = [];
  const counts = new Map<string, number>();
  const seenCalls = new Set<string>();
  let total = 0, uncoveredCalls = 0;
  const ordered = calls.filter((call) => call.runId === run.id && call.threadId === run.threadId)
    .slice().sort((a, b) => a.step - b.step || a.order - b.order || a.id.localeCompare(b.id));
  for (const call of ordered) {
    if (seenCalls.has(call.id)) continue;
    seenCalls.add(call.id);
    if (call.effect !== "write" || call.status !== "completed") continue;
    let result: Record<string, unknown> | undefined;
    if (call.atomic && call.result && call.result.length <= 65536) {
      try {
        const parsed: unknown = JSON.parse(call.result);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) result = parsed as Record<string, unknown>;
      } catch { /* Old or incomplete payloads have no receipt evidence. */ }
    }
    const receipt = readWriteReceipt(result?.writeReceipt);
    const seenEntries = new Set<string>();
    const valid = receipt?.entries.every((entry) => {
      const identity = `${entry.kind}:${entry.id}`;
      if (seenEntries.has(identity)) return false;
      seenEntries.add(identity);
      if (!permitsEntry(call.name, entry) || (run.projectId && entry.ownerId !== run.projectId)) return false;
      if (call.name === "project_create" && ((run.projectId && (run.createdProjectBinding?.projectId !== run.projectId || run.createdProjectBinding.callId !== call.id)) || typeof result?.id !== "string" || entry.ownerId !== result.id)) return false;
      if (entry.kind === "project" && entry.ownerId !== entry.id) return false;
      return entry.operation === "deleted" || entry.revision !== undefined;
    });
    if (!receipt || !valid) { uncoveredCalls++; continue; }
    for (const entry of receipt.entries) {
      total++;
      const label = `${WRITE_OPERATION_LABELS[entry.operation]}${WRITE_KIND_LABELS[entry.kind]}`;
      counts.set(label, (counts.get(label) ?? 0) + 1);
      if (entries.length < 60) entries.push({ ...entry, callId: call.id });
    }
  }
  return { entries, total, omitted: total - entries.length, uncoveredCalls,
    groups: [...counts].map(([label, count]) => ({ label, count })) };
}
