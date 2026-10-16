import {sha256Bytes} from "../media/sha256";
import {McpHostError} from "./mcpErrors";

export const browserMcpId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;
export const browserMcpDigest = (text: string): string => sha256Bytes(new TextEncoder().encode(text));
function primitive(item: unknown): boolean {return item === null || typeof item === "boolean" || typeof item === "string" || typeof item === "number" && Number.isFinite(item);}

/** Canonical bounded JSON rejects accessors, non-JSON data and depth before serialization. */
export function browserMcpJson(value: unknown, maximum = 16_384): string {
    let nodes = 0;
    const active = new Set<object>();
    function visit(item: unknown, depth: number): unknown {
        if (++nodes > 32_768 || depth > 40) throw new McpHostError("limit", "not_started", "browser_json");
        if (primitive(item)) return item;
        if (!item || typeof item !== "object" || active.has(item) || Object.getOwnPropertySymbols(item).length || !Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype) throw new McpHostError("invalid", "not_started", "browser_json");
        active.add(item);
        const descriptors = Object.getOwnPropertyDescriptors(item);
        if (Array.isArray(item) && (item.length > 32_768 || Object.keys(descriptors).length !== item.length + 1)) throw new McpHostError("limit", "not_started", "browser_json");
        const result: unknown[] | Record<string, unknown> = Array.isArray(item) ? [] : {};
        for (const key of Object.keys(descriptors).sort()) {
            if (Array.isArray(item) && key === "length") continue;
            const descriptor = descriptors[key];
            if (!descriptor.enumerable || !("value" in descriptor)) throw new McpHostError("invalid", "not_started", "browser_json");
            Object.defineProperty(result, key, {value: visit(descriptor.value, depth + 1), enumerable: true, configurable: true, writable: true});
        }
        active.delete(item);
        return result;
    }
    const json = JSON.stringify(visit(value, 0));
    if (new TextEncoder().encode(json).byteLength > maximum) throw new McpHostError("limit", "not_started", "browser_json");
    return json;
}

export function freezeBrowserMcp<T>(item: T): T {
    if (item && typeof item === "object" && !Object.isFrozen(item)) {
        for (const child of Object.values(item)) freezeBrowserMcp(child);
        Object.freeze(item);
    }
    return item;
}
