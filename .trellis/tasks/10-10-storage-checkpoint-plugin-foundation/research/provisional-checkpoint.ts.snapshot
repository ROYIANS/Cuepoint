import {BROWSER_WORKSPACE_ID, mediaWorkspaceRef, workspaceId} from "@/lib/workspace";
import type {WorkspaceId, WorkspaceRef} from "@/lib/workspace";
import {Sha256} from "@/lib/sha256";

/** The only portable checkpoint format implemented by this protocol child. */
export const CHECKPOINT_FORMAT = "cuepoint.protocol-fixture.v1" as const;
export const CHECKPOINT_SCHEMA_VERSION = 1 as const;
export const CHECKPOINT_COVERAGE_KIND = "partial" as const;
export const CHECKPOINT_CHUNK_SIZE = 256 * 1024;

type JsonObject = Record<string, unknown>;
export type CheckpointFormat = typeof CHECKPOINT_FORMAT;
export type CheckpointCoverageKind = typeof CHECKPOINT_COVERAGE_KIND;

export class CheckpointValidationError extends Error {
    readonly code = "checkpoint-validation" as const;

    constructor(message: string) {
        super(message);
    }
}

export class CheckpointCanceledError extends DOMException {
    constructor() {
        super("Checkpoint operation canceled", "AbortError");
    }
}

export interface PartialCheckpointCoverage {
    readonly kind: CheckpointCoverageKind;
    readonly included: readonly ["project", "media"];
    readonly omitted: readonly string[];
}

export interface CheckpointProjectRecord {
    readonly kind: "project";
    readonly id: string;
    readonly title: string;
}

export interface CheckpointMediaRecord {
    readonly kind: "media";
    readonly id: string;
    readonly projectId: string;
    readonly title?: string;
    readonly mediaWorkspaceRef: WorkspaceRef;
    readonly binaryId: string;
}

export type CheckpointRecord = CheckpointProjectRecord | CheckpointMediaRecord;

export interface CheckpointBinaryEntry {
    readonly binaryId: string;
    readonly mediaId: string;
    readonly projectId: string;
    readonly mediaWorkspaceRef: WorkspaceRef;
    readonly mimeType: string;
    readonly byteLength: number;
    readonly sha256: string;
}

export interface CheckpointManifest {
    readonly format: CheckpointFormat;
    readonly schemaVersion: typeof CHECKPOINT_SCHEMA_VERSION;
    readonly workspaceId: WorkspaceId;
    readonly projectId: string;
    readonly revisionId: string;
    readonly parentRevisionIds: readonly string[];
    readonly coverage: PartialCheckpointCoverage;
    readonly records: readonly CheckpointRecord[];
    readonly binaries: readonly CheckpointBinaryEntry[];
}

export type BinarySource = Blob | Uint8Array | ArrayBuffer;

export interface CheckpointBinaryInput {
    readonly binaryId: string;
    readonly mediaId: string;
    readonly projectId: string;
    readonly mimeType: string;
    readonly bytes: BinarySource;
}

export interface CheckpointBuildInput {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly parentRevisionIds?: readonly string[];
    readonly coverage?: PartialCheckpointCoverage;
    readonly records: readonly CheckpointRecord[];
    readonly binaries: readonly CheckpointBinaryInput[];
}

/** A binary snapshot exposes a copy on every read; caller mutation cannot alter the prepared bytes. */
export interface PreparedBinary {
    readonly entry: CheckpointBinaryEntry;
    readonly bytes: Uint8Array;
}

export interface PreparedCheckpoint {
    readonly manifest: CheckpointManifest;
    readonly binaries: readonly PreparedBinary[];
}

export interface VerifiedCheckpoint {
    readonly manifest: CheckpointManifest;
    readonly binaries: readonly PreparedBinary[];
}

export interface CheckpointApplicationReceipt {
    readonly kind: "application-receipt";
    readonly workspaceId: WorkspaceId;
    readonly revisionId: string;
    readonly applied: boolean;
    readonly alreadyApplied: boolean;
}

/** The application owner performs its own atomic ledger check and commit. */
export interface CheckpointApplicationPort {
    apply(checkpoint: VerifiedCheckpoint, signal?: AbortSignal): Promise<CheckpointApplicationReceipt>;
}

function isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function object(value: unknown, keys: readonly string[], label: string): JsonObject {
    if (!isObject(value)) throw new CheckpointValidationError(`${label} must be an object`);
    for (const key of Object.keys(value)) {
        if (!keys.includes(key)) throw new CheckpointValidationError(`${label} contains unsupported field ${key}`);
    }
    return value;
}

function text(value: unknown, label: string): string {
    if (typeof value !== "string" || value.length === 0 || value.trim().length === 0) {
        throw new CheckpointValidationError(`${label} must be a non-empty string`);
    }
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code < 32 || code === 127) throw new CheckpointValidationError(`${label} contains a control character`);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) throw new CheckpointValidationError(`${label} contains invalid Unicode`);
            index += 1;
        } else if (code >= 0xdc00 && code <= 0xdfff) {
            throw new CheckpointValidationError(`${label} contains invalid Unicode`);
        }
    }
    return value;
}

function identifier(value: unknown, label: string): string {
    return text(value, label);
}

function hash(value: unknown, label: string): string {
    const result = text(value, label);
    if (!/^[0-9a-f]{64}$/.test(result)) throw new CheckpointValidationError(`${label} must be a lowercase SHA-256 digest`);
    return result;
}

function mime(value: unknown): string {
    const result = text(value, "binary mimeType");
    if (!/^[\w!#$&^.+-]+\/[\w!#$&^.+-]+(?:\s*;.*)?$/.test(result)) {
        throw new CheckpointValidationError("binary mimeType is invalid");
    }
    return result;
}

function safeByteLength(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new CheckpointValidationError("binary byteLength is invalid");
    }
    return value;
}

function assertNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new CheckpointCanceledError();
}

function macrotask(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            try {
                assertNotAborted(signal);
                resolve();
            } catch (error) {
                reject(error);
            }
        }, 0);
        if (signal?.aborted) {
            clearTimeout(timer);
            reject(new CheckpointCanceledError());
        }
    });
}

function freezeRef(ref: WorkspaceRef): WorkspaceRef {
    return Object.freeze({workspaceId: ref.workspaceId, projectId: ref.projectId, relativePath: ref.relativePath});
}

function readWorkspaceRef(value: unknown, label: string): WorkspaceRef {
    const raw = object(value, ["workspaceId", "projectId", "relativePath"], label);
    const id = workspaceId(text(raw.workspaceId, `${label}.workspaceId`));
    const projectId = identifier(raw.projectId, `${label}.projectId`);
    const relativePath = text(raw.relativePath, `${label}.relativePath`);
    return freezeRef({workspaceId: id, projectId, relativePath});
}

function ensurePortableWorkspace(value: unknown): WorkspaceId {
    const id = workspaceId(text(value, "workspaceId"));
    if (id === BROWSER_WORKSPACE_ID) throw new CheckpointValidationError("browser-local is not a portable workspace identity");
    return id;
}

function readCoverage(value: unknown): PartialCheckpointCoverage {
    const raw = object(value, ["kind", "included", "omitted"], "coverage");
    if (raw.kind !== CHECKPOINT_COVERAGE_KIND) throw new CheckpointValidationError("coverage must declare partial coverage");
    if (!Array.isArray(raw.included) || raw.included.length !== 2 || raw.included[0] !== "project" || raw.included[1] !== "media") {
        throw new CheckpointValidationError("coverage included fields are invalid");
    }
    if (!Array.isArray(raw.omitted) || raw.omitted.some(item => typeof item !== "string" || item.trim().length === 0)) {
        throw new CheckpointValidationError("coverage omitted fields are invalid");
    }
    const omitted = [...raw.omitted].sort(exactCompare);
    if (new Set(omitted).size !== omitted.length) throw new CheckpointValidationError("coverage omitted fields contain duplicates");
    return Object.freeze({kind: CHECKPOINT_COVERAGE_KIND, included: ["project", "media"] as ["project", "media"], omitted: Object.freeze(omitted)});
}

