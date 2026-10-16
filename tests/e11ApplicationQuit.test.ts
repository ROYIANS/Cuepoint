import {describe, expect, it, vi} from "vitest";
import {createApplicationQuit} from "@/app/lifecycle/applicationQuit";
import {createManualQuitGuards} from "@/app/drafts/manualQuitGuards";
import {createEffectAdmission} from "@/platform/runtime/effectAdmission";
import {createNativeWindowState, type DesktopLifecycleEvent, type DesktopLifecycleAction, type DesktopLifecyclePort} from "@/platform/runtime/desktopLifecycle";

function deferred<T = void>() {let resolve!: (value: T) => void; const promise = new Promise<T>(done => {resolve = done;}); return {promise, resolve};}
const event = (phase: DesktopLifecycleEvent["phase"], intentId: string | null = "quit-1"): DesktopLifecycleEvent => ({version: 1, phase, intentId, session: null, visible: true, focused: true});
function fixture() {
    const guards = createManualQuitGuards(), admission = createEffectAdmission();
    const calls: string[] = [], actions: DesktopLifecycleAction[] = [];
    const model = deferred(), references = deferred(), imports = deferred(), native = deferred();
    const port: DesktopLifecyclePort = {async request(action) {actions.push(action); return event("running", null);}, async subscribe() {return () => {};}};
    const quit = createApplicationQuit(port, guards, {
        closeAdmission() {calls.push("close admission"); admission.close();},
        stopAgent() {calls.push("stop agent"); return model.promise;},
        stopReferences() {calls.push("stop references"); return references.promise;},
        stopDesktopImports() {calls.push("stop desktop"); return imports.promise;},
        stopNativeEffects() {calls.push("stop native"); return native.promise;},
        async disposeMcp() {calls.push("dispose MCP"); return {status: "drained"};},
        async closeStorage() {calls.push("close storage");},
    });
    return {guards, admission, calls, actions, quit, model, references, imports, native};
}
describe("E11 explicit application Quit", () => {
    it("reports guard state immediately, cancels without closing admission, then permits a new original intent", async () => {
        const f = fixture(); let cancel!: () => void;
        const unregister = f.guards.register({readState: () => ({dirty: true, pending: false}), requestDeparture(_go, _discard, no) {cancel = no;}});
        f.quit.handle(event("checking_drafts")); await vi.waitFor(() => expect(cancel).toBeTypeOf("function"));
        expect(f.actions).toEqual([{kind: "guardStatus", intentId: "quit-1", status: "decision_required"}]);
        cancel(); await vi.waitFor(() => expect(f.actions.at(-1)).toEqual({kind: "guardDecision", intentId: "quit-1", decision: "cancel"}));
        expect(f.admission.open).toBe(true); expect(f.calls).toEqual([]);
        f.quit.handle(event("running", null)); unregister(); f.quit.handle(event("checking_drafts", "quit-2"));
        await vi.waitFor(() => expect(f.actions.at(-1)).toEqual({kind: "guardStatus", intentId: "quit-2", status: "clear"}));
    });
    it("joins one original drain and retains store/MCP publication until every original done settles", async () => {
        const f = fixture(); f.quit.handle(event("quiescing")); const done = f.quit.done;
        expect(f.admission.open).toBe(false); expect(() => f.admission.assertOpen()).toThrow("应用正在退出");
        expect(f.calls).toEqual(["close admission", "stop agent", "stop references", "stop desktop", "stop native"]);
        f.quit.handle(event("quiescing")); expect(f.quit.done).toBe(done);
        f.model.resolve(); f.references.resolve(); f.imports.resolve(); await Promise.resolve();
        expect(f.calls).not.toContain("dispose MCP");
        // Original resource publication is still eligible during cooperative drain.
        f.calls.push("original native receipt"); f.native.resolve(); await done;
        expect(f.calls.slice(-3)).toEqual(["original native receipt", "dispose MCP", "close storage"]);
        expect(f.actions).toEqual([{kind: "drained", intentId: "quit-1", outcome: "drained"}]);
    });
    it("cancels a guard whose mounted owner disappears and never reselects a discarded owner with stale React props", async () => {
        const guards = createManualQuitGuards(); let proceed!: () => void;
        const request = vi.fn((go: () => void) => {proceed = go;});
        const unregister = guards.register({readState: () => ({dirty: true, pending: false}), requestDeparture: request});
        const first = guards.request(); expect(guards.request()).toBe(first); proceed(); await expect(first).resolves.toBe(true); expect(request).toHaveBeenCalledOnce();
        const second = guards.request(); unregister(); await expect(second).resolves.toBe(false);
    });
    it("uses native visibility/focus truth with immutable stable observations", () => {
        const state = createNativeWindowState(); const initial = state.getSnapshot(), changed = vi.fn(); state.subscribe(changed);
        state.update({visible: false, focused: false}); expect(state.getSnapshot()).toBe(initial);
        state.update({visible: true, focused: true}); const shown = state.getSnapshot(); expect(Object.isFrozen(shown)).toBe(true);
        state.update({visible: false, focused: false}); expect(shown).toEqual({visible: true, focused: true}); expect(changed).toHaveBeenCalledTimes(2);
    });
});
