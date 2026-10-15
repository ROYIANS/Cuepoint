import {describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {actualStoreScope, installStoreHook, interceptStoreBackend} from "./helpers/storeBackendFaults";
import type {NativeQuery} from "@/platform/storage/protocol";
import {emptyShot} from "@/features/video/models/newRecords";
import {readProjectCoverIds} from "@/features/projects/queries/studioLibraryQueries";
import type {Shot} from "@/features/video/models/shots";

function shot(id: string, projectId: string, order: number, mediaId?: string, episodeId = "episode-a"): Shot {
    const row = {...emptyShot(projectId, episodeId, order, String(order), 3), id};
    if (mediaId) row.firstFrame.result = {mediaId, kind: "image"};
    return row;
}

// The original gallery's stable sort semantics, independent of the new reducer.
function originalCover(rows: Shot[], projectId: string) {
    return rows.filter(row => row.projectId === projectId).sort((a, b) => a.order - b.order)
        .find(row => row.firstFrame.result?.mediaId)?.firstFrame.result?.mediaId;
}

describe("scoped gallery fallback query", () => {
    it("keeps input-key ties and project-wide order across episodes; skips early missing results", async () => {
        await db.shots.bulkPut([
            shot("z-tie", "owner", 2, "second-input-tie", "episode-a"),
            shot("a-tie", "owner", 2, "first-input-tie", "episode-b"),
            shot("0-no-result", "owner", 0),
            shot("later", "owner", 9, "later"),
            shot("foreign", "other", -1, "other-cover"),
        ]);
        const cover = await readProjectCoverIds(["owner"]);
        expect(cover.get("owner")).toBe("first-input-tie");
        expect(cover.get("owner")).toBe(originalCover(await db.shots.toArray(), "owner"));
        expect(cover.has("other")).toBe(false);
    });

    it("keeps a selected but missing media ID; does not silently choose a later available frame", async () => {
        await db.shots.bulkPut([shot("early", "owner", 1, "missing-media"), shot("late", "owner", 2, "later-media")]);
        expect(await db.media.get("missing-media")).toBeUndefined();
        expect(await readProjectCoverIds(["owner"])).toEqual(new Map([["owner", "missing-media"]]));
    });

    it("returns no fallback for absent owners or owners without an eligible first frame", async () => {
        const noResult = shot("no-result", "owner", 1);
        noResult.clip.result = {mediaId: "clip-is-not-a-cover", kind: "image"};
        await db.shots.put(noResult);
        expect(await readProjectCoverIds(["owner", "absent"])).toEqual(new Map());
    });

    it("does not read shots for an explicit-cover-only/empty fallback owner set", async () => {
        const read = vi.spyOn(db.shots, "where");
        expect(await readProjectCoverIds([])).toEqual(new Map());
        expect(read).not.toHaveBeenCalled();
        read.mockRestore();
    });

    it("reads each scoped row once, deduplicates owner IDs and retains only cover IDs", async () => {
        const rows = Array.from({length: 300}, (_, i) => ({
            ...shot(String(i).padStart(4, "0"), i < 100 ? "visible" : "filtered-out", i, i % 7 ? `media-${i}` : undefined),
            content: "large authored content ".repeat(1000),
        }));
        await db.shots.bulkPut(rows);
        const seen: Shot[] = [];
        const reading = (row: Shot) => {seen.push(row); return row;};
        const hook = await installStoreHook(db, "shots", "reading", reading);
        try {
            const result = await readProjectCoverIds(["visible", "visible"]);
            expect(seen).toHaveLength(100);
            expect(seen.every(row => row.projectId === "visible")).toBe(true);
            expect(result).toEqual(new Map([["visible", "media-1"]]));
            expect(JSON.stringify([...result]).length).toBeLessThan(JSON.stringify(seen).length / 1000);
        } finally {hook.mockRestore();}
    });

    it("deduplicates owners and opens exact ranges in one shared readonly transaction", async () => {
        await db.shots.bulkPut([shot("a", "owner-a", 1, "cover-a"), shot("b", "owner-b", 1, "cover-b"), shot("c", "owner-c", 1, "cover-c")]);
        const transactions = new Set<string>();
        const ranges: NativeQuery[] = [];
        const scopes: Array<{mode: string; names: string[]}> = [];
        const read = await interceptStoreBackend(db, "shots", "query", async (backend, args, next) => {
            transactions.add(backend.transactionId);
            ranges.push(args[0] as NativeQuery);
            scopes.push(await actualStoreScope(db, backend));
            return next();
        });
        try {
            expect(await readProjectCoverIds(["owner-a", "owner-c", "owner-a", "owner-b"])).toEqual(new Map([
                ["owner-a", "cover-a"], ["owner-b", "cover-b"], ["owner-c", "cover-c"],
            ]));
            expect(ranges).toHaveLength(3);
            expect(ranges.every(query => query.index === "projectId" && query.selector.kind === "equals")).toBe(true);
            expect(ranges.map(query => query.selector.kind === "equals" ? query.selector.keys[0] : undefined)).toEqual([
                {kind: "string", value: "owner-a"}, {kind: "string", value: "owner-c"}, {kind: "string", value: "owner-b"},
            ]);
            expect(transactions.size).toBe(1);
            expect(scopes).toEqual(Array.from({length: 3}, () => ({mode: "readonly", names: ["shots"]})));
        } finally {read.mockRestore();}
    });

    it("matches original covers for a varied multi-owner, multi-episode data set", async () => {
        await db.shots.bulkPut(Array.from({length: 800}, (_, i) => shot(
            String(i).padStart(4, "0"), `owner-${i % 8}`, (i * 17) % 31,
            i % 5 === 0 ? undefined : `media-${i}`, `episode-${i % 3}`,
        )));
        const rows = await db.shots.toArray();
        const owners = Array.from({length: 8}, (_, i) => `owner-${i}`);
        const result = await readProjectCoverIds(owners);
        for (const owner of owners) expect(result.get(owner)).toBe(originalCover(rows, owner));
    });

    it("refreshes a live scoped cover when a relevant frame is edited or deleted", async () => {
        await db.shots.bulkPut([shot("a", "owner", 1, "initial"), shot("b", "owner", 2, "fallback")]);
        const values: Array<Map<string, string>> = [];
        let notify: (() => void) | undefined;
        const stop = db.observe(tx => readProjectCoverIds(["owner"], tx), {next:value => {values.push(value); notify?.();}, error:error => {throw error;}});
        async function until(expected: string) {
            if (values.at(-1)?.get("owner") === expected) return;
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error(`Missing cover ${expected}`)), 3000);
                notify = () => {if (values.at(-1)?.get("owner") === expected) {clearTimeout(timeout); notify = undefined; resolve();}};
            });
        }
        try {
            await until("initial");
            await db.shots.put(shot("a", "owner", 1, "updated"));
            await until("updated");
            await db.shots.delete("a");
            await until("fallback");
        } finally {stop();}
    });
});