function readRecord(value: unknown, workspace: WorkspaceId, projectId: string): CheckpointRecord {
    const raw = object(value, ["kind", "id", "title", "projectId", "mediaWorkspaceRef", "binaryId"], "record");
    if (raw.kind === "project") {
        if (!Object.hasOwn(raw, "id") || !Object.hasOwn(raw, "title") || Object.hasOwn(raw, "projectId") || Object.hasOwn(raw, "mediaWorkspaceRef") || Object.hasOwn(raw, "binaryId")) {
            throw new CheckpointValidationError("project record fields are invalid");
        }
        const id = identifier(raw.id, "project record id");
        if (id !== projectId) throw new CheckpointValidationError("project record does not belong to manifest project");
        return Object.freeze({kind: "project", id, title: text(raw.title, "project record title")});
    }
    if (raw.kind !== "media") throw new CheckpointValidationError("record kind is unsupported");
    if (!Object.hasOwn(raw, "id") || !Object.hasOwn(raw, "projectId") || !Object.hasOwn(raw, "mediaWorkspaceRef") || !Object.hasOwn(raw, "binaryId")) {
        throw new CheckpointValidationError("media record fields are invalid");
    }
    const id = identifier(raw.id, "media record id");
    const owner = identifier(raw.projectId, "media record projectId");
    if (owner !== projectId) throw new CheckpointValidationError("media record belongs to another project");
    const ref = readWorkspaceRef(raw.mediaWorkspaceRef, "media record mediaWorkspaceRef");
    const expected = mediaWorkspaceRef(workspace, owner, id);
    if (ref.workspaceId !== expected.workspaceId || ref.projectId !== expected.projectId || ref.relativePath !== expected.relativePath) {
        throw new CheckpointValidationError("media record workspace reference is not canonical");
    }
    const title = raw.title === undefined ? undefined : text(raw.title, "media record title");
    return Object.freeze(title === undefined ? {kind: "media", id, projectId: owner, mediaWorkspaceRef: ref, binaryId: identifier(raw.binaryId, "media record binaryId")} : {kind: "media", id, projectId: owner, title, mediaWorkspaceRef: ref, binaryId: identifier(raw.binaryId, "media record binaryId")});
}

function readBinary(value: unknown, workspace: WorkspaceId, projectId: string): CheckpointBinaryEntry {
    const raw = object(value, ["binaryId", "mediaId", "projectId", "mediaWorkspaceRef", "mimeType", "byteLength", "sha256"], "binary");
    const binaryId = identifier(raw.binaryId, "binary binaryId");
    const mediaId = identifier(raw.mediaId, "binary mediaId");
    const owner = identifier(raw.projectId, "binary projectId");
    if (owner !== projectId) throw new CheckpointValidationError("binary belongs to another project");
    const ref = readWorkspaceRef(raw.mediaWorkspaceRef, "binary mediaWorkspaceRef");
    const expected = mediaWorkspaceRef(workspace, owner, mediaId);
    if (ref.workspaceId !== expected.workspaceId || ref.projectId !== expected.projectId || ref.relativePath !== expected.relativePath) {
        throw new CheckpointValidationError("binary workspace reference is not canonical");
    }
    return Object.freeze({binaryId, mediaId, projectId: owner, mediaWorkspaceRef: ref, mimeType: mime(raw.mimeType), byteLength: safeByteLength(raw.byteLength), sha256: hash(raw.sha256, "binary sha256")});
}

function canonicalValue(value: unknown): string {
    if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
    if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalValue(value[key])}`).join(",")}}`;
    throw new CheckpointValidationError("checkpoint contains an unsupported value");
}

