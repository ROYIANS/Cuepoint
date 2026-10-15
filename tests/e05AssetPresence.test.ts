import {describe, expect, it} from "vitest";
import {db} from "@/platform/product/store";
import {readAssetPresence} from "@/features/library/queries/assetLibrary";
import {emptyCharacter, emptyProp, emptyScene, emptyStyle} from "@/features/library/models/newAssets";
import {actualStoreScope, interceptStoreBackend} from "./helpers/storeBackendFaults";

describe("E05 exact owner/kind/id readonly asset inspection", () => {
    it("propagates a failed real readonly read without reporting absence or touching the row", async () => {
        const row = emptyCharacter("owner"); await db.characters.put(row);
        const failure = new Error("inspection unavailable");
        let reads = 0;
        const interceptor = await interceptStoreBackend(db, "characters", "get", async () => {reads++; throw failure;});
        try {
            await expect(readAssetPresence({kind: "character", ownerId: "owner", id: row.id}, db)).rejects.toBe(failure);
            expect(reads).toBe(1);
        } finally {interceptor.mockRestore();}
        await expect(db.characters.get(row.id)).resolves.toEqual(row);
    });
    it.each([
        {kind: "character", table: "characters", create: emptyCharacter},
        {kind: "scene", table: "scenes", create: emptyScene},
        {kind: "prop", table: "props", create: emptyProp},
        {kind: "style", table: "styles", create: emptyStyle},
    ] as const)("$kind distinguishes exact, foreign and absent rows in the sole readonly owner", async ({kind, table, create}) => {
        const row = {...create("owner"), id: "exact"};
        // Each table is populated through its real adapter without a fabricated read receipt.
        if (kind === "character") await db.characters.put({...emptyCharacter("owner"), id: row.id});
        else if (kind === "scene") await db.scenes.put({...emptyScene("owner"), id: row.id});
        else if (kind === "prop") await db.props.put({...emptyProp("owner"), id: row.id});
        else await db.styles.put({...emptyStyle("owner"), id: row.id});
        const scopes: Array<{mode: string; names: string[]}> = [];
        const transactions = new Set<string>();
        const interceptor = await interceptStoreBackend(db, table, "get", async (backend, _args, next) => {
            scopes.push(await actualStoreScope(db, backend)); transactions.add(backend.transactionId); return next();
        });
        try {
            expect(await readAssetPresence({kind, ownerId: "owner", id: row.id}, db)).toBe("present");
            expect(await readAssetPresence({kind, ownerId: "foreign", id: row.id}, db)).toBe("foreign");
            expect(await readAssetPresence({kind, ownerId: "owner", id: "missing"}, db)).toBe("missing");
            expect(scopes).toEqual(Array.from({length: 3}, () => ({mode: "readonly", names: [table]})));
            expect(transactions.size).toBe(3);
        } finally {interceptor.mockRestore();}
        await expect(db[table].count()).resolves.toBe(1);
        await expect(db.transaction("r", [table], tx => readAssetPresence({kind, ownerId: "owner", id: row.id}, tx))).resolves.toBe("present");
    });
});
