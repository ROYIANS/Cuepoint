import {getDeviceSetting} from "../commands/deviceSettings";
import {matchModel, type ModelMatch} from "./match";
import type {CatalogSnapshot} from "./types";
import {parseBaselineSnapshot, parseSyncedSnapshot} from "./validate";
import type {ConnectorConfig} from "../models/connector";
import type {ModelPricing} from "../../agent/models/agent";

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
        try {
            const started = generation;
            const synced = await getDeviceSetting(MODEL_CATALOG_KEY, parseSyncedSnapshot);
            const snapshot = synced ?? await loadBaseline();
            if (snapshot && generation === started) publish(snapshot);
        } catch {
            // The catalog is advisory: a failed load leaves every lookup "unknown".
        }
    })();
    return initializing;
}

/** Synchronous, memory-only. Undefined until `initModelCatalog` has finished. */
export function getModelCatalog(): CatalogSnapshot | undefined {
    return current;
}

export function subscribeModelCatalog(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Synchronous lookup safe inside a database transaction: reads memory only and never awaits.
 * While the catalog is not loaded yet it answers "unknown" instead of throwing.
 */
export function lookupModel(connector: Pick<ConnectorConfig, "definitionId" | "baseUrl">, modelId: string): ModelMatch | undefined {
    return current ? matchModel(current, connector, modelId) : undefined;
}

/**
 * Lookup for callers that only know the connector definition id (the limit/vision consumers
 * receive no base URL). An `openai-compatible` connector then has no provider of its own and
 * resolves through the original-vendor tier, as the previous catalog did.
 */
export function lookupModelByDefinition(definitionId: string | undefined, modelId: string): ModelMatch | undefined {
    return lookupModel({definitionId: (definitionId ?? "") as ConnectorConfig["definitionId"], baseUrl: ""}, modelId);
}

/** Frozen USD price for a new run, or undefined when no price is known. Reads memory only. */
export function snapshotModelPricing(
    connector: Pick<ConnectorConfig, "definitionId" | "baseUrl">, modelId: string, capturedAt: string,
): ModelPricing | undefined {
    const price = lookupModel(connector, modelId)?.price;
    if (!current || !price) return undefined;
    const rates = {
        ...(price.input !== undefined ? {input: price.input} : {}),
        ...(price.output !== undefined ? {output: price.output} : {}),
        ...(price.cacheRead !== undefined ? {cacheRead: price.cacheRead} : {}),
        ...(price.cacheWrite !== undefined ? {cacheWrite: price.cacheWrite} : {}),
    };
    if (!Object.keys(rates).length) return undefined;
    return {
        source: current.source, provider: price.provider, modelId: price.modelId, reference: price.reference,
        currency: "USD", unit: "per_million_tokens", ...rates, capturedAt,
    };
}

/** Makes a freshly persisted sync result current and notifies subscribers. Memory only. */
export function applySyncedSnapshot(snapshot: CatalogSnapshot): void {
    publish(snapshot);
}

/** Falls back to the built-in baseline in memory (after the synced row was deleted). */
export async function restoreBaselineSnapshot(): Promise<void> {
    const baseline = await loadBaseline();
    publish(baseline);
}

export function resetModelCatalogForTests(): void {
    current = undefined;
    generation += 1;
    initializing = undefined;
    listeners.clear();
}
