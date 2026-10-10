import {useCallback, useMemo, useRef, useState} from "react";
import type {DraftSaveStatus} from "./debouncedDraft";

export type TextDraftStatusChange = (id: string, field: string, status: DraftSaveStatus) => void;

/** Readable row retention only; persistence and retry belong to debouncedDraft. */
export function useTextDraftRetention<T extends { id: string }>(loadedRows: T[] | undefined) {
    const statuses = useRef(new Map<string, Map<string, DraftSaveStatus>>());
    // The render snapshot drives memo invalidation; the ref above protects the
    // same input event before React commits this state. Neither owns persistence.
    const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
    const onStatusChange: TextDraftStatusChange = useCallback((id, field, status) => {
        const fields = statuses.current.get(id) ?? new Map<string, DraftSaveStatus>();
        if ((fields.get(field) ?? "saved") === status) return;
        if (status === "saved") fields.delete(field);
        else fields.set(field, status);
        if (fields.size) statuses.current.set(id, fields);
        else statuses.current.delete(id);
        setPendingIds(new Set(statuses.current.keys()));
    }, []);
    const lastRows = useRef<T[]>([]);
    const {rows, retainedCount} = useMemo(() => {
        const retained = lastRows.current.filter(row => pendingIds.has(row.id) &&
            !loadedRows?.some(current => current.id === row.id));
        const rows = [...(loadedRows ?? []), ...retained];
        lastRows.current = rows;
        return {rows, retainedCount: retained.length};
    }, [loadedRows, pendingIds]);
    return {
        rows, retainedCount, pending: statuses.current.size > 0,
        isPending: (id: string) => statuses.current.has(id), onStatusChange
    };
}
