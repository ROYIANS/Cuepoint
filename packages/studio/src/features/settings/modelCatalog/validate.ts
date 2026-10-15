import {DEVICE_SETTING_MAX_BYTES} from "../commands/deviceSettings";
import type {CatalogCost, CatalogEntry, CatalogSnapshot} from "./types";

export const MAX_CATALOG_ENTRIES = 20000;
const COST_KEYS = ["input", "output", "cacheRead", "cacheWrite"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 512;
}

function optionalCount(value: unknown): boolean {
    return value === undefined || (typeof value === "number" && Number.isSafeInteger(value) && value > 0);
}

function optionalBoolean(value: unknown): boolean {
    return value === undefined || typeof value === "boolean";
}

function parseCost(value: unknown): CatalogCost | undefined | null {
    if (value === undefined) return undefined;
    if (!isRecord(value)) return null;
    const cost: CatalogCost = {};
    for (const key of Object.keys(value)) if (!(COST_KEYS as readonly string[]).includes(key)) return null;
    for (const key of COST_KEYS) {
        const price = value[key];
        if (price === undefined) continue;
        if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return null;
        cost[key] = price;
    }
    return cost;
}

function validFacts(value: Record<string, unknown>): boolean {
    if (!text(value.provider) || !text(value.id) || !text(value.name)) return false;
    if (value.canonicalId !== undefined && !text(value.canonicalId)) return false;
    if (!optionalCount(value.context) || !optionalCount(value.output)) return false;
    if (!optionalBoolean(value.imageInput) || !optionalBoolean(value.reasoning) || !optionalBoolean(value.toolCall)) return false;
    return value.releaseDate === undefined || (typeof value.releaseDate === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(value.releaseDate));
}

/** Validates one projected entry; the sync drops (rather than fails on) a single bad one. */
export function parseCatalogEntry(value: unknown): CatalogEntry | undefined {
    if (!isRecord(value) || !validFacts(value)) return undefined;
    const cost = parseCost(value.cost);
    if (cost === null) return undefined;
    const fact = <K extends keyof CatalogEntry>(key: K): Pick<CatalogEntry, K> | Record<string, never> =>
        value[key] !== undefined ? {[key]: value[key]} as Pick<CatalogEntry, K> : {};
    return {
        provider: value.provider as string, id: value.id as string, name: value.name as string,
        ...fact("canonicalId"), ...fact("context"), ...fact("output"), ...fact("imageInput"),
        ...fact("reasoning"), ...fact("toolCall"),
        ...(cost && Object.keys(cost).length ? {cost} : {}),
        ...fact("releaseDate"),
    };
}

function parseEntries(value: unknown): CatalogEntry[] | undefined {
    if (!Array.isArray(value) || value.length > MAX_CATALOG_ENTRIES) return undefined;
    const entries: CatalogEntry[] = [];
    const seen = new Set<string>();
    for (const raw of value) {
        const entry = parseCatalogEntry(raw);
        if (!entry) return undefined;
        const key = `${entry.provider}\u0000${entry.id}`;
        if (seen.has(key)) return undefined;
        seen.add(key);
        entries.push(entry);
    }
    return entries;
}

function parseOrigins(value: unknown): Record<string, string> | undefined {
    if (!isRecord(value)) return undefined;
    const origins: Record<string, string> = {};
    for (const [provider, origin] of Object.entries(value)) {
        if (!text(origin)) return undefined;
        try {
            const url = new URL(origin);
            if ((url.protocol !== "https:" && url.protocol !== "http:") || url.origin !== origin) return undefined;
        } catch {
            return undefined;
        }
        origins[provider] = origin;
    }
    return origins;
}

function isoTime(value: unknown): value is string {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/** Strict: any malformed entry rejects the whole snapshot (committed data must be exact). */
export function parseBaselineSnapshot(raw: unknown): CatalogSnapshot | undefined {
    if (!isRecord(raw) || raw.format !== 1 || !text(raw.packageVersion)) return undefined;
    const entries = parseEntries(raw.entries);
    const providerOrigins = parseOrigins(raw.providerOrigins);
    if (!entries || !providerOrigins) return undefined;
    return {source: "baseline", packageVersion: raw.packageVersion, providerOrigins, entries};
}

/** Stored form of a synced catalog: `{v:1, syncedAt, providerOrigins, entries}`, within the device-setting budget. */
export function parseSyncedSnapshot(raw: unknown): CatalogSnapshot | undefined {
    if (!isRecord(raw) || raw.v !== 1 || !isoTime(raw.syncedAt)) return undefined;
    const entries = parseEntries(raw.entries);
    const providerOrigins = parseOrigins(raw.providerOrigins);
    if (!entries || !providerOrigins) return undefined;
    if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > DEVICE_SETTING_MAX_BYTES) return undefined;
    return {source: "synced", syncedAt: raw.syncedAt, providerOrigins, entries};
}
