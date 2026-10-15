import type {
    BinarySource,
    CheckpointApplicationPort,
    CheckpointApplicationReceipt,
    CheckpointManifest,
    PreparedCheckpoint,
    VerifiedCheckpoint,
} from "./checkpoint";
import {
    assertPreparedCheckpoint,
    CheckpointCanceledError,
    validateCheckpointManifest,
    verifyCheckpointDelivery
} from "./checkpoint";
import type {WorkspaceId} from "./workspace";

interface ProviderCapabilities {
    readonly publication: boolean;
    readonly bidirectionalSync: boolean;
    readonly backup: boolean;
    readonly listing: boolean;
    readonly conditionalHead: boolean;
    readonly cancellation: boolean;
    readonly progress: boolean;
    readonly authentication: "none" | "opaque-credential";
    readonly maxBinaryByteLength: number | null;
}

export interface ProviderCredentialHandle {
    readonly kind: "opaque-device-credential";
    readonly handleId: string;
}

/** Construct an opaque local handle. Its value is never accepted by checkpoint codecs. */
export function opaqueCredentialHandle(handleId: string): ProviderCredentialHandle {
    if (typeof handleId !== "string" || handleId.trim().length === 0) throw new Error("provider credential handle is invalid");
    return Object.freeze({kind: "opaque-device-credential", handleId});
}

interface ProviderProgress {
    readonly phase: "binary" | "manifest" | "head" | "download" | "application";
    readonly completed: number;
    readonly total: number;
}

export interface CheckpointTransport {
    readonly providerId: string;
    readonly capabilities: ProviderCapabilities;
    readonly lifecycle: "open" | "closed";

    /** Object keys are content addresses; logical binary IDs remain in the manifest. */
    putBinary(workspaceId: WorkspaceId, objectKey: string, bytes: Uint8Array, signal?: AbortSignal, onProgress?: (progress: ProviderProgress) => void): Promise<void>;

    putManifest(workspaceId: WorkspaceId, manifest: CheckpointManifest, signal?: AbortSignal): Promise<void>;

    readManifest(workspaceId: WorkspaceId, revisionId: string, signal?: AbortSignal): Promise<unknown>;

    readBinary(workspaceId: WorkspaceId, objectKey: string, signal?: AbortSignal): Promise<BinarySource>;

    readHead(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<string | null>;

    compareAndSwapHead(workspaceId: WorkspaceId, expectedHead: string | null, revisionId: string, signal?: AbortSignal): Promise<{
        readonly updated: boolean;
        readonly currentHead: string | null
    }>;

    listRevisions?(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<readonly string[]>;

    close?(): Promise<void>;
}

export interface ProviderFactoryContext {
    readonly credential?: ProviderCredentialHandle;
    readonly onProgress?: (progress: ProviderProgress) => void;
}

export interface TrustedProviderFactory {
    readonly id: string;
    readonly capabilities: ProviderCapabilities;

    open(context: ProviderFactoryContext): Promise<CheckpointTransport>;
}

export interface ProviderSession {
    readonly providerId: string;
    readonly capabilities: ProviderCapabilities;
    readonly transport: CheckpointTransport;
    readonly lifecycle: "open" | "closed";

    close(): Promise<void>;
}

export class ProviderRegistry {
    private readonly factories = new Map<string, TrustedProviderFactory>();

    /** Registration is intentionally explicit; this registry does not load modules or execute plugins. */
    registerTrusted(factory: TrustedProviderFactory): void {
        if (!factory || typeof factory.id !== "string" || factory.id.trim().length === 0 || typeof factory.open !== "function") {
            throw new Error("trusted provider factory is invalid");
        }
        if (this.factories.has(factory.id)) throw new Error(`provider ${factory.id} is already registered`);
        this.factories.set(factory.id, Object.freeze({
            id: factory.id,
            capabilities: snapshotCapabilities(factory.capabilities),
            open: factory.open.bind(factory)
        }));
    }

    has(id: string): boolean {
        return this.factories.has(id);
    }

    list(): readonly string[] {
        return Object.freeze([...this.factories.keys()].sort());
    }

    async open(id: string, context: ProviderFactoryContext = {}): Promise<ProviderSession> {
        const factory = this.factories.get(id);
        if (!factory) throw new Error(`provider ${id} is not registered`);
        if (factory.capabilities.authentication === "opaque-credential" && context.credential?.kind !== "opaque-device-credential") throw new ProviderProtocolError("provider requires a device-local credential handle");
        const transport = await factory.open(Object.freeze({...context}));
        if (!transport || transport.providerId !== id) throw new Error("provider factory returned an invalid transport");
        let closed = false;
        return Object.freeze({
            providerId: id,
            capabilities: Object.freeze({...factory.capabilities}),
            transport,
            get lifecycle() {
                return closed ? "closed" : "open";
            },
            close: async () => {
                if (closed) return;
                closed = true;
                await transport.close?.();
            },
        });
    }
}


class ProviderProtocolError extends Error {
    readonly code = "provider-protocol" as const;

    constructor(message: string) {
        super(message);
        this.name = "ProviderProtocolError";
    }
}

interface PublicationAcknowledgement {
    readonly kind: "publication-acknowledgement";
    readonly providerId: string;
    readonly workspaceId: WorkspaceId;
    readonly revisionId: string;
    readonly expectedHead: string | null;
    readonly head: string;
    readonly binaryIds: readonly string[];
}

interface PublicationConflict {
    readonly kind: "publication-conflict";
    readonly providerId: string;
    readonly workspaceId: WorkspaceId;
    readonly revisionId: string;
    readonly expectedHead: string | null;
    readonly currentHead: string | null;
}

export type PublicationOutcome = PublicationAcknowledgement | PublicationConflict;

export interface PublishOptions {
    readonly expectedHead: string | null;
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: ProviderProgress) => void;
}

function assertNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new CheckpointCanceledError();
}

