import {useMemo, useSyncExternalStore} from "react";
import {db} from "../../../platform/product/store";
import type {StoreTx} from "../../../platform/storage/types";
import type {AgentRun} from "../models/agent";
import {readThreadActivity} from "../commands/threadActivity";
import type {ThreadActivityIdentity} from "../models/threadActivity";
import {canRetryRun} from "../commands/agentRuns";

function freezeReading<T>(value: T): T {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freezeReading(child);
        Object.freeze(value);
    }
    return value;
}

/** Source rows and their publication watermark always come from this one readonly snapshot. */
export async function readThreadTranscript(identity: ThreadActivityIdentity | undefined, tx: StoreTx) {
    const threadId = identity?.threadId;
    const [messages, runs, calls, activity] = await Promise.all([
        threadId ? tx.chatMessages.where("threadId").equals(threadId).sortBy("createdAt") : [],
        threadId ? tx.agentRuns.where("threadId").equals(threadId).sortBy("createdAt") : [],
        threadId ? tx.agentToolCalls.where("threadId").equals(threadId).toArray() : [],
        identity ? readThreadActivity(identity, tx) : null,
    ]);
    const observedRevision = Math.min(activity?.publicRevision ?? 0,
        Math.max(0, ...messages.filter(message => message.role === "assistant").map(message => message.publicRevision ?? 0)));
    const latest = runs.at(-1);
    return freezeReading({threadId, messages, runs, calls, activity, observedRevision,
        retryableRunId: latest && canRetryRun(latest, runs, messages) ? latest.id : undefined});
}

type ControlRun = Pick<AgentRun, "id" | "threadId" | "taskId" | "createdAt" | "status" | "hasToolCalls" | "pauseReason">;
export interface ThreadControlSnapshot {
    readonly threadId?: string;
    readonly ready: boolean;
    readonly hasMessages: boolean;
    readonly hasRuns: boolean;
    readonly runs: readonly ControlRun[];
    readonly compacting: boolean;
    readonly error?: string;
}

/** Only the finite command/composer projection can invalidate the page. */
function createThreadControl(threadId: string | undefined) {
    let snapshot: ThreadControlSnapshot = Object.freeze({threadId, ready: false, hasMessages: false, hasRuns: false, runs: [], compacting: false});
    let encoded = "";
    let stop: (() => void) | undefined;
    const listeners = new Set<() => void>();
    const publish = (value: ThreadControlSnapshot) => {
        const key = JSON.stringify(value);
        if (encoded === key) return;
        encoded = key; snapshot = Object.freeze(value);
        for (const listener of listeners) listener();
    };
    return {
        getSnapshot: () => snapshot,
        subscribe(this: void, listener: () => void) {
            listeners.add(listener);
            if (!stop) stop = db.observe(async tx => {
                if (!threadId) return {threadId, ready: true, hasMessages: false, hasRuns: false, runs: [], compacting: false};
                const [messageCount, runs, compactions] = await Promise.all([
                    tx.chatMessages.where("threadId").equals(threadId).count(),
                    tx.agentRuns.where("threadId").equals(threadId).sortBy("createdAt"),
                    tx.contextCompactions.where("threadId").equals(threadId).sortBy("createdAt"),
                ]);
                return {threadId, ready: true, hasMessages: messageCount > 0, hasRuns: runs.length > 0,
                    runs: runs.map(({id, threadId, taskId, createdAt, status, hasToolCalls, pauseReason}) =>
                        Object.freeze({id, threadId, taskId, createdAt, status, hasToolCalls, pauseReason})),
                    compacting: compactions.at(-1)?.status === "running"};
            }, {next: publish, error: () => publish({...snapshot, error: "对话状态读取失败"})});
            return () => {listeners.delete(listener); if (!listeners.size) {stop?.(); stop = undefined;}};
        },
    };
}

export function useThreadControl(threadId: string | undefined) {
    const control = useMemo(() => createThreadControl(threadId), [threadId]);
    return useSyncExternalStore(control.subscribe, control.getSnapshot);
}
