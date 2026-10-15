import {afterEach, describe, expect, it, vi} from "vitest";
import {downloadBlob, isPublishedSaveError} from "@/platform/runtime/runtimeSave";
import {pickZipFile} from "@/features/library/services/library";

const native = vi.hoisted(() => ({save: vi.fn()}));
vi.mock("@/platform/runtime/nativeSystemServices", () => ({saveNativeBlob: native.save}));

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    native.save.mockReset();
});

describe("shared host save boundary", () => {
    it("distinguishes a published warning from a normal failure or malformed value", () => {
        expect(isPublishedSaveError(Object.assign(new Error("file exists, sync uncertain"), {published: true}))).toBe(true);
        expect(isPublishedSaveError(new Error("write failed"))).toBe(false);
        expect(isPublishedSaveError({published: true})).toBe(false);
    });
    it("waits for native publication and preserves the original bytes and abort signal", async () => {
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}});
        let finish: (value: "saved") => void = () => { throw new Error("save was not started"); };
        native.save.mockImplementation(() => new Promise<"saved">((resolve) => { finish = resolve; }));
        const blob = new Blob([new Uint8Array([0, 255, 4])]);
        const controller = new AbortController();
        let settled = false;
        const pending = downloadBlob(blob, "original.bin", controller.signal).then((result) => {
            settled = true;
            return result;
        });
        await vi.waitFor(() => expect(native.save).toHaveBeenCalledWith(blob, "original.bin", controller.signal));
        expect(settled).toBe(false);
        finish("saved");
        await expect(pending).resolves.toBe("saved");
    });

    it("returns native cancellation without attempting an anchor download", async () => {
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}});
        const create = vi.fn();
        vi.stubGlobal("document", {createElement: create});
        native.save.mockResolvedValue("canceled");
        await expect(downloadBlob(new Blob(), "empty.bin")).resolves.toBe("canceled");
        expect(create).not.toHaveBeenCalled();
    });

    it("propagates a native failure without silently switching to Web download", async () => {
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}});
        const create = vi.fn();
        vi.stubGlobal("document", {createElement: create});
        const failure = new Error("destination already exists");
        native.save.mockRejectedValue(failure);
        await expect(downloadBlob(new Blob(["bytes"]), "existing.txt")).rejects.toBe(failure);
        expect(create).not.toHaveBeenCalled();
    });

    it("honors an already canceled signal before dispatching either host", async () => {
        const controller = new AbortController();
        const reason = new DOMException("stopped", "AbortError");
        controller.abort(reason);
        await expect(downloadBlob(new Blob(), "empty.bin", controller.signal)).rejects.toBe(reason);
        expect(native.save).not.toHaveBeenCalled();
    });

    it.each([false, true])("releases the Web object URL even when anchor activation fails (%s)", async (fail) => {
        vi.stubGlobal("window", {});
        const error = new Error("anchor failed");
        const anchor = {href: "", download: "", click: vi.fn(() => { if (fail) throw error; })};
        vi.stubGlobal("document", {createElement: vi.fn(() => anchor)});
        const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
        const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        const blob = new Blob(["same export"]);
        const result = downloadBlob(blob, "project.zip");
        if (fail) await expect(result).rejects.toBe(error);
        else await expect(result).resolves.toBe("saved");
        expect(create).toHaveBeenCalledWith(blob);
        expect(anchor.href).toBe("blob:export");
        expect(anchor.download).toBe("project.zip");
        expect(revoke).toHaveBeenCalledWith("blob:export");
        expect(native.save).not.toHaveBeenCalled();
    });

    it("resolves file picker cancellation so the import UI can release its pending state", async () => {
        const input = {type: "", accept: "", onchange: undefined, oncancel: undefined, click: vi.fn()};
        vi.stubGlobal("document", {createElement: () => input});
        const pending = pickZipFile();
        expect(input.click).toHaveBeenCalledOnce();
        const cancel = input.oncancel as unknown as () => void;
        cancel();
        await expect(pending).resolves.toBeUndefined();
    });
});
