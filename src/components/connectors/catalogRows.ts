import {type CatalogRow, MAX_SELECTION_KEYS} from "@/lib/ai/modelCatalog/sync";
import type {CatalogEntry} from "@/lib/ai/modelCatalog/types";

export interface RowFilter {
    /** Provider id, or "" for all. */
    provider: string;
    search: string;
}

export function filterRows(rows: readonly CatalogRow[], filter: RowFilter): CatalogRow[] {
    const needle = filter.search.trim().toLowerCase();
    return rows.filter(row =>
        (!filter.provider || row.providers.includes(filter.provider)) &&
        (!needle || row.name.toLowerCase().includes(needle) || row.modelKeys.some(key => key.toLowerCase().includes(needle))));
}

/** A row is ticked when any of its equivalent entries is selected. */
export function rowSelected(row: CatalogRow, selected: ReadonlySet<string>): boolean {
    return row.modelKeys.some(key => selected.has(key));
}

/** Ticking adds every equivalent key; unticking removes them all. Refuses (undefined) past the stored limit. */
export function toggleRow(row: CatalogRow, selected: ReadonlySet<string>, on: boolean): Set<string> | undefined {
    return setRows([row], selected, on);
}

/** Bulk tick/untick of the given (filtered) rows only; rows outside the filter keep their state. */
export function setRows(rows: readonly CatalogRow[], selected: ReadonlySet<string>, on: boolean): Set<string> | undefined {
    const next = new Set(selected);
    for (const row of rows) for (const key of row.modelKeys) {
        if (on) next.add(key);
        else next.delete(key);
    }
    return next.size > MAX_SELECTION_KEYS ? undefined : next;
}

/** Rows ticked, plus selected keys no row stands for (e.g. before the full list is loaded). */
export function selectedCount(rows: readonly CatalogRow[], selected: ReadonlySet<string>): number {
    const covered = new Set<string>();
    let count = 0;
    for (const row of rows) {
        for (const key of row.modelKeys) covered.add(key);
        if (rowSelected(row, selected)) count += 1;
    }
    for (const key of selected) if (!covered.has(key)) count += 1;
    return count;
}

/** "Common scope" size in the loaded catalog: entries from the scope's providers. */
export function commonScopeCount(entries: readonly CatalogEntry[], providers: readonly string[]): number {
    const wanted = new Set(providers);
    return entries.reduce((total, entry) => total + (wanted.has(entry.provider) ? 1 : 0), 0);
}
