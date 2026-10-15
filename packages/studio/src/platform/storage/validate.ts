import {StorageError} from "./errors";
import type {EncodedValue, NativeBinaryRef, NativeSession, RowChange, StoreKey, WireRow} from "./protocol";
import {TABLE_NAMES} from "./schema";
import {decodeWireText} from "./wireText";

function invalid(): never {
    throw new StorageError("invalid", "Native storage returned an invalid response");
}

function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
    return value as Record<string, unknown>;
}

function closed(value: Record<string, unknown>, keys: readonly string[]): void {
    if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) invalid();
}

function string(value: unknown): string {
    if (typeof value !== "string") return invalid();
    return value;
}

function integer(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return invalid();
    return value;
}

function validateBinaryRef(raw: unknown): NativeBinaryRef {
    const value = object(raw);
    closed(value, ["version", "workspaceId", "binaryId", "byteLength", "contentHash", "mimeType"]);
    if (value.version !== 1 || !string(value.workspaceId) || !string(value.binaryId) || !/^[a-f0-9]{64}$/.test(string(value.contentHash))) return invalid();
    return {
        version: 1,
        workspaceId: string(value.workspaceId),
        binaryId: string(value.binaryId),
        byteLength: integer(value.byteLength),
        contentHash: string(value.contentHash),
        mimeType: string(value.mimeType)
    };
}

export function validateEncodedValue(raw: unknown): EncodedValue {
    if (!Array.isArray(raw) || typeof raw[0] !== "string") return invalid();
    const tag = raw[0];
    if (tag === "undef" || tag === "null") {
        if (raw.length !== 1) return invalid();
        return [tag];
    }
    if (raw.length !== 2) return invalid();
    const value: unknown = raw[1];
    switch (tag) {
        case "bool":
            if (typeof value !== "boolean") return invalid();
            return [tag, value];
        case "str":
            return [tag, string(value)];
        case "num": {
            if (typeof value === "number" && Number.isFinite(value)) return [tag, value];
            if (value === "NaN" || value === "Infinity" || value === "-Infinity" || value === "-0") return [tag, value];
            return invalid();
        }
        case "bytes":
        case "utf16": {
            if (!Array.isArray(value) || value.some(item => typeof item !== "number" || !Number.isInteger(item) || item < 0 || item > (tag === "bytes" ? 255 : 65535))) return invalid();
            return [tag, value as number[]];
        }
        case "date": {
            const date = string(value);
            if (!Number.isFinite(new Date(date).getTime())) return invalid();
            return [tag, date];
        }
        case "binary":
            return [tag, validateBinaryRef(value)];
        case "arr":
            if (!Array.isArray(value)) return invalid();
            return [tag, value.map(validateEncodedValue)];
        case "obj":
        case "obj16": {
            if (!Array.isArray(value)) return invalid();
            const seen = new Set<string>();
            const entries = value.map(entry => {
                if (!Array.isArray(entry) || entry.length !== 2) return invalid();
                const name = tag === "obj" ? string(entry[0]) : validateEncodedValue(["utf16", entry[0]])[1];
                const key = typeof name === "string" ? name : JSON.stringify(name);
                if (seen.has(key)) return invalid();
                seen.add(key);
                return [name, validateEncodedValue(entry[1])];
            });
            return (tag === "obj" ? [tag, entries] : [tag, entries]) as EncodedValue;
        }
        default:
            return invalid();
    }
}

export function validateWireRow(raw: unknown): WireRow {
    const value = object(raw);
    closed(value, ["key", "value"]);
    return {key: decodeWireText(value.key), value: validateEncodedValue(value.value)};
}

export function validateSession(raw: unknown): NativeSession & { changeSequence: number } {
    const value = object(raw);
    closed(value, ["version", "session", "workspaceId", "generation", "changeSequence"]);
    if (value.version !== 1 || !string(value.session) || !string(value.workspaceId)) return invalid();
    return {
        version: 1,
        session: string(value.session),
        workspaceId: string(value.workspaceId),
        generation: integer(value.generation),
        changeSequence: integer(value.changeSequence)
    };
}

function validateStoreKey(raw: unknown): StoreKey {
    const value = object(raw);
    closed(value, ["kind", "value"]);
    if (value.kind === "string") return {kind: "string", value: decodeWireText(value.value)};
    if (value.kind === "number") {
        if (typeof value.value === "number" && Number.isFinite(value.value)) return {
            kind: "number",
            value: value.value
        };
        if (value.value === "Infinity" || value.value === "-Infinity") return {kind: "number", value: value.value};
    }
    if (value.kind === "array" && Array.isArray(value.value)) return {
        kind: "array",
        value: value.value.map(validateStoreKey)
    };
    return invalid();
}

export function validateRowChange(raw: unknown): RowChange {
    const value = object(raw);
    closed(value, ["table", "key", "before", "after"]);
    if (!TABLE_NAMES.includes(value.table as never)) return invalid();
    const projections = (input: unknown) => Object.fromEntries(Object.entries(object(input)).map(([key, item]) => [key, validateStoreKey(item)]));
    return {
        table: value.table as RowChange["table"],
        key: decodeWireText(value.key),
        before: projections(value.before),
        after: projections(value.after)
    };
}
