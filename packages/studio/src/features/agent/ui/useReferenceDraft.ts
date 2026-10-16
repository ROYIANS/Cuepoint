import {useMemo, useSyncExternalStore} from "react";
import {chatDrafts} from "../runtime/chatDraftStore";

/** Detaching a view only releases observation; drafts/imports retain their owner. */
export function useReferenceDraft(scope: string, projectId?: string) {
    const draft = useSyncExternalStore(chatDrafts.subscribe, () => chatDrafts.snapshot(scope));
    const actions = useMemo(() => chatDrafts.session(scope, projectId), [scope, projectId]);
    return {...draft, ...actions};
}
