import type {BinarySource, CheckpointApplicationPort, CheckpointApplicationReceipt, CheckpointBuildInput, CheckpointManifest, CheckpointRecord, VerifiedCheckpoint} from "@/lib/checkpoint";
import {CheckpointCanceledError, encodeCheckpointManifest} from "@/lib/checkpoint";
import type {CheckpointTransport, ProviderCapabilities} from "@/lib/syncProvider";
import {mediaWorkspaceRef, resolveWorkspaceRef, workspaceId} from "@/lib/workspace";
import type {WorkspaceId, WorkspaceRoot} from "@/lib/workspace";

export const fixtureWorkspaceId = workspaceId("protocol-fixture-workspace");
export const fixtureProjectId = "project-one";
export const fixtureMediaId = "media-one";
export const fixtureBinaryId = "binary-one";

export const fixtureCapabilities: ProviderCapabilities = Object.freeze({publication: true, bidirectionalSync: true, backup: true, listing: true, conditionalHead: true, cancellation: true, progress: true, authentication: "none", maxBinaryByteLength: null});

export function checkpointFixtureInput(bytes: BinarySource = new Uint8Array([1, 2, 3, 255]), title = "Protocol fixture", parentRevisionIds: string[] = []): CheckpointBuildInput {
    return {
        workspaceId: fixtureWorkspaceId,
        projectId: fixtureProjectId,
        parentRevisionIds,
        records: [
            {kind: "project", id: fixtureProjectId, title},
            {kind: "media", id: fixtureMediaId, projectId: fixtureProjectId, title: "Fixture media", mediaWorkspaceRef: mediaWorkspaceRef(fixtureWorkspaceId, fixtureProjectId, fixtureMediaId), binaryId: fixtureBinaryId},
        ],
        binaries: [{binaryId: fixtureBinaryId, mediaId: fixtureMediaId, projectId: fixtureProjectId, mimeType: "application/octet-stream", bytes}],
    };
}

function scoped(workspace: WorkspaceId, identity: string): string {
    return `${workspace}/${identity}`;
}

/** Disposable immutable transport only; no network, filesystem, authentication or hosted provider. */
export class CheckpointTransportFixture implements CheckpointTransport {
    readonly providerId = "disposable-transport";
    readonly capabilities: ProviderCapabilities;
    lifecycle: "open" | "closed" = "open";
    readonly objects = new Map<string, Uint8Array>();
    readonly manifests = new Map<string, string>();
    readonly heads = new Map<WorkspaceId, string>();
    readonly calls: string[] = [];
    onPutBinary?: () => Promise<void> | void;
    onPutManifest?: () => Promise<void> | void;
    onCas?: () => Promise<void> | void;
    onReadManifest?: () => Promise<void> | void;
    onReadBinary?: () => Promise<void> | void;
    manifestOverride?: unknown;
    binaryOverride?: BinarySource;

    constructor(capabilities: ProviderCapabilities = fixtureCapabilities) {
        this.capabilities = Object.freeze({...capabilities});
    }

    async putBinary(workspace: WorkspaceId, key: string, bytes: Uint8Array): Promise<void> {
        this.calls.push("putBinary");
        await this.onPutBinary?.();
        const identity = scoped(workspace, key);
        const prior = this.objects.get(identity);
        if (prior && (prior.length !== bytes.length || prior.some((value, index) => value !== bytes[index]))) throw new Error("immutable object identity collision");
        if (!prior) this.objects.set(identity, new Uint8Array(bytes));
    }

    async putManifest(workspace: WorkspaceId, manifest: CheckpointManifest): Promise<void> {
        this.calls.push("putManifest");
        await this.onPutManifest?.();
        const key = scoped(workspace, manifest.revisionId);
        const wire = encodeCheckpointManifest(manifest);
        const prior = this.manifests.get(key);
        if (prior && prior !== wire) throw new Error("immutable manifest identity collision");
        this.manifests.set(key, wire);
    }

