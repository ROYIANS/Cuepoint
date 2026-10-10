import {describe, expect, it, vi} from "vitest";
import {prepareCheckpoint} from "@/lib/checkpoint";
import type {CheckpointApplicationPort, PreparedCheckpoint} from "@/lib/checkpoint";
import {checkpointObjectKey, deliverCheckpoint, listCheckpointRevisions, opaqueCredentialHandle, ProviderRegistry, publishCheckpoint} from "@/lib/syncProvider";
import {workspaceId} from "@/lib/workspace";
import {checkpointFixtureInput, CheckpointDeviceFixture, CheckpointTransportFixture, fixtureBinaryId, fixtureCapabilities, fixtureProjectId, fixtureWorkspaceId} from "./helpers/checkpointProtocolFixture";

const initial = () => prepareCheckpoint(checkpointFixtureInput());
const localRootA = "/disposable-device-a/workspace";
const localRootB = "C:/disposable-device-b/workspace";

function applicationSpy() {
    return {apply: vi.fn<CheckpointApplicationPort["apply"]>()};
}

describe("immutable publication and device application", () => {
    it("preserves stable identity and full bytes across independent fixture roots and logical restart", async () => {
        const transport = new CheckpointTransportFixture();
        const prepared = await initial();
        const ack = await publishCheckpoint(transport, prepared, {expectedHead: null});
        expect(ack.kind).toBe("publication-acknowledgement");
        expect(ack).not.toHaveProperty("applied");
        const a = new CheckpointDeviceFixture(localRootA);
        const b = new CheckpointDeviceFixture(localRootB);
        const firstA = await deliverCheckpoint(transport, fixtureWorkspaceId, prepared.manifest.revisionId, a);
        const firstB = await deliverCheckpoint(transport, fixtureWorkspaceId, prepared.manifest.revisionId, b);
        expect(firstA.receipt).toMatchObject({kind: "application-receipt", applied: true, revisionId: prepared.manifest.revisionId});
        expect(firstB.receipt).toEqual(firstA.receipt);
        expect(a.state).not.toBe(b.state);
        expect([...a.state.records.keys()].sort()).toEqual([...b.state.records.keys()].sort());
        expect(a.state.records.get(fixtureProjectId)).toMatchObject({id: fixtureProjectId, title: "Protocol fixture"});
        expect([...a.state.files.keys()][0]).toContain(localRootA);
        expect([...b.state.files.keys()][0]).toContain(localRootB);
        expect([...a.state.files.values()][0]).toEqual(new Uint8Array([1, 2, 3, 255]));
        expect([...b.state.files.values()][0]).toEqual(new Uint8Array([1, 2, 3, 255]));
        const restartedB = new CheckpointDeviceFixture(localRootB, b.state);
        const repeated = await deliverCheckpoint(transport, fixtureWorkspaceId, prepared.manifest.revisionId, restartedB);
        expect(repeated.receipt).toMatchObject({applied: false, alreadyApplied: true});
        expect(b.state.commitCount).toBe(1);
        expect(b.state.records.size).toBe(2);
        expect(b.state.files.size).toBe(1);
    });

    it("serializes simultaneous duplicate application through the port ledger", async () => {
        const transport = new CheckpointTransportFixture();
        const prepared = await initial();
        await publishCheckpoint(transport, prepared, {expectedHead: null});
        const device = new CheckpointDeviceFixture(localRootB);
        const receipts = await Promise.all([deliverCheckpoint(transport, fixtureWorkspaceId, prepared.manifest.revisionId, device), deliverCheckpoint(transport, fixtureWorkspaceId, prepared.manifest.revisionId, device)]);
        expect(receipts.map(receipt => receipt.receipt.applied).sort()).toEqual([false, true]);
        expect(device.state.commitCount).toBe(1);
    });

    it("retains both candidate revisions and both byte versions for concurrent head races", async () => {
        const transport = new CheckpointTransportFixture();
        const base = await initial();
        await publishCheckpoint(transport, base, {expectedHead: null});
        const a = await prepareCheckpoint(checkpointFixtureInput(new Uint8Array([5, 6]), "A branch", [base.manifest.revisionId]));
        const b = await prepareCheckpoint(checkpointFixtureInput(new Uint8Array([7, 8]), "B branch", [base.manifest.revisionId]));
        const outcomes = await Promise.all([publishCheckpoint(transport, a, {expectedHead: base.manifest.revisionId}), publishCheckpoint(transport, b, {expectedHead: base.manifest.revisionId})]);
        expect(outcomes.map(outcome => outcome.kind).sort()).toEqual(["publication-acknowledgement", "publication-conflict"]);
        expect(await listCheckpointRevisions(transport, fixtureWorkspaceId)).toEqual([base.manifest.revisionId, a.manifest.revisionId, b.manifest.revisionId].sort());
        expect(transport.objects.size).toBe(3);
        const aDevice = new CheckpointDeviceFixture(localRootA);
        const bDevice = new CheckpointDeviceFixture(localRootB);
        await deliverCheckpoint(transport, fixtureWorkspaceId, a.manifest.revisionId, aDevice);
        await deliverCheckpoint(transport, fixtureWorkspaceId, b.manifest.revisionId, bDevice);
        expect([...aDevice.state.files.values()][0]).toEqual(new Uint8Array([5, 6]));
        expect([...bDevice.state.files.values()][0]).toEqual(new Uint8Array([7, 8]));
    });

    it("stores an already-stale complete candidate before reporting scoped CAS conflict", async () => {
        const transport = new CheckpointTransportFixture();
        const base = await initial();
        await publishCheckpoint(transport, base, {expectedHead: null});
        const winning = await prepareCheckpoint(checkpointFixtureInput(new Uint8Array([4]), "Winning", [base.manifest.revisionId]));
        await publishCheckpoint(transport, winning, {expectedHead: base.manifest.revisionId});
        const stale = await prepareCheckpoint(checkpointFixtureInput(new Uint8Array([9]), "Stale", [base.manifest.revisionId]));
        expect(await publishCheckpoint(transport, stale, {expectedHead: base.manifest.revisionId})).toMatchObject({kind: "publication-conflict", currentHead: winning.manifest.revisionId});
        expect(await listCheckpointRevisions(transport, fixtureWorkspaceId)).toContain(stale.manifest.revisionId);
        expect(transport.objects.has(`${fixtureWorkspaceId}/${checkpointObjectKey(stale.manifest.binaries[0]!)}`)).toBe(true);
        expect((await transport.readHead(fixtureWorkspaceId))).toBe(winning.manifest.revisionId);
    });

    it("rejects incompatible ancestry and forged prepared input before any remote staging", async () => {
        const transport = new CheckpointTransportFixture();
        const base = await initial();
        await expect(publishCheckpoint(transport, base, {expectedHead: `sha256-v1:${"f".repeat(64)}`})).rejects.toThrow("ancestry");
        const next = await prepareCheckpoint(checkpointFixtureInput(undefined, "Next", [base.manifest.revisionId]));
        await expect(publishCheckpoint(transport, next, {expectedHead: null})).rejects.toThrow("initial");
        for (const forged of [{...base}, {...base, binaries: []}, {...base, binaries: [base.binaries[0]!, base.binaries[0]!]}]) {
            await expect(publishCheckpoint(transport, forged as PreparedCheckpoint, {expectedHead: null})).rejects.toThrow("prepared");
        }
        expect(transport.calls).toEqual([]);
        expect(transport.manifests.size).toBe(0);
    });

    it("keeps locally prepared work after provider failure, cancellation, and repeat publication", async () => {
        const transport = new CheckpointTransportFixture();
        const prepared = await initial();
        const before = prepared.binaries[0]!.bytes;
        transport.onPutManifest = () => { throw new Error("transient failure"); };
        await expect(publishCheckpoint(transport, prepared, {expectedHead: null})).rejects.toThrow("transient failure");
        expect(await transport.readHead(fixtureWorkspaceId)).toBe(null);
        expect(prepared.binaries[0]!.bytes).toEqual(before);
        transport.onPutManifest = undefined;
        const controller = new AbortController();
        transport.onPutBinary = () => controller.abort();
        await expect(publishCheckpoint(transport, prepared, {expectedHead: null, signal: controller.signal})).rejects.toMatchObject({name: "AbortError"});
        expect(await transport.readHead(fixtureWorkspaceId)).toBe(null);
        expect(prepared.binaries[0]!.bytes).toEqual(before);
        transport.onPutBinary = undefined;
        expect((await publishCheckpoint(transport, prepared, {expectedHead: null})).kind).toBe("publication-acknowledgement");
        expect(transport.objects.size).toBe(1);
        expect(transport.manifests.size).toBe(1);
        expect((await publishCheckpoint(transport, prepared, {expectedHead: null})).kind).toBe("publication-conflict");
        expect(transport.manifests.size).toBe(1);
    });

    it("reports actual committed CAS/application success after a late cancellation signal", async () => {
        const transport = new CheckpointTransportFixture();
        const prepared = await initial();
        const publication = new AbortController();
        transport.onCas = () => publication.abort();
        expect((await publishCheckpoint(transport, prepared, {expectedHead: null, signal: publication.signal})).kind).toBe("publication-acknowledgement");
        const application = new AbortController();
        const device = new CheckpointDeviceFixture(localRootB);
        device.onBeforeCommit = () => application.abort();
        expect((await deliverCheckpoint(transport, fixtureWorkspaceId, prepared.manifest.revisionId, device, {signal: application.signal})).receipt.applied).toBe(true);
        expect(device.state.commitCount).toBe(1);
    });

    it("leaves previous records/files/ledger intact when the application owner fails atomically", async () => {
        const transport = new CheckpointTransportFixture();
        const base = await initial();
        await publishCheckpoint(transport, base, {expectedHead: null});
        const device = new CheckpointDeviceFixture(localRootB);
        await deliverCheckpoint(transport, fixtureWorkspaceId, base.manifest.revisionId, device);
        const beforeRecords = new Map(device.state.records);
        const beforeFiles = new Map(device.state.files);
        const beforeLedger = new Set(device.state.appliedRevisions);
        const next = await prepareCheckpoint(checkpointFixtureInput(new Uint8Array([9, 9]), "Next", [base.manifest.revisionId]));
        await publishCheckpoint(transport, next, {expectedHead: base.manifest.revisionId});
        device.failBeforeCommit = true;
        await expect(deliverCheckpoint(transport, fixtureWorkspaceId, next.manifest.revisionId, device)).rejects.toThrow("atomic apply failed");
        expect(device.state.records).toEqual(beforeRecords);
        expect(device.state.files).toEqual(beforeFiles);
        expect(device.state.appliedRevisions).toEqual(beforeLedger);
        device.failBeforeCommit = false;
        expect((await deliverCheckpoint(transport, fixtureWorkspaceId, next.manifest.revisionId, device)).receipt.applied).toBe(true);
    });
});

