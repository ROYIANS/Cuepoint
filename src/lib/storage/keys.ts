import {StorageError} from "./errors";
import type {StoreKey} from "./protocol";
import type {IndexDefinition, TableDefinition} from "./schema";

export function keyOf(value: unknown): StoreKey | null {
    if (typeof value === "string") return {kind: "string", value};
    if (typeof value === "number" && !Number.isNaN(value)) return {
        kind: "number",
        value: Number.isFinite(value) ? value : (value === Infinity ? "Infinity" : "-Infinity")
    };
    if (Array.isArray(value)) {
        const keys = value.map(keyOf);
        if (keys.every((key): key is StoreKey => key !== null)) return {kind: "array", value: keys};
    }
    return null;
}

const keyOrder = {number: 0, string: 1, array: 2} as const;

export function compareKeys(left: StoreKey, right: StoreKey): number {
    if (left.kind !== right.kind) return keyOrder[left.kind] - keyOrder[right.kind];
    if (left.kind === "array" && right.kind === "array") {
        for (let i = 0; i < Math.min(left.value.length, right.value.length); i++) {
            const result = compareKeys(left.value[i], right.value[i]);
            if (result !== 0) return result;
        }
        return left.value.length - right.value.length;
    }
    if (left.kind === "string" && right.kind === "string") return left.value === right.value ? 0 : (left.value < right.value ? -1 : 1);
    if (left.kind === "number" && right.kind === "number") {
        const a = Number(left.value), b = Number(right.value);
        return a === b ? 0 : (a < b ? -1 : 1);
    }
    throw new StorageError("invalid", "Inconsistent storage index key");
}

export function propertyAt(row: unknown, path: string): unknown {
    let value: unknown = row;
    for (const part of path.split(".")) {
        if (value === null || typeof value !== "object" || !Object.hasOwn(value, part)) return undefined;
        value = (value as Record<string, unknown>)[part];
    }
    return value;
}

export function primaryKey(row: unknown, definition: TableDefinition): string {
    const key = propertyAt(row, definition.keyPath);
    if (typeof key !== "string") throw new StorageError("invalid", "Product row primary key must be a string");
    return key;
}

export function indexKey(row: unknown, index: IndexDefinition): StoreKey | null {
    return keyOf(index.keyPaths.length === 1 ? propertyAt(row, index.keyPaths[0]) : index.keyPaths.map(path => propertyAt(row, path)));
}

export function requireKey(value: unknown): StoreKey {
    const key = keyOf(value);
    if (!key) throw new StorageError("invalid", "Invalid product index key");
    return key;
}
