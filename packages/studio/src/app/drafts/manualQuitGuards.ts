export interface ManualQuitGuard {
    readState(): {dirty: boolean; pending: boolean};
    requestDeparture(proceed: () => void, discard: undefined, cancel: () => void): void;
}

/** Mounted editor owners, including route:false overlays, reuse their existing confirmation. */
export function createManualQuitGuards() {
    const owners = new Set<ManualQuitGuard>();
    let original: Promise<boolean> | undefined;
    let cancelOwner: {owner: ManualQuitGuard; cancel(): void} | undefined;
    return {
        register(owner: ManualQuitGuard) {owners.add(owner); return () => {
            owners.delete(owner);
            if (cancelOwner?.owner === owner) cancelOwner.cancel();
        };},
        needsDecision() {return [...owners].some(owner => {const state = owner.readState(); return state.dirty || state.pending;});},
        request(): Promise<boolean> {
            if (original) return original;
            let resolve!: (value: boolean) => void;
            const done = new Promise<boolean>(yes => {resolve = yes;});
            original = done;
            const processed = new Set<ManualQuitGuard>();
            let settled = false;
            const finish = (value: boolean) => {if (settled) return; settled = true; cancelOwner = undefined; original = undefined; resolve(value);};
            const next = () => {
                // The most recently mounted overlay must resolve before its containing editor.
                if (settled) return;
                const owner = [...owners].reverse().find(item => {const state = item.readState(); return !processed.has(item) && (state.dirty || state.pending);});
                if (!owner) {finish(true); return;}
                cancelOwner = {owner, cancel: () => finish(false)};
                try {owner.requestDeparture(() => {processed.add(owner); next();}, undefined, () => finish(false));}
                catch {finish(false);}
            };
            next();
            return done;
        },
    };
}

export const manualQuitGuards = createManualQuitGuards();
