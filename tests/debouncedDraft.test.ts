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
