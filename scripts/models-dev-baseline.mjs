import {readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE_PATH = join(root, "src/lib/ai/modelCatalog/scope.json");
export const BASELINE_PATH = join(root, "src/lib/ai/modelCatalog/baseline.generated.json");
export const BASELINE_FORMAT = 1;

function positive(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function price(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function monthsBefore(iso, months) {
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

function originOf(api) {
    try {
        const url = new URL(api);
        return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
    } catch {
        return undefined;
    }
}

/** Pure projection of a Models.dev snapshot into the committed baseline (no wall clock). */
export function projectBaseline({providers, snapshotGeneratedAt, packageVersion}, scope) {
    const cutoff = monthsBefore(snapshotGeneratedAt, scope.recentMonths);
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
    const byKey = (a, b) => (a.provider < b.provider ? -1 : a.provider > b.provider ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    entries.sort(byKey);
    return {format: BASELINE_FORMAT, packageVersion, snapshotGeneratedAt, providerOrigins, entries};
}

/** Differences ignoring the wall-clock `generatedAt` stamp. Empty means equal. */
export function compareBaseline(committed, fresh) {
    const strip = ({generatedAt: _ignored, ...rest}) => rest;
    const problems = [];
    if (committed?.packageVersion !== fresh.packageVersion) problems.push(`package version ${committed?.packageVersion} != installed ${fresh.packageVersion}`);
    if (JSON.stringify(strip(committed ?? {})) !== JSON.stringify(strip(fresh))) problems.push("baseline content differs from a fresh projection");
    return problems;
}

async function loadInstalled() {
    const snapshot = await import("@opencode-ai/models/snapshot");
    const pkg = JSON.parse(readFileSync(join(root, "node_modules/@opencode-ai/models/package.json"), "utf8"));
    return {providers: snapshot.providers, snapshotGeneratedAt: snapshot.generatedAt, packageVersion: pkg.version};
}

function declaredVersion() {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return pkg.devDependencies?.["@opencode-ai/models"];
}

async function main(command) {
    const scope = JSON.parse(readFileSync(SCOPE_PATH, "utf8"));
    const fresh = projectBaseline(await loadInstalled(), scope);
    if (command === "generate") {
        writeFileSync(BASELINE_PATH, `${JSON.stringify({...fresh, generatedAt: new Date().toISOString()})}\n`);
        console.log(`models-dev baseline: ${fresh.entries.length} entries, package ${fresh.packageVersion}`);
        return;
    }
    if (command === "verify") {
        const problems = [];
        if (declaredVersion() !== fresh.packageVersion) problems.push(`package.json pins ${declaredVersion()} but ${fresh.packageVersion} is installed`);
        problems.push(...compareBaseline(JSON.parse(readFileSync(BASELINE_PATH, "utf8")), fresh));
        if (problems.length) {
            console.error(`models-dev baseline verification failed:\n- ${problems.join("\n- ")}\nRun pnpm models-dev:baseline and commit the result.`);
            process.exitCode = 1;
            return;
        }
        console.log(`models-dev baseline OK (${fresh.entries.length} entries, package ${fresh.packageVersion})`);
        return;
    }
    console.error("usage: models-dev-baseline.mjs generate|verify");
    process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2]);
