import {Buffer} from "node:buffer";
import {createHash} from "node:crypto";
import {describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {STUDIO_LIBRARY_ID} from "@/features/library/models/ownership";
import {uploadMediaFile} from "@/features/library/services/media";
import {copyIntoManagedWorkspace, workspaceId} from "@/features/library/services/workspace";

const metadata = {workspaceId: workspaceId("chunk-fixture"), projectId: STUDIO_LIBRARY_ID, filename: "source.png", mimeType: "image/png"};

describe("bounded managed copy", () => {
    it.each([55, 56, 63, 64, 65, 1024 * 1024 + 65, 4 * 1024 * 1024 + 129])("copies and hashes %i bytes using bounded reads with macrotask opportunities", async length => {
        const bytes = Uint8Array.from({length}, (_, index) => index * 29 % 256);
        const source = new Blob([bytes]);
        const fullRead = vi.spyOn(source, "arrayBuffer");
        const slice = source.slice.bind(source);
        const readLengths: number[] = [];
        let previousTimerRan = true;
        const timers: Promise<void>[] = [];
        vi.spyOn(source, "slice").mockImplementation((start, end, type) => {
            expect(previousTimerRan).toBe(true);
            const chunk = slice(start, end, type);
            readLengths.push(chunk.size);
            previousTimerRan = false;
            timers.push(new Promise(resolve => setTimeout(() => {previousTimerRan = true; resolve();}, 0)));
            return chunk;
        });
        const staged = await copyIntoManagedWorkspace(source, metadata);
        expect(fullRead).not.toHaveBeenCalled();
        expect(Math.max(...readLengths)).toBeLessThanOrEqual(256 * 1024);
        expect(readLengths.reduce((sum, size) => sum + size, 0)).toBe(length);
        expect(staged.copy.contentHash).toBe(createHash("sha256").update(bytes).digest("hex"));
        expect(Buffer.from(await staged.copy.blob.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);
        expect(staged.copy.blob).not.toBe(source);
        staged.discard();
        await Promise.all(timers);
    });

    it("cancels a pending later chunk read before any ready row is written", async () => {
        const source = new File([new Uint8Array(1024 * 1024 + 65)], "source.png", {type: "image/png"});
        const slice = source.slice.bind(source);
        const controller = new AbortController();
        let finish!: (bytes: ArrayBuffer) => void;
        let notifyReading!: () => void;
        const reading = new Promise<void>(resolve => {notifyReading = resolve;});
        let readCount = 0;
        vi.spyOn(source, "slice").mockImplementation((start, end, type) => {
            const chunk = slice(start, end, type);
            if (++readCount === 2) {
                vi.spyOn(chunk, "arrayBuffer").mockImplementation(() => new Promise(resolve => {finish = resolve; notifyReading();}));
            }
            return chunk;
        });
        const pending = uploadMediaFile(STUDIO_LIBRARY_ID, source, controller.signal);
        const rejected = expect(pending).rejects.toMatchObject({name: "AbortError"});
        await reading;
        expect(await db.media.count()).toBe(0);
        controller.abort();
        finish(new ArrayBuffer(256 * 1024));
        await rejected;
        expect(readCount).toBe(2);
        expect(await db.media.count()).toBe(0);
        expect(source.size).toBe(1024 * 1024 + 65);
        expect(Buffer.from(await source.arrayBuffer()).equals(Buffer.alloc(source.size))).toBe(true);
    });

    it("observes cancellation during the yield before reading the next chunk", async () => {
        const source = new File([new Uint8Array(1024 * 1024 + 65)], "source.png", {type: "image/png"});
        const slice = source.slice.bind(source);
        const controller = new AbortController();
        const read = vi.spyOn(source, "slice").mockImplementation((start, end, type) => {
            setTimeout(() => controller.abort(), 0);
            return slice(start, end, type);
        });
        await expect(uploadMediaFile(STUDIO_LIBRARY_ID, source, controller.signal)).rejects.toMatchObject({name: "AbortError"});
        expect(read).toHaveBeenCalledOnce();
        expect(await db.media.count()).toBe(0);
    });

    it("preserves a later chunk read failure without retaining a partial ready record", async () => {
        const source = new File([new Uint8Array(1024 * 1024 + 65)], "source.png", {type: "image/png"});
        const slice = source.slice.bind(source);
        const failure = new Error("later slice read failed");
        let reads = 0;
        vi.spyOn(source, "slice").mockImplementation((start, end, type) => {
            const chunk = slice(start, end, type);
            if (++reads === 2) vi.spyOn(chunk, "arrayBuffer").mockRejectedValue(failure);
            return chunk;
        });
        await expect(uploadMediaFile(STUDIO_LIBRARY_ID, source)).rejects.toBe(failure);
        expect(reads).toBe(2);
        expect(await db.media.count()).toBe(0);
        expect(Buffer.from(await source.arrayBuffer()).equals(Buffer.alloc(source.size))).toBe(true);
    });
});
