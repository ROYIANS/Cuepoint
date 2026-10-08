import { afterEach, describe, expect, it, vi } from "vitest";
import { UndoController } from "@/lib/undo";

function deferredRestore() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { restore: vi.fn(() => promise), resolve, reject };
}

afterEach(() => vi.useRealTimers());

describe("UndoController", () => {
  it("restores the latest action only once", async () => {
    const restore = vi.fn(async () => undefined);
    const controller = new UndoController();
    controller.register({ label: "删除了镜头", restore });

    expect(await controller.undo()).toBe(true);
    expect(await controller.undo()).toBe(false);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("expires an action after its configured window", async () => {
    vi.useFakeTimers();
    const restore = vi.fn(async () => undefined);
    const controller = new UndoController();
    controller.register({ label: "已删除镜头", restore, expiresInMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await controller.undo()).toBe(false);
    expect(restore).not.toHaveBeenCalled();
  });

  it("replaces the previous action when a new one is registered", async () => {
    const restoreA = vi.fn(async () => undefined);
    const restoreB = vi.fn(async () => undefined);
    const controller = new UndoController();
    controller.register({ label: "A", restore: restoreA });
    controller.register({ label: "B", restore: restoreB });
    expect(await controller.undo()).toBe(true);
    expect(restoreA).not.toHaveBeenCalled();
    expect(restoreB).toHaveBeenCalledTimes(1);
  });

  it("rejects failure to the caller, retains the action and retries successfully", async () => {
    const restore = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockResolvedValueOnce(undefined);
    const controller = new UndoController();
    controller.register({ label: "批量修改", restore });
    const expiresAt = controller.getCurrent()!.expiresAt;
    await expect(controller.undo()).rejects.toThrow("storage unavailable");
    expect(controller.getCurrent()).toMatchObject({
      label: "批量修改", pending: false, error: "storage unavailable", expiresAt,
    });
    expect(await controller.undo()).toBe(true);
    expect(controller.getCurrent()).toBeUndefined();
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it("keeps failed retries only until the original expiry", async () => {
    vi.useFakeTimers();
    const controller = new UndoController();
    controller.register({ label: "A", expiresInMs: 100, restore: async () => { throw new Error("retry"); } });
    await vi.advanceTimersByTimeAsync(60);
    await expect(controller.undo()).rejects.toThrow("retry");
    await vi.advanceTimersByTimeAsync(30);
    await expect(controller.undo()).rejects.toThrow("retry");
    expect(controller.getCurrent()?.label).toBe("A");
    await vi.advanceTimersByTimeAsync(10);
    expect(controller.getCurrent()).toBeUndefined();
    expect(await controller.undo()).toBe(false);
  });

  it.each(["success", "failure"] as const)("shares one pending restore across duplicate clicks on %s", async (outcome) => {
    const pending = deferredRestore();
    const controller = new UndoController();
    controller.register({ label: "A", restore: pending.restore });
    const first = controller.undo();
    const second = controller.undo();
    expect(controller.getCurrent()).toMatchObject({ label: "A", pending: true });
    await Promise.resolve();
    expect(pending.restore).toHaveBeenCalledTimes(1);
    if (outcome === "success") {
      pending.resolve();
      expect(await Promise.all([first, second])).toEqual([true, true]);
    } else {
      const results = Promise.allSettled([first, second]);
      pending.reject(new Error("failed"));
      expect((await results).map((result) => result.status)).toEqual(["rejected", "rejected"]);
      expect(controller.getCurrent()?.error).toBe("failed");
    }
  });

  it.each(["success", "failure"] as const)("leaves a newer action intact after old pending %s", async (outcome) => {
    vi.useFakeTimers();
    const pending = deferredRestore();
    const controller = new UndoController();
    controller.register({ label: "A", restore: pending.restore, expiresInMs: 100 });
    const old = controller.undo();
    const settled = Promise.allSettled([old]);
    await vi.advanceTimersByTimeAsync(50);
    const restoreB = vi.fn(async () => undefined);
    controller.register({ label: "B", restore: restoreB, expiresInMs: 200 });
    if (outcome === "success") pending.resolve();
    else pending.reject(new Error("old failure"));
    await settled;
    expect(controller.getCurrent()).toMatchObject({ label: "B", pending: false, error: undefined });
    await vi.advanceTimersByTimeAsync(50);
    expect(controller.getCurrent()?.label).toBe("B");
    expect(await controller.undo()).toBe(true);
    expect(restoreB).toHaveBeenCalledTimes(1);
  });

  it("does not settle a newer pending restore when an older restore finishes", async () => {
    const pendingA = deferredRestore();
    const pendingB = deferredRestore();
    const controller = new UndoController();
    controller.register({ label: "A", restore: pendingA.restore });
    const first = controller.undo();
    controller.register({ label: "B", restore: pendingB.restore });
    const second = controller.undo();
    pendingA.resolve();
    await first;
    expect(controller.getCurrent()).toMatchObject({ label: "B", pending: true });
    pendingB.resolve();
    expect(await second).toBe(true);
    expect(controller.getCurrent()).toBeUndefined();
  });

  it.each([
    ["clear", "success"], ["clear", "failure"],
    ["expire", "success"], ["expire", "failure"],
  ] as const)("does not resurrect an action after %s during pending %s", async (remove, outcome) => {
    vi.useFakeTimers();
    const pending = deferredRestore();
    const controller = new UndoController();
    controller.register({ label: "A", restore: pending.restore, expiresInMs: 100 });
    const settled = Promise.allSettled([controller.undo()]);
    if (remove === "clear") controller.clear();
    else await vi.advanceTimersByTimeAsync(100);
    if (outcome === "success") pending.resolve();
    else pending.reject(new Error("late failure"));
    await settled;
    expect(controller.getCurrent()).toBeUndefined();
    expect(await controller.undo()).toBe(false);
  });

  it("emits pending, failure, retry and success changes to subscribers", async () => {
    const controller = new UndoController();
    const states: Array<{ pending: boolean; error?: string } | undefined> = [];
    const unsubscribe = controller.subscribe(() => {
      const action = controller.getCurrent();
      states.push(action ? { pending: action.pending, error: action.error } : undefined);
    });
    const restore = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce("unknown failure")
      .mockResolvedValueOnce(undefined);
    controller.register({ label: "A", restore });
    await expect(controller.undo()).rejects.toBe("unknown failure");
    expect(controller.getCurrent()?.error).toBeTruthy();
    await controller.undo();
    expect(states.map((state) => state?.pending)).toEqual([false, true, false, true, undefined]);
    expect(states[3]?.error).toBeUndefined();
    unsubscribe();
  });
});
