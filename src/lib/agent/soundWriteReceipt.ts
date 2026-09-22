import { createWriteReceipt, type WriteReceiptEntry } from "./writeReceipt";

/** Only call with repository results inside the atomic tool callback. */
export function soundWriteReceipt(
  kind: WriteReceiptEntry["kind"], operation: WriteReceiptEntry["operation"],
  args: { projectId: string; id?: string }, result: unknown,
) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("声音写入结果无效");
  const row = result as Record<string, unknown>;
  const deleted = operation === "deleted";
  const id = deleted ? row.removedClipId : row.id;
  if (typeof id !== "string" || (deleted ? id !== args.id : row.projectId !== args.projectId)) throw new Error("声音写入结果归属不匹配");
  const revision = deleted ? undefined : row.revision;
  if (!deleted && (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0)) throw new Error("声音写入结果缺少版本");
  const settings = row.settings && typeof row.settings === "object" ? row.settings as Record<string, unknown> : undefined;
  const label = [row.title, row.name, row.text, settings?.title].find((value): value is string => typeof value === "string") ?? "";
  return createWriteReceipt([{ kind, operation, id, ownerId: args.projectId,
    ...(typeof revision === "number" ? { revision } : {}), label: label.slice(0, 160) }]);
}
