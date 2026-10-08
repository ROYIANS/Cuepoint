import { describe, expect, it, vi } from "vitest";
import { DebouncedDraftController, type DraftSaveStatus } from "@/lib/debouncedDraft";

describe("DebouncedDraftController", () => {
  it("flushes the latest draft on dispose", async () => {
    const persist = vi.fn(async () => undefined);
    const controller = new DebouncedDraftController("", persist, () => undefined, 400);

    controller.change("latest");
    controller.dispose();
    await vi.waitFor(() => expect(persist).toHaveBeenCalledWith("latest"));
  });

  it("does not let an old save mark a newer revision saved", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const statuses: DraftSaveStatus[] = [];
    const persist = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(undefined);
    const controller = new DebouncedDraftController(
      "",
      persist,
      (status) => statuses.push(status),
      1,
    );

    controller.change("first");
    const saving = controller.flush();
    controller.change("second");
    resolveFirst();
    await saving;

    expect(statuses.at(-1)).toBe("saving");
    await controller.flush();
    expect(persist).toHaveBeenLastCalledWith("second");
    expect(statuses.at(-1)).toBe("saved");
  });

  it("serializes writes so an older save cannot overwrite the latest draft", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const persist = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(undefined);
    const controller = new DebouncedDraftController("", persist, () => undefined);

    controller.change("first");
    const firstSave = controller.flush();
    controller.change("latest");
    const latestSave = controller.flush();

    expect(persist).toHaveBeenCalledTimes(1);
    resolveFirst();
    await Promise.all([firstSave, latestSave]);

    expect(persist.mock.calls).toEqual([["first"], ["latest"]]);
  });

  it("keeps an error visible and retries the latest value", async () => {
    const statuses: DraftSaveStatus[] = [];
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const controller = new DebouncedDraftController(
      "",
      persist,
      (status) => statuses.push(status),
    );

    controller.change("draft");
    await controller.flush();
    expect(statuses.at(-1)).toBe("error");
    await controller.retry();
    expect(persist).toHaveBeenLastCalledWith("draft");
    expect(statuses.at(-1)).toBe("saved");
  });
});

describe("scoped backup draft barrier", () => {
  it("waits for the latest edit made while an earlier write is in flight", async () => {
    let resolve!: () => void;
    const persist = vi.fn().mockImplementationOnce(() => new Promise<void>((r) => { resolve = r; })).mockResolvedValue(undefined);
    const controller = new DebouncedDraftController("", persist, () => undefined);
    controller.change("first");
    const flushing = controller.flushOrThrow();
    controller.change("latest");
    resolve();
    await flushing;
    expect(persist.mock.calls).toEqual([["first"], ["latest"]]);
    controller.dispose();
  });

  it("rejects failed writes and can retry without losing the draft", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
    const controller = new DebouncedDraftController("", persist, () => undefined);
    controller.change("unsaved");
    await expect(controller.flushOrThrow()).rejects.toThrow("quota");
    await controller.flushOrThrow();
    expect(persist.mock.calls).toEqual([["unsaved"], ["unsaved"]]);
    controller.dispose();
  });

  it("flushes only the requested scope and waits for all fields even if one fails", async () => {
    const { registerPendingDraft, flushPendingDrafts } = await import("@/lib/debouncedDraft");
    const failure = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
    const other = vi.fn(async () => undefined);
    const good = vi.fn(async () => undefined);
    const unregister = [registerPendingDraft("first", failure), registerPendingDraft("first", good), registerPendingDraft("other", other)];
    await expect(flushPendingDrafts("first")).rejects.toThrow("quota");
    expect(good).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
    await flushPendingDrafts("first");
    unregister.forEach((release) => release());
  });

  it("keeps failed detached editors in the barrier used by project-gallery backup", async () => {
    const { registerPendingDraft, flushPendingDrafts } = await import("@/lib/debouncedDraft");
    const persist = vi.fn().mockRejectedValue(new Error("quota"));
    const controller = new DebouncedDraftController("", persist, () => undefined);
    controller.change("last edit before navigation");
    const unregister = registerPendingDraft("gallery-backup-fixture", () => controller.flushOrThrow());
    controller.dispose();
    unregister();
    await expect(flushPendingDrafts("gallery-backup-fixture")).rejects.toThrow("quota");
    persist.mockResolvedValue(undefined);
    await flushPendingDrafts("gallery-backup-fixture");
    expect(persist).toHaveBeenLastCalledWith("last edit before navigation");
    const calls = persist.mock.calls.length;
    await flushPendingDrafts("gallery-backup-fixture");
    expect(persist).toHaveBeenCalledTimes(calls);
  });
});

