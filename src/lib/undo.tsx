import {createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState,} from "react";
import {Button} from "@/components/ui/button";

export interface UndoAction {
    label: string;
    restore: () => Promise<void>;
    expiresInMs?: number;
}

interface ActiveUndoAction extends UndoAction {
    expiresAt: number;
    pending: boolean;
    error?: string;
}

export class UndoController {
    private action: ActiveUndoAction | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private listeners = new Set<() => void>();
    private inFlight = new WeakMap<ActiveUndoAction, Promise<boolean>>();

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getCurrent(): ActiveUndoAction | undefined {
        if (this.action && this.action.expiresAt <= Date.now()) this.clear();
        return this.action;
    }

    register(action: UndoAction): void {
        if (this.timer) clearTimeout(this.timer);
        const expiresInMs = action.expiresInMs ?? 8_000;
        this.action = {...action, expiresAt: Date.now() + expiresInMs, pending: false, error: undefined};
        this.timer = setTimeout(() => this.clear(), expiresInMs);
        this.emit();
    }

    undo(): Promise<boolean> {
        const action = this.getCurrent();
        if (!action) return Promise.resolve(false);
        const pending = this.inFlight.get(action);
        if (pending) return pending;
        action.pending = true;
        action.error = undefined;
        // Store the promise before invoking restore or notifying listeners to guard reentrant clicks.
        const operation = Promise.resolve().then(() => action.restore()).then(
            () => {
                this.inFlight.delete(action);
                if (this.getCurrent() === action) this.clear();
                return true;
            },
            (error: unknown) => {
                this.inFlight.delete(action);
                if (this.getCurrent() === action) {
                    action.pending = false;
                    action.error = error instanceof Error && error.message ? error.message : "撤销失败，请重试。";
                    this.emit();
                }
                throw error;
            },
        );
        this.inFlight.set(action, operation);
        this.emit();
        return operation;
    }

    clear(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        if (!this.action) return;
        this.action = undefined;
        this.emit();
    }

    private emit(): void {
        for (const listener of this.listeners) listener();
    }
}

const UndoContext = createContext<UndoController | null>(null);

export function UndoProvider({children}: { children: ReactNode }) {
    const controller = useMemo(() => new UndoController(), []);
    const [, render] = useState(0);
    useEffect(() => controller.subscribe(() => render((value) => value + 1)), [controller]);
    const action = controller.getCurrent();
    let buttonLabel = "撤销";
    if (action?.pending) buttonLabel = "正在撤销…";
    else if (action?.error) buttonLabel = "重试撤销";

    return (
        <UndoContext.Provider value={controller}>
            {children}
            {action ? (
                <div
                    className="bg-foreground text-background fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl px-4 py-2 text-sm shadow-lg">
                    <div aria-live="polite">
                        <span>{action.label}</span>
                        {action.error ? <p role="alert">撤销失败：{action.error}</p> : null}
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={action.pending}
                        onClick={() => void controller.undo().catch(() => undefined)}
                    >
                        {buttonLabel}
                    </Button>
                </div>
            ) : null}
        </UndoContext.Provider>
    );
}

export function useUndo() {
    const controller = useContext(UndoContext);
    if (!controller) throw new Error("useUndo must be used inside UndoProvider");
    const registerUndo = useCallback((action: UndoAction) => controller.register(action), [controller]);
    return {registerUndo, undo: () => controller.undo(), clearUndo: () => controller.clear()};
}
