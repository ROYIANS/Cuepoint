import {StorageError, UnknownCommitError} from "./errors";
import type {BinaryClaim, EncodedValue, NativeBinaryRef, NativeSession} from "./protocol";

const binaryReferences = new WeakSet<object>();
type PreparedReference = {claim: BinaryClaim; session: NativeSession; state: "prepared" | "reserved" | "committed" | "discarded" | "unknown"; operationId?: string};
const preparedReferences = new WeakMap<object, PreparedReference>();
const preparedClaims = new Map<string, WeakRef<PreparedReference> | PreparedReference>();
const MAX_PREPARED_CLAIMS = 4096;
const preparedClaimKey = (claim: BinaryClaim, session: NativeSession) => `${session.session}:${session.generation}:${session.workspaceId}:${claim.stageId}`;
const retainedPreparedClaim = (value: WeakRef<PreparedReference> | PreparedReference | undefined) => value instanceof WeakRef ? value.deref() : value;

/** Storage-internal registration after the native reply and current session were validated. */
export function registerPreparedBinaryReference(claim: BinaryClaim, session: NativeSession): NativeBinaryRef {
    const reference = registerBinaryReference(claim.reference);
    if (reference.workspaceId !== session.workspaceId) throw new StorageError("invalid", "Prepared binary belongs to another workspace");
    const key = preparedClaimKey(claim, session);
    const existing = retainedPreparedClaim(preparedClaims.get(key));
    if (existing && (existing.state === "committed" || existing.state === "discarded" || JSON.stringify(existing.claim) !== JSON.stringify({...claim, reference})))
        throw new StorageError("closed", "Prepared binary claim was consumed or replaced");
    if (!existing) {
        if (preparedClaims.size >= MAX_PREPARED_CLAIMS) for (const [stored, value] of preparedClaims) if (!retainedPreparedClaim(value)) preparedClaims.delete(stored);
        if (preparedClaims.size >= MAX_PREPARED_CLAIMS) throw new StorageError("unavailable", "Prepared binary claim retention limit reached");
    }
    const prepared: PreparedReference = existing ?? {claim: {...claim, reference}, session: {...session}, state: "prepared"};
    preparedReferences.set(reference, prepared);
    if (!existing) preparedClaims.set(key, new WeakRef(prepared));
    return reference;
}

/** A clone preserves capability identity; a JSON-shaped reference cannot acquire a claim. */
export function reservePreparedBinaryReference(reference: NativeBinaryRef, session: NativeSession, operationId: string): BinaryClaim | undefined {
    const prepared = preparedReferences.get(reference);
    if (!prepared || prepared.state === "committed") return undefined;
    if (prepared.state === "unknown") throw new UnknownCommitError(prepared.operationId!, prepared.session.workspaceId);
    if (prepared.state === "discarded" || prepared.session.session !== session.session || prepared.session.workspaceId !== session.workspaceId || prepared.session.generation !== session.generation)
        throw new StorageError("closed", "Prepared binary is no longer available in this session");
    if (prepared.state === "reserved" && prepared.operationId !== operationId) throw new StorageError("conflict", "Prepared binary is already reserved by another transaction");
    prepared.state = "reserved";
    prepared.operationId = operationId;
    return prepared.claim;
}

export function settlePreparedBinaryReference(reference: NativeBinaryRef, operationId: string, outcome: "committed" | "discarded" | "unknown"): void {
    const prepared = preparedReferences.get(reference);
    if (prepared?.state === "reserved" && prepared.operationId === operationId) {
        prepared.state = outcome;
        // A lost JS reference cannot erase consumed/uncertain stage identity and
        // let the original native reply mint a fresh preparation capability.
        preparedClaims.set(preparedClaimKey(prepared.claim, prepared.session), prepared);
    }
}

function wellFormed(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
        const unit = value.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(++index);
            if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
        } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    }
    return true;
}

/** Keep reconstruction within the engine's argument limit for arbitrary stored text. */
function fromUtf16Units(units: readonly number[]): string {
    let result = "";
    for (let offset = 0; offset < units.length; offset += 8192) result += String.fromCharCode(...units.slice(offset, offset + 8192));
    return result;
}

/** Only refs produced by the native owner/decoder are binary tokens; user keys never reserve syntax. */
export function registerBinaryReference(value: NativeBinaryRef): NativeBinaryRef {
    if (value.version !== 1 || !value.workspaceId || !value.binaryId || !Number.isSafeInteger(value.byteLength) || value.byteLength < 0 || !/^[a-f0-9]{64}$/.test(value.contentHash) || typeof value.mimeType !== "string") {
        throw new StorageError("invalid", "Invalid managed binary reference");
    }
    const reference = Object.freeze({...value});
    binaryReferences.add(reference);
    return reference;
}

