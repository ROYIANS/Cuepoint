import type {ConnectorConfig} from "@/domain/types";
import {connectorProviderId, ORIGIN_PROVIDERS} from "./connectorProviders";
import type {CatalogCost, CatalogEntry, CatalogSnapshot} from "./types";

type MatchTier = "provider" | "origin" | "canonical";

interface MatchedPrice extends CatalogCost {
    provider: string;
    modelId: string;
    /** Original-vendor price rather than the connector's own provider price. */
    reference: boolean;
}

export interface ModelMatch {
    tier: MatchTier;
    /** Resolved facts. `provider`/`id`/`name` come from the first candidate; conflicting fields are undefined. */
    entry: CatalogEntry;
    /** Only tiers "provider" and "origin" ever price a model. */
    price?: MatchedPrice;
}

interface Index {
    byProviderId: Map<string, Map<string, CatalogEntry>>;
    byId: Map<string, CatalogEntry[]>;
    byCanonical: Map<string, CatalogEntry[]>;
}

const indexes = new WeakMap<CatalogSnapshot, Index>();

function push<K>(map: Map<K, CatalogEntry[]>, key: K, entry: CatalogEntry): void {
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
}

function indexOf(snapshot: CatalogSnapshot): Index {
    let index = indexes.get(snapshot);
    if (index) return index;
    index = {byProviderId: new Map(), byId: new Map(), byCanonical: new Map()};
    for (const entry of snapshot.entries) {
        let ids = index.byProviderId.get(entry.provider);
        if (!ids) index.byProviderId.set(entry.provider, ids = new Map<string, CatalogEntry>());
        ids.set(entry.id, entry);
        push(index.byId, entry.id, entry);
        if (entry.canonicalId) push(index.byCanonical, entry.canonicalId, entry);
    }
    indexes.set(snapshot, index);
    return index;
}

type Strategy = "smallest" | "agree";

function number(values: (number | undefined)[], strategy: Strategy): number | undefined {
    if (strategy === "agree") return values.every(v => v !== undefined && v === values[0]) ? values[0] : undefined;
    const known = values.filter((v): v is number => v !== undefined);
    return known.length ? Math.min(...known) : undefined;
}

/** Vision conflicts are always unknown, never narrowed to a minimum. */
function vision(values: (boolean | undefined)[]): boolean | undefined {
    return values.every(v => v !== undefined && v === values[0]) ? values[0] : undefined;
}

function merge(candidates: CatalogEntry[], strategy: Strategy): CatalogEntry {
    const [first] = candidates;
    if (candidates.length === 1) return first;
    const context = number(candidates.map(c => c.context), strategy);
    const output = number(candidates.map(c => c.output), strategy);
    const imageInput = vision(candidates.map(c => c.imageInput));
    return {
        provider: first.provider, id: first.id, name: first.name,
        ...(first.canonicalId ? {canonicalId: first.canonicalId} : {}),
        ...(context !== undefined ? {context} : {}),
        ...(output !== undefined ? {output} : {}),
        ...(imageInput !== undefined ? {imageInput} : {}),
    };
}

function costsEqual(a: CatalogCost | undefined, b: CatalogCost | undefined): boolean {
    return a?.input === b?.input && a?.output === b?.output && a?.cacheRead === b?.cacheRead && a?.cacheWrite === b?.cacheWrite;
}

function priceOf(candidates: CatalogEntry[], reference: boolean): MatchedPrice | undefined {
    const [first] = candidates;
    if (!first.cost) return undefined;
    // Several vendors listing one id with different prices: no price rather than a guess.
    if (!candidates.every(c => costsEqual(c.cost, first.cost))) return undefined;
    return {...first.cost, provider: first.provider, modelId: first.id, reference};
}

/**
 * Layered, exact-id lookup (case-sensitive, no aliases):
 * 1. the connector's own provider; 2. original-vendor providers (reference prices);
 * 3. the same id (or a canonical id) across providers, only when all candidates share one
 * canonical model and agree per field. Prices never come from tier 3.
 * Pure: reads only the snapshot it is given.
 */
export function matchModel(
    snapshot: CatalogSnapshot,
    connector: Pick<ConnectorConfig, "definitionId" | "baseUrl">,
    modelId: string,
): ModelMatch | undefined {
    const id = modelId.trim();
    if (!id) return undefined;
    const index = indexOf(snapshot);
    const own = connectorProviderId(connector, snapshot.providerOrigins);
    const direct = own ? index.byProviderId.get(own)?.get(id) : undefined;
    if (direct) return {tier: "provider", entry: direct, price: priceOf([direct], false)};

    const origins = (index.byId.get(id) ?? []).filter(entry => entry.provider !== own && ORIGIN_PROVIDERS.has(entry.provider));
    if (origins.length) return {tier: "origin", entry: merge(origins, "smallest"), price: priceOf(origins, true)};

    const candidates = [...(index.byId.get(id) ?? []), ...(index.byCanonical.get(id) ?? [])]
        .filter((entry, position, all) => all.indexOf(entry) === position);
    const canonical = new Set(candidates.map(entry => entry.canonicalId));
    if (candidates.length && canonical.size === 1 && !canonical.has(undefined)) return {tier: "canonical", entry: merge(candidates, "agree")};
    return undefined;
}
