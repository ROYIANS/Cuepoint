# Workspace and migration foundation design

Status: implemented and independently accepted on 2026-10-10; product commit recorded in task.json; archive follows the approved batch. This is the first implementation child of `desktop-storage-sync`.

## Boundary

The current product stores media in IndexedDB Blobs. The future desktop product needs the same business owners to address files inside an application-owned workspace. This child introduces a storage-neutral boundary without pretending that a browser Blob is already an OS file. Callers retain stable media IDs; storage details are behind a managed-copy result and a workspace-relative location.

## Proposed contracts

```ts
type WorkspaceId = string & { readonly __workspaceId: unique symbol };

interface WorkspaceRef {
  workspaceId: WorkspaceId;
  projectId: Id;
  relativePath: string;
}

interface ManagedCopy {
  mediaId: Id;
  sourceName: string;
  mimeType: string;
  byteLength: number;
  contentHash: string;
  blob: Blob;
  ref: WorkspaceRef;
}

interface ManagedCopyStage {
  readonly copy: ManagedCopy;
  discard(): void;
  commit<T>(persist: (copy: ManagedCopy) => Promise<T>): Promise<T>;
}

copyIntoManagedWorkspace(input: Blob, metadata: { workspaceId: WorkspaceId; projectId: Id; filename: string; mimeType: string }, signal?: AbortSignal): Promise<ManagedCopyStage>
```

The exact names may change to match existing conventions, but the semantics are fixed: normalize the filename for display and a collision-safe relative storage name; copy bytes before returning; compute a deterministic content hash; reject empty or invalid input; do not mutate the source.

IDs are encoded as `id-` followed by their UTF-8 bytes in lowercase hexadecimal. This keeps distinct authored/legacy IDs distinct on Windows and other case-insensitive filesystems without changing the IDs themselves. Valid Unicode is not normalized; malformed UTF-16 (unpaired surrogates) is rejected before UTF-8 conversion, retaining the old encoder's rejection instead of silently aliasing replacement characters. Project files use `projects/id-<hex>/assets/id-<hex>`; studio files use `studio/assets/id-<hex>`. Media references require the canonical lowercase byte encoding. These references are not yet persisted, so this review correction changes no durable record or migration format.

The module validates `relativePath` as a normalized, workspace-local path. It rejects absolute paths, `..` traversal, empty segments and a workspace ID mismatch. Absolute OS paths may be retained only as non-authoritative diagnostic provenance in a later adapter, never in a portable reference.

## Integration shape

The browser staging adapter reads at most 256 KiB per slice, verifies each read length, hashes with a shared incremental SHA-256 state, and copies the read bytes into independent chunk Blobs. It yields a macrotask between chunks and checks cancellation before/after reads and yields. Only the complete independent Blob can reach `commit`; partial chunks never create a ready row. The synchronous `sha256Bytes` wrapper remains available for the existing canonical production revision. SHA-256 finalization allocates at most two 64-byte padding blocks rather than a full-file padding array. The staged Blob still retains the full copied content, so this is a responsive browser boundary rather than a native filesystem adapter or a constant-total-memory claim.

The first call site is the media import path. `uploadMediaFile` should stage through the managed-copy primitive and then call the existing `putMedia` owner with the independent Blob and stable ID. If the database write fails, the primitive's staged content is discarded and no ready reference is returned. Existing `putMedia` remains the transaction owner for project ownership and `touchProject` behavior.

The fixture layer is read-only with respect to production data. It walks current database owners and nested material payloads, producing a manifest of stable IDs, byte lengths, hashes and unresolved references. It includes audio arrangement selection snapshots and their media references separately from live take references, plus choices, item/clip, before and receipt take references. A removed live take does not erase an embedded take snapshot; missing live take or media references remain explicit, and nested/project/receipt ownership is checked. Only reference projections are exported. It does not export secrets, caches or runtime claims and does not change ZIP or project-package behavior yet.

## Failure semantics

- Source read failure, cancellation, zero bytes or unsupported metadata: reject before database mutation.
- Database rejection after staging: clean the staged content and propagate the original failure.
- Same display filename: preserve separate IDs and collision-safe storage names.
- Missing managed bytes discovered later: retain the stable reference and surface an unavailable state; do not delete another device's copy.
- Future adapter crash: staged files may be reclaimed only by a later retention-aware cleanup pass.

## Compatibility and tests

Use the current `MediaRecord` shape and existing `kindFromMime`/owner checks. Do not change Dexie schema in this child. Tests should use `fake-indexeddb`, in-memory Blobs and temporary fixture objects; no filesystem permission or cloud account is required.
