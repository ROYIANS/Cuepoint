import type {Id} from "@/domain/types";
import {isStudioLibrary} from "@/domain/types";
import {createId} from "@/lib/ids";
import {Sha256} from "@/lib/sha256";

export type WorkspaceId = string & {readonly __workspaceId: unique symbol};

export interface WorkspaceRef {
    workspaceId: WorkspaceId;
    projectId: Id;
    relativePath: string;
}

export interface WorkspaceRoot {
    workspaceId: WorkspaceId;
    /** Device-local only. Never include this root in a portable reference. */
    absolutePath: string;
}

export interface ManagedCopy {
    mediaId: Id;
    sourceName: string;
    mimeType: string;
    byteLength: number;
    contentHash: string;
    blob: Blob;
    ref: WorkspaceRef;
}

export interface ManagedCopyMetadata {
    workspaceId: WorkspaceId;
    projectId: Id;
    filename: string;
    mimeType: string;
}

export function workspaceId(value: string): WorkspaceId {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("工作区标识无效");
    return value as WorkspaceId;
}

// The existing browser database has no portable workspace identity yet. This
// names its local adapter only; checkpoint work must persist a real identity.
export const BROWSER_WORKSPACE_ID = workspaceId("browser-local");

function assertIdentity(value: string): void {
    if (typeof value !== "string" || !value.trim()) throw new Error("工作区文件缺少归属或标识");
    // UTF-8 replaces lone surrogates with U+FFFD. Reject them so different IDs
    // cannot alias the same bytes; well-formed IDs are never normalized.
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(++index);
            if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("工作区标识包含无效 Unicode");
        } else if (code >= 0xdc00 && code <= 0xdfff) throw new Error("工作区标识包含无效 Unicode");
    }
}

