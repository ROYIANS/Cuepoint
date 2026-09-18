export const WORLD_TABS = ["setting", "characters", "scenes", "props", "styles"] as const;
export type WorldTab = (typeof WORLD_TABS)[number];

export function parseWorldTab(value: unknown): WorldTab | undefined {
  return typeof value === "string" && WORLD_TABS.includes(value as WorldTab)
    ? value as WorldTab
    : undefined;
}

/** Search authored text without exposing internal IDs, slots or provenance. */
export function matchesAssetSearch(asset: object, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return Object.entries(asset).some(([key, value]) =>
    !["id", "projectId", "createdAt", "updatedAt"].includes(key) &&
    typeof value === "string" && value.toLocaleLowerCase().includes(needle));
}