export function isBinaryReference(value: unknown): value is NativeBinaryRef {
    return value !== null && typeof value === "object" && binaryReferences.has(value);
}

export type PrepareBlob = (blob: Blob) => Promise<NativeBinaryRef>;

function encodeNumber(value: number): EncodedValue {
    if (Number.isNaN(value)) return ["num", "NaN"];
    if (value === Infinity) return ["num", "Infinity"];
    if (value === -Infinity) return ["num", "-Infinity"];
    if (Object.is(value, -0)) return ["num", "-0"];
    return ["num", value];
}

export async function encodeLocalValue(value: unknown, prepareBlob?: PrepareBlob, ancestors = new Set<object>()): Promise<EncodedValue> {
    if (value === undefined) return ["undef"];
    if (value === null) return ["null"];
    if (typeof value === "string") return wellFormed(value) ? ["str", value] : ["utf16", Array.from({length: value.length}, (_, index) => value.charCodeAt(index))];
    if (typeof value === "boolean") return ["bool", value];
    if (typeof value === "number") return encodeNumber(value);
    if (isBinaryReference(value)) return ["binary", value];
    if (value instanceof Blob) {
        if (!prepareBlob) throw new StorageError("invalid", "Blob requires managed byte preparation");
        return ["binary", registerBinaryReference(await prepareBlob(value))];
    }
    if (value instanceof Date) {
        if (!Number.isFinite(value.getTime())) throw new StorageError("invalid", "Invalid stored date");
        return ["date", value.toISOString()];
    }
    if (value instanceof Uint8Array) return ["bytes", Array.from(value)];
    if (typeof value !== "object" || (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value))) {
        throw new StorageError("invalid", "Stored value contains an unsupported type");
    }
    if (ancestors.has(value)) throw new StorageError("invalid", "Stored value contains a cycle");
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            const result: EncodedValue[] = [];
            for (const item of value) result.push(await encodeLocalValue(item, prepareBlob, ancestors));
            return ["arr", result];
        }
        const entries: Array<[string, EncodedValue]> = [];
        for (const key of Object.keys(value)) entries.push([key, await encodeLocalValue((value as Record<string, unknown>)[key], prepareBlob, ancestors)]);
        if (entries.some(([key]) => !wellFormed(key))) return ["obj16", entries.map(([key, item]): [number[], EncodedValue] => [Array.from({length: key.length}, (_, index) => key.charCodeAt(index)), item])];
        return ["obj", entries];
    } finally {
        ancestors.delete(value);
    }
}

export function decodeLocalValue(value: EncodedValue): unknown {
    switch (value[0]) {
        case "undef":
            return undefined;
        case "null":
            return null;
        case "str":
        case "bool":
            return value[1];
        case "utf16":
            return fromUtf16Units(value[1]);
        case "num": {
            const number = value[1];
            if (typeof number === "number") return number;
            if (number === "-0") return -0;
            if (number === "NaN") return NaN;
            return number === "Infinity" ? Infinity : -Infinity;
        }
        case "arr":
            return value[1].map(decodeLocalValue);
        case "obj":
        case "obj16": {
            const result: Record<string, unknown> = {};
            for (const [raw, item] of value[1]) {
                const key = typeof raw === "string" ? raw : fromUtf16Units(raw);
                if (Object.hasOwn(result, key)) throw new StorageError("invalid", "Duplicate stored object key");
                Object.defineProperty(result, key, {
                    value: decodeLocalValue(item),
                    enumerable: true,
                    writable: true,
                    configurable: true
                });
            }
            return result;
        }
        case "date":
            return new Date(value[1]);
        case "bytes":
            return new Uint8Array(value[1]);
        case "binary":
            return registerBinaryReference(value[1]);
    }
}

function registerClonedReferences(original: unknown, clone: unknown, seen = new Set<object>()): void {
    if (!original || !clone || typeof original !== "object" || typeof clone !== "object") return;
    if (isBinaryReference(original)) {
        binaryReferences.add(clone);
        const prepared = preparedReferences.get(original);
        if (prepared) preparedReferences.set(clone, prepared);
        Object.freeze(clone);
        return;
    }
    if (seen.has(original)) return;
    seen.add(original);
    if (Array.isArray(original) && Array.isArray(clone)) {
        original.forEach((item, index) => registerClonedReferences(item, clone[index], seen));
    } else if (Object.getPrototypeOf(original) === Object.prototype && Object.getPrototypeOf(clone) === Object.prototype) {
        for (const key of Object.keys(original)) registerClonedReferences((original as Record<string, unknown>)[key], (clone as Record<string, unknown>)[key], seen);
    }
}

export function cloneStoredValue<T>(value: T): T {
    const clone = structuredClone(value);
    registerClonedReferences(value, clone);
    return clone;
}
