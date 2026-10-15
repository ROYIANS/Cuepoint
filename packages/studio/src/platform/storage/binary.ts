import type {BinaryContent} from "../media/binaryTypes";
import {isBinaryReference} from "./codec";
import {StorageError} from "./errors";
import type {BinaryAvailability, NativeBinaryServices} from "./nativeBinary";
import {Sha256} from "../media/sha256";
import {IPC_CHUNK_BYTES} from "./protocol";

let nativeServices: NativeBinaryServices | undefined;
const blobIds = new WeakMap<Blob, number>();
let nextBlobId = 0;

/** Startup binds once to the fixed product driver; failure never changes owner. */
export function installNativeBinaryAccess(services: NativeBinaryServices): void {
    if (nativeServices && nativeServices !== services) throw new StorageError("scope", "素材存储已绑定其他工作区");
    nativeServices = services;
}

function native(): NativeBinaryServices {
    if (!nativeServices) throw new StorageError("unavailable", "工作区素材存储尚未打开");
    return nativeServices;
}

export interface BinaryReadLease {
    readonly identity: string;

    cacheIdentity(): Promise<string>;

    readBlob(signal?: AbortSignal): Promise<Blob>;
}

/** Consumers may cache decoded content by identity. The native owner verifies
 * availability before the callback and verifies again before its result escapes. */
export async function withBinaryReadLease<T>(binary: BinaryContent, consume: (lease: BinaryReadLease) => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    if (binary instanceof Blob) {
        let identity = blobIds.get(binary);
        if (identity === undefined) {
            identity = ++nextBlobId;
            blobIds.set(binary, identity);
        }
        const result = await consume({
            identity: `blob:${identity}`, cacheIdentity: async () => {
                const hash = new Sha256();
                for (let offset = 0; offset < binary.size; offset += IPC_CHUNK_BYTES) {
                    signal?.throwIfAborted();
                    hash.update(new Uint8Array(await binary.slice(offset, offset + IPC_CHUNK_BYTES).arrayBuffer()));
                    await new Promise<void>(resolve => setTimeout(resolve, 0));
                }
                signal?.throwIfAborted();
                return `blob-sha256:${hash.digest()}:${binary.size}:${binary.type}`;
            }, readBlob: readSignal => {
                readSignal?.throwIfAborted();
                return Promise.resolve(binary);
            }
        });
        signal?.throwIfAborted();
        return result;
    }
    if (!isBinaryReference(binary)) throw new StorageError("invalid", "素材字节引用未经存储层验证");
    const lease = await native().open(binary, signal);
    let completed = false;
    try {
        signal?.throwIfAborted();
        const result = await consume({...lease, cacheIdentity: () => Promise.resolve(lease.identity)});
        await lease.verify(signal);
        completed = true;
        return result;
    } finally {
        if (completed) await lease.close();
        else await lease.close().catch(() => undefined);
    }
}

export function readBinaryBlob(binary: BinaryContent, signal?: AbortSignal): Promise<Blob> {
    return withBinaryReadLease(binary, lease => lease.readBlob(signal), signal);
}

/** Metadata identity only; callers must separately verify availability. */
export async function binaryCacheIdentity(binary: BinaryContent): Promise<string> {
    if (binary instanceof Blob) {
        let identity = blobIds.get(binary);
        if (identity === undefined) {
            identity = ++nextBlobId;
            blobIds.set(binary, identity);
        }
        return `blob:${identity}`;
    }
    if (!isBinaryReference(binary)) throw new StorageError("invalid", "素材字节引用未经存储层验证");
    return native().identity(binary);
}

export async function binaryAvailability(binary: BinaryContent, signal?: AbortSignal): Promise<BinaryAvailability> {
    signal?.throwIfAborted();
    if (binary instanceof Blob) return "ready";
    if (!isBinaryReference(binary)) throw new StorageError("invalid", "素材字节引用未经存储层验证");
    return native().availability(binary, signal);
}

export async function verifyBinaryAvailable(binary: BinaryContent, signal?: AbortSignal): Promise<void> {
    const state = await binaryAvailability(binary, signal);
    if (state !== "ready") throw new StorageError("unavailable", state === "missing" ? "素材已丢失，请重新导入" : "素材内容已损坏，无法使用");
}

/** Requested preview bytes only; callers release the owned object URL. */
export async function createBinaryObjectUrl(binary: BinaryContent, signal?: AbortSignal): Promise<{
    url: string;
    release(): void
}> {
    if (!(binary instanceof Blob) && /^(audio|video)\//.test(binary.mimeType)) {
        if (!isBinaryReference(binary)) throw new StorageError("invalid", "素材字节引用未经存储层验证");
        const services = native();
        if (!services.preview) throw new StorageError("unavailable", "原生媒体播放尚未就绪");
        return services.preview(binary, signal);
    }
    const blob = await readBinaryBlob(binary, signal);
    signal?.throwIfAborted();
    const url = URL.createObjectURL(blob);
    let released = false;
    return {
        url, release() {
            if (!released) {
                released = true;
                URL.revokeObjectURL(url);
            }
        }
    };
}
