import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

export type DraftSaveStatus = "saved" | "saving" | "error";

// Keys are owned by callers (entity + field); the same key always uses one value type.
const retainedDrafts = new Map<string, Map<string, unknown>>();

const pendingDrafts = new Map<string, Set<{ flush: () => Promise<void>; detached: boolean }>>();

/** Keep failed, unmounted drafts available to the backup barrier for retry. */
export function registerPendingDraft(scope: string, flush: () => Promise<void>): () => void {
  const entries = pendingDrafts.get(scope) ?? new Set();
  pendingDrafts.set(scope, entries);
  const entry = { flush, detached: false };
  entries.add(entry);
  return () => {
    entry.detached = true;
    void flush().then(() => entries.delete(entry), () => undefined);
  };
}

export async function flushPendingDrafts(scope: string): Promise<void> {
  const entries = pendingDrafts.get(scope);
  if (!entries) return;
  const results = await Promise.allSettled([...entries].map(async (entry) => {
    await entry.flush();
    if (entry.detached) entries.delete(entry);
  }));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

export class DebouncedDraftController<T> {
  private revision = 0;
  private persistedRevision = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<{ revision: number }> | undefined;
  private disposed = false;
  private value: T;
  private lastError: unknown;
  private status: DraftSaveStatus = "saved";

  constructor(
    initialValue: T,
    private persist: (value: T) => Promise<void>,
    private onStatus: (status: DraftSaveStatus, error?: unknown) => void,
    private readonly delay = 400,
  ) {
    this.value = initialValue;
  }

  get snapshot() { return { value: this.value, status: this.status, error: this.lastError }; }
  get isSettled() { return this.persistedRevision === this.revision && !this.inFlight; }
  get isDisposed() { return this.disposed; }

  /** Browser-standard guard; async writes cannot be guaranteed once the user leaves. */
  guardBeforeUnload(event: Pick<BeforeUnloadEvent, "preventDefault" | "returnValue">): void {
    if (this.isSettled) return;
    event.preventDefault();
    event.returnValue = "";
    void this.flush();
  }

  private report(status: DraftSaveStatus, error?: unknown) {
    this.status = status;
    if (!this.disposed) this.onStatus(status, error);
  }

  change(value: T): void {
    this.value = value;
    this.revision += 1;
    this.report("saving");
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
    this.report("saving");
    let write: Promise<void>;
    try {
      write = this.persist(savingValue);
    } catch (error) {
      write = Promise.reject(error);
    }
    const save = write.then(
      () => {
        this.lastError = undefined;
        this.persistedRevision = savingRevision;
        if (this.revision === savingRevision) {
          this.report("saved");
        }
        return { revision: savingRevision };
      },
      (error: unknown) => {
        this.lastError = error ?? new Error("保存失败");
        if (this.revision === savingRevision) {
          this.report("error", this.lastError);
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

  /** Unlike UI flush, backup must reject on failure and drain newer revisions. */
  async flushOrThrow(): Promise<void> {
    do {
      await this.flush();
      if (this.persistedRevision !== this.revision && this.lastError !== undefined) {
        throw this.lastError;
      }
    } while (this.persistedRevision !== this.revision);
  }

  resume(persist?: (value: T) => Promise<void>, onStatus?: (status: DraftSaveStatus, error?: unknown) => void): void {
    if (persist) this.persist = persist;
    if (onStatus) this.onStatus = onStatus;
    this.disposed = false;
    this.onStatus(this.status, this.lastError);
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
  scope,
  draftKey,
}: {
  initialValue: T;
  persist: (value: T) => Promise<void>;
  delay?: number;
  scope?: string;
  /** Stable entity + field identity restores failed navigation drafts on reopening. */
  draftKey?: string;
}) {
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const controllerRef = useRef<DebouncedDraftController<T> | null>(null);
  if (!controllerRef.current) {
    const retained = scope && draftKey ? retainedDrafts.get(scope)?.get(draftKey) : undefined;
    controllerRef.current = retained
      ? retained as DebouncedDraftController<T>
      : new DebouncedDraftController(initialValue, (value) => persistRef.current(value), () => undefined, delay);
  }
  const controller = controllerRef.current;
  const [draft, setDraftState] = useState(controller.snapshot.value);
  const [status, setStatus] = useState<DraftSaveStatus>(controller.snapshot.status);
  const [error, setError] = useState<unknown>(controller.snapshot.error);
  const draftRef = useRef(controller.snapshot.value);

  const setDraft = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === "function"
      ? (action as (value: T) => T)(draftRef.current)
      : action;
    draftRef.current = next;
    controller.change(next);
    setDraftState(next);
  }, [controller]);

  const flush = useCallback(() => controller.flush(), [controller]);
  const retry = useCallback(() => controller.retry(), [controller]);

  useEffect(() => {
    controller.resume((value) => persistRef.current(value), (nextStatus, nextError) => {
      setStatus(nextStatus);
      setError(nextError);
    });
    if (scope && draftKey) {
      const retained = retainedDrafts.get(scope) ?? new Map();
      retained.set(draftKey, controller);
      retainedDrafts.set(scope, retained);
    }
    const scopedFlush = async () => {
      await controller.flushOrThrow();
      if (scope && draftKey && controller.isDisposed && controller.isSettled) {
        const retained = retainedDrafts.get(scope);
        if (retained?.get(draftKey) === controller) retained.delete(draftKey);
      }
    };
    const unregister = scope ? registerPendingDraft(scope, scopedFlush) : undefined;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => controller.guardBeforeUnload(event);
    const handlePageHide = () => { void flush(); };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      controller.dispose();
      unregister?.();
    };
  }, [controller, flush, scope, draftKey]);

  return { draft, setDraft, status, error, flush, retry };
}
