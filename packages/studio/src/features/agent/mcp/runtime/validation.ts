import {sha256Bytes} from "../../../../platform/media/sha256";

const encoder = new TextEncoder();
export function mcpRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("MCP 记录无效");
    return value as Record<string, unknown>;
}

export function mcpKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
    if (Object.keys(record).some(key => !allowed.includes(key))) throw new Error("MCP 记录包含不支持的字段");
}

export function mcpText(value: unknown, maximum: number): string {
    if (typeof value !== "string" || !value || value.length > maximum || encoder.encode(value).byteLength > maximum || (/[\p{Cc}\p{Cf}]/u.test(value) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))) throw new Error("MCP 文本无效或过长");
    return value;
}

export function mcpId(value: unknown): string {
    const id = mcpText(value, 128);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(id)) throw new Error("MCP 标识无效");
    return id;
}

export function mcpInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER - 1): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error("MCP 版本或计数无效");
    return value;
}

/** Reject cycles, accessors and non-JSON data before serialization; never invokes toJSON. */
export function mcpJson(value: unknown, maximumBytes: number, depthLimit = 32, nodeLimit = 16_384): string {
    let nodes = 0, lowerBytes = 0;
    const active = new Set<object>();
    function addBytes(length: number): void {
        lowerBytes += length;
        if (lowerBytes > maximumBytes) throw new Error("MCP 内容超过大小限制");
    }
    function container(item: object, depth: number): void {
        const array = Array.isArray(item);
        if (active.has(item) || !array && Object.getPrototypeOf(item) !== Object.prototype || Object.getOwnPropertySymbols(item).length) throw new Error("MCP 内容不是有效 JSON");
        const entries = Object.entries(Object.getOwnPropertyDescriptors(item));
        if (array && (item.length > nodeLimit || entries.length !== item.length + 1)) throw new Error("MCP 数组无效或过长");
        active.add(item);
        for (const [key, descriptor] of entries) {
            if (array && key === "length") continue;
            if (!descriptor.enumerable || !("value" in descriptor) || key.length > maximumBytes) throw new Error("MCP 内容不是有效 JSON");
            addBytes(encoder.encode(key).byteLength);
            walk(descriptor.value, depth + 1);
        }
        active.delete(item);
    }
    function walk(item: unknown, depth: number): void {
        if (++nodes > nodeLimit || depth > depthLimit) throw new Error("MCP 内容过于复杂");
        if (item === null) {addBytes(4); return;}
        switch (typeof item) {
            case "boolean": addBytes(5); return;
            case "number":
                if (!Number.isFinite(item)) throw new Error("MCP 内容不是有效 JSON");
                addBytes(1); return;
            case "string":
                if (item.length > maximumBytes) throw new Error("MCP 内容超过大小限制");
                addBytes(encoder.encode(item).byteLength); return;
            case "object": container(item, depth); return;
            case "bigint": case "function": case "symbol": case "undefined": throw new Error("MCP 内容不是有效 JSON");
        }
    }
    walk(value, 0);
    const json = JSON.stringify(value);
    if (encoder.encode(json).byteLength > maximumBytes) throw new Error("MCP 内容超过大小限制");
    return json;
}

/** Locale-independent ordering of protocol identities. */
export function mcpOrdinal(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

export function mcpDigest(value: string): string {return sha256Bytes(encoder.encode(value));}

export function freezeMcp<T>(value: T): T {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freezeMcp(child);
        Object.freeze(value);
    }
    return value;
}
