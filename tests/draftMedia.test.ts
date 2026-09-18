import { describe, expect, it, vi } from "vitest";
import { DraftMediaSession } from "@/lib/draftMedia";
import { deleteMediaIfOrphan, putMedia, createProject, addCharacter, setCharacterSlot } from "@/db/repo";
import { db } from "@/db/database";
import { emptySlot } from "@/domain/slot";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("draft-owned media lifecycle", () => {
  it("waits for an upload after cancellation then reclaims only its own media", async () => {
    const remove = vi.fn(async () => undefined);
    const session = new DraftMediaSession(remove);
    const file = deferred<{ id: string }>();
    const uploading = session.upload(() => file.promise);
    const closing = session.cancel();
    expect(remove).not.toHaveBeenCalled();
    file.resolve({ id: "late" });
    expect(await uploading).toBeUndefined();
    await closing;
    expect(remove.mock.calls).toEqual([["late"]]);
  });

  it("retains failed-save uploads for retry and releases ownership only after commit", async () => {
    const remove = vi.fn(async () => undefined);
    const session = new DraftMediaSession(remove);
    await session.upload(async () => ({ id: "draft" }));
    const save = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
    await expect(session.save(["draft", "shared"], save)).rejects.toThrow("quota");
    expect(remove).not.toHaveBeenCalled();
    await session.save(["draft", "shared"], save);
    await session.cancel();
    expect(save).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalled();
  });

  it("cleans replaced uploads but never treats existing reference IDs as owned", async () => {
    const remove = vi.fn(async () => undefined);
    const session = new DraftMediaSession(remove);
    await session.upload(async () => ({ id: "old" }));
    await session.upload(async () => ({ id: "new" }));
    await session.discardExcept(["new", "shared"]);
    expect(remove.mock.calls).toEqual([["old"]]);
    await session.cancel();
    expect(remove.mock.calls).toEqual([["old"], ["new"]]);
  });

  it("blocks overlapping upload and save, and waits for a committing save on unmount", async () => {
    const remove = vi.fn(async () => undefined);
    const session = new DraftMediaSession(remove);
    const upload = deferred<{ id: string }>();
    const pending = session.upload(() => upload.promise);
    await expect(session.upload(async () => ({ id: "other" }))).rejects.toThrow();
    await expect(session.save([], async () => undefined)).rejects.toThrow();
    upload.resolve({ id: "kept" });
    await pending;
    const commit = deferred<void>();
    const saving = session.save(["kept"], () => commit.promise);
    const closing = session.cancel();
    commit.resolve();
    await Promise.all([saving, closing]);
    expect(remove).not.toHaveBeenCalled();
  });

  it("allows cleanup retry after deletion fails", async () => {
    const remove = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
    const session = new DraftMediaSession(remove);
    await session.upload(async () => ({ id: "retry" }));
    await expect(session.cancel()).rejects.toThrow("quota");
    await session.cancel();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("does not remove media that another committed record now references", async () => {
    const project = await createProject("fixture");
    const asset = await addCharacter(project.id);
    const session = new DraftMediaSession(deleteMediaIfOrphan);
    await session.upload(async () => {
      await putMedia({ id: "shared-draft", projectId: project.id, mimeType: "image/png", filename: "fixture.png", blob: new Blob(["fixture"], { type: "image/png" }) });
      return { id: "shared-draft" };
    });
    await setCharacterSlot(asset.id, "front", { ...emptySlot(), result: { kind: "image", mediaId: "shared-draft" } });
    await session.cancel();
    expect(await db.media.get("shared-draft")).toBeDefined();
  });
});