describe("draft navigation recovery", () => {
  it("retains a failed unmounted value and resumes with the current writer/status sink", async () => {
    const oldWriter = vi.fn().mockRejectedValue(new Error("quota"));
    const oldStatus = vi.fn();
    const controller = new DebouncedDraftController("initial", oldWriter, oldStatus);
    controller.change("failed navigation draft");
    controller.dispose();
    await expect(controller.flushOrThrow()).rejects.toThrow("quota");
    expect(controller.snapshot.value).toBe("failed navigation draft");
    expect(controller.snapshot.status).toBe("error");
    const newWriter = vi.fn(async () => undefined);
    const newStatus = vi.fn();
    controller.resume(newWriter, newStatus);
    expect(newStatus).toHaveBeenLastCalledWith("error", expect.any(Error));
    controller.change("newer edit");
    await controller.flushOrThrow();
    expect(newWriter).toHaveBeenCalledWith("newer edit");
    expect(controller.snapshot.status).toBe("saved");
    controller.dispose();
  });

  it("does not swallow synchronous storage failure at the backup barrier", async () => {
    const controller = new DebouncedDraftController("", () => { throw new Error("storage unavailable"); }, () => undefined);
    controller.change("keep me");
    await expect(controller.flushOrThrow()).rejects.toThrow("storage unavailable");
    expect(controller.snapshot.value).toBe("keep me");
    controller.resume(async () => undefined);
    await controller.flushOrThrow();
    controller.dispose();
  });
});

describe("browser exit draft guard", () => {
  const exitEvent = () => ({ preventDefault: vi.fn(), returnValue: "unchanged" });

  it("allows exit when clean, protects a just-typed edit, then allows exit after persistence", async () => {
    const persist = vi.fn(async () => undefined);
    const controller = new DebouncedDraftController("", persist, () => undefined);
    const clean = exitEvent();
    controller.guardBeforeUnload(clean);
    expect(clean.preventDefault).not.toHaveBeenCalled();
    expect(clean.returnValue).toBe("unchanged");
    expect(persist).not.toHaveBeenCalled();
    controller.change("last keystroke");
    const dirty = exitEvent();
    controller.guardBeforeUnload(dirty);
    expect(dirty.preventDefault).toHaveBeenCalledOnce();
    expect(dirty.returnValue).toBe("");
    expect(persist).toHaveBeenCalledWith("last keystroke");
    await controller.flushOrThrow();
    const saved = exitEvent();
    controller.guardBeforeUnload(saved);
    expect(saved.preventDefault).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("protects in-flight writes without starting a duplicate write", async () => {
    let resolve!: () => void;
    const persist = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    const controller = new DebouncedDraftController("", persist, () => undefined);
    controller.change("saving");
    const saving = controller.flush();
    const event = exitEvent();
    controller.guardBeforeUnload(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
    resolve();
    await saving;
    expect(controller.isSettled).toBe(true);
    controller.dispose();
  });

  it("protects a failed write and retries without dropping the value", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
    const controller = new DebouncedDraftController("", persist, () => undefined);
    controller.change("failed draft");
    await controller.flush();
    const event = exitEvent();
    controller.guardBeforeUnload(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    await controller.flushOrThrow();
    expect(persist.mock.calls).toEqual([["failed draft"], ["failed draft"]]);
    expect(controller.isSettled).toBe(true);
    controller.dispose();
  });
});
