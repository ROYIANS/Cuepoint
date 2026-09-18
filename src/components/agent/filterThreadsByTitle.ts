import type { ChatThread } from "@/domain/types";

/**
 * Case-insensitive substring filter on thread titles only.
 * Uses `toLocaleLowerCase("zh-CN")` so Chinese locale folding stays consistent.
 * Empty / whitespace-only query returns the full list unchanged.
 */
export function filterThreadsByTitle(
  threads: ChatThread[],
  query: string,
): ChatThread[] {
  const needle = query.trim().toLocaleLowerCase("zh-CN");
  if (!needle) return threads;
  return threads.filter((thread) =>
    thread.title.toLocaleLowerCase("zh-CN").includes(needle),
  );
}