function snapshotCapabilities(value: ProviderCapabilities): ProviderCapabilities {
    if (!value || typeof value !== "object") throw new ProviderProtocolError("provider capabilities are invalid");
    for (const key of ["publication", "bidirectionalSync", "backup", "listing", "conditionalHead", "cancellation", "progress"] as const) {
        if (typeof value[key] !== "boolean") throw new ProviderProtocolError("provider capabilities are invalid");
    }
    if (value.authentication !== "none" && value.authentication !== "opaque-credential") throw new ProviderProtocolError("provider authentication capability is invalid");
    if (value.maxBinaryByteLength !== null && (!Number.isSafeInteger(value.maxBinaryByteLength) || value.maxBinaryByteLength <= 0)) throw new ProviderProtocolError("provider media limit is invalid");
    return Object.freeze({...value});
}

function sessionTransport(sessionOrTransport: ProviderSession | CheckpointTransport, operation: "publication" | "delivery"): {
    readonly transport: CheckpointTransport;
    readonly providerId: string;
    readonly capabilities: ProviderCapabilities
} {
    if (sessionOrTransport.lifecycle !== "open") throw new ProviderProtocolError("provider session is closed");
    const transport = "transport" in sessionOrTransport ? sessionOrTransport.transport : sessionOrTransport;
    if (transport.lifecycle !== "open") throw new ProviderProtocolError("provider transport is closed");
    const capabilities = snapshotCapabilities(sessionOrTransport.capabilities);
    if (operation === "publication" && (!capabilities.publication || !capabilities.conditionalHead)) throw new ProviderProtocolError("provider does not support conditional publication");
    if (operation === "delivery" && !capabilities.bidirectionalSync) throw new ProviderProtocolError("provider does not support delivery");
    return {transport, providerId: sessionOrTransport.providerId, capabilities};
}

/** A versioned immutable object key; a stable logical ID never overwrites old bytes. */
export function checkpointObjectKey(entry: { readonly sha256: string }): string {
    if (!/^[0-9a-f]{64}$/.test(entry.sha256)) throw new ProviderProtocolError("binary content address is invalid");
    return `sha256:${entry.sha256}`;
}

