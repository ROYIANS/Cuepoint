import type { AudioTaskObservation } from "@/domain/audioGeneration";

const VERIFIED = ["pending", "processing", "completed", "failed"];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** Strict, bounded storage/import boundary. Never retain provider payloads or credentials. */
export function validateAudioTaskObservations(value: unknown, taskIds: readonly string[]): asserts value is AudioTaskObservation[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 100 || value.length > taskIds.length) throw new Error("音乐任务查询记录无效");
  const seen = new Set<string>();
  for (const row of value) {
    if (!object(row) || Object.keys(row).some(key => !["taskId", "checkedAt", "status", "lastVerified"].includes(key))
      || typeof row.taskId !== "string" || !row.taskId.trim() || row.taskId.length > 512 || /[\u0000-\u001f]/.test(row.taskId)
      || !taskIds.includes(row.taskId) || seen.has(row.taskId) || !timestamp(row.checkedAt)
      || typeof row.status !== "string" || ![...VERIFIED, "unknown", "query-failed"].includes(row.status)) throw new Error("音乐任务查询记录无效");
    seen.add(row.taskId);
    const last = row.lastVerified;
    if (last !== undefined && (!object(last) || Object.keys(last).some(key => !["status", "observedAt"].includes(key))
      || typeof last.status !== "string" || !VERIFIED.includes(last.status) || !timestamp(last.observedAt)
      || last.observedAt > row.checkedAt)) throw new Error("音乐任务历史状态无效");
    if (VERIFIED.includes(row.status) && (!object(last) || last.status !== row.status || last.observedAt !== row.checkedAt)) throw new Error("音乐任务状态缺少对应查询证据");
  }
}

export function observeAudioTask(taskId: string, status: AudioTaskObservation["status"], checkedAt: string, previous?: AudioTaskObservation): AudioTaskObservation {
  return { taskId, checkedAt, status,
    ...((status === "unknown" || status === "query-failed")
      ? previous?.lastVerified ? { lastVerified: previous.lastVerified } : {}
      : { lastVerified: { status, observedAt: checkedAt } }) };
}
