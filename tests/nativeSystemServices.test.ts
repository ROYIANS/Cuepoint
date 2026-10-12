import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {sha256Bytes} from "@/lib/sha256";
import {saveNativeBlob, nativeOpenExternalUrl} from "@/lib/nativeSystemServices";
import {downloadBlob, isPublishedSaveError} from "@/lib/runtimeSave";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({invoke}));
const session = "12345678-1234-4234-8234-123456789012";
const ready = {type: "ready", session, chunkBytes: 262144};

describe("native Blob save lifecycle", () => {
    beforeEach(() => {invoke.mockReset();});
    afterEach(() => vi.unstubAllGlobals());
    it.each(["directorySync", "stageCleanup", "fileSync"])("preserves actual %s receipt through the common native Save wrapper without automatic retry", async code => {
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
        const bytes = Uint8Array.of(1, 2, 3);
        invoke.mockImplementation(async (command: string) => {
            if (command === "product_save_begin") return ready;
            if (command === "product_save_chunk") return bytes.length;
            if (command === "product_save_finish") return {type: "publishedWithError", byteLength: bytes.length, contentHash: sha256Bytes(bytes), code};
            throw new Error("Unexpected retry/cancel command");
        });
        const outcome = await downloadBlob(new Blob([bytes]), "fixture.bin").catch((error: unknown) => error);
        expect(isPublishedSaveError(outcome)).toBe(true);
        expect(outcome).toMatchObject({published: true, code, byteLength: 3, contentHash: sha256Bytes(bytes),
            message: code === "fileSync" ? "文件已保存，但系统未能确认内容已写入磁盘。请检查已保存的文件。" : expect.stringContaining("文件已保存")});
        expect(invoke.mock.calls.map(([command]) => command)).toEqual(["product_save_begin", "product_save_chunk", "product_save_finish"]);
    });
    it("keeps the published warning code schema closed", async () => {
        invoke.mockResolvedValueOnce(ready).mockResolvedValueOnce(1).mockResolvedValueOnce({
            type: "publishedWithError", byteLength: 1, contentHash: sha256Bytes(Uint8Array.of(1)), code: "anythingElse",
        }).mockResolvedValue(true);
        const outcome = await saveNativeBlob(new Blob([Uint8Array.of(1)]), "fixture.bin").catch((error: unknown) => error);
        expect(isPublishedSaveError(outcome)).toBe(false);
        expect(outcome).toBeInstanceOf(Error);
        expect(invoke.mock.calls.filter(([command]) => command === "product_save_finish")).toHaveLength(1);
    });
    it("streams ordered bounded chunks and verifies the final native digest", async () => {
        const bytes = new Uint8Array(262144 + 7).fill(89);
        const requests: {offset: number; bytes: number[]}[] = [];
        invoke.mockImplementation(async (command: string, args: {request: {offset: number; bytes: number[]}}) => {
            if (command === "product_save_begin") return ready;
            if (command === "product_save_chunk") {requests.push(args.request); return args.request.offset + args.request.bytes.length;}
            if (command === "product_save_finish") return {type: "saved", byteLength: bytes.length, contentHash: sha256Bytes(bytes)};
            throw new Error("Unexpected IPC");
        });
        await expect(saveNativeBlob(new Blob([bytes]), "output.zip")).resolves.toBe("saved");
        expect(requests.map(request => [request.offset, request.bytes.length])).toEqual([[0, 262144], [262144, 7]]);
        expect(invoke.mock.calls.some(([command]) => command === "product_save_cancel")).toBe(false);
    });
    it("saves zero bytes without inventing a payload or SQLite owner", async () => {
        invoke.mockImplementation(async (command: string) => {
            if (command === "product_save_begin") return ready;
            if (command === "product_save_finish") return {type: "saved", byteLength: 0, contentHash: sha256Bytes(new Uint8Array())};
            throw new Error("Unexpected IPC");
        });
        await expect(saveNativeBlob(new Blob(), "empty.csv")).resolves.toBe("saved");
        expect(invoke.mock.calls.map(([command]) => command)).toEqual(["product_save_begin", "product_save_finish"]);
    });
    it("canceled dialog and transfer abort clean the session", async () => {
        invoke.mockResolvedValueOnce({type: "canceled"}).mockResolvedValue(true);
        await expect(saveNativeBlob(new Blob(["a"]), "out")).resolves.toBe("canceled");
        expect(invoke.mock.calls.at(-1)?.[0]).toBe("product_save_cancel");
        invoke.mockReset();
        const controller = new AbortController();
        invoke.mockImplementation(async (command: string, args: {request: {offset: number; bytes: number[]}}) => {
            if (command === "product_save_begin") return ready;
            if (command === "product_save_chunk") {controller.abort(); return args.request.bytes.length;}
            if (command === "product_save_cancel") return true;
            throw new Error("Unexpected IPC");
        });
        await expect(saveNativeBlob(new Blob([new Uint8Array(262145)]), "out", controller.signal)).resolves.toBe("canceled");
        expect(invoke.mock.calls.some(([command]) => command === "product_save_finish")).toBe(false);
    });
    it("publication wins over a late abort and post-publication errors stay explicit", async () => {
        const controller = new AbortController(); const bytes = new TextEncoder().encode("a");
        invoke.mockImplementation(async (command: string) => {
            if (command === "product_save_begin") return ready;
            if (command === "product_save_chunk") return 1;
            if (command === "product_save_finish") {controller.abort(); return {type: "saved", byteLength: 1, contentHash: sha256Bytes(bytes)};}
            return false;
        });
        await expect(saveNativeBlob(new Blob([bytes]), "out", controller.signal)).resolves.toBe("saved");
        invoke.mockImplementation(async (command: string) => {
            if (command === "product_save_begin") return ready;
            if (command === "product_save_chunk") return 1;
            return {type: "publishedWithError", byteLength: 1, contentHash: sha256Bytes(bytes), code: "directorySync"};
        });
        await expect(saveNativeBlob(new Blob([bytes]), "out")).rejects.toMatchObject({published: true, message: expect.stringContaining("文件已保存")});
    });
    it("bad offsets or hashes fail without claiming completion", async () => {
        invoke.mockResolvedValueOnce(ready).mockResolvedValueOnce(7).mockResolvedValue(true);
        await expect(saveNativeBlob(new Blob(["a"]), "out")).rejects.toThrow("字节位置");
        expect(invoke.mock.calls.at(-1)?.[0]).toBe("product_save_cancel");
        invoke.mockReset();
        invoke.mockResolvedValueOnce(ready).mockResolvedValueOnce(1).mockResolvedValueOnce({type: "saved", byteLength: 1, contentHash: "0".repeat(64)});
        await expect(saveNativeBlob(new Blob(["a"]), "out")).rejects.toThrow("校验");
    });
    it("normalizes canceled pending writes but keeps unknown finalization errors", async () => {
        const controller = new AbortController();
        invoke.mockImplementation(async (command: string) => {
            if (command === "product_save_begin") return ready;
            if (command === "product_save_chunk") {controller.abort(); throw new Error("Export closed");}
            return true;
        });
        await expect(saveNativeBlob(new Blob(["a"]), "out", controller.signal)).resolves.toBe("canceled");
        const later = new AbortController();
        invoke.mockImplementation(async (command: string) => {
            if (command === "product_save_begin") return ready;
            if (command === "product_save_chunk") return 1;
            if (command === "product_save_finish") {later.abort(); throw new Error("Unknown publication outcome");}
            return false;
        });
        await expect(saveNativeBlob(new Blob(["a"]), "out", later.signal)).rejects.toThrow("Unknown publication outcome");
    });
    it("rejects non-web external links and delegates only HTTP(S)", async () => {
        await expect(nativeOpenExternalUrl("file:///tmp/x")).rejects.toThrow();
        await expect(nativeOpenExternalUrl("https://user:password@host")).rejects.toThrow();
        expect(invoke).not.toHaveBeenCalled();
        invoke.mockResolvedValue(undefined);
        await nativeOpenExternalUrl("https://example.test/path?q=1");
        expect(invoke).toHaveBeenCalledWith("product_open_external", {url: "https://example.test/path?q=1"});
    });
});
