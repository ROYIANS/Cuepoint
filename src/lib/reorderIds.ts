/** True when two id lists are the same length and order. */
export function sameIdOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/** Move `activeId` to the index of `overId` within a flat id list. */
export function moveIdToPosition(
  orderedIds: string[],
  activeId: string,
  overId: string,
): string[] | null {
  if (activeId === overId) return null;
  const from = orderedIds.indexOf(activeId);
  const to = orderedIds.indexOf(overId);
  if (from < 0 || to < 0) return null;
  const next = [...orderedIds];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}

/**
 * Reorder members of a group inside a full ordered list, keeping non-group
 * ids in place. Used so within-beat shot drags do not scramble other beats.
 */
export function reorderGroupInFullOrder(
  fullOrderedIds: string[],
  groupIds: string[],
  activeId: string,
  overId: string,
): string[] | null {
  const nextGroup = moveIdToPosition(groupIds, activeId, overId);
  if (!nextGroup) return null;
  const groupSet = new Set(groupIds);
  let index = 0;
  return fullOrderedIds.map((id) => (groupSet.has(id) ? nextGroup[index++]! : id));
}
