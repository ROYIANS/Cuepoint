import Dexie from "dexie";
import { expect, it } from "vitest";
import {browserDatabase} from "@/lib/storage/browserDatabase";
import {createBrowserProductStore} from "@/lib/storage/browser";
if (!browserDatabase) throw new Error("Historical migration comparator requires browser storage");
const rawDb=browserDatabase;
const db=createBrowserProductStore(rawDb);
import {deleteConnector, resolveConnector, upsertConnector} from "@/db/connectors";

it("deduplicates legacy connections without changing historical IDs, and rotates/revokes every alias", async () => {
  const schema = Object.fromEntries(rawDb.tables.filter(table => table.name !== "connectorAliases")
    .map(table => [table.name, [table.schema.primKey.src, ...table.schema.indexes.map(index => index.src)].join(",")]));
  schema.connectors = "id, definitionId, updatedAt";
  await db.delete();
  const legacy = new Dexie(db.name);
  legacy.version(19).stores(schema);
  await legacy.open();
  const old = { id: "legacy-old", definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://old.invalid/v1", apiKey: "old-key", updatedAt: "2026-01-01" };
  const current = { ...old, id: "legacy-new", baseUrl: "https://new.invalid/v1", apiKey: "new-key", updatedAt: "2026-02-01" };
  await legacy.table("connectors").bulkPut([old, current]);
  legacy.close();
  await db.open();
  expect(await db.connectors.toArray()).toEqual([current]);
  expect(await resolveConnector(old.id,db)).toEqual(old);
  expect(await resolveConnector(current.id,db)).toEqual(current);
  await expect(db.connectors.add({ ...current, id: "duplicate", definitionId: "apimart", protocol: "openai-compatible" })).rejects.toThrow();
  const updated = await upsertConnector({ definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://rotated.invalid/v1", apiKey: "rotated-key" },db);
  expect(updated.id).toBe(current.id);
  expect(await resolveConnector(old.id,db)).toMatchObject({ id: old.id, apiKey: "rotated-key", baseUrl: "https://rotated.invalid/v1" });
  await deleteConnector(updated.id,db);
  expect(await resolveConnector(old.id,db)).toBeUndefined();
  expect(await resolveConnector(current.id,db)).toBeUndefined();
});
