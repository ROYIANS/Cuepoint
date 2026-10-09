import {useBlocker} from "@tanstack/react-router";
import {useCallback, useRef, useState} from "react";
import {
    AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {Button} from "@/components/ui/button";

export type ManualDraftState = {dirty: boolean; pending: boolean; routeDirty?: boolean; routePending?: boolean};
export type ManualDraftDeparture = (leave: () => void, discard?: () => void | Promise<void>) => void;

/** Local owners read synchronous state before closing or replacing a keyed editor. */
export function useManualDraftDeparture(
    dirty: boolean, pending: boolean, onDiscard: () => void | Promise<void>,
    options?: {readState?: () => ManualDraftState; route?: boolean},
) {
    const [localLeave, setLocalLeave] = useState<{run: () => void; discard?: () => void | Promise<void>}>();
    const localRequest = useRef<{run: () => void; discard?: () => void | Promise<void>} | undefined>(undefined);
    const [discarding, setDiscarding] = useState(false);
    const [error, setError] = useState<string>();
    const current = useRef({dirty, pending, onDiscard, readState: options?.readState});
    current.current = {dirty, pending, onDiscard, readState: options?.readState};
    const busy = useRef(false);
    const position = useRef<{
        element: HTMLElement | null;
        selection?: [number | null, number | null];
        scroll: Array<{element: HTMLElement; top: number; left: number}>;
    } | undefined>(undefined);
    const readState = useCallback((): ManualDraftState => current.current.readState?.() ?? current.current, []);
    const capturePosition = useCallback(() => {
        const element = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const scroll: Array<{element: HTMLElement; top: number; left: number}> = [];
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
            scroll.push({element: ancestor, top: ancestor.scrollTop, left: ancestor.scrollLeft});
        }
        // Close buttons may sit outside the editor's scrolling pane.
        for (const pane of document.querySelectorAll<HTMLElement>("[role=dialog], [role=dialog] *")) {
            if ((pane.scrollTop || pane.scrollLeft) && !scroll.some(item => item.element === pane))
                scroll.push({element: pane, top: pane.scrollTop, left: pane.scrollLeft});
        }
        position.current = {
            element, scroll,
            ...((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
                typeof element.selectionStart === "number" && typeof element.selectionEnd === "number"
                ? {selection: [element.selectionStart, element.selectionEnd] as [number | null, number | null]} : {}),
        };
    }, []);
    const waiting = pending || readState().pending || discarding;
    const blocker = useBlocker({
        // Locate/search changes retain the same owner. Actual thread routes change pathname.
        shouldBlockFn: ({current: from, next}) => {
            const state = readState();
            const block = options?.route !== false && from.pathname !== next.pathname &&
                ((state.routeDirty ?? state.dirty) || (state.routePending ?? state.pending) || busy.current);
            if (block) capturePosition();
            return block;
        },
        withResolver: true,
        enableBeforeUnload: options?.route !== false && (dirty || waiting),
    });
    const requestDeparture = useCallback<ManualDraftDeparture>((leave, onLocalDiscard) => {
        const state = readState();
        if (busy.current) return;
        if (localRequest.current) {
            if (!state.dirty && !state.pending) {
                const request = localRequest.current;
                localRequest.current = undefined;
                setLocalLeave(undefined);
                request.run();
            }
            return;
        }
        if (!state.dirty && !state.pending) {leave(); return;}
        capturePosition();
        setError(undefined);
        const request = {run: leave, discard: onLocalDiscard};
        localRequest.current = request;
        setLocalLeave(request);
    }, [readState, capturePosition]);

    async function discard() {
        if (readState().pending || busy.current || (!localLeave && blocker.status !== "blocked")) return;
        busy.current = true;
        setDiscarding(true);
        setError(undefined);
        try {
            await (localLeave?.discard ?? current.current.onDiscard)();
            position.current = undefined;
            if (localLeave) {
                localRequest.current = undefined;
                setLocalLeave(undefined);
                // Preserve the initiating local request if another route was attempted under its confirmation.
                if (blocker.status === "blocked") blocker.reset();
                localLeave.run();
            }
            else if (blocker.status === "blocked") blocker.proceed();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "无法放弃修改，请重试");
        } finally {
            busy.current = false;
            setDiscarding(false);
        }
    }

    const confirmation = <AlertDialog open={!!localLeave || blocker.status === "blocked"} onOpenChange={(open) => {
        if (!open && !discarding) {
            localRequest.current = undefined;
            setLocalLeave(undefined);
            if (blocker.status === "blocked") blocker.reset();
        }
    }}>
        <AlertDialogContent onCloseAutoFocus={(event) => {
            const saved = position.current;
            if (!saved) return;
            event.preventDefault();
            const element = saved.element;
            if (element?.isConnected) {
                element.focus({preventScroll: true});
                if (saved.selection && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
                    typeof element.selectionStart === "number" && typeof element.selectionEnd === "number")
                    element.setSelectionRange(...saved.selection);
            }
            for (const item of saved.scroll) {
                if (item.element.isConnected) {item.element.scrollTop = item.top; item.element.scrollLeft = item.left;}
            }
            position.current = undefined;
        }}>
            <AlertDialogHeader>
                <AlertDialogTitle>{waiting ? "正在处理修改" : "保留未保存的修改？"}</AlertDialogTitle>
                <AlertDialogDescription>{waiting ? "等待操作完成后再离开，避免丢失操作结果。" : "离开会放弃当前表单中尚未保存的内容。"}</AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
            <AlertDialogFooter>
                <Button variant="outline" disabled={discarding} onClick={() => {
                    setError(undefined);
                    localRequest.current = undefined;
                    setLocalLeave(undefined);
                    if (blocker.status === "blocked") blocker.reset();
                }}>继续编辑</Button>
                {!waiting && <Button variant="destructive" onClick={() => void discard()}>放弃并离开</Button>}
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>;
    return {requestDeparture, confirmation};
}

/** Keep the existing route-only API compatible with manual asset editors. */
export function useManualDraftGuard(dirty: boolean, pending: boolean, onDiscard: () => void | Promise<void>) {
    return useManualDraftDeparture(dirty, pending, onDiscard).confirmation;
}
