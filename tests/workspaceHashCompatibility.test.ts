import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {describe, expect, it, vi} from "vitest";
import {Sha256, sha256Bytes} from "@/lib/sha256";
import {targetRevision} from "@/lib/productionRevision";
import {targetRevision as originalTargetRevision} from "./fixtures/workspace/originalProductionRevision";
import {uploadMediaFile} from "@/lib/media";
import {db} from "@/db/database";
import {STUDIO_LIBRARY_ID} from "@/domain/types";

describe("shared byte hashing compatibility", () => {
    it("retains the original production-revision source fixture bytes", () => {
        // Captured from 8b8b709e; do not rewrite the historical comparison input.
        const source = readFileSync(new URL("./fixtures/workspace/originalProductionRevision.ts", import.meta.url));
        expect(createHash("sha256").update(source).digest("hex")).toBe("1ee25abc919f5366adc71a3af1b43fb934d12da78acf2e00364ca4423636827e");
    });

    it("matches standard SHA-256 vectors across block/padding boundaries and binary bytes", () => {
        const vectors = [new Uint8Array(), new TextEncoder().encode("abc"), new TextEncoder().encode("素材🌹"),
            ...[55, 56, 63, 64, 65, 127, 128, 129, 8192].map(length => Uint8Array.from({length}, (_, index) => index % 256))];
        for (const input of vectors) {
            expect(sha256Bytes(input)).toBe(createHash("sha256").update(input).digest("hex"));
        }
    });

    it("matches incremental updates, partial views and finalization across arbitrary boundaries", () => {
        for (const length of [0, 1, 55, 56, 63, 64, 65, 127, 128, 129, 1024 * 1024 + 129]) {
            const backing = Uint8Array.from({length: length + 17}, (_, index) => index * 31 % 256);
            const input = backing.subarray(9, 9 + length);
            const expected = createHash("sha256").update(input).digest("hex");
            for (const chunkSize of [1, 7, 55, 56, 63, 64, 65, 511, 256 * 1024]) {
                const hash = new Sha256().update(new Uint8Array());
                for (let offset = 0; offset < input.length; offset += chunkSize) hash.update(input.subarray(offset, offset + chunkSize));
                expect(hash.digest()).toBe(expected);
                expect(hash.digest()).toBe(expected);
                expect(() => hash.update(new Uint8Array())).toThrow("finalized");
            }
        }
    });

    it("preserves the original canonical production revision across supported content", () => {
        const values: unknown[] = [undefined, null, true, false, 0, -0, 1, -123.456, "", "素材🌹", [], [undefined, null, "x"],
            {}, {z: 1, a: 2}, {a: 2, z: 1}, {nested: {revision: 3, extra: {b: undefined, a: [1, 2]}}, createdAt: "2026-10-10"}];
        for (let index = 0; index < 100; index++) values.push({id: `media-${index}`, fields: [index, `text ${index}`, index % 2 === 0], extra: {b: index + 1, a: index}});
        for (const value of values) expect(targetRevision(value)).toBe(originalTargetRevision(value));
        for (const value of [NaN, Infinity, new Date(), new Blob(["bytes"]), new Map(), Object.create(null) as unknown]) {
            expect(() => originalTargetRevision(value)).toThrow("不支持");
            expect(() => targetRevision(value)).toThrow("不支持");
        }
    });

    it("imports media when WebCrypto is absent, as on ordinary HTTP deployments", async () => {
        vi.stubGlobal("crypto", undefined);
        try {
            const result = await uploadMediaFile(STUDIO_LIBRARY_ID, new File(["plain-http"], "http.png", {type: "image/png"}));
            expect(await (await db.media.get(result.id))!.blob.text()).toBe("plain-http");
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
