import {useBlocker} from "@tanstack/react-router";
import {useRef, useState} from "react";
import {
    AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {Button} from "@/components/ui/button";

/** Keep manual sessions mounted until route departure is explicitly resolved. */
export function useManualDraftGuard(dirty: boolean, pending: boolean, onDiscard: () => void | Promise<void>) {
    const [discarding, setDiscarding] = useState(false);
    const [error, setError] = useState<string>();
    const busy = useRef(false);
    const waiting = pending || discarding;
    const blocker = useBlocker({
        // Locate/search changes keep the same editor and its draft.
        shouldBlockFn: ({current, next}) => current.pathname !== next.pathname && (dirty || waiting),
        withResolver: true,
        enableBeforeUnload: dirty || waiting,
    });

    async function discard() {
        if (pending || busy.current || blocker.status !== "blocked") return;
        busy.current = true;
        setDiscarding(true);
        setError(undefined);
        try {
            await onDiscard();
            blocker.proceed();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "无法放弃修改，请重试");
        } finally {
            busy.current = false;
            setDiscarding(false);
        }
    }

    return <AlertDialog open={blocker.status === "blocked"} onOpenChange={(open) => {
        if (!open && !discarding && blocker.status === "blocked") blocker.reset();
    }}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{waiting ? "正在处理修改" : "保留未保存的修改？"}</AlertDialogTitle>
                <AlertDialogDescription>{waiting ? "等待操作完成后再离开，避免丢失操作结果。" : "离开会放弃当前表单中尚未保存的内容。"}</AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
            <AlertDialogFooter>
                <Button variant="outline" disabled={discarding} onClick={() => {
                    setError(undefined);
                    if (blocker.status === "blocked") blocker.reset();
                }}>继续编辑</Button>
                {!waiting && <Button variant="destructive" onClick={() => void discard()}>放弃并离开</Button>}
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>;
}
