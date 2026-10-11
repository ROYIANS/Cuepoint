import {useEffect, useRef} from "react";
import {type DraftSaveStatus, useDebouncedDraft} from "@/lib/debouncedDraft";
import {DraftStatus} from "@/components/ui/draft-status";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";

type Props = {
    projectId: string;
    draftKey: string;
    value: string;
    persist: (value: string, baseline: string) => Promise<void>;
    onStatusChange?: (status: DraftSaveStatus) => void;
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
                              projectId, draftKey, value, persist, onStatusChange, multiline, rows,
                              placeholder, ariaLabel, className, containerClassName, unavailable
                          }: Props) {
    const save = useRef(persist).current;
    const {draft, setDraft, status, error, retry, useLatest} = useDebouncedDraft({
        initialValue: value, persist: save, scope: projectId, draftKey,
    });
    useEffect(() => {
        onStatusChange?.(status);
    }, [onStatusChange, status]);
    const Control = multiline ? Textarea : Input;
    return <div className={containerClassName} data-text-draft={draftKey}>
        <Control value={draft} rows={multiline ? rows : undefined} readOnly={unavailable}
                 placeholder={placeholder} aria-label={ariaLabel} className={className}
                 onChange={event => {
                     // Parent retention must see the pending marker before any async write/read.
                     onStatusChange?.("saving");
                     setDraft(event.target.value);
                 }}/>
        <DraftStatus status={status} error={error} onRetry={() => void retry()} onUseLatest={useLatest}/>
    </div>;
}
