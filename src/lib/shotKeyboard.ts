/**
 * Step the keyboard highlight through a visible ordered id list.
 * When nothing is active, down/forward starts at the first id and up/back at the last.
 */
export function stepActiveShotId(
  orderedIds: string[],
  activeId: string | undefined,
  direction: -1 | 1,
): string | undefined {
  if (orderedIds.length === 0) return undefined;
  if (!activeId || !orderedIds.includes(activeId)) {
    return direction === 1 ? orderedIds[0] : orderedIds[orderedIds.length - 1];
  }
  const index = orderedIds.indexOf(activeId);
  const next = index + direction;
  if (next < 0 || next >= orderedIds.length) return activeId;
  return orderedIds[next];
}

/** Sibling ids within the same beat group, preserving the given order. */
export function beatGroupIds(
  orderedShots: { id: string; beatId?: string }[],
  shotId: string,
  beatIds: string[],
): string[] {
  const shot = orderedShots.find((item) => item.id === shotId);
  if (!shot) return [];
  const beatSet = new Set(beatIds);
  const assigned = Boolean(shot.beatId && beatSet.has(shot.beatId));
  return orderedShots
    .filter((item) =>
      assigned
        ? item.beatId === shot.beatId
        : !item.beatId || !beatSet.has(item.beatId),
    )
    .map((item) => item.id);
}

/**
 * Drop selected ids that are no longer visible (e.g. after filters change)
 * so bulk actions and select-all stay scoped to the current visible set.
 */
export function retainVisibleSelectedIds(
  selected: Iterable<string>,
  visibleIds: readonly string[],
): Set<string> {
  const visible = new Set(visibleIds);
  const next = new Set<string>();
  for (const id of selected) {
    if (visible.has(id)) next.add(id);
  }
  return next;
}
