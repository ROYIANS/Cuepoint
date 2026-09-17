import { describe, expect, it, vi } from "vitest";
import { UndoController } from "@/lib/undo";

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
    try {
      const restore = vi.fn(async () => undefined);
      const controller = new UndoController();
      controller.register({ label: "已删除镜头", restore, expiresInMs: 100 });

      await vi.advanceTimersByTimeAsync(100);

      expect(await controller.undo()).toBe(false);
      expect(restore).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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
});
