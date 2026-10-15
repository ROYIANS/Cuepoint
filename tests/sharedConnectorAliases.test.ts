import {describe, expect, it} from "vitest";
import {db} from "@/platform/product/store";
import {deleteConnector, resolveConnector, upsertConnector} from "@/features/settings/commands/connectors";
import {interceptStoreBackend} from "./helpers/storeBackendFaults";

async function fixture() {
    const canonical = await upsertConnector({definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://old.fixture.invalid/v1", apiKey: "fixture-old"});
    const aliases = ["retained-a", "retained-b"].map(id => ({...canonical, id}));
    const unrelated = {...canonical, id: "other-definition", definitionId: "aihubmix" as const};
    await db.connectorAliases.bulkAdd([...aliases, unrelated]);
    return {canonical, aliases, unrelated};
}

describe("current connector alias business owner", () => {
    it("rotates and revokes all retained identities atomically while preserving unrelated definitions", async () => {
        const {canonical, aliases, unrelated} = await fixture();
        const updated = await upsertConnector({definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://rotated.fixture.invalid/v1", apiKey: "fixture-rotated"});
        expect(updated.id).toBe(canonical.id);
        db.close(); await db.open();
        for (const alias of aliases) expect(await resolveConnector(alias.id)).toEqual({...updated, id: alias.id});
        expect(await resolveConnector(unrelated.id)).toEqual(unrelated);
        await deleteConnector(aliases[0].id);
        expect(await db.connectors.get(canonical.id)).toBeUndefined();
        for (const alias of aliases) expect(await resolveConnector(alias.id)).toBeUndefined();
        expect(await db.connectorAliases.toArray()).toEqual([unrelated]);
    });

    it("rolls back the canonical rotation and every alias when a later alias write fails", async () => {
        const {canonical, aliases, unrelated} = await fixture();
        let reached = 0;
        const fault = await interceptStoreBackend(db, "connectorAliases", "mutate", async (backend) => {
            reached++;
            expect((await backend.get("connectors", [canonical.id]))[0]).toMatchObject({apiKey: "fixture-rotated"});
            throw new Error("late alias write failed");
        });
        try {
            await expect(upsertConnector({definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://rotated.fixture.invalid/v1", apiKey: "fixture-rotated"})).rejects.toThrow("late alias write failed");
        } finally {fault.mockRestore();}
        expect(reached).toBe(1);
        expect(await db.connectors.get(canonical.id)).toEqual(canonical);
        expect(await db.connectorAliases.toArray()).toEqual([...aliases, unrelated].sort((a, b) => a.id.localeCompare(b.id)));
    });
});
