/** Report each committed copy immediately so a retry cannot duplicate it. */
export async function copySelection(
  selected: Iterable<string>,
  alreadyCopied: ReadonlySet<string>,
  copy: (id: string) => Promise<unknown>,
  onCompleted: (id: string) => void,
): Promise<number> {
  let count = 0;
  for (const id of selected) {
    if (!alreadyCopied.has(id)) {
      await copy(id);
      count += 1;
    }
    onCompleted(id);
  }
  return count;
}
