import {useCallback, useEffect, useState} from "react";
import {toast} from "sonner";
import {useVideoWorkspaceRepository} from "../services/workspaceRepository";
import {useDebouncedDraft} from "../../../platform/product/drafts";
import {parseDurationInput} from "../services/durationInput";
import {DraftStatus} from "../../../app/drafts/draft-status";
import {Input} from "../../../ui/input";
import type {ManualDraftState} from "../../../app/drafts/useManualDraftGuard";

export function DurationInput({projectId, shotId, value, unavailable = false, onDepartureState}: {
    projectId: string; shotId: string; value?: number; unavailable?: boolean;
    onDepartureState?: (state: ManualDraftState, discard: () => void) => void;
}) {
    const repository = useVideoWorkspaceRepository();
    const [raw, setRaw] = useState<string | null>(null);
    const {draft, setDraft, status, error, retry, useLatest: adoptLatestDraft} = useDebouncedDraft({
        initialValue: value ?? 0,
        persist: (durationSec, baseline) => repository.patchShot(shotId, {durationSec}, {durationSec: baseline}),
        scope: projectId,
        draftKey: `shot:${shotId}:durationSec`,
    });
    const text = raw ?? String(draft);
    const invalid = parseDurationInput(text) === undefined;
    const discard = useCallback(() => {setRaw(null); adoptLatestDraft();}, [adoptLatestDraft]);
    useEffect(() => {
        onDepartureState?.({dirty: invalid || status !== "saved", pending: status === "saving"}, discard);
    }, [onDepartureState, invalid, status, discard]);
    return <div className="w-full">
        <Input
            value={text}
            inputMode="decimal"
            placeholder="秒"
            aria-label="时长（秒）"
            aria-invalid={invalid}
            readOnly={unavailable}
            onFocus={() => setRaw(text)}
            onChange={event => {
                const next = event.target.value;
                setRaw(next);
                const durationSec = parseDurationInput(next);
                onDepartureState?.({dirty: true, pending: status === "saving" || durationSec !== undefined}, discard);
                if (durationSec !== undefined) setDraft(durationSec);
            }}
            onBlur={() => {
                if (invalid) toast.error("请输入大于或等于 0 的有效秒数");
                // Keep punctuation during typing; the serialized numeric draft survives
                // blur, save failures, row unmounting and the project backup barrier.
                if (!invalid) setRaw(null);
            }}
            className="h-8 w-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-2 focus-visible:ring-inset dark:bg-transparent"
        />
        {status === "error" &&
            <DraftStatus status={status} error={error} onRetry={() => {if (!unavailable) void retry();}} onUseLatest={discard}/>}
    </div>;
}
