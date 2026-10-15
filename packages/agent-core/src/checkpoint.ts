import type {AgentRunOutput} from "./types.js";

/** Coalesce bursts and serialize writes. A failed write stops further streaming. */
export function createRunWriter(persist: (sequence: number, output: AgentRunOutput) => Promise<unknown>, onFailure: () => void, initialSequence = 0) {
    let sequence = initialSequence;
    let pending: { sequence: number; output: AgentRunOutput } | undefined;
    let draining: Promise<void> | undefined;
    let failure: unknown;

    function drain() {
        if (draining || !pending || failure) return;
        draining = (async () => {
            while (pending) {
                const next = pending;
                pending = undefined;
                await persist(next.sequence, next.output);
            }
        })().catch((error: unknown) => {
            failure = error;
            pending = undefined;
            onFailure();
        }).finally(() => {
            draining = undefined;
            if (pending) drain();
        });
    }

    function push(output: AgentRunOutput) {
        if (failure) return;
        pending = {sequence: ++sequence, output: {...output}};
        drain();
    }

    return {
        push, async flush() {
            while (draining) await draining;
            if (failure) throw failure;
        }
    };
}
