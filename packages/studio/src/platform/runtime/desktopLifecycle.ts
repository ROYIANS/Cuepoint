import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";
import {z} from "zod";
import type {NativeSession} from "../storage/protocol";

const sessionSchema = z.object({version: z.literal(1), session: z.string().min(1), workspaceId: z.string().min(1), generation: z.number().int().nonnegative()}).strict().nullable();
const phaseSchema = z.enum(["running", "checking_drafts", "quiescing", "exiting"]);
const windowSchema = z.object({version: z.literal(1), visible: z.boolean(), focused: z.boolean()}).strict();
const statusSchema = z.object({version: z.literal(1), phase: phaseSchema, intentId: z.string().min(1).max(160).nullable(), session: sessionSchema, visible: z.boolean(), focused: z.boolean()}).strict();
export type DesktopLifecycleEvent = z.infer<typeof statusSchema>;
export type DesktopLifecycleAction = {kind: "status"} | {kind: "guardStatus"; intentId: string; status: "clear" | "decision_required"}
    | {kind: "guardDecision"; intentId: string; decision: "proceed" | "cancel"}
    | {kind: "drained"; intentId: string; outcome: "drained" | "interrupted"};
export interface DesktopLifecyclePort {
    request(action: DesktopLifecycleAction): Promise<z.infer<typeof statusSchema>>;
    subscribe(listener: (event: DesktopLifecycleEvent) => void): Promise<() => void>;
}
export function createNativeWindowState() {
    let snapshot: Readonly<{visible: boolean; focused: boolean}> = Object.freeze({visible: false, focused: false});
    const listeners = new Set<() => void>();
    return {
        getSnapshot: () => snapshot,
        subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
        update(value: {visible: boolean; focused: boolean}) {
            if (snapshot.visible === value.visible && snapshot.focused === value.focused) return;
            snapshot = Object.freeze({visible: value.visible, focused: value.focused});
            for (const listener of [...listeners]) {try {listener();} catch { /* Native truth does not depend on views. */ }}
        },
    };
}
export const nativeWindowState = createNativeWindowState();

/** Bound once to the actual startup session; null is the trusted IndexedDB reference profile only. */
export function createDesktopLifecyclePort(session: NativeSession | null): DesktopLifecyclePort {
    const sameSession = (value: NativeSession | null) => value === null || session === null ? value === session :
        value.version === session.version && value.session === session.session && value.workspaceId === session.workspaceId && value.generation === session.generation;
    return {
        async request(action) {
            const result = statusSchema.parse(await invoke("product_lifecycle_request", {request: {version: 1, session, action}}));
            if (!sameSession(result.session)) throw new Error("桌面会话已变化，请重新打开应用");
            nativeWindowState.update(result);
            return result;
        },
        async subscribe(listener) {
            const unlistenLifecycle = await listen("product-lifecycle", event => {
                const parsed = statusSchema.safeParse(event.payload);
                if (parsed.success && sameSession(parsed.data.session)) {nativeWindowState.update(parsed.data); listener(parsed.data);}
            });
            try {
                const unlistenWindow = await listen("product-window-state", event => {
                    const parsed = windowSchema.safeParse(event.payload);
                    if (parsed.success) nativeWindowState.update(parsed.data);
                });
                return () => {unlistenLifecycle(); unlistenWindow();};
            } catch (cause) {unlistenLifecycle(); throw cause;}
        },
    };
}
