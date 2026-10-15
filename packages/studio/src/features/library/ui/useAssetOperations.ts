import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {StorageError} from "../../../platform/storage/errors";
import {addCharacter, addProp, addScene, addStyle, deleteCharacter, deleteProp, deleteScene, deleteStyle} from "../commands/assets";
import {readAssetPresence, type AssetKind} from "../queries/assetLibrary";

type Target = {id: string; name: string};
type CreateIssue = {kind: "error" | "unknown" | "open"; message: string};
type DeleteIssue = {unknown: boolean; message: string};
type OperationState = {
    creating?: boolean; createIssue?: CreateIssue;
    target?: Target; deleting?: boolean; checking?: boolean; deleteIssue?: DeleteIssue;
};
const createCommands = {character: addCharacter, scene: addScene, prop: addProp, style: addStyle};
const deleteCommands = {character: deleteCharacter, scene: deleteScene, prop: deleteProp, style: deleteStyle};
const unknownCreateCopy = "无法确认是否已创建，请先查看当前列表。为避免重复创建，本次操作不能直接重试。";
const unknownDeleteCopy = "无法确认删除结果。请先核对这项设定，确认前不会再次删除。";

function errorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}

/** Mounted collection intent only; commands retain sole ownership of durable writes. */
export function useAssetOperations({kind, ownerId, openAsset}: {
    kind: AssetKind | undefined; ownerId: string; openAsset: (id: string) => Promise<unknown> | void;
}) {
    const owner = useMemo(() => ({kind, ownerId, key: JSON.stringify([ownerId, kind])}), [kind, ownerId]);
    const currentOwner = useRef(owner);
    const mounted = useRef(false);
    useLayoutEffect(() => {currentOwner.current = owner;}, [owner]);
    useEffect(() => {
        mounted.current = true;
        return () => {mounted.current = false;};
    }, []);
    const locks = useRef(new Set<string>());
    const unknownCreates = useRef(new Set<string>());
    const receipts = useRef(new Map<string, string>());
    const unknownDeletes = useRef(new Map<string, Map<string, string>>());
    const [states, setStates] = useState<Record<string, OperationState>>({});
    const state = states[owner.key] ?? {};
    const busy = Boolean(state.creating || state.deleting || state.checking);
    function isCurrent() {return mounted.current && currentOwner.current === owner;}
    function update(patch: Partial<OperationState>) {
        if (!mounted.current) return;
        setStates(previous => ({...previous, [owner.key]: {...previous[owner.key], ...patch}}));
    }
    function acquire() {
        if (!isCurrent() || !kind || locks.current.has(owner.key)) return false;
        locks.current.add(owner.key);
        return true;
    }

    async function create() {
        if (unknownCreates.current.has(owner.key) || !acquire() || !kind) return;
        update({creating: true, createIssue: undefined});
        try {
            let id = receipts.current.get(owner.key);
            if (!id) {
                try {
                    const created = await createCommands[kind](ownerId);
                    id = created.id;
                    receipts.current.set(owner.key, id);
                } catch (error) {
                    const unknown = error instanceof StorageError && error.certainty === "unknown";
                    if (unknown) unknownCreates.current.add(owner.key);
                    update({createIssue: {kind: unknown ? "unknown" : "error", message: unknown ? unknownCreateCopy : errorMessage(error, "创建失败，请重试。")}});
                    return;
                }
            }
            // A receipt survives navigation failure. Retrying opens this ID, never adds again.
            if (!isCurrent()) {
                update({createIssue: {kind: "open", message: "设定已创建，可以打开继续编辑。"}});
                return;
            }
            try {
                await openAsset(id);
                receipts.current.delete(owner.key);
            } catch {
                update({createIssue: {kind: "open", message: "设定已创建，但暂时无法打开。请再次打开。"}});
            }
        } finally {
            locks.current.delete(owner.key);
            update({creating: false});
        }
    }

    function selectDelete(target: Target) {
        if (!isCurrent() || locks.current.has(owner.key)) return;
        const uncertainty = unknownDeletes.current.get(owner.key)?.get(target.id);
        update({target, deleteIssue: uncertainty ? {unknown: true, message: uncertainty} : undefined});
    }
    function closeDelete() {
        if (!isCurrent() || locks.current.has(owner.key)) return;
        update({target: undefined, deleteIssue: undefined});
    }
    async function remove() {
        const target = state.target;
        if (!target || unknownDeletes.current.get(owner.key)?.has(target.id) || !acquire() || !kind) return;
        update({deleting: true, deleteIssue: undefined});
        try {
            await deleteCommands[kind](target.id);
            update({target: undefined});
        } catch (error) {
            const unknown = error instanceof StorageError && error.certainty === "unknown";
            if (unknown) {
                const targets = unknownDeletes.current.get(owner.key) ?? new Map<string, string>();
                targets.set(target.id, unknownDeleteCopy);
                unknownDeletes.current.set(owner.key, targets);
            }
            update({deleteIssue: {unknown, message: unknown ? unknownDeleteCopy : errorMessage(error, "删除失败，请重试。")}});
        } finally {
            locks.current.delete(owner.key);
            update({deleting: false});
        }
    }
    async function inspectDelete() {
        const target = state.target;
        if (!target || !unknownDeletes.current.get(owner.key)?.has(target.id) || !acquire() || !kind) return;
        update({checking: true});
        try {
            const presence = await readAssetPresence({kind, ownerId, id: target.id});
            if (presence === "missing") {
                // Absence is useful, but does not prove which actor deleted the row/cascade.
                update({target: undefined, deleteIssue: undefined});
            } else {
                const message = presence === "present"
                    ? "这项设定仍在列表中，删除结果尚未确认。请稍后再次核对，当前不会重复删除。"
                    : "这项设定的归属与当前列表不一致，无法确认删除结果。当前不会重复删除。";
                unknownDeletes.current.get(owner.key)?.set(target.id, message);
                update({deleteIssue: {unknown: true, message}});
            }
        } catch {
            const message = "暂时无法核对这项设定。删除结果仍待确认，请稍后再核对。";
            unknownDeletes.current.get(owner.key)?.set(target.id, message);
            update({deleteIssue: {unknown: true, message}});
        } finally {
            locks.current.delete(owner.key);
            update({checking: false});
        }
    }
    return {...state, busy, create, selectDelete, closeDelete, remove, inspectDelete};
}
