import {sha256Bytes} from "../media/sha256";

function canonical(value: unknown): string {
    if (value === undefined) return '["undefined"]';
    if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `["array",${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        return `["object",${Object.keys(value).sort().map((key) => `${JSON.stringify(key)},${canonical((value as Record<string, unknown>)[key])}`).join(",")}]`;
    }
    throw new Error("版本快照包含不支持的数据类型");
}

// Synchronous SHA-256 keeps revision checks inside IndexedDB transactions. The
// token includes ALL entity content, including timestamps/extra, but reveals none
// of that content. It is a conflict token, never an authorization credential.
export function targetRevision(value: unknown): string {
    const input = new TextEncoder().encode(canonical(value));
    return `sha256-v1:${sha256Bytes(input)}`;
}
