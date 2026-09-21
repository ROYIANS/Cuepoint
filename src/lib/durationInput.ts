/** An incomplete decimal remains editable without being persisted as another number. */
export function parseDurationInput(raw: string): number | undefined {
  const value = raw.trim();
  if (value === "") return 0;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
