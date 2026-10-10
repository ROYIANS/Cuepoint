# Managed workspace foundation

## 1. Scope / Trigger

Apply when changing media-file import, workspace-relative references or the shared byte hash. The current implemented adapter prepares independent browser Blobs and persists through Dexie. It does not create operating-system workspace files, migrate to SQLite, synchronize devices or establish a durable portable workspace identity.

## 2. Signatures / Owners

- `src/lib/workspace.ts`: `workspaceId(value)`, `mediaWorkspaceRef(workspaceId, projectId, mediaId)`, `resolveWorkspaceRef(ref, root)` and `copyIntoManagedWorkspace(input, metadata, signal?)`.
- `WorkspaceRef` contains workspace identity, project/studio owner and relative path. `WorkspaceRoot.absolutePath` is device-local and is never a portable field.
- The copy function returns a stage with `copy: ManagedCopy`, `discard()` and `commit(persist)`. The copy contains a new media ID, display filename, MIME, byte length, SHA-256, independent Blob and owned reference.
- `uploadMediaFile(projectId, file, signal?)` prepares the stage, then calls the existing `src/db/media.ts` `putMedia` command. `putMedia` retains parent validation, immutable insertion, project touch and atomic rollback.
- `src/lib/sha256.ts`: incremental `Sha256.update(Uint8Array).digest()` and synchronous `sha256Bytes(input)`. `targetRevision` in `productionRevision.ts` retains canonicalization and the `sha256-v1:` prefix.

## 3. Contracts / Invariants

Project and media path components are `id-` followed by lowercase hexadecimal UTF-8 bytes of the exact well-formed ID. Do not normalize identity strings or retain their literal letters: case-insensitive and Unicode-normalizing filesystems must not alias distinct valid IDs. Unpaired UTF-16 surrogates reject before UTF-8 replacement. Studio media stays under `studio/assets/`; other owners use `projects/<encoded-owner>/assets/<encoded-media>`.

The resolver validates owner, expected workspace, the encoded media component and relative-path safety. It resolves against a supplied absolute device root. This is lexical containment only: a future native adapter must separately enforce real-root/symlink containment, filesystem limits and durable copy recovery.

Import reads, copies and hashes bounded 256 KiB chunks outside database transactions. Each completed chunk becomes an independent Blob part. Macrotask opportunities between chunks let cancellation and other browser work execute. Empty files, incomplete reads, metadata failure and source-read failure reject before a ready record exists. Filename is display metadata; storage names derive from IDs. Copies never delete source bytes.

Cancellation is checked before reads, after reads, between chunks and before persistence. Once the persistence callback starts, its actual success/failure remains authoritative; cancellation cannot report an already committed row as canceled. Commit and failure release the stage reference. Concurrent commit/discard while saving rejects. This browser stage is ephemeral and provides no crash-safe native staging claim.

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

The read-only `tests/helpers/workspaceBinaryFixture.ts` supplements migration planning: it enumerates media, file material versions, nested setting media and explicit recording/output/history references, including audio-arrangement selection/item/before/receipt snapshots. It reports missing/foreign references, absent owners, empty bytes and read failure. It is not a full-workspace codec, a production migration or a secrecy guarantee for arbitrary user-authored strings. Native storage, persistent workspace identity, per-table checkpoint projections and live-provider tests remain separate deliverables.

## 7. Wrong vs Correct

```ts
// Wrong: persistence precedes independent copy/integrity checks.
await putMedia({...record, blob: originalFile});
// Correct: prepare outside the transaction, commit through the existing owner.
const stage = await copyIntoManagedWorkspace(file, metadata, signal);
await stage.commit(copy => putMedia({...record, id: copy.mediaId, blob: copy.blob}));
```

Wrong: use `encodeURIComponent(id)` unchanged as a cross-platform case-sensitive filename. Correct: preserve the ID and derive an ASCII lowercase-hex component from its validated UTF-8 bytes. Never normalize an identity just to make it fit a filesystem.