function pathComponent(value: string): string {
    assertIdentity(value);
    // Lowercase UTF-8 hex stays distinct even on case-insensitive filesystems.
    // Prefixing avoids Windows device names and dot components.
    return `id-${Array.from(new TextEncoder().encode(value), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function hasControlCharacters(value: string): boolean {
    return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function assertWorkspaceRef(ref: WorkspaceRef, expectedWorkspaceId: WorkspaceId): void {
    workspaceId(ref.workspaceId);
    if (ref.workspaceId !== expectedWorkspaceId) throw new Error("文件不属于当前工作区");
    assertIdentity(ref.projectId);
    const segments = ref.relativePath.split("/");
    if (segments.some(segment => !segment || segment === "." || segment === ".." ||
        /[\\:*?"<>|]/.test(segment) || hasControlCharacters(segment) || /[. ]$/.test(segment) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) {
        throw new Error("工作区文件路径必须是安全的相对路径");
    }
    const owner = isStudioLibrary(ref.projectId) ? "studio" : `projects/${pathComponent(ref.projectId)}`;
    const prefix = `${owner}/assets/`;
    if (!ref.relativePath.startsWith(prefix)) throw new Error("文件路径与所属项目不一致");
    if (!/^id-(?:[0-9a-f]{2})+$/.test(ref.relativePath.slice(prefix.length))) throw new Error("工作区素材路径编码无效");
}

export function mediaWorkspaceRef(id: WorkspaceId, projectId: Id, mediaId: Id): WorkspaceRef {
    const owner = isStudioLibrary(projectId) ? "studio" : `projects/${pathComponent(projectId)}`;
    const ref = {workspaceId: id, projectId, relativePath: `${owner}/assets/${pathComponent(mediaId)}`};
    assertWorkspaceRef(ref, id);
    return ref;
}

export function resolveWorkspaceRef(ref: WorkspaceRef, root: WorkspaceRoot): string {
    assertWorkspaceRef(ref, root.workspaceId);
    const localRoot = root.absolutePath.replaceAll("\\", "/");
    if (!(localRoot.startsWith("/") || /^[a-zA-Z]:\//.test(localRoot)) ||
        hasControlCharacters(localRoot) || localRoot.split("/").some(segment => segment === "." || segment === "..")) {
        throw new Error("请提供当前设备的绝对工作区目录");
    }
    return `${localRoot.replace(/\/+$/, "")}/${ref.relativePath}`;
}

function sourceName(filename: string): string {
    if (typeof filename !== "string") throw new Error("文件名称无效");
    const name = filename.replaceAll("\\", "/").split("/").at(-1)?.normalize("NFC").trim();
    if (!name || name === "." || name === ".." || hasControlCharacters(name)) throw new Error("文件名称无效");
    return name;
}

function assertMime(mimeType: string): void {
    // Format validation only. Feature import owners still decide supported types.
    if (typeof mimeType !== "string" || hasControlCharacters(mimeType) || !/^[\w!#$&^.+-]+\/[\w!#$&^.+-]+(?:\s*;.*)?$/.test(mimeType)) {
        throw new Error("文件类型无效");
    }
}

function assertNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new DOMException("素材导入已取消", "AbortError");
}

/** Ephemeral staging only: discard releases our Blob reference, never source data. */
class ManagedCopyStage {
    private value: ManagedCopy | undefined;
    private committing = false;

    constructor(copy: ManagedCopy, private readonly signal?: AbortSignal) {
        this.value = copy;
    }

    get copy(): ManagedCopy {
        if (!this.value) throw new Error("暂存素材已经释放");
        return this.value;
    }

    discard(): void {
        if (this.committing) throw new Error("素材正在保存，请等待完成");
        this.value = undefined;
    }

    /** Cancellation ends at the write boundary; a committed row is never reported canceled. */
    async commit<T>(persist: (copy: ManagedCopy) => Promise<T>): Promise<T> {
        if (this.committing) throw new Error("素材正在保存，请等待完成");
        const copy = this.copy;
        try {
            assertNotAborted(this.signal);
            this.committing = true;
            return await persist(copy);
        } finally {
            this.committing = false;
            this.value = undefined;
        }
    }
}

/** Read and verify outside database transactions; no ready record is created here. */
export async function copyIntoManagedWorkspace(input: Blob, metadata: ManagedCopyMetadata, signal?: AbortSignal): Promise<ManagedCopyStage> {
    assertNotAborted(signal);
    workspaceId(metadata.workspaceId);
    assertIdentity(metadata.projectId);
    const filename = sourceName(metadata.filename);
    assertMime(metadata.mimeType);
    if (!(input instanceof Blob) || !Number.isSafeInteger(input.size) || input.size <= 0) throw new Error("文件为空，无法导入");
    const hash = new Sha256();
    const chunks: Blob[] = [];
    // Bound each read/hash/copy turn. A macrotask between chunks lets input,
    // rendering and cancellation run even when Blob reads resolve immediately.
    const chunkSize = 256 * 1024;
    for (let offset = 0; offset < input.size; offset += chunkSize) {
        assertNotAborted(signal);
        const end = Math.min(offset + chunkSize, input.size);
        const bytes = await input.slice(offset, end).arrayBuffer();
        assertNotAborted(signal);
        if (bytes.byteLength !== end - offset) throw new Error("文件复制不完整，请重新导入");
        hash.update(new Uint8Array(bytes));
        chunks.push(new Blob([bytes]));
        assertNotAborted(signal);
        if (end < input.size) {
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            assertNotAborted(signal);
        }
    }
    const blob = new Blob(chunks, {type: metadata.mimeType});
    if (blob.size !== input.size) throw new Error("文件复制不完整，请重新导入");
    const contentHash = hash.digest();
    assertNotAborted(signal);
    const mediaId = createId("med");
    return new ManagedCopyStage({
        mediaId, sourceName: filename, mimeType: metadata.mimeType,
        byteLength: blob.size,
        contentHash,
        blob, ref: mediaWorkspaceRef(metadata.workspaceId, metadata.projectId, mediaId),
    }, signal);
}
