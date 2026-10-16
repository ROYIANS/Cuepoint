import {beforeEach, describe, expect, it, vi} from "vitest";
import type {DesktopLifecycleEvent} from "@/platform/runtime/desktopLifecycle";
const host = vi.hoisted(() => ({invoke: vi.fn(), callbacks: new Map<string, (event: {payload: unknown}) => void>(), unlisten: vi.fn()}));
vi.mock("@tauri-apps/api/core", () => ({invoke: host.invoke}));
vi.mock("@tauri-apps/api/event", () => ({listen: async (name: string, callback: (event: {payload: unknown}) => void) => {host.callbacks.set(name, callback); return host.unlisten;}}));
import {createDesktopLifecyclePort, nativeWindowState} from "@/platform/runtime/desktopLifecycle";
const session = {version: 1 as const, session: "original", workspaceId: "workspace", generation: 3};
const snapshot = (phase: DesktopLifecycleEvent["phase"], intentId: string | null): DesktopLifecycleEvent => ({version: 1, phase, intentId, session, visible: true, focused: false});
beforeEach(() => {host.invoke.mockReset(); host.callbacks.clear(); host.unlisten.mockClear();});
describe("real native lifecycle Snapshot wire", () => {
    it("decodes full serialized native events, cancel/null then second intent, and ignores foreign generations/extra fields", async () => {
        const port = createDesktopLifecyclePort(session), events: DesktopLifecycleEvent[] = [];
        const stop = await port.subscribe(event => events.push(event));
        const emit = (value: unknown) => host.callbacks.get("product-lifecycle")!({payload: JSON.parse(JSON.stringify(value))});
        emit(snapshot("checking_drafts", "first")); emit(snapshot("running", null)); emit(snapshot("checking_drafts", "second")); emit(snapshot("quiescing", "second"));
        expect(events.map(event => [event.phase, event.intentId])).toEqual([["checking_drafts", "first"], ["running", null], ["checking_drafts", "second"], ["quiescing", "second"]]);
        emit({...snapshot("quiescing", "second"), session: {...session, generation: 4}}); emit({...snapshot("quiescing", "second"), quitNow: true});
        expect(events).toHaveLength(4); expect(nativeWindowState.getSnapshot()).toEqual({visible: true, focused: false});
        stop(); expect(host.unlisten).toHaveBeenCalledTimes(2);
    });
    it("compares session fields independently of key order and sends the exact captured nullable reference session", async () => {
        const reordered = {generation: 3, workspaceId: "workspace", session: "original", version: 1};
        host.invoke.mockResolvedValue({...snapshot("running", null), session: reordered});
        await createDesktopLifecyclePort(session).request({kind: "status"});
        expect(host.invoke).toHaveBeenLastCalledWith("product_lifecycle_request", {request: {version: 1, session, action: {kind: "status"}}});
        host.invoke.mockResolvedValue({...snapshot("running", null), session: null});
        await createDesktopLifecyclePort(null).request({kind: "status"});
        expect(host.invoke).toHaveBeenLastCalledWith("product_lifecycle_request", {request: {version: 1, session: null, action: {kind: "status"}}});
        await expect(createDesktopLifecyclePort(session).request({kind: "status"})).rejects.toThrow("会话已变化");
    });
});