function ensureParentCompatibility(manifest: CheckpointManifest, expectedHead: string | null): void {
    if (expectedHead !== null && !/^sha256-v1:[0-9a-f]{64}$/.test(expectedHead)) throw new ProviderProtocolError("expected provider head is invalid");
    if (expectedHead === null) {
        if (manifest.parentRevisionIds.length !== 0) throw new ProviderProtocolError("an initial publication cannot name an unknown parent");
        return;
    }
    if (!manifest.parentRevisionIds.includes(expectedHead)) throw new ProviderProtocolError("candidate ancestry does not include expected provider head");
}

/** Upload immutable objects first, then conditionally publish only the scoped head. */
export async function publishCheckpoint(sessionOrTransport: ProviderSession | CheckpointTransport, checkpoint: PreparedCheckpoint, options: PublishOptions): Promise<PublicationOutcome> {
    const expectedHead = options.expectedHead;
    const signal = options.signal;
    const onProgress = options.onProgress;
    const {transport, providerId, capabilities} = sessionTransport(sessionOrTransport, "publication");
    assertPreparedCheckpoint(checkpoint);
    const manifest = checkpoint.manifest;
    ensureParentCompatibility(manifest, expectedHead);
    if (signal && !capabilities.cancellation) throw new ProviderProtocolError("provider does not support cancellation");
    assertNotAborted(signal);
    if (capabilities.maxBinaryByteLength !== null && manifest.binaries.some(entry => entry.byteLength > capabilities.maxBinaryByteLength!)) throw new ProviderProtocolError("checkpoint exceeds provider media limit");
    const binaryIds: string[] = [];
    for (let index = 0; index < checkpoint.binaries.length; index += 1) {
        const binary = checkpoint.binaries[index];
        assertNotAborted(signal);
        sessionTransport(sessionOrTransport, "publication");
        await transport.putBinary(manifest.workspaceId, checkpointObjectKey(binary.entry), binary.bytes, signal, capabilities.progress ? onProgress : undefined);
        binaryIds.push(binary.entry.binaryId);
        if (capabilities.progress) onProgress?.({
            phase: "binary",
            completed: index + 1,
            total: checkpoint.binaries.length
        });
    }
    assertNotAborted(signal);
    sessionTransport(sessionOrTransport, "publication");
    await transport.putManifest(manifest.workspaceId, manifest, signal);
    assertNotAborted(signal);
    sessionTransport(sessionOrTransport, "publication");
    if (capabilities.progress) onProgress?.({phase: "manifest", completed: 1, total: 1});
    // A stale candidate is retained as immutable staging too. CAS is the only head change.
    assertNotAborted(signal);
    sessionTransport(sessionOrTransport, "publication");
    const cas = await transport.compareAndSwapHead(manifest.workspaceId, expectedHead, manifest.revisionId, signal);
    if (typeof cas !== "object" || cas === null || Array.isArray(cas) || typeof cas.updated !== "boolean" || (cas.currentHead !== null && (typeof cas.currentHead !== "string" || !/^sha256-v1:[0-9a-f]{64}$/.test(cas.currentHead)))) throw new ProviderProtocolError("provider returned an invalid head outcome");
    if (!cas.updated) {
        return Object.freeze({
            kind: "publication-conflict",
            providerId,
            workspaceId: manifest.workspaceId,
            revisionId: manifest.revisionId,
            expectedHead: expectedHead,
            currentHead: cas.currentHead
        });
    }
    if (cas.currentHead !== manifest.revisionId) throw new ProviderProtocolError("provider reported an inconsistent committed head");
    // Once CAS starts, its actual committed result wins over a later cancellation signal.
    return Object.freeze({
        kind: "publication-acknowledgement",
        providerId,
        workspaceId: manifest.workspaceId,
        revisionId: manifest.revisionId,
        expectedHead: expectedHead,
        head: manifest.revisionId,
        binaryIds: Object.freeze(binaryIds)
    });
}

export interface DeliveryOptions {
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: ProviderProgress) => void;
}

export interface ApplicationDeliveryReceipt {
    readonly kind: "application-receipt";
    readonly providerId: string;
    readonly receipt: CheckpointApplicationReceipt;
}

