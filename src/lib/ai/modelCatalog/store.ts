import {getDeviceSetting} from "@/db/deviceSettings";
import {matchModel, type ModelMatch} from "./match";
import type {CatalogSnapshot} from "./types";
import {parseBaselineSnapshot, parseSyncedSnapshot} from "./validate";
import type {ConnectorConfig} from "@/domain/types";

export const MODEL_CATALOG_KEY = "modelCatalog";

let current: CatalogSnapshot | undefined;
let generation = 0;
let initializing: Promise<void> | undefined;
const listeners = new Set<() => void>();

function publish(snapshot: CatalogSnapshot | undefined): void {
    current = snapshot;
    generation += 1;
    for (const listener of [...listeners]) listener();
}

async function loadBaseline(): Promise<CatalogSnapshot | undefined> {
    try {
        const module = await import("./baseline.generated.json");
        return parseBaselineSnapshot(module.default);
    } catch {
        return undefined;
    }
}

/**
 * Loads the synced catalog (device setting) or, when missing/invalid/unreadable, the lazily
 * imported baseline. Never throws. Run once at startup, before the first agent run; the
 * dynamic import happens here and nowhere in the synchronous query path.
 */
export function initModelCatalog(): Promise<void> {
    initializing ??= (async () => {
        const started = generation;
        const synced = await getDeviceSetting(MODEL_CATALOG_KEY, parseSyncedSnapshot);
        const snapshot = synced ?? await loadBaseline();
        if (snapshot && generation === started) publish(snapshot);
    })();
    return initializing;
}

/** Synchronous, memory-only. Undefined until `initModelCatalog` has finished. */
export function getModelCatalog(): CatalogSnapshot | undefined {
    return current;
}

export function subscribeModelCatalog(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/**
 * Synchronous lookup safe inside a database transaction: reads memory only and never awaits.
 * While the catalog is not loaded yet it answers "unknown" instead of throwing.
 */
export function lookupModel(connector: Pick<ConnectorConfig, "definitionId" | "baseUrl">, modelId: string): ModelMatch | undefined {
    return current ? matchModel(current, connector, modelId) : undefined;
}

export function resetModelCatalogForTests(): void {
    current = undefined;
    generation += 1;
    initializing = undefined;
    listeners.clear();
}
