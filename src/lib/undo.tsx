import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

export interface UndoAction {
  label: string;
  restore: () => Promise<void>;
  expiresInMs?: number;
}

interface ActiveUndoAction extends UndoAction {
  expiresAt: number;
}

export class UndoController {
  private action: ActiveUndoAction | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();

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
    this.action = { ...action, expiresAt: Date.now() + expiresInMs };
    this.timer = setTimeout(() => this.clear(), expiresInMs);
    this.emit();
  }

  async undo(): Promise<boolean> {
    const action = this.getCurrent();
    if (!action) return false;
    this.clear();
    await action.restore();
    return true;
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

export function UndoProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new UndoController(), []);
  const [, render] = useState(0);
  useEffect(() => controller.subscribe(() => render((value) => value + 1)), [controller]);
  const action = controller.getCurrent();

  return (
    <UndoContext.Provider value={controller}>
      {children}
      {action ? (
        <div className="bg-foreground text-background fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl px-4 py-2 text-sm shadow-lg">
          <span>{action.label}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void controller.undo()}
          >
            撤销
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
  return { registerUndo, undo: () => controller.undo(), clearUndo: () => controller.clear() };
}
