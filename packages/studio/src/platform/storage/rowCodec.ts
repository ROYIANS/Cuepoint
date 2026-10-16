import {encodeLocalValue, isBinaryReference, type PrepareBlob} from "./codec";
import {StorageError} from "./errors";
import type {EncodedValue, NativeBinaryRef} from "./protocol";
import type {TableName} from "./tableTypes";

function carrier(table: TableName, path: readonly string[]): boolean {
    if (table === "media") return path.length === 1 && path[0] === "blob";
    if (table !== "materialVersions") return false;
    return (path.length === 2 && path[0] === "payload" && path[1] === "blob") ||
        (path.length === 4 && path[0] === "payload" && path[1] === "media" && /^\d+$/.test(path[2]) && path[3] === "blob");
}

function validateCarriers(table: TableName, value: unknown, path: readonly string[] = [], ancestors = new Set<object>(), adopt?: (reference: NativeBinaryRef) => void): void {
    if (value instanceof Blob || isBinaryReference(value)) {
        if (!carrier(table, path)) throw new StorageError("invalid", "Binary values are only allowed in registered product carriers");
        if (isBinaryReference(value)) adopt?.(value);
        return;
    }
    if (value === null || typeof value !== "object") return;
    if (ancestors.has(value)) throw new StorageError("invalid", "Stored value contains a cycle");
    ancestors.add(value);
    try {
        if (Array.isArray(value)) value.forEach((item, index) => validateCarriers(table, item, [...path, String(index)], ancestors, adopt));
        else if (Object.getPrototypeOf(value) === Object.prototype) for (const key of Object.keys(value)) validateCarriers(table, (value as Record<string, unknown>)[key], [...path, key], ancestors, adopt);
    } finally {
        ancestors.delete(value);
    }
}

export async function encodeProductRow(table: TableName, row: object, prepareBlob: PrepareBlob, adopt?: (reference: NativeBinaryRef) => void): Promise<EncodedValue> {
    validateCarriers(table, row, [], new Set(), adopt);
    return encodeLocalValue(row, prepareBlob);
}
