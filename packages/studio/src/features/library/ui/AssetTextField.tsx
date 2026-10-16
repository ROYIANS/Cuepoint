import {useCallback, useEffect, useRef} from "react";
import {useDebouncedDraft} from "../../../platform/product/drafts";
import type {ManualDraftState} from "../../../app/drafts/useManualDraftGuard";
import {StorageError} from "../../../platform/storage/errors";
import {DraftStatus} from "../../../app/drafts/draft-status";
import {Field} from "../../../ui/field";
import {Input} from "../../../ui/input";
import {Textarea} from "../../../ui/textarea";

/** One field per draft: unrelated live-query and slot updates cannot reset input. */
export function AssetTextField(props: {
    label: string;
    value: string;
    projectId: string;
    draftKey: string;
    persist: (value: string, baseline: string) => Promise<void>;
    multiline?: boolean;
    placeholder?: string;
    unavailable?: boolean;
    onDepartureState?: (state: ManualDraftState, discard: () => void) => void;
}) {
    return <AssetTextControl key={JSON.stringify([props.projectId, props.draftKey])} {...props}/>;
}

function AssetTextControl({label, value, projectId, draftKey, persist, multiline, placeholder, unavailable, onDepartureState}: Parameters<typeof AssetTextField>[0]) {
    const save = useRef(persist).current;
    const blocked = useRef(unavailable);
    blocked.current = unavailable;
    const uncertainWrite = useRef<StorageError | undefined>(undefined);
    const {draft, setDraft, status, error, retry, useLatest: resetToLatest} = useDebouncedDraft({
        initialValue: value,
        persist: async (next, baseline) => {
            if (uncertainWrite.current) throw uncertainWrite.current;
            if (blocked.current) throw new Error("此设定暂时不可用，草稿已保留，当前不能保存。");
            try {await save(next, baseline);} catch (cause) {
                if (cause instanceof StorageError && cause.certainty === "unknown") uncertainWrite.current = cause;
                throw cause;
            }
        },
        scope: projectId,
        draftKey,
    });
    const adoptLatest = useCallback(() => {resetToLatest(); uncertainWrite.current = undefined;}, [resetToLatest]);
    const uncertain = error instanceof StorageError && error.certainty === "unknown";
    // A failed retained controller may be resumed by this same target after teardown.
    if (uncertain) uncertainWrite.current = error;
    useEffect(() => {
        onDepartureState?.({dirty: status !== "saved", pending: status === "saving"}, adoptLatest);
    }, [onDepartureState, status, adoptLatest]);
    const Control = multiline ? Textarea : Input;
    return (
        <div className="space-y-1.5" data-asset-text={draftKey}>
            <Field label={label}>
                <Control value={draft} placeholder={placeholder} readOnly={unavailable || uncertain} onChange={(event) => {
                    if (unavailable || uncertain) return;
                    onDepartureState?.({dirty: true, pending: true}, adoptLatest);
                    setDraft(event.target.value);
                }}/>
            </Field>
            {uncertain ? <p role="alert" className="text-destructive text-xs">未确认是否已保存，草稿已保留。请核对设定后再离开。</p>
                : <DraftStatus status={status} error={error} onRetry={() => {if (!unavailable) void retry();}} onUseLatest={adoptLatest}/>}
        </div>
    );
}
