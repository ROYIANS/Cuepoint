import {type ReactNode, useState} from "react";
import {computeWindow} from "./virtualWindow";

/**
 * Hand-written fixed-height windowing: only the visible rows (plus a buffer) are mounted, the inner box keeps the
 * full height. The viewport height is a prop, not a measurement, so the window never depends on layout.
 */
export function VirtualRows({count, rowHeight, viewportHeight, label, renderRow, overscan = 6}: {
    count: number;
    rowHeight: number;
    viewportHeight: number;
    label: string;
    renderRow: (index: number) => ReactNode;
    overscan?: number;
}) {
    const [scrollTop, setScrollTop] = useState(0);
    const window = computeWindow({count, rowHeight, viewportHeight, scrollTop, overscan});
    const rows: ReactNode[] = [];
    for (let index = window.start; index < window.end; index++) {
        rows.push(<div key={index} role="listitem" aria-setsize={count} aria-posinset={index + 1}
                       style={{height: rowHeight}} className="border-b">{renderRow(index)}</div>);
    }
    return (
        <div className="overflow-y-auto rounded-md border" style={{height: viewportHeight}}
             onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
            <div style={{height: window.totalHeight, paddingTop: window.offsetTop, boxSizing: "border-box"}}
                 role="list" aria-label={label}>
                {rows}
            </div>
        </div>
    );
}
