import { db } from "@/db/database";
import { bounded, getRow, projection, targetRevision, type BusinessRow } from "./businessStore";
import { createWriteReceipt, type WriteReceiptEntry } from "./writeReceipt";

const kinds = ["project", "episode", "beat", "shot", "character", "scene", "prop", "style"] as const;
type Kind = typeof kinds[number];
type Operation = WriteReceiptEntry["operation"];
function supported(name: string): { kind: Kind; operation: Operation } | undefined {
  for (const kind of kinds) {
    for (const [suffix, operation] of [["create", "created"], ["update", "updated"], ["delete", "deleted"]] as const) {
      if (name === `${kind}_${suffix}`) return { kind, operation };
    }
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("业务写入结果缺少对象");
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("业务写入结果缺少标识");
  return value;
}
function entry(kind: WriteReceiptEntry["kind"], operation: Operation, row: BusinessRow): WriteReceiptEntry {
  const sound = kind === "audio_chapter" || kind === "audio_track" || kind === "music_draft";
  let revision: string | number;
  if (sound) {
    if (typeof row.revision !== "number" || !Number.isInteger(row.revision) || row.revision < 0) throw new Error("项目初始声音内容缺少版本");
    revision = row.revision;
  } else revision = targetRevision(row);
  return { kind, operation, id: row.id, ownerId: kind === "project" ? row.id : id(row.projectId),
    revision, label: String(row.name ?? row.title ?? row.shotNumber ?? row.id).slice(0, 160) };
}

/** Capture only the explicit target before deletion; cascades are deliberately not claimed. */
export async function captureBusinessDeletion(name: string, raw: unknown): Promise<BusinessRow | undefined> {
  const tool = supported(name);
  if (tool?.operation !== "deleted") return;
  const args = object(raw);
  return getRow(tool.kind, id(args.id), tool.kind === "project" ? id(args.id) : id(args.ownerId), typeof args.episodeId === "string" ? args.episodeId : undefined);
}

async function normalized(kind: Kind, row: BusinessRow) {
  const record = projection(kind, row);
  if (kind === "project") record.kind = row.kind ?? "video";
  if (kind === "shot") {
    const project = await db.projects.get(id(row.projectId));
    if (!project) throw new Error("镜头所属项目不存在");
    const styleId = row.styleId === undefined ? project.defaultStyleId : row.styleId;
    const style = typeof styleId === "string" ? await db.styles.get(styleId) : undefined;
    record.effectiveStyle = {
      source: row.styleId === undefined ? "inherit" : row.styleId === null ? "none" : "explicit",
      id: style?.projectId === project.id ? style.id : null,
      label: style?.projectId === project.id ? style.name : null,
      ...(styleId && style?.projectId !== project.id ? { unresolvedId: styleId } : {}),
    };
  }
  return record;
}

/** Bound all records as one budget, reserving space for exact target IDs and receipts. */
function boundRecords(records: Record<string, unknown>[], budget: number) {
  for (const [textLimit, arrayLimit] of [[2000, 50], [500, 20], [100, 5], [20, 0]]) {
    let truncated = false;
    function clip(value: unknown, key = ""): unknown {
      if (typeof value === "string") {
        // Stable scalar relations stay usable even when prose is clipped.
        const limit = /(?:^id$|Id$|Ids$)/.test(key) ? Infinity : textLimit;
        if (value.length > limit) truncated = true;
        return value.slice(0, limit);
      }
      if (Array.isArray(value)) {
        if (value.length > arrayLimit) truncated = true;
        return value.slice(0, arrayLimit).map((item) => clip(item, key));
      }
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, clip(item, field)]));
      return value;
    }
    const clipped = records.map((record) => clip(record));
    if (JSON.stringify(clipped).length <= budget) {
      const result = bounded(clipped);
      return { records: result.data as Record<string, unknown>[], truncated: truncated || result.truncated };
    }
  }
  throw new Error("写入回执过大，请缩小操作范围");
}

/** Called within executeAtomicTool, so failure here rolls back both rows and receipt. */
export async function withBusinessWriteReceipt(name: string, raw: unknown, value: unknown, deleted?: BusinessRow): Promise<unknown> {
  const tool = supported(name);
  if (!tool) return value;
  const args = object(raw), result = object(value);
  if (tool.operation === "deleted") {
    if (!deleted || result.deletedId !== deleted.id) throw new Error("删除结果与目标不一致");
    return { ...result, writeReceipt: createWriteReceipt([entry(tool.kind, "deleted", deleted)]) };
  }
  const targets = name === "shot_create" ? (result.items as unknown[]).map(object) : [result];
  const rows = await Promise.all(targets.map((target) => getRow(tool.kind, id(target.id),
    tool.kind === "project" ? id(target.id) : id(args.ownerId), typeof args.episodeId === "string" ? args.episodeId : undefined)));
  const entries = rows.map((row) => entry(tool.kind, tool.operation, row));
  if (name === "project_create") {
    const ownerId = rows[0]!.id;
    if (result.firstEpisodeId) entries.push(entry("episode", "created", await getRow("episode", id(result.firstEpisodeId), ownerId)));
    for (const [key, kind, table] of [
      ["firstChapterId", "audio_chapter", db.audioChapters], ["firstTrackId", "audio_track", db.audioTracks], ["firstDraftId", "music_draft", db.musicDrafts],
    ] as const) {
      if (!result[key]) continue;
      const seed = await table.get(id(result[key]));
      if (!seed || seed.projectId !== ownerId) throw new Error("项目初始内容不存在或归属不匹配");
      entries.push(entry(kind, "created", { ...seed }));
    }
  }
  const writeReceipt = createWriteReceipt(entries);
  const base = { ...result, writeReceipt };
  const budget = Math.min(30000, 60000 - JSON.stringify(base).length);
  const details = boundRecords(await Promise.all(rows.map((row) => normalized(tool.kind, row))), budget);
  const enriched = targets.map((target, index) => ({ ...target, record: details.records[index], recordTruncated: details.truncated }));
  const output = name === "shot_create" ? { ...base, items: enriched } : { ...base, ...enriched[0] };
  if (JSON.stringify(output).length > 65536) throw new Error("写入回执过大，请缩小操作范围");
  return output;
}
