/** USD per million tokens. Unknown is a dash, never "$0": a missing price is not a free price. */
export function formatPrice(value: number | undefined): string {
    if (value === undefined || !Number.isFinite(value)) return "—";
    return `$${Number(value.toFixed(4))}`;
}
