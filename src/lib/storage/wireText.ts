import {StorageError} from "./errors";
import type {StoreKey, WireText} from "./protocol";

/** JSON cannot carry an unpaired UTF16 unit through Rust's Unicode strings. */
export function encodeWireText(value: string): WireText {
    for (let index = 0; index < value.length; index++) {
        const unit = value.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                index++;
                continue;
            }
            return {utf16: Array.from({length: value.length}, (_, position) => value.charCodeAt(position))};
        }
        if (unit >= 0xdc00 && unit <= 0xdfff) return {utf16: Array.from({length: value.length}, (_, position) => value.charCodeAt(position))};
    }
    return value;
}

export function decodeWireText(raw: unknown): string {
    if (typeof raw === "string") return raw;
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length !== 1 || !("utf16" in raw) || !Array.isArray(raw.utf16)) throw new StorageError("invalid", "Invalid native UTF16 text");
    const units: unknown[] = raw.utf16;
    if (units.some(unit => typeof unit !== "number" || !Number.isInteger(unit) || unit < 0 || unit > 65535)) throw new StorageError("invalid", "Invalid native UTF16 text");
    let text = "";
    for (let offset = 0; offset < units.length; offset += 8192) text += String.fromCharCode(...units.slice(offset, offset + 8192) as number[]);
    return text;
}

export function encodeWireKey(key: StoreKey): unknown {
    if (key.kind === "string") return {kind: "string", value: encodeWireText(key.value)};
    if (key.kind === "array") return {kind: "array", value: key.value.map(encodeWireKey)};
    return key;
}
