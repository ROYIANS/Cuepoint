/** USD per million tokens. Missing facts stay undefined; never 0. */
export interface CatalogCost {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
}

export interface CatalogEntry {
    /** Models.dev provider id. */
    provider: string;
    /** Provider-scoped model id. */
    id: string;
    name: string;
    canonicalId?: string;
    context?: number;
    output?: number;
    imageInput?: boolean;
    reasoning?: boolean;
    toolCall?: boolean;
    cost?: CatalogCost;
    releaseDate?: string;
}

export interface CatalogSnapshot {
    source: "baseline" | "synced";
    /** `@opencode-ai/models` version the baseline was built from. */
    packageVersion?: string;
    /** ISO time of a user-triggered sync. */
    syncedAt?: string;
    /** Provider id -> API origin (only providers that publish one and appear in `entries`). */
    providerOrigins: Readonly<Record<string, string>>;
    entries: readonly CatalogEntry[];
}

/** Frozen price snapshot, shaped for a later `AgentRun.modelPricing`. */
export interface ModelPricing {
    source: "baseline" | "synced";
    provider: string;
    modelId: string;
    /** True when the price comes from the model's original vendor, not the connector's own provider. */
    reference: boolean;
    currency: "USD";
    unit: "per_million_tokens";
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    capturedAt: string;
}
