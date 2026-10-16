import {emptyProject} from "@/features/projects/models/newProject";
import {describe, expect, it, vi} from "vitest";
import {cloneStoredValue, reservePreparedBinaryReference} from "@/platform/storage/codec";
import {registerNativePreparedBinary} from "@/platform/storage/nativeBinary";
import {createNativeProductStore} from "@/platform/storage/native";
import {UnknownCommitError} from "@/platform/storage/errors";
import type {BinaryClaim, NativeSession, NativeStoreBridge, WireBatchEntry} from "@/platform/storage/protocol";

const session: NativeSession = {version: 1, session: "11111111-1111-4111-8111-111111111111", workspaceId: "22222222-2222-4222-8222-222222222222", generation: 1};
function prepared() {
    const claim: BinaryClaim = {stageId: crypto.randomUUID(), reference: {version: 1, workspaceId: session.workspaceId,
        binaryId: crypto.randomUUID(), byteLength: 4, mimeType: "video/mp4", contentHash: "a".repeat(64)}};
    return {claim, reference: registerNativePreparedBinary(claim, session)};
}
function fixture(options: {commit?: NativeStoreBridge['commit']; status?: NativeStoreBridge['status']} = {}) {
    const payloads = new Map<string, string>(), batches: WireBatchEntry[][] = [];
    const discard = vi.fn(async () => undefined), prepare = vi.fn(async () => {throw new Error('No Blob preparation expected');});
    const bridge: NativeStoreBridge = {
        open: async () => ({...session, changeSequence: 0}), begin: async request => ({...request, handle: crypto.randomUUID()}),
        get: async request => ({rows: request.keys.map(() => null)}), query: async () => ({rows: [], cursor: null, epoch: 0}), count: async () => ({count: 0}),
        readTransfer: async () => {throw new Error('Unexpected transfer');},
        prepare: async request => {payloads.set(request.operationId, (payloads.get(request.operationId) ?? '') + request.payload); return {nextChunk: request.chunkIndex + 1};},
        seal: async request => {batches.push(payloads.get(request.operationId)!.trim().split('\n').map(line => JSON.parse(line) as WireBatchEntry)); return {capability: 'sealed', fingerprint: request.fingerprint};},
        commit: options.commit ?? (async request => ({status: 'committed', operationId: request.operationId, fingerprint: request.fingerprint, changeSequence: 1, tables: ['media']})),
        status: options.status ?? (async request => ({status: 'unknown', operationId: request.operationId})),
        validate: async () => undefined, abort: async () => undefined, changes: async () => ({changes: [], cursor: null}),
        readChangeTransfer: async () => {throw new Error('Unexpected change transfer');},
    };
    return {...createNativeProductStore(bridge, {prepare, discard}), bridge, batches, discard, prepare};
}
const record = (id: string, blob: BinaryClaim['reference']) => ({id, projectId: 'project', filename: 'clip.mp4', mimeType: 'video/mp4', blob});

