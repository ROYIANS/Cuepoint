import {useEffect, useRef} from "react";
import {type DraftSaveStatus, useDebouncedDraft} from "../../platform/product/drafts";
import {DraftStatus} from "./draft-status";
import {Input} from "../../ui/input";
import {Textarea} from "../../ui/textarea";
import type {ManualDraftState} from "./useManualDraftGuard";

type Props = {
    projectId: string;
    draftKey: string;
    value: string;
    persist: (value: string, baseline: string) => Promise<void>;
    onStatusChange?: (status: DraftSaveStatus) => void;
    onDepartureState?: (state: ManualDraftState, discard: () => void) => void;
    multiline?: boolean;
    rows?: number;
    placeholder?: string;
    ariaLabel?: string;
    className?: string;
    containerClassName?: string;
    unavailable?: boolean;
};

/** The key is also a persistence boundary: a controller can never change owners. */
export function TextDraftField(props: Props) {
    return <TextDraftControl key={JSON.stringify([props.projectId, props.draftKey])} {...props}/>;
}

function TextDraftControl({
                              projectId, draftKey, value, persist, onStatusChange, onDepartureState, multiline, rows,
                              placeholder, ariaLabel, className, containerClassName, unavailable
                          }: Props) {
    const save = useRef(persist).current;
    const {draft, setDraft, status, error, retry, useLatest} = useDebouncedDraft({
        initialValue: value, persist: save, scope: projectId, draftKey,
    });
    useEffect(() => {
        onStatusChange?.(status);
        onDepartureState?.({dirty: status !== "saved", pending: status === "saving"}, useLatest);
    }, [onStatusChange, onDepartureState, status, useLatest]);
    const Control = multiline ? Textarea : Input;
    return <div className={containerClassName} data-text-draft={draftKey}>
        <Control value={draft} rows={multiline ? rows : undefined} readOnly={unavailable}
                 placeholder={placeholder} aria-label={ariaLabel} className={className}
                 onChange={event => {
                     // Parent retention must see the pending marker before any async write/read.
                     onStatusChange?.("saving");
                     onDepartureState?.({dirty: true, pending: true}, useLatest);
                     setDraft(event.target.value);
                 }}/>
        <DraftStatus status={status} error={error} onRetry={() => {if (!unavailable) void retry();}} onUseLatest={useLatest}/>
    </div>;
}
