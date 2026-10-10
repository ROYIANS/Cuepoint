import type {
    BinarySource,
    CheckpointApplicationPort,
    CheckpointApplicationReceipt,
    CheckpointManifest,
    PreparedCheckpoint,
    VerifiedCheckpoint,
} from "@/lib/checkpoint";
import {CheckpointCanceledError, validateCheckpointManifest, verifyCheckpointDelivery} from "@/lib/checkpoint";
import type {WorkspaceId} from "@/lib/workspace";

export interface ProviderCapabilities {
    readonly publication: boolean;
    readonly bidirectionalSync: boolean;
    readonly backup: boolean;
    readonly listing: boolean;
    readonly conditionalHead: boolean;
    readonly cancellation: boolean;
    readonly progress: boolean;
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

export interface ProviderProgress {
    readonly phase: "binary" | "manifest" | "head" | "download" | "application";
    readonly completed: number;
    readonly total: number;
}

export interface CheckpointTransport {
    readonly providerId: string;
    putBinary(workspaceId: WorkspaceId, binaryId: string, bytes: Uint8Array, signal?: AbortSignal, onProgress?: (progress: ProviderProgress) => void): Promise<void>;
    putManifest(workspaceId: WorkspaceId, manifest: CheckpointManifest, signal?: AbortSignal): Promise<void>;
    readManifest(workspaceId: WorkspaceId, revisionId: string, signal?: AbortSignal): Promise<unknown>;
    readBinary(workspaceId: WorkspaceId, binaryId: string, signal?: AbortSignal): Promise<BinarySource>;
    readHead(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<string | null>;
    compareAndSwapHead(workspaceId: WorkspaceId, expectedHead: string | null, revisionId: string, signal?: AbortSignal): Promise<{readonly updated: boolean; readonly currentHead: string | null}>;
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
        this.factories.set(factory.id, factory);
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
        const transport = await factory.open(context);
        if (!transport || transport.providerId !== id) throw new Error("provider factory returned an invalid transport");
        let closed = false;
        return {
            providerId: id,
            capabilities: Object.freeze({...factory.capabilities}),
            transport,
            close: async () => {
                if (closed) return;
                closed = true;
                await transport.close?.();
            },
        };
    }
}

export const checkpointProviderRegistry = new ProviderRegistry();
export const syncProviderRegistry = checkpointProviderRegistry;

export class ProviderConflictError extends Error {
    readonly code = "provider-head-conflict" as const;
    readonly expectedHead: string | null;
    readonly currentHead: string | null;
    readonly revisionId: string;

    constructor(revisionId: string, expectedHead: string | null, currentHead: string | null) {
        super("provider head changed while publishing checkpoint");
        this.name = "ProviderConflictError";
        this.revisionId = revisionId;
        this.expectedHead = expectedHead;
        this.currentHead = currentHead;
    }
}

export class ProviderProtocolError extends Error {
    readonly code = "provider-protocol" as const;

