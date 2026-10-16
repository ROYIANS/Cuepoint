import {useMemo, useSyncExternalStore} from "react";
import {db} from "../../../platform/product/store";
import {prepareThreadActivityKey, readThreadActivity} from "../commands/threadActivity";
import {agentExecution} from "../runtime/agentExecution";

export interface TopicActivitySnapshot {
    readonly threadId: string;
    readonly busy: boolean;
    readonly waitingApproval: boolean;
    readonly unread: boolean;
    readonly unavailable: boolean;
    readonly owner?: object;
}

/** One real adapter observation per mounted row; public revisions never escape this projection. */
export function createTopicActivity(threadId: string) {
    const identity = prepareThreadActivityKey(threadId);
    let snapshot: TopicActivitySnapshot = Object.freeze({threadId, busy: false, waitingApproval: false, unread: false, unavailable: false});
    let saved = {waitingApproval: false, unread: false, unavailable: false};
    let stop: (() => void) | undefined;
    const listeners = new Set<() => void>();
    const publish = () => {
        const live = agentExecution.snapshot(threadId);
        const owner = live.token ?? live.work;
        const next = {...saved, threadId, busy: live.active || live.stopping, owner};
        if (snapshot.busy === next.busy && snapshot.waitingApproval === next.waitingApproval && snapshot.unread === next.unread &&
            snapshot.unavailable === next.unavailable && snapshot.owner === next.owner) return;
        snapshot = Object.freeze(next);
        for (const listener of listeners) listener();
    };
    return {
        getSnapshot: () => snapshot,
        subscribe(this: void, listener: () => void) {
            listeners.add(listener);
            if (!stop) {
                const stopOwner = agentExecution.subscribe(threadId, publish);
                const stopRead = db.observe(async tx => {
                    const [activity, runs] = await Promise.all([readThreadActivity(identity, tx),
                        tx.agentRuns.where("threadId").equals(threadId).sortBy("createdAt")]);
                    return {waitingApproval: runs.at(-1)?.status === "waiting_approval",
                        unread: !!activity && (activity.publicRevision > activity.readRevision || activity.reports.some(report => report.publicRevision > report.readRevision)),
                        unavailable: false};
                }, {next(value) {saved = value; publish();}, error() {saved = {...saved, unavailable: true}; publish();}});
                stop = () => {stopOwner(); stopRead();};
                publish();
            }
            return () => {listeners.delete(listener); if (!listeners.size) {stop?.(); stop = undefined;}};
        },
    };
}

export function useTopicActivity(threadId: string) {
    const source = useMemo(() => createTopicActivity(threadId), [threadId]);
    return useSyncExternalStore(source.subscribe, source.getSnapshot);
}
