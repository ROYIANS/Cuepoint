import { db } from "@/db/database";
import { DraftConflictError } from "@/lib/draftConflict";
import { addAudioSegment, patchAudioSegment } from "@/db/audio";
import { AUDIO_TRANSACTION_TABLES } from "@/db/audioShared";

export function splitAudioScript(text: string): string[] {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n/).map((part) => part.trim()).filter(Boolean);
  if (!paragraphs.length) throw new Error("请先粘贴稿件");
  if (paragraphs.length > 200) throw new Error("一次最多添加 200 段，请分批粘贴；当前内容未添加");
  return paragraphs;
}
/** Appends whole nonempty script lines atomically, preserving each line without truncation. */
export async function appendAudioScript(projectId: string, chapterId: string, text: string) {
  const paragraphs = splitAudioScript(text);
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    const existing = await db.audioSegments.where("chapterId").equals(chapterId).toArray();
    const start = Math.max(0, ...existing.map((row) => row.order));
    const added = [];
    for (const [index, paragraph] of paragraphs.entries()) added.push(await addAudioSegment(projectId, { chapterId, order: start + index + 1, text: paragraph, notes: "" }));
    return added;
  });
}

export async function editAudioScriptLines(args: { projectId: string; segmentId: string; baseline: string; start: number; end: number; pasted?: string }) {
  const { projectId, segmentId, baseline, start, end, pasted } = args;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > baseline.length) throw new Error("正文选区无效");
  const lines = pasted === undefined
    ? [baseline.slice(0, start), baseline.slice(end)]
    : (baseline.slice(0, start) + pasted + baseline.slice(end)).replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim());
  if (lines.length > 200) throw new Error("一次最多粘贴 200 行，内容未添加");
  if (!lines.length) return [];
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    const current = await db.audioSegments.get(segmentId);
    if (!current || current.projectId !== projectId || current.text !== baseline) throw new DraftConflictError();
    const rows = await db.audioSegments.where("chapterId").equals(current.chapterId).sortBy("order");
    const next = rows[rows.findIndex((row) => row.id === segmentId) + 1];
    const step = next ? (next.order - current.order) / lines.length : 1;
    if (!(step > 0) || current.order + step === current.order) throw new Error("段落顺序过于接近，请调整顺序后重试");
    const result = [await patchAudioSegment(projectId, segmentId, current.revision, { text: lines[0] })];
    for (let index = 1; index < lines.length; index++) result.push(await addAudioSegment(projectId, { chapterId: current.chapterId, speakerId: current.speakerId, order: current.order + step * index, text: lines[index], notes: "" }));
    return result;
  });
}