    constructor(message: string) {
        super(message);
        this.name = "ProviderProtocolError";
    }
}

export interface PublicationAcknowledgement {
    readonly kind: "publication-acknowledgement";
    readonly providerId: string;
    readonly workspaceId: WorkspaceId;
    readonly revisionId: string;
    readonly expectedHead: string | null;
    readonly head: string;
    readonly binaryIds: readonly string[];
}

export interface PublicationConflict {
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

function sessionTransport(sessionOrTransport: ProviderSession | CheckpointTransport): {readonly transport: CheckpointTransport; readonly providerId: string} {
    if ("transport" in sessionOrTransport) return {transport: sessionOrTransport.transport, providerId: sessionOrTransport.providerId};
    return {transport: sessionOrTransport, providerId: sessionOrTransport.providerId};
}

function ensureParentCompatibility(manifest: CheckpointManifest, expectedHead: string | null): void {
    if (expectedHead === null) {
        if (manifest.parentRevisionIds.length !== 0) throw new ProviderProtocolError("an initial publication cannot name an unknown parent");
        return;
    }
    if (!manifest.parentRevisionIds.includes(expectedHead)) throw new ProviderProtocolError("candidate ancestry does not include expected provider head");
}

/** Upload immutable objects first, then conditionally publish only the scoped head. */
export async function publishCheckpoint(sessionOrTransport: ProviderSession | CheckpointTransport, checkpoint: PreparedCheckpoint, options: PublishOptions): Promise<PublicationOutcome> {
    const {transport, providerId} = sessionTransport(sessionOrTransport);
    const manifest = validateCheckpointManifest(checkpoint.manifest);
    if (manifest.workspaceId === undefined) throw new ProviderProtocolError("checkpoint workspace identity is missing");
    ensureParentCompatibility(manifest, options.expectedHead);
    assertNotAborted(options.signal);
    const currentHead = await transport.readHead(manifest.workspaceId, options.signal);
    if (currentHead !== options.expectedHead) {
        return {kind: "publication-conflict", providerId, workspaceId: manifest.workspaceId, revisionId: manifest.revisionId, expectedHead: options.expectedHead, currentHead};
    }
    const binaryIds: string[] = [];
    for (let index = 0; index < checkpoint.binaries.length; index += 1) {
        const binary = checkpoint.binaries[index];
        if (!binary || !manifest.binaries.some(entry => entry.binaryId === binary.entry.binaryId)) throw new ProviderProtocolError("prepared binary set does not match manifest");
        assertNotAborted(options.signal);
        await transport.putBinary(manifest.workspaceId, binary.entry.binaryId, new Uint8Array(binary.bytes), options.signal, progress => options.onProgress?.(progress));
        binaryIds.push(binary.entry.binaryId);
    }
    if (binaryIds.length !== manifest.binaries.length) throw new ProviderProtocolError("prepared checkpoint is missing a required binary");
    await transport.putManifest(manifest.workspaceId, manifest, options.signal);
    assertNotAborted(options.signal);
    const cas = await transport.compareAndSwapHead(manifest.workspaceId, options.expectedHead, manifest.revisionId, options.signal);
    if (!cas.updated) {
        return {kind: "publication-conflict", providerId, workspaceId: manifest.workspaceId, revisionId: manifest.revisionId, expectedHead: options.expectedHead, currentHead: cas.currentHead};
    }
    return Object.freeze({kind: "publication-acknowledgement", providerId, workspaceId: manifest.workspaceId, revisionId: manifest.revisionId, expectedHead: options.expectedHead, head: manifest.revisionId, binaryIds: Object.freeze(binaryIds)});
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
    const {transport, providerId} = sessionTransport(sessionOrTransport);
    assertNotAborted(options.signal);
    const rawManifest = await transport.readManifest(workspaceId, revisionId, options.signal);
    const manifest = validateCheckpointManifest(rawManifest);
    if (manifest.workspaceId !== workspaceId || manifest.revisionId !== revisionId) throw new ProviderProtocolError("provider returned a foreign checkpoint");
    const sources = new Map<string, BinarySource>();
    for (let index = 0; index < manifest.binaries.length; index += 1) {
        assertNotAborted(options.signal);
        const entry = manifest.binaries[index];
        if (!entry) throw new ProviderProtocolError("provider returned an invalid binary entry");
        sources.set(entry.binaryId, await transport.readBinary(workspaceId, entry.binaryId, options.signal));
        options.onProgress?.({phase: "download", completed: index + 1, total: manifest.binaries.length});
    }
    const verified: VerifiedCheckpoint = await verifyCheckpointDelivery(manifest, sources, options.signal);
    assertNotAborted(options.signal);
    // After this call begins, the application port's committed result is authoritative.
    const receipt = await application.apply(verified, options.signal);
    return Object.freeze({kind: "application-receipt", providerId, receipt});
}

export type ProviderAcknowledgement = PublicationAcknowledgement;
