import {db as productDb} from "../../../platform/product/store";
import type {ProductStore} from "../../../platform/storage/types";

const WORLD_TABS = ["setting", "characters", "scenes", "props", "styles"] as const;
export type WorldTab = (typeof WORLD_TABS)[number];
export type AssetKind = "character" | "scene" | "prop" | "style";
const ASSET_TABLES = {character: "characters", scene: "scenes", prop: "props", style: "styles"} as const;

/** Presence is inspection only: a present row never authorizes replaying a delete. */
export async function readAssetPresence(
    {kind, ownerId, id}: {kind: AssetKind; ownerId: string; id: string},
    store: ProductStore = productDb,
): Promise<"missing" | "present" | "foreign"> {
    const table = ASSET_TABLES[kind];
    return store.transaction("r", [table], async tx => {
        const row = await tx[table].get(id);
        if (!row) return "missing";
        return row.projectId === ownerId ? "present" : "foreign";
    });
}

export function parseWorldTab(value: unknown): WorldTab | undefined {
    return typeof value === "string" && WORLD_TABS.includes(value as WorldTab)
        ? value as WorldTab
        : undefined;
}

/** Search authored text without exposing internal IDs, slots or provenance. */
export function matchesAssetSearch(asset: object, query: string): boolean {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return true;
    return Object.entries(asset).some(([key, value]) =>
        !["id", "projectId", "createdAt", "updatedAt"].includes(key) &&
        typeof value === "string" && value.toLocaleLowerCase().includes(needle));
}
