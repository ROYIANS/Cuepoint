// Pure Models.dev projection shared by the build-time baseline script and the runtime sync.
// Plain ESM (no Node imports) so Node can run it directly and the app bundle can import it.

function positive(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function price(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function monthsBefore(iso, months) {
    const date = new Date(iso);
    date.setUTCMonth(date.getUTCMonth() - months);
    return date.toISOString().slice(0, 10);
}

/** Models.dev dates are YYYY-MM or YYYY-MM-DD; both sort lexically. */
function isRecent(releaseDate, cutoff) {
    return typeof releaseDate === "string" && releaseDate.slice(0, 7) >= cutoff.slice(0, 7);
}

/** Connector providers keep deprecated models: users still run them (deepseek-chat is the connector default). */
function isTextChat(model, keepDeprecated) {
    if (model.status === "deprecated" && !keepDeprecated) return false;
    if (model.type !== undefined && model.type !== "chat") return false;
    return Array.isArray(model.modalities?.output) && model.modalities.output.includes("text");
}

/** Compact projection: missing facts stay absent (never 0); context tiers are dropped. */
export function projectEntry(provider, model) {
    const entry = {provider, id: model.id, name: model.name};
    if (typeof model.canonical_model_id === "string" && model.canonical_model_id) entry.canonicalId = model.canonical_model_id;
    const context = positive(model.limit?.context);
    const output = positive(model.limit?.output);
    if (context) entry.context = context;
    if (output) entry.output = output;
    if (Array.isArray(model.modalities?.input)) entry.imageInput = model.modalities.input.includes("image");
    if (typeof model.reasoning === "boolean") entry.reasoning = model.reasoning;
    if (typeof model.tool_call === "boolean") entry.toolCall = model.tool_call;
    const cost = {};
    const input = price(model.cost?.input);
    const out = price(model.cost?.output);
    const cacheRead = price(model.cost?.cache_read);
    const cacheWrite = price(model.cost?.cache_write);
    if (input !== undefined) cost.input = input;
    if (out !== undefined) cost.output = out;
    if (cacheRead !== undefined) cost.cacheRead = cacheRead;
    if (cacheWrite !== undefined) cost.cacheWrite = cacheWrite;
    if (Object.keys(cost).length) entry.cost = cost;
    if (typeof model.release_date === "string" && model.release_date) entry.releaseDate = model.release_date;
    return entry;
}

export function originOf(api) {
    try {
        const url = new URL(api);
        return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
    } catch {
        return undefined;
    }
}

export function compareEntries(a, b) {
    return a.provider < b.provider ? -1 : a.provider > b.provider ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The "common scope": connector providers in full, original vendors limited to recent text
 * models. `now` is the cutoff reference (snapshot time at build, sync time at runtime).
 */
export function projectCommonScope(providers, scope, now) {
    const cutoff = monthsBefore(now, scope.recentMonths);
    const full = new Set(scope.fullProviders);
    const origin = new Set(scope.originProviders);
    const entries = [];
    const providerOrigins = {};
    for (const providerId of new Set([...full, ...origin])) {
        const provider = providers[providerId];
        if (!provider) continue;
        const apiOrigin = typeof provider.api === "string" ? originOf(provider.api) : undefined;
        if (apiOrigin) providerOrigins[providerId] = apiOrigin;
        for (const model of Object.values(provider.models)) {
            if (!isTextChat(model, full.has(providerId))) continue;
            if (!full.has(providerId) && !isRecent(model.release_date, cutoff)) continue;
            entries.push(projectEntry(providerId, model));
        }
    }
    entries.sort(compareEntries);
    return {entries, providerOrigins};
}

/** Pure projection of a Models.dev snapshot into the committed baseline (no wall clock). */
export function projectBaseline({providers, snapshotGeneratedAt, packageVersion}, scope, format) {
    const {entries, providerOrigins} = projectCommonScope(providers, scope, snapshotGeneratedAt);
    return {format, packageVersion, snapshotGeneratedAt, providerOrigins, entries};
}
