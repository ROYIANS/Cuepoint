import {useCallback, useEffect, useRef, useState} from "react";
import {useBlocker} from "@tanstack/react-router";
import type {AgentRun} from "../models/agent";
import {runBlocksThread} from "../models/agentToolSelection";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../../../ui/alert-dialog";

/**
 * Leaving a topic whose execution is still active is a confirmed choice, not a silent
 * abort. Switching topics, starting a new one, deleting the current one and browser
 * Back all pass through here. Either way the run keeps its saved steps; stopping it is
 * now explicit, and the thread keeps accepting continues or an explicit end afterwards.
 *
 * A confirmed departure arms exactly one navigation so the route blocker does not ask
 * twice for the same decision.
 */
export function useThreadDeparture(threadId: string | undefined, runs: readonly AgentRun[] | undefined) {
    const [localLeave, setLocalLeave] = useState<{ run: () => void }>();
    const localRef = useRef<{ run: () => void } | undefined>(undefined);
    const activeRef = useRef(false);
    const ownedRuns = threadId ? (runs ?? []).filter(run => run.threadId === threadId) : [];
    activeRef.current = ownedRuns.some(runBlocksThread);
    const armed = useRef(false);
    const leaving = useRef(false);
    // A different topic's runs are its own; a previous confirmation never covers them.
    useEffect(() => {
        leaving.current = false;
        armed.current = false;
        localRef.current = undefined;
        setLocalLeave(undefined);
    }, [threadId]);
    // A confirmation covers the run it stopped. If the user stays (a failed create/delete)
    // and the thread starts executing again, that new execution gets its own confirmation.
    const executing = ownedRuns.some((run) => run.status === "running" || run.status === "waiting_approval");
    useEffect(() => {
        if (executing) {
            leaving.current = false;
            armed.current = false;
        }
    }, [executing]);
    const armOnce = useCallback(() => {
        armed.current = true;
    }, []);
    const blocker = useBlocker({
        shouldBlockFn: () => {
            if (leaving.current) return false;
            if (armed.current) {
                armed.current = false;
                return false;
            }
            return activeRef.current;
        },
        withResolver: true,
    });
    const request = useCallback((leave: () => void) => {
        if (localRef.current) return;
        if (leaving.current || !activeRef.current) {
            leave();
            return;
        }
        const entry = {run: leave};
        localRef.current = entry;
        setLocalLeave(entry);
    }, []);
    const confirm = useCallback(() => {
        const pending = localRef.current;
        localRef.current = undefined;
        setLocalLeave(undefined);
        leaving.current = true;
        armOnce();
        // A route attempt that arrived under this confirmation is superseded by it.
        if (blocker.status === "blocked") blocker.reset();
        if (pending) pending.run();
        else if (blocker.status === "blocked") blocker.proceed();
    }, [armOnce, blocker]);
    const cancel = useCallback(() => {
        localRef.current = undefined;
        setLocalLeave(undefined);
        armed.current = false;
        if (blocker.status === "blocked") blocker.reset();
    }, [blocker]);
    const confirmation = <AlertDialog open={Boolean(localLeave) || blocker.status === "blocked"}
                                      onOpenChange={(open) => {
                                          if (!open) cancel();
                                      }}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>当前话题仍在执行</AlertDialogTitle>
                <AlertDialogDescription>
                    离开会停止本次执行。已完成的步骤与已收到的内容会保留，回来后可以继续或结束。
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>留在当前话题</AlertDialogCancel>
                <AlertDialogAction onClick={confirm}>停止并离开</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>;
    return {request, confirmation, armOnce};
}
