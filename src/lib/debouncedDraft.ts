import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

export type DraftSaveStatus = "saved" | "saving" | "error";

export class DebouncedDraftController<T> {
  private revision = 0;
  private persistedRevision = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<{ revision: number }> | undefined;
  private disposed = false;
  private value: T;

  constructor(
    initialValue: T,
    private readonly persist: (value: T) => Promise<void>,
    private readonly onStatus: (status: DraftSaveStatus, error?: unknown) => void,
    private readonly delay = 400,
  ) {
    this.value = initialValue;
  }

  change(value: T): void {
    this.value = value;
    this.revision += 1;
    this.onStatus("saving");
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.delay);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.inFlight) {
      const result = await this.inFlight;
      if (this.revision !== result.revision) {
        await this.flush();
      }
      return;
    }
    if (this.persistedRevision === this.revision) return;
    const savingRevision = this.revision;
    const savingValue = this.value;
    if (!this.disposed) this.onStatus("saving");
    const save = this.persist(savingValue).then(
      () => {
        this.persistedRevision = savingRevision;
        if (this.revision === savingRevision && !this.disposed) {
          this.onStatus("saved");
        }
        return { revision: savingRevision };
      },
      (error: unknown) => {
        if (this.revision === savingRevision && !this.disposed) {
          this.onStatus("error", error);
        }
        return { revision: savingRevision };
      },
    );
    this.inFlight = save;
    await save;
    if (this.inFlight === save) this.inFlight = undefined;

    if (this.revision !== savingRevision) {
      if (this.disposed) {
        await this.flush();
      } else if (!this.timer) {
        this.schedule();
      }
    }
  }

  retry(): Promise<void> {
    return this.flush();
  }

  resume(): void {
    this.disposed = false;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    void this.flush();
  }
}

export function useDebouncedDraft<T>({
  initialValue,
  persist,
  delay = 400,
}: {
  initialValue: T;
  persist: (value: T) => Promise<void>;
  delay?: number;
}) {
  const [draft, setDraftState] = useState(initialValue);
  const [status, setStatus] = useState<DraftSaveStatus>("saved");
  const [error, setError] = useState<unknown>();
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const controllerRef = useRef<DebouncedDraftController<T> | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new DebouncedDraftController(
      initialValue,
      (value) => persistRef.current(value),
      (nextStatus, nextError) => {
        setStatus(nextStatus);
        setError(nextError);
      },
      delay,
    );
  }

  const setDraft = useCallback((action: SetStateAction<T>) => {
    setDraftState((current) => {
      const next = typeof action === "function"
        ? (action as (value: T) => T)(current)
        : action;
      controllerRef.current?.change(next);
      return next;
    });
  }, []);

  const flush = useCallback(() => controllerRef.current?.flush() ?? Promise.resolve(), []);
  const retry = useCallback(() => controllerRef.current?.retry() ?? Promise.resolve(), []);

  useEffect(() => {
    controllerRef.current?.resume();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      controllerRef.current?.dispose();
    };
  }, [flush]);

  return { draft, setDraft, status, error, flush, retry };
}