/** Download and verify all immutable objects before calling the application owner. */
export async function deliverCheckpoint(sessionOrTransport: ProviderSession | CheckpointTransport, workspaceId: WorkspaceId, revisionId: string, application: CheckpointApplicationPort, options: DeliveryOptions = {}): Promise<ApplicationDeliveryReceipt> {
    const signal = options.signal;
    const onProgress = options.onProgress;
    const apply = application.apply.bind(application);
    const {transport, providerId, capabilities} = sessionTransport(sessionOrTransport, "delivery");
    if (signal && !capabilities.cancellation) throw new ProviderProtocolError("provider does not support cancellation");
    assertNotAborted(signal);
    const rawManifest = await transport.readManifest(workspaceId, revisionId, signal);
    const manifest = validateCheckpointManifest(rawManifest);
    if (manifest.workspaceId !== workspaceId || manifest.revisionId !== revisionId) throw new ProviderProtocolError("provider returned a foreign checkpoint");
    if (capabilities.maxBinaryByteLength !== null && manifest.binaries.some(entry => entry.byteLength > capabilities.maxBinaryByteLength!)) throw new ProviderProtocolError("checkpoint exceeds provider media limit");
    const sources = new Map<string, BinarySource>();
    for (let index = 0; index < manifest.binaries.length; index += 1) {
        assertNotAborted(signal);
        const entry = manifest.binaries[index];
        if (!entry) throw new ProviderProtocolError("provider returned an invalid binary entry");
        sessionTransport(sessionOrTransport, "delivery");
        sources.set(entry.binaryId, await transport.readBinary(workspaceId, checkpointObjectKey(entry), signal));
        if (capabilities.progress) onProgress?.({
            phase: "download",
            completed: index + 1,
            total: manifest.binaries.length
        });
    }
    const verified: VerifiedCheckpoint = await verifyCheckpointDelivery(manifest, sources, signal);
    assertNotAborted(signal);
    // The trusted port owns pre-commit cancellation and the atomic ledger/commit boundary.
    // Its actual committed result wins over a later signal; validation alone is not application.
    sessionTransport(sessionOrTransport, "delivery");
    const receipt = await apply(verified, signal);
    if (typeof receipt !== "object" || receipt === null || Array.isArray(receipt) || receipt.kind !== "application-receipt" || receipt.workspaceId !== workspaceId || receipt.revisionId !== revisionId || typeof receipt.applied !== "boolean" || typeof receipt.alreadyApplied !== "boolean" || receipt.applied === receipt.alreadyApplied) throw new ProviderProtocolError("application port returned an invalid receipt");
    return Object.freeze({
        kind: "application-receipt",
        providerId,
        receipt: Object.freeze({
            kind: receipt.kind,
            workspaceId: receipt.workspaceId,
            revisionId: receipt.revisionId,
            applied: receipt.applied,
            alreadyApplied: receipt.alreadyApplied
        })
    });
}


/** Listing is read-only transport history; it never applies or removes local content. */
export async function listCheckpointRevisions(sessionOrTransport: ProviderSession | CheckpointTransport, workspaceId: WorkspaceId, signal?: AbortSignal): Promise<readonly string[]> {
    if (sessionOrTransport.lifecycle !== "open") throw new ProviderProtocolError("provider session is closed");
    const transport = "transport" in sessionOrTransport ? sessionOrTransport.transport : sessionOrTransport;
    if (transport.lifecycle !== "open") throw new ProviderProtocolError("provider transport is closed");
    const capabilities = snapshotCapabilities(sessionOrTransport.capabilities);
    if (!capabilities.listing || !transport.listRevisions) throw new ProviderProtocolError("provider does not support history listing");
    if (signal && !capabilities.cancellation) throw new ProviderProtocolError("provider does not support cancellation");
    assertNotAborted(signal);
    const received: unknown = await transport.listRevisions(workspaceId, signal);
    assertNotAborted(signal);
    if (!Array.isArray(received)) throw new ProviderProtocolError("provider returned invalid revision history");
    const values: unknown[] = received;
    const revisions = values.map(value => {
        if (typeof value !== "string" || !/^sha256-v1:[0-9a-f]{64}$/.test(value)) throw new ProviderProtocolError("provider returned invalid revision history");
        return value;
    });
    if (new Set(revisions).size !== revisions.length) throw new ProviderProtocolError("provider returned invalid revision history");
    return Object.freeze(revisions.sort());
}