function exactCompare(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function revisionContent(input: Omit<CheckpointManifest, "revisionId">): Omit<CheckpointManifest, "revisionId"> {
    return {
        ...input,
        parentRevisionIds: [...input.parentRevisionIds].sort(exactCompare),
        coverage: {...input.coverage, omitted: [...input.coverage.omitted].sort()},
        records: [...input.records].sort((left, right) => exactCompare(`${left.kind}:${left.id}`, `${right.kind}:${right.id}`)),
        binaries: [...input.binaries].sort((left, right) => exactCompare(left.binaryId, right.binaryId)),
    };
}

function revisionFor(input: Omit<CheckpointManifest, "revisionId">): string {
    return `sha256-v1:${new Sha256().update(new TextEncoder().encode(canonicalValue(revisionContent(input)))).digest()}`;
}

function freezeManifest(input: Omit<CheckpointManifest, "revisionId"> & {revisionId: string}): CheckpointManifest {
    return Object.freeze({
        format: input.format,
        schemaVersion: input.schemaVersion,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        revisionId: input.revisionId,
        parentRevisionIds: Object.freeze([...input.parentRevisionIds]),
        coverage: Object.freeze({kind: input.coverage.kind, included: Object.freeze(["project", "media"] as ["project", "media"]), omitted: Object.freeze([...input.coverage.omitted])}),
        records: Object.freeze([...input.records]),
        binaries: Object.freeze([...input.binaries]),
    });
}

/** Validate and defensively snapshot a manifest received from an unknown boundary. */
export function validateCheckpointManifest(value: unknown): CheckpointManifest {
    const raw = object(value, ["format", "schemaVersion", "workspaceId", "projectId", "revisionId", "parentRevisionIds", "coverage", "records", "binaries"], "checkpoint manifest");
    if (raw.format !== CHECKPOINT_FORMAT || raw.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) throw new CheckpointValidationError("checkpoint format or schema version is unsupported");
    const workspace = ensurePortableWorkspace(raw.workspaceId);
    const projectId = identifier(raw.projectId, "manifest projectId");
    const revisionId = text(raw.revisionId, "manifest revisionId");
    if (!/^sha256-v1:[0-9a-f]{64}$/.test(revisionId)) throw new CheckpointValidationError("manifest revisionId is invalid");
    if (!Array.isArray(raw.parentRevisionIds)) throw new CheckpointValidationError("manifest parentRevisionIds must be an array");
    const parents = raw.parentRevisionIds.map((parent, index) => {
        const value = text(parent, `manifest parentRevisionIds[${index}]`);
        if (!/^sha256-v1:[0-9a-f]{64}$/.test(value)) throw new CheckpointValidationError("manifest parent revision is invalid");
        return value;
    }).sort(exactCompare);
    if (new Set(parents).size !== parents.length) throw new CheckpointValidationError("manifest parent revisions contain duplicates");
    if (parents.includes(revisionId)) throw new CheckpointValidationError("manifest cannot be its own parent");
    const coverage = readCoverage(raw.coverage);
    if (!Array.isArray(raw.records) || raw.records.length === 0) throw new CheckpointValidationError("manifest records must not be empty");
    const records = raw.records.map(record => readRecord(record, workspace, projectId));
    const recordIds = records.map(record => record.id);
    if (new Set(recordIds).size !== recordIds.length) throw new CheckpointValidationError("manifest records contain duplicate IDs");
    if (!records.some(record => record.kind === "project" && record.id === projectId)) throw new CheckpointValidationError("manifest is missing its project record");
    if (!Array.isArray(raw.binaries)) throw new CheckpointValidationError("manifest binaries must be an array");
    const binaries = raw.binaries.map(binary => readBinary(binary, workspace, projectId));
    if (new Set(binaries.map(binary => binary.binaryId)).size !== binaries.length) throw new CheckpointValidationError("manifest binaries contain duplicate IDs");
    if (new Set(binaries.map(binary => binary.mediaId)).size !== binaries.length) throw new CheckpointValidationError("manifest binaries contain duplicate media IDs");
    const mediaRecords = records.filter((record): record is CheckpointMediaRecord => record.kind === "media");
    const mediaById = new Map(mediaRecords.map(record => [record.id, record]));
    const binaryById = new Map(binaries.map(binary => [binary.binaryId, binary]));
    for (const record of mediaRecords) {
        const binary = binaryById.get(record.binaryId);
        if (!binary || binary.mediaId !== record.id || binary.projectId !== record.projectId) throw new CheckpointValidationError("media record binary reference is incomplete");
        if (binary.mediaWorkspaceRef.relativePath !== record.mediaWorkspaceRef.relativePath) throw new CheckpointValidationError("media record binary path does not close");
    }
    for (const binary of binaries) {
        const record = mediaById.get(binary.mediaId);
        if (!record || record.binaryId !== binary.binaryId || record.projectId !== binary.projectId) throw new CheckpointValidationError("binary is not referenced by a media record");
    }
    const candidate: Omit<CheckpointManifest, "revisionId"> = {format: CHECKPOINT_FORMAT, schemaVersion: CHECKPOINT_SCHEMA_VERSION, workspaceId: workspace, projectId, parentRevisionIds: parents, coverage, records, binaries};
    if (revisionFor(candidate) !== revisionId) throw new CheckpointValidationError("manifest revision does not match canonical content");
    return freezeManifest({...candidate, revisionId});
}

/** Build a canonical immutable manifest. Binary bytes are prepared separately. */
export function createCheckpointManifest(input: Omit<CheckpointBuildInput, "binaries"> & {binaries: readonly CheckpointBinaryEntry[]}): CheckpointManifest {
    const workspace = ensurePortableWorkspace(input.workspaceId);
    const projectId = identifier(input.projectId, "projectId");
    const coverage = input.coverage === undefined ? Object.freeze({kind: CHECKPOINT_COVERAGE_KIND, included: ["project", "media"] as ["project", "media"], omitted: Object.freeze(["all-production-tables", "credentials", "runtime-claims", "opaque-history-results"])}) : readCoverage(input.coverage);
    const records = input.records.map(record => readRecord(record, workspace, projectId));
    const binaries = input.binaries.map(binary => readBinary(binary, workspace, projectId));
    const parentRevisionIds = (input.parentRevisionIds ?? []).map(parent => text(parent, "parentRevisionId")).sort(exactCompare);
    const candidate: Omit<CheckpointManifest, "revisionId"> = {format: CHECKPOINT_FORMAT, schemaVersion: CHECKPOINT_SCHEMA_VERSION, workspaceId: workspace, projectId, parentRevisionIds, coverage, records, binaries};
    const manifest = freezeManifest({...candidate, revisionId: revisionFor(candidate)});
    return validateCheckpointManifest(manifest);
}

/** Deterministic JSON wire form; callers should not hand-edit this string. */
export function encodeCheckpointManifest(manifest: CheckpointManifest): string {
    const validated = validateCheckpointManifest(manifest);
    return canonicalValue(validated);
}

export function decodeCheckpointManifest(input: string | unknown): CheckpointManifest {
    if (typeof input === "string") {
        let parsed: unknown;
        try {
            parsed = JSON.parse(input) as unknown;
        } catch {
            throw new CheckpointValidationError("checkpoint manifest JSON is invalid");
        }
        return validateCheckpointManifest(parsed);
    }
    return validateCheckpointManifest(input);
}

async function sourceBytes(source: BinarySource, signal?: AbortSignal): Promise<{readonly bytes: Uint8Array; readonly sha256: string}> {
    assertNotAborted(signal);
    const size = source instanceof Blob ? source.size : source instanceof ArrayBuffer ? source.byteLength : source.byteLength;
    if (!Number.isSafeInteger(size) || size <= 0) throw new CheckpointValidationError("binary source size is invalid");
    const output = new Uint8Array(size);
    const hashState = new Sha256();
    for (let offset = 0; offset < size; offset += CHECKPOINT_CHUNK_SIZE) {
        assertNotAborted(signal);
        const end = Math.min(offset + CHECKPOINT_CHUNK_SIZE, size);
        const chunk = source instanceof Blob ? new Uint8Array(await source.slice(offset, end).arrayBuffer()) : source instanceof ArrayBuffer ? new Uint8Array(source.slice(offset, end)) : source.slice(offset, end);
        assertNotAborted(signal);
        if (chunk.byteLength !== end - offset) throw new CheckpointValidationError("binary source is truncated");
        output.set(chunk, offset);
        hashState.update(chunk);
        if (end < size) await macrotask(signal);
    }
    return Object.freeze({bytes: output, sha256: hashState.digest()});
}

function clonePreparedBinary(entry: CheckpointBinaryEntry, bytes: Uint8Array): PreparedBinary {
    const snapshot = new Uint8Array(bytes);
    const result = {entry, bytes: snapshot} as PreparedBinary;
    Object.defineProperty(result, "bytes", {enumerable: true, configurable: false, get: () => new Uint8Array(snapshot)});
    return Object.freeze(result);
}

/** Copy and verify complete bytes before a manifest can be published or applied. */
export async function prepareCheckpoint(input: CheckpointBuildInput, signal?: AbortSignal): Promise<PreparedCheckpoint> {
    assertNotAborted(signal);
    // Snapshot descriptors and mutable byte inputs before the first await. Blob data is immutable;
    // typed-array/ArrayBuffer inputs are copied so caller mutation cannot alter the prepared result.
    const descriptors = input.binaries.map(binary => Object.freeze({
        binaryId: binary.binaryId,
        mediaId: binary.mediaId,
        projectId: binary.projectId,
        mimeType: binary.mimeType,
        bytes: binary.bytes instanceof Blob ? binary.bytes : new Uint8Array(binary.bytes instanceof ArrayBuffer ? binary.bytes : binary.bytes),
    }));
    const entries: CheckpointBinaryEntry[] = [];
    const results: Array<{readonly descriptor: typeof descriptors[number]; readonly bytes: Uint8Array; readonly sha256: string}> = [];
    for (const descriptor of descriptors) {
        const result = await sourceBytes(descriptor.bytes, signal);
        results.push({descriptor, bytes: result.bytes, sha256: result.sha256});
        entries.push({binaryId: descriptor.binaryId, mediaId: descriptor.mediaId, projectId: descriptor.projectId, mediaWorkspaceRef: mediaWorkspaceRef(workspaceId(input.workspaceId), descriptor.projectId, descriptor.mediaId), mimeType: descriptor.mimeType, byteLength: result.bytes.byteLength, sha256: result.sha256});
    }
    const manifest = createCheckpointManifest({...input, binaries: entries});
    const prepared = manifest.binaries.map(entry => {
        const result = results.find(candidate => candidate.descriptor.binaryId === entry.binaryId);
        if (!result) throw new CheckpointValidationError("prepared checkpoint binary identity changed");
        return clonePreparedBinary(entry, result.bytes);
    });
    return Object.freeze({manifest, binaries: Object.freeze(prepared)});
}

function sourcesMap(sources: ReadonlyMap<string, BinarySource> | Readonly<Record<string, BinarySource>>): ReadonlyMap<string, BinarySource> {
    return sources instanceof Map ? sources : new Map(Object.entries(sources));
}

/** Verify every required object from an untrusted transport before application. */
export async function verifyCheckpointDelivery(manifestInput: unknown, sources: ReadonlyMap<string, BinarySource> | Readonly<Record<string, BinarySource>>, signal?: AbortSignal): Promise<VerifiedCheckpoint> {
    const manifest = validateCheckpointManifest(manifestInput);
    const available = sourcesMap(sources);
    const binaries: PreparedBinary[] = [];
    for (const entry of manifest.binaries) {
        const source = available.get(entry.binaryId);
        if (!source) throw new CheckpointValidationError(`binary ${entry.binaryId} is missing`);
        const result = await sourceBytes(source, signal);
        if (result.bytes.byteLength !== entry.byteLength) throw new CheckpointValidationError(`binary ${entry.binaryId} is truncated or has the wrong size`);
        if (result.sha256 !== entry.sha256) throw new CheckpointValidationError(`binary ${entry.binaryId} hash does not match manifest`);
        binaries.push(clonePreparedBinary(entry, result.bytes));
    }
    if (available.size !== manifest.binaries.length) {
        for (const id of available.keys()) if (!manifest.binaries.some(entry => entry.binaryId === id)) throw new CheckpointValidationError(`unexpected binary ${id}`);
    }
    assertNotAborted(signal);
    return Object.freeze({manifest, binaries: Object.freeze(binaries)});
}

export function preparedBinaryMap(checkpoint: PreparedCheckpoint | VerifiedCheckpoint): ReadonlyMap<string, Uint8Array> {
    return new Map(checkpoint.binaries.map(binary => [binary.entry.binaryId, new Uint8Array(binary.bytes)]));
}

export function canonicalCheckpointJson(manifest: CheckpointManifest): string {
    return encodeCheckpointManifest(manifest);
}

export function checkpointRevision(manifest: Omit<CheckpointManifest, "revisionId">): string {
    return revisionFor(manifest);
}
