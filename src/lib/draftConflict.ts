/** Raised inside the write transaction; a stale editor must never silently win. */
export class DraftConflictError extends Error {
  constructor() {
    super("其他页面已修改此内容。你的草稿已保留；请复制需要保留的文字，再采用最新内容后合并。");
    this.name = "DraftConflictError";
  }
}

/** Flat text drafts only: return the fields actually edited against their baseline. */
export function changedDraftFields<T extends object>(value: T, baseline: T): Partial<T> {
  return Object.fromEntries(Object.keys(value).filter((key) =>
    value[key as keyof T] !== baseline[key as keyof T],
  ).map((key) => [key, value[key as keyof T]])) as Partial<T>;
}

export function assertDraftBaseline<T extends object>(current: T, patch: Partial<T>, baseline?: Partial<T>): void {
  if (!baseline) return;
  for (const key of Object.keys(patch) as Array<keyof T>) {
    // Empty optional text fields have the same editor value as an absent field.
    if ((current[key] ?? "") !== (baseline[key] ?? "") && current[key] !== patch[key]) throw new DraftConflictError();
  }
}
