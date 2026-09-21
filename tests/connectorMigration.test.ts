import Dexie from "dexie";
import { expect, it } from "vitest";
import { db } from "@/db/database";
import { deleteConnector, resolveConnector, upsertConnector } from "@/db/repo";

it("deduplicates legacy connections without changing historical IDs, and rotates/revokes every alias", async () => {
  const schema = Object.fromEntries(db.tables.filter(table => table.name !== "connectorAliases")
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
  expect(await resolveConnector(old.id)).toEqual(old);
  expect(await resolveConnector(current.id)).toEqual(current);
  await expect(db.connectors.add({ ...current, id: "duplicate", definitionId: "apimart", protocol: "openai-compatible" })).rejects.toThrow();
  const updated = await upsertConnector({ definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://rotated.invalid/v1", apiKey: "rotated-key" });
  expect(updated.id).toBe(current.id);
  expect(await resolveConnector(old.id)).toMatchObject({ id: old.id, apiKey: "rotated-key", baseUrl: "https://rotated.invalid/v1" });
  await deleteConnector(updated.id);
  expect(await resolveConnector(old.id)).toBeUndefined();
  expect(await resolveConnector(current.id)).toBeUndefined();
});
