# Managed workspace foundation

## 1. Scope / Trigger

Apply when changing media-file import, workspace-relative references, managed binary consumption or the shared byte hash. Browser keeps independent Blobs; the full native SQLite adapter publishes workspace-owned hashed files and persists opaque references. Both use the same commands and ProductStore. Actual isolated acceptance gates normal activation. The schema-4 prototype in `native-workspace.md` is a separate reference lane. There is no migration or dual-owner mirror. Read `shared-product-storage.md` for all three binary carriers and transaction claims, and `native-product-runtime.md` for independent external Save.

## 2. Signatures / Owners

- `packages/studio/src/features/library/services/workspace.ts`: `workspaceId(value)`, `mediaWorkspaceRef(workspaceId, projectId, mediaId)`, `resolveWorkspaceRef(ref, root)` and `copyIntoManagedWorkspace(input, metadata, signal?)`.
- `WorkspaceRef` contains workspace identity, project/studio owner and relative path. `WorkspaceRoot.absolutePath` is device-local and is never a portable field.
- The copy function returns a stage with `copy: ManagedCopy`, `discard()` and `commit(persist)`. The copy contains a new media ID, display filename, MIME, byte length, SHA-256, independent Blob and owned reference.
- `uploadMediaFile(projectId, file, signal?)` prepares the stage, then calls the existing `packages/studio/src/features/library/commands/media.ts` `putMedia` command. `putMedia` retains parent validation, immutable insertion, project touch and atomic rollback.
- `packages/studio/src/platform/media/sha256.ts`: incremental `Sha256.update(Uint8Array).digest()` and synchronous `sha256Bytes(input)`. `targetRevision` in `platform/data/revision.ts` retains canonicalization and the `sha256-v1:` prefix.

## 3. Contracts / Invariants

Project and media path components are `id-` followed by lowercase hexadecimal UTF-8 bytes of the exact well-formed ID. Do not normalize identity strings or retain their literal letters: case-insensitive and Unicode-normalizing filesystems must not alias distinct valid IDs. Unpaired UTF-16 surrogates reject before UTF-8 replacement. Studio media stays under `studio/assets/`; other owners use `projects/<encoded-owner>/assets/<encoded-media>`.

The resolver validates owner, expected workspace, the encoded media component and relative-path safety. It resolves against a supplied absolute device root. This helper provides lexical containment only. The full native binary owner separately validates the fixed root and actual parent/file identity, rejects symlink escapes, and implements durable intent/claim recovery; its opaque binary IDs do not derive authority from this helper.

The full SQLite/filesystem owner never accepts a renderer-selected absolute root. Rust resolves its trusted application-private root, receives bounded chunks, stages/hashes bytes and joins publication claims to the domain/evidence row commit. Media, file material versions and immutable setting snapshots have independent managed ownership. A missing file retains asset/reference rows and is reported as `missing`; a changed file is `corrupt`. The source path never remains live authority. Full-product operations do not call the old schema-4 workspace ensure/create commands.

Import reads, copies and hashes bounded 256 KiB chunks outside database transactions. Each completed chunk becomes an independent Blob part. Macrotask opportunities between chunks let cancellation and other browser work execute. Empty files, incomplete reads, metadata failure and source-read failure reject before a ready record exists. Filename is display metadata; storage names derive from IDs. Copies never delete source bytes.

Cancellation is checked before reads, after reads, between chunks and before persistence. Once the persistence callback starts, its actual success/failure remains authoritative; cancellation cannot report an already committed row as canceled. Commit and failure release the stage reference. Concurrent commit/discard while saving rejects. This browser stage is ephemeral. Native publication uses separate durable intents and atomic claims rather than pretending this stage provides native recovery.

Hashing does not depend on WebCrypto, a secure context or a cloud account. Incremental hashing retains only compression state and a partial block; media-sized padded buffers are forbidden at the normal importer boundary. A final Blob and stored media still require content storage proportional to the file size. `browser-local` identifies the local adapter only; never use it to join unrelated synchronized workspaces.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Same display filename, distinct imports | New IDs and distinct owned paths |
| IDs differ by case or valid Unicode spelling | Distinct case-folded filesystem paths |
| Unpaired surrogate, empty ID or foreign workspace | Reject before path resolution or persistence |
| Absolute/traversing/foreign-owner/invalid encoded relative path | Reject, no filesystem access |
| Empty, truncated or failed source read | Preserve source and error, no ready media row |
| Cancel before persistence | Abort and release staging, no database write |
| Cancel after persistence begins | Report the actual database outcome |
| Parent deleted during copy or project touch fails | Existing `putMedia` parent check/transaction rolls back |
| Large media import | Bounded hash/read turns with real event-loop opportunities |
| Missing managed bytes later | Preserve references; do not infer a replicated logical deletion |

## 5. Good / Base / Bad Cases

Good: independently copy a video, allow cancellation between chunks, then hand the complete Blob to the existing transaction owner. Base: a Studio import remains valid without creating a `projects` row. Bad: use an original OS path as live authority, lowercase authored IDs, hash an entire large video synchronously on the UI thread, or run Blob preparation inside a Dexie write transaction.

## 6. Tests Required

Use actual importer/repository calls and fake IndexedDB for no-ready-row, deleted-parent, touch failure, same-name and Studio cases. Test independent copied bytes, incremental block/padding/hash vectors, ordinary-HTTP behavior with WebCrypto absent, cancellation during chunked reading and macrotask progress before completion. Preserve immutable original-source revision comparisons and source checksums under stable `tests/fixtures/` paths.

The read-only `tests/helpers/workspaceBinaryFixture.ts` supplements workspace/codec inspection: it enumerates media, file material versions, nested setting media and explicit recording/output/history references, including audio-arrangement selection/item/before/receipt snapshots. It reports missing/foreign references, absent owners, empty bytes and read failure. It is not a full-workspace codec, a production migration or a secrecy guarantee for arbitrary user-authored strings. Native storage, persistent workspace identity, per-table checkpoint projections and live-provider tests remain separate deliverables.

## 7. Wrong vs Correct

```ts
// Wrong: persistence precedes independent copy/integrity checks.
await putMedia({...record, blob: originalFile});
// Correct: prepare outside the transaction, commit through the existing owner.
const stage = await copyIntoManagedWorkspace(file, metadata, signal);
await stage.commit(copy => putMedia({...record, id: copy.mediaId, blob: copy.blob}));
```

Wrong: use `encodeURIComponent(id)` unchanged as a cross-platform case-sensitive filename. Correct: preserve the ID and derive an ASCII lowercase-hex component from its validated UTF-8 bytes. Never normalize an identity just to make it fit a filesystem.
