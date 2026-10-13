export interface VirtualWindow {
    /** First rendered row (inclusive). */
    start: number;
    /** Last rendered row (exclusive). */
    end: number;
    /** Height of the full list in px, so the scrollbar represents every row. */
    totalHeight: number;
    /** Distance from the top of the list to the first rendered row. */
    offsetTop: number;
}

/**
 * Fixed-row-height windowing: the rows intersecting the viewport plus `overscan` rows on each side.
 * Pure so the boundaries can be tested without layout.
 */
export function computeWindow(input: {count: number; rowHeight: number; viewportHeight: number; scrollTop: number; overscan: number}): VirtualWindow {
    const count = Math.max(0, Math.floor(input.count));
    const {rowHeight, viewportHeight, overscan} = input;
    const totalHeight = count * rowHeight;
    const scrollTop = Math.min(Math.max(0, input.scrollTop), Math.max(0, totalHeight - viewportHeight));
    const first = Math.floor(scrollTop / rowHeight);
    const last = Math.ceil((scrollTop + viewportHeight) / rowHeight);
    const start = Math.max(0, first - overscan);
    const end = Math.min(count, last + overscan);
    return {start, end: Math.max(start, end), totalHeight, offsetTop: start * rowHeight};
}
