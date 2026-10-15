import type {RouterHistory} from "@tanstack/react-router";

type Location = RouterHistory["location"];
type Entry = { key: string; index: number; href: string };
type NavigationCapabilities = { canBack: boolean; canForward: boolean; pending: boolean };

function entry(location: Location): Entry | undefined {
    const key = location.state.__TSR_key ?? location.state.key;
    const index = location.state.__TSR_index;
    return typeof key === "string" && Number.isInteger(index) && location.href.startsWith("/")
        ? {key, index, href: location.href} : undefined;
}

const equal = (a: Entry | undefined, b: Entry | undefined) => !!a && !!b && a.key === b.key && a.index === b.index && a.href === b.href;

/** Volatile proved entries, scoped to the router rather than any route frame. */
export function createHistoryNavigation(history: RouterHistory) {
    let entries: Entry[] = [];
    const initial = entry(history.location);
    if (initial) entries = [initial];
    let position = 0;
    let pending = false;
    let snapshot: NavigationCapabilities = {canBack: false, canForward: false, pending: false};
    const listeners = new Set<() => void>();
    const originalFlush = history.flush;
    let disposed = false;
    let scheduled = false;
    type Notice = { location: Location; type: string };
    let notices: Notice[] = [];

    function publish() {
        const next = {
            canBack: !pending && position > 0,
            canForward: !pending && position < entries.length - 1,
            pending
        };
        if (next.canBack === snapshot.canBack && next.canForward === snapshot.canForward && next.pending === snapshot.pending) return;
        snapshot = next;
        listeners.forEach(listener => listener());
    }

    function reset(current: Entry | undefined) {
        entries = current ? [current] : [];
        position = 0;
    }

    function settle() {
        scheduled = false;
        if (disposed) return;
        originalFlush();
        const batch = notices;
        notices = [];
        // PUSH/REPLACE are optimistic and a browser microtask can commit several
        // notifications as just one entry. Reconcile their last accepted location.
        let pushed = false;
        let lastWrite: Entry | undefined;
        let hasWrite = false;
        const commitWrite = () => {
            if (!hasWrite) return;
            if (!lastWrite) reset(undefined);
            else if (pushed) {
                if (!entries[position] || lastWrite.index <= entries[position].index) {
                    reset(lastWrite);
                    pushed = false;
                    hasWrite = false;
                    return;
                }
                if (!equal(entries[position], lastWrite)) {
                    entries = entries.slice(0, position + 1);
                    entries.push(lastWrite);
                    if (entries.length > 200) entries.shift();
                    position = entries.length - 1;
                }
            } else if (entries[position] && entries[position].index === lastWrite.index) entries[position] = lastWrite;
            else reset(lastWrite);
            pushed = false;
            hasWrite = false;
        };
        for (const notice of batch) {
            const current = entry(notice.location);
            if (notice.type === "PUSH" || notice.type === "REPLACE") {
                hasWrite = true;
                pushed ||= notice.type === "PUSH";
                lastWrite = current;
            } else {
                commitWrite();
                const found = entries.findIndex(known => equal(known, current));
                if (found >= 0) position = found; else reset(current);
                // A blocked POP reports the old accepted entry. It leaves both
                // the position and forward branch intact.
                pending = false;
            }
        }
        commitWrite();
        publish();
    }

    // A caller may explicitly flush between two writes in the same turn. That
    // commits two physical entries, so preserve the boundary before batching.
    const flush = () => {
        originalFlush();
        if (notices.length) settle();
    };
    history.flush = flush;
    const unsubscribe = history.subscribe(({location, action}) => {
        notices.push({location, type: action.type});
        if (!scheduled) {
            scheduled = true;
            queueMicrotask(settle);
        }
    });

    function traverse(direction: "back" | "forward") {
        if (scheduled) settle();
        if (pending || (direction === "back" ? !snapshot.canBack : !snapshot.canForward)) return;
        pending = true;
        publish();
        // The installed router's POP blockers remain the only route arbiter.
        history[direction]();
    }

    return {
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot: () => snapshot,
        back: () => traverse("back"), forward: () => traverse("forward"),
        destroy: () => {
            disposed = true;
            unsubscribe();
            if (history.flush === flush) history.flush = originalFlush;
            listeners.clear();
        },
    };
}

const stores = new WeakMap<RouterHistory, ReturnType<typeof createHistoryNavigation>>();

export function getHistoryNavigation(history: RouterHistory) {
    let store = stores.get(history);
    if (!store) {
        store = createHistoryNavigation(history);
        stores.set(history, store);
    }
    return store;
}