describe("bounded trusted provider and request binding", () => {
    it.each(["foreign-workspace", "foreign-revision", "corrupt", "truncated", "missing", "unknown-schema", "cancel-before-application"])("rejects %s before an application port is called", async kind => {
        const transport = new CheckpointTransportFixture();
        const prepared = await initial();
        await publishCheckpoint(transport, prepared, {expectedHead: null});
        const app = applicationSpy();
        const controller = new AbortController();
        if (kind === "foreign-workspace") {
            await expect(deliverCheckpoint(transport, workspaceId("foreign"), prepared.manifest.revisionId, app)).rejects.toThrow();
        } else if (kind === "foreign-revision") {
            transport.manifestOverride = prepared.manifest;
            await expect(deliverCheckpoint(transport, fixtureWorkspaceId, `sha256-v1:${"f".repeat(64)}`, app)).rejects.toThrow("foreign");
        } else {
            if (kind === "corrupt") transport.binaryOverride = new Uint8Array([9, 9, 9, 9]);
            if (kind === "truncated") transport.binaryOverride = new Uint8Array([1]);
            if (kind === "missing") transport.objects.clear();
            if (kind === "unknown-schema") transport.manifestOverride = {...prepared.manifest, schemaVersion: 999};
            if (kind === "cancel-before-application") transport.onReadBinary = () => controller.abort();
            await expect(deliverCheckpoint(transport, fixtureWorkspaceId, prepared.manifest.revisionId, app, {signal: controller.signal})).rejects.toThrow();
        }
        expect(app.apply).not.toHaveBeenCalled();
    });

    it.each(["no-conditional-head", "read-only", "media-limit", "closed", "no-cancellation"])("gates publication for %s before transport mutation", async kind => {
        const caps = {...fixtureCapabilities};
        if (kind === "no-conditional-head") caps.conditionalHead = false;
        if (kind === "read-only") caps.publication = false;
        if (kind === "media-limit") caps.maxBinaryByteLength = 2;
        if (kind === "no-cancellation") caps.cancellation = false;
        const transport = new CheckpointTransportFixture(caps);
        if (kind === "closed") await transport.close();
        await expect(publishCheckpoint(transport, await initial(), {expectedHead: null, signal: new AbortController().signal})).rejects.toThrow();
        expect(transport.calls).toEqual([]);
    });

    it("gates delivery/listing and enforces registry session closure without deleting device content", async () => {
        const registry = new ProviderRegistry();
        const transport = new CheckpointTransportFixture();
        registry.registerTrusted({id: transport.providerId, capabilities: fixtureCapabilities, open: async () => transport});
        expect(registry.list()).toEqual([transport.providerId]);
        expect(() => registry.registerTrusted({id: transport.providerId, capabilities: fixtureCapabilities, open: async () => transport})).toThrow("already registered");
        const session = await registry.open(transport.providerId);
        const prepared = await initial();
        await publishCheckpoint(session, prepared, {expectedHead: null});
        const device = new CheckpointDeviceFixture(localRootB);
        await deliverCheckpoint(session, fixtureWorkspaceId, prepared.manifest.revisionId, device);
        expect(await listCheckpointRevisions(session, fixtureWorkspaceId)).toEqual([prepared.manifest.revisionId]);
        await session.close();
        await session.close();
        await expect(publishCheckpoint(session, prepared, {expectedHead: null})).rejects.toThrow("closed");
        await expect(deliverCheckpoint(session, fixtureWorkspaceId, prepared.manifest.revisionId, device)).rejects.toThrow("closed");
        await expect(listCheckpointRevisions(session, fixtureWorkspaceId)).rejects.toThrow("closed");
        expect(device.state.files.size).toBe(1);
        const readonlyTransport = new CheckpointTransportFixture({...fixtureCapabilities, bidirectionalSync: false, listing: false});
        await expect(deliverCheckpoint(readonlyTransport, fixtureWorkspaceId, prepared.manifest.revisionId, device)).rejects.toThrow("delivery");
        await expect(listCheckpointRevisions(readonlyTransport, fixtureWorkspaceId)).rejects.toThrow("listing");
    });

    it("passes only a local opaque credential handle through trusted factory context", async () => {
        const registry = new ProviderRegistry();
        const transport = new CheckpointTransportFixture();
        let seen: unknown;
        registry.registerTrusted({id: transport.providerId, capabilities: {...fixtureCapabilities, authentication: "opaque-credential"}, open: async context => { seen = context.credential; return transport; }});
        await expect(registry.open(transport.providerId)).rejects.toThrow("credential");
        const credential = opaqueCredentialHandle("device-credential-slot");
        await registry.open(transport.providerId, {credential});
        expect(seen).toBe(credential);
        expect((await initial()).manifest).not.toHaveProperty("credential");
        await expect(registry.open("unregistered")).rejects.toThrow("not registered");
    });

    it("does not certify an inconsistent CAS result or wrong application receipt identity", async () => {
        const transport = new CheckpointTransportFixture();
        const prepared = await initial();
        transport.compareAndSwapHead = async () => ({updated: true, currentHead: `sha256-v1:${"f".repeat(64)}`});
        await expect(publishCheckpoint(transport, prepared, {expectedHead: null})).rejects.toThrow("inconsistent");
        const app: CheckpointApplicationPort = {apply: async () => ({kind: "application-receipt", workspaceId: fixtureWorkspaceId, revisionId: `sha256-v1:${"f".repeat(64)}`, applied: true, alreadyApplied: false})};
        await expect(deliverCheckpoint(transport, fixtureWorkspaceId, prepared.manifest.revisionId, app)).rejects.toThrow("receipt");
    });

    it("defensively exposes publication bytes without letting the provider mutate prepared work", async () => {
        const transport = new CheckpointTransportFixture();
        const originalPut = transport.putBinary.bind(transport);
        transport.putBinary = async (workspace, key, bytes) => { const copied = new Uint8Array(bytes); bytes.fill(9); await originalPut(workspace, key, copied); };
        const prepared = await initial();
        await publishCheckpoint(transport, prepared, {expectedHead: null});
        expect(prepared.binaries[0]!.bytes).toEqual(new Uint8Array([1, 2, 3, 255]));
        expect(prepared.binaries[0]!.entry.binaryId).toBe(fixtureBinaryId);
    });
});
