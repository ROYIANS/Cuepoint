export type LibrarySort = "updated" | "created" | "name";

export function filterAndSortLibrary<
  T extends { name: string; createdAt: string; updatedAt: string },
>(items: T[], query: string, sort: LibrarySort): T[] {
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? items.filter((item) => item.name.toLowerCase().includes(needle))
    : items;
  return [...filtered].sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name, "zh-CN");
    if (sort === "created") return right.createdAt.localeCompare(left.createdAt);
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function pickZipFile(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.onchange = () => resolve(input.files?.[0] ?? undefined);
    input.click();
  });
}

export function stillTone(seed: string): { from: string; to: string } {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const from = 0.26 + (hash % 5) * 0.018;
  return {
    from: `oklch(${from.toFixed(3)} 0 0)`,
    to: `oklch(0.18 0 0)`,
  };
}
