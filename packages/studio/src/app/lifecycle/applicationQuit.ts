import type {DesktopLifecycleEvent, DesktopLifecyclePort} from "../../platform/runtime/desktopLifecycle";
import type {createManualQuitGuards} from "../drafts/manualQuitGuards";

interface QuitResources {
    closeAdmission(): void;
    stopAgent(): Promise<void>;
    stopReferences(): Promise<void>;
    stopDesktopImports(): Promise<void>;
    stopNativeEffects(): Promise<void>;
    disposeMcp(): Promise<{status: "drained" | "draining"}>;
    closeStorage(): Promise<void>;
}

/** One original native intent. Native owns the total deadline and truthful forced-exit fallback. */
export function createApplicationQuit(port: DesktopLifecyclePort, guards: ReturnType<typeof createManualQuitGuards>, resources: QuitResources) {
    let active: {id: string; guard?: Promise<void>; drain?: Promise<void>} | undefined;
    function handle(event: DesktopLifecycleEvent): void {
        if (event.phase === "running") {
            if (active && !active.drain && (event.intentId === null || active.id === event.intentId)) active = undefined;
            return;
        }
        if (event.intentId === null) return;
        if (!active) active = {id: event.intentId};
        if (active.id !== event.intentId) return;
        const intent = active;
        if (event.phase === "checking_drafts" && !intent.guard) {
            // Send the finite synchronous state immediately; a human decision may take longer.
            const required = guards.needsDecision();
            intent.guard = (async () => {
                await port.request({kind: "guardStatus", intentId: intent.id, status: required ? "decision_required" : "clear"});
                if (required) {
                    const proceed = await guards.request();
                    if (active !== intent || intent.drain) return;
                    await port.request({kind: "guardDecision", intentId: intent.id, decision: proceed ? "proceed" : "cancel"});
                }
            })();
            void intent.guard.catch(() => undefined); // Native timeout owns absent renderer/ack fallback.
        }
        if (event.phase === "quiescing" && !intent.drain) {
            let resolve!: () => void;
            intent.drain = new Promise<void>(done => {resolve = done;});
            resources.closeAdmission();
            // Call every original Stop before awaiting any completion.
            const started: Promise<void>[] = [];
            for (const stop of [() => resources.stopAgent(), () => resources.stopReferences(), () => resources.stopDesktopImports(), () => resources.stopNativeEffects()]) {
                try {started.push(stop());} catch (cause) {started.push(Promise.reject(cause instanceof Error ? cause : new Error("停止操作未完成", {cause})));}
            }
            void (async () => {
                let outcome: "drained" | "interrupted" = "drained";
                try {
                    const settled = await Promise.allSettled(started);
                    if (settled.some(result => result.status === "rejected")) outcome = "interrupted";
                    const mcp = await resources.disposeMcp();
                    if (mcp.status !== "drained") outcome = "interrupted";
                    await resources.closeStorage();
                } catch {outcome = "interrupted";}
                await port.request({kind: "drained", intentId: intent.id, outcome}).catch(() => undefined);
                resolve();
            })();
        }
    }
    return {handle, get done() {return active?.drain;}};
}