    async readManifest(workspace: WorkspaceId, revision: string): Promise<unknown> {
        this.calls.push("readManifest");
        await this.onReadManifest?.();
        return this.manifestOverride ?? JSON.parse(this.manifests.get(scoped(workspace, revision)) ?? "null") as unknown;
    }

    async readBinary(workspace: WorkspaceId, key: string): Promise<BinarySource> {
        this.calls.push("readBinary");
        await this.onReadBinary?.();
        if (this.binaryOverride) return this.binaryOverride;
        const bytes = this.objects.get(scoped(workspace, key));
        if (!bytes) throw new Error("required object is missing");
        return new Uint8Array(bytes);
    }

    async readHead(workspace: WorkspaceId): Promise<string | null> {
        return this.heads.get(workspace) ?? null;
    }

    async compareAndSwapHead(workspace: WorkspaceId, expected: string | null, revision: string): Promise<{updated: boolean; currentHead: string | null}> {
        this.calls.push("cas");
        await this.onCas?.();
        const current = this.heads.get(workspace) ?? null;
        if (current !== expected) return {updated: false, currentHead: current};
        this.heads.set(workspace, revision);
        return {updated: true, currentHead: revision};
    }

    async listRevisions(workspace: WorkspaceId): Promise<readonly string[]> {
        return [...this.manifests.keys()].filter(key => key.startsWith(`${workspace}/`)).map(key => key.slice(workspace.length + 1));
    }

    async close(): Promise<void> { this.lifecycle = "closed"; }
}

/** Retained fixture maps model atomic logical restart, never native/durable filesystem recovery. */
export interface CheckpointDeviceFixtureState {
    records: Map<string, CheckpointRecord>;
    files: Map<string, Uint8Array>;
    appliedRevisions: Set<string>;
    commitCount: number;
}

export function emptyCheckpointDeviceState(): CheckpointDeviceFixtureState {
    return {records: new Map(), files: new Map(), appliedRevisions: new Set(), commitCount: 0};
}

export class CheckpointDeviceFixture implements CheckpointApplicationPort {
    readonly root: WorkspaceRoot;
    onBeforeCommit?: () => Promise<void> | void;
    onAfterCommit?: () => Promise<void> | void;
    failBeforeCommit = false;
    private tail: Promise<void> = Promise.resolve();

    constructor(absoluteRoot: string, readonly state = emptyCheckpointDeviceState()) {
        this.root = {workspaceId: fixtureWorkspaceId, absolutePath: absoluteRoot};
    }

    async apply(checkpoint: VerifiedCheckpoint, signal?: AbortSignal): Promise<CheckpointApplicationReceipt> {
        const previous = this.tail;
        let unlock!: () => void;
        this.tail = new Promise<void>(resolve => { unlock = resolve; });
        await previous;
        try {
            if (signal?.aborted) throw new CheckpointCanceledError();
            if (checkpoint.manifest.workspaceId !== this.root.workspaceId) throw new Error("device workspace does not match");
            const revisionId = checkpoint.manifest.revisionId;
            if (this.state.appliedRevisions.has(revisionId)) return {kind: "application-receipt", workspaceId: checkpoint.manifest.workspaceId, revisionId, applied: false, alreadyApplied: true};
            const records = new Map(this.state.records);
            const files = new Map(this.state.files);
            for (const record of checkpoint.manifest.records) records.set(record.id, record);
            for (const binary of checkpoint.binaries) files.set(resolveWorkspaceRef(binary.entry.mediaWorkspaceRef, this.root), binary.bytes);
            await this.onBeforeCommit?.();
            if (this.failBeforeCommit) throw new Error("fixture atomic apply failed");
            if (signal?.aborted) throw new CheckpointCanceledError();
            // The fixture's single serialized atomic boundary changes state and ledger together.
            this.state.records = records;
            this.state.files = files;
            this.state.appliedRevisions.add(revisionId);
            this.state.commitCount += 1;
            await this.onAfterCommit?.();
            return {kind: "application-receipt", workspaceId: checkpoint.manifest.workspaceId, revisionId, applied: true, alreadyApplied: false};
        } finally {
            unlock();
        }
    }
}