describe('trusted native prepared claims through actual TS transaction encoding', () => {
    it('preserves claim capability across clones and emits each original claim with its carriers once', async () => {
        const native = fixture(), {reference, claim} = prepared();
        await native.store.transaction('rw', ['media'], async tx => {
            await tx.media.add(record('source', cloneStoredValue(reference)));
            await tx.media.add(record('second-carrier', reference));
        });
        expect(native.prepare).not.toHaveBeenCalled(); expect(native.discard).not.toHaveBeenCalled();
        expect(native.batches[0].filter(entry => entry.kind === 'claim')).toEqual([{kind: 'claim', claim}]);
        expect(native.batches[0].filter(entry => entry.kind === 'mutation')).toHaveLength(2);
        // Already committed immutable references can subsequently be reused without resubmitting a stage.
        await native.store.media.add(record('reused', reference));
        expect(native.batches[1].some(entry => entry.kind === 'claim')).toBe(false);
        expect(() => registerNativePreparedBinary(claim, session)).toThrow('consumed');
    });
    it('rejects foreign/stale sessions, malformed claim DTOs and forged JSON reference authority', async () => {
        const {reference, claim} = prepared();
        expect(() => registerNativePreparedBinary({...claim, path: '/untrusted'}, session)).toThrow();
        expect(() => registerNativePreparedBinary({...claim, reference: {...claim.reference, workspaceId: crypto.randomUUID()}}, session)).toThrow();
        expect(() => reservePreparedBinaryReference(reference, {...session, generation: 2}, 'tx')).toThrow();
        expect(() => reservePreparedBinaryReference(reference, {...session, session: crypto.randomUUID()}, 'tx')).toThrow();
        expect(reservePreparedBinaryReference({...reference}, session, 'tx')).toBeUndefined();
    });
    it('reserves one shared clone capability atomically across different drivers', async () => {
        let release!: () => void, entered!: () => void;
        const held = new Promise<void>(resolve => {release = resolve;}), entering = new Promise<void>(resolve => {entered = resolve;});
        const first = fixture({commit: async request => {entered(); await held; return {status: 'committed', operationId: request.operationId, fingerprint: request.fingerprint, changeSequence: 1, tables: ['media']};}});
        const second = fixture(), {reference, claim} = prepared();
        const writing = first.store.media.add(record('first', reference));
        await entering;
        const repeatedNativeReply = registerNativePreparedBinary(claim, session);
        await expect(second.store.media.add(record('second', cloneStoredValue(repeatedNativeReply)))).rejects.toMatchObject({code: 'conflict'});
        expect(second.batches).toHaveLength(0); expect(second.discard).not.toHaveBeenCalled();
        release(); await writing;
    });
    it('discards confirmed rolled back claims and invalidates every clone', async () => {
        const native = fixture({commit: async () => {throw new Error('lost');}, status: async request => ({status: 'rolledBack', operationId: request.operationId})});
        const {reference, claim} = prepared(), clone = cloneStoredValue(reference);
        await expect(native.store.media.add(record('first', reference))).rejects.toMatchObject({certainty: 'rollback'});
        expect(native.discard).toHaveBeenCalledTimes(1);
        await expect(fixture().store.media.add(record('retry', clone))).rejects.toMatchObject({code: 'closed'});
        expect(() => registerNativePreparedBinary(claim, session)).toThrow('consumed');
    });
    it('retains an uncertain claim and blocks replay instead of discarding possibly committed bytes', async () => {
        const native = fixture({commit: async () => {throw new Error('lost');}, status: async () => {throw new Error('status unavailable');}});
        const {reference, claim} = prepared();
        await expect(native.store.media.add(record('first', reference))).rejects.toBeInstanceOf(UnknownCommitError);
        expect(native.discard).not.toHaveBeenCalled();
        const retry = fixture();
        await expect(retry.store.media.add(record('retry', cloneStoredValue(reference)))).rejects.toBeInstanceOf(UnknownCommitError);
        expect(retry.batches).toHaveLength(0); expect(retry.discard).not.toHaveBeenCalled();
        const repeatedNativeReply = registerNativePreparedBinary(claim, session);
        expect(() => reservePreparedBinaryReference(repeatedNativeReply, session, 'different-transaction')).toThrow(UnknownCommitError);
    });
    it('refuses new claims at the retention bound without evicting an uncertain original identity', async () => {
        vi.resetModules();
        const codec = await import('@/platform/storage/codec');
        const {UnknownCommitError: IsolatedUnknownCommitError} = await import('@/platform/storage/errors');
        const claim: BinaryClaim = {stageId: crypto.randomUUID(), reference: {version: 1, workspaceId: session.workspaceId, binaryId: crypto.randomUUID(), byteLength: 1, mimeType: 'image/png', contentHash: 'a'.repeat(64)}};
        const original = codec.registerPreparedBinaryReference(claim, session);
        codec.reservePreparedBinaryReference(original, session, 'uncertain-operation');
        codec.settlePreparedBinaryReference(original, 'uncertain-operation', 'unknown');
        const live = [];
        for (let index = 1; index < 4096; index++) live.push(codec.registerPreparedBinaryReference({...claim, stageId: crypto.randomUUID(), reference: {...claim.reference, binaryId: crypto.randomUUID()}}, session));
        expect(live).toHaveLength(4095);
        expect(() => codec.registerPreparedBinaryReference({...claim, stageId: crypto.randomUUID()}, session)).toThrow('retention limit');
        expect(() => codec.reservePreparedBinaryReference(codec.registerPreparedBinaryReference(claim, session), session, 'new-operation')).toThrow(IsolatedUnknownCommitError);
        vi.resetModules();
    });
});


describe("E11 native driver final close", () => {
    it("waits admitted original root publication and queued reads, rejects fresh roots and joins the same close", async () => {
        let release!: () => void, entered!: () => void;
        const held = new Promise<void>(resolve => {release = resolve;}), entering = new Promise<void>(resolve => {entered = resolve;});
        const native = fixture({commit: async request => {entered(); await held; return {status: 'committed', operationId: request.operationId, fingerprint: request.fingerprint, changeSequence: 1, tables: ['projects']};}});
        const original = native.store.projects.put({...emptyProject('retained'), id: 'original'});
        await entering;
        const queued = native.store.projects.get('original');
        const closing = native.driver.close(); expect(native.driver.close()).toBe(closing);
        let closed = false; void closing.then(() => {closed = true;});
        await expect(native.store.projects.get('late')).rejects.toMatchObject({code: 'closed'});
        await Promise.resolve(); expect(closed).toBe(false);
        release(); await original; await queued; await closing;
        expect(native.batches).toHaveLength(1); expect(closed).toBe(true);
        expect(native.discard).not.toHaveBeenCalled();
    });
});
