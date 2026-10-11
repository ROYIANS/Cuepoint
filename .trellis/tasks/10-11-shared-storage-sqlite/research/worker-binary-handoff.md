# Binary implementation handoff

Ownership: `/root/native_binary_sessions`, Trellis implementer. No commits, installs, paid calls, credentials/profile reads, or edits to engine/shared-store owned wiring. Peers wired the module and shared facade.

## Implemented

- `desktop/tauri/src-tauri/src/product_binary.rs` + `product_binary/tests.rs`: durable prepare/write/seal/abort intents, ordered raw bounded 256 KiB chunks, stream hashes, fsync/no-overwrite publication, verified claims participating in the exact domain SQL transaction/receipt, final inode/mtime validation before COMMIT, idempotent conservative interruption recovery. Unknown files retained; no physical live GC. Native refs use opaque generated UUIDs with paths managed by existing containment authority. Ordinary files only, no source-path authority.
- All three carriers supported by generic shared codec (`media.blob`, file material version payload, nested setting snapshot media). Domain `BinaryContent` explicitly distinguishes real Blob from opaque native refs; shared codec WeakSet brand prevents authored lookalikes from becoming capabilities. `src/domain/binary.ts`, narrow Blob field changes in `domain/types.ts`/`domain/materials.ts`, protocol type alias coordinated with shared owner.
- `src/lib/storage/nativeBinary.ts` + `binary.ts`: same fixed driver session, closed session projection (transaction handle extras never leak to native binary envelope), raw Tauri writes/reads, metadata availability, immutable generation-scoped cache identity, verified read leases before and after consumer work, actual requested Blob decoding, no fake Blob subclass. Native audio/video preview consumes engine's opaque `product_media_preview/release` commands. URL shape checked against opaque preview ID; no path/file URL accepted. Browser object URL behavior retained.
- `PlaybackFile` primitive initial whole-file streaming hash, bounded reads with current root/parent containment and inode/file checks before/after every response. Engine owns actual desktop protocol lifecycle/CSP/ACL/session/range wiring.
- `src/lib/media.ts`, `components/media/MediaThumb.tsx`: common preview lifecycle, loading/missing/corrupt/error state, focus/visibility refresh, abort + owned URL cleanup, logical rows retained.
- `lib/audio/buffers.ts`: native cached AudioBuffer reuse still opens/verifies source; generation/immutable identity cache key. Last optional ProductStore supports actual bound-owner proof; browser content hash shares decoded buffers across equivalent IndexedDB Blob clones.
- `lib/ai/referenceWire.ts`, `lib/references/import.ts`/`package.ts`: actual verified bytes for images/documents/digests; bound StoreTx callbacks and helper propagation; recheck bytes and logical provenance before model input leaves preparation. Exact existing worker AbortSignal.reason handling preserved (reviewed quality/debt allowance).
- `lib/projectPackage.ts`, `audioProjectPackage.ts`, `productionHandoff.ts`: explicit snapshot tx ownership and nested validators, actual bytes after metadata snapshot, final availability verification before export result, unknown-commit certainty retained on import, truthful missing/corrupt handoff slots.
- `lib/shotMedia.ts`, `useShotMedia.ts`: logical metadata map retained with separate verified availability snapshot; native refs are pending until checked. Pure gap/filter/delivery consumers accept unchanged map API, requiring ready state. Only referenced slot IDs read. Short cache is keyed by workspace generation + immutable binary identity; focus clears it. Export/preflight independently reverify bytes.
- Shared reactive hook conversions plus binary consumers: `components/agent/ReferenceAttachments.tsx`, `ReferenceLibrary.tsx`, `components/audio/AudioExports.tsx`, `AudioSources.tsx`, `VoiceReferencePicker.tsx`, `components/audioMusic/shared.tsx`, `components/music/MusicWorkspacePage.tsx`, `components/slots/GenerationSlotCard.tsx`, `components/studio/materials/MaterialPreview.tsx`, `lib/mediaPicker.ts`. Selection/voice decoding/export uses actual read leases; metadata size alone is only initial eligibility.
- R8 music variants: `Project.musicVariantLinks` typed optional product field; MusicWorkspacePage no longer reads/writes localStorage variant links. Engine owns atomic switch helper. `lib/packages/projectPackageCodec.ts` validates all group members against actual owned music drafts/types/consistent reciprocal groups and remaps actual immutable draft IDs alongside audio package rows.
- Tests: `nativeBinaryAccess.test.ts`, `nativeBinaryProduct.test.ts`, updated `projectPackage.test.ts`, `projectPackageRelations.test.ts`, `productionHandoff.test.ts`, `shotFilters.test.ts`, `productStorageQueries.test.ts`. Raw browser hooks are test-only actual adapter fault/scheduling injection; no production hook API invented.
- Narrow test helper `tests/helpers/nativeProductProbe.ts` actual bounded Rust Vec response -> Uint8Array.buffer adaptation. This JSON-line process transport is fixture-only; production stays raw Tauri IPC. Shared peer owns subsequent helper options/state/test-facade changes.

## Reuse successful proof (no redundant rerun needed)

Exact commands, exit statuses, source/proof scope, and raw logs are in `worker-binary-checks.json` and corresponding `worker-binary-*.log`.

- Rust binary filter: 13/13 actual file/SQLite tests, including 33 MiB+123 deterministic bytes and bounded playback primitive.
- Explicit native lane: `CUEPOINT_NATIVE_STORAGE_ACCEPTANCE=1 ... pnpm exec vitest run tests/nativeBinaryProduct.test.ts`, 2/2 pass, 42.58 seconds. Actual shared putMedia/createFileMaterial/promoteLegacyMaterial -> Rust -> SQLite/managed files. All 3 carriers, external source unlink, independent snapshot after original managed file unlink, reopen, actual warm AudioBuffer corruption/missing rejection. Explicit acceptance fails if pinned probe absent; default generic suite does not claim native proof.
- Consumer suite: 8 files,76 tests pass.
- Expanded query/music/ZIP/access suite: 5 files,73 tests pass.
- Final shared hook seam + binary access: 2 files,11 tests pass.
- Whole `pnpm lint` (TypeScript build) passed at last snapshot, confirmed exec exit 0. Main must retain final freeze/gate.
- Scoped direct ESLint raw: 1 existing reviewed error,53 warnings; sole error is unchanged references/import worker exact abort reason, covered by existing `quality/debt.json`. No new owned direct ESLint errors. Formal baseline gate belongs main.

## Remaining acceptance / limits

- Actual packaged WKWebView continuing Range/seek playback and protocol revocation are still pending main/engine acceptance. Unit range bounds + native primitive prove storage mechanics, not WebKit compatibility.
- The >32 MiB deterministic carrier fixture is not a valid PNG; it is binary storage and independence proof. Valid media playback fixtures are a separate packaged acceptance lane.
- Requested non-audio/video preview/decoder/provider/ZIP paths materialize real Blob bytes proportional to requested files. Native audio/video media elements use opaque Range URLs. Metadata queries never hydrate all files.
- Native Rust active read leases are bounded to 8. TS simultaneous requested image previews currently rely on underlying lease bounds; a large grid may need queued read scheduling (avoid interpreting legitimate saturation as missing/corrupt). Review this before accepting a dense native library.
- Availability UI refreshes on focus/visibility and metadata changes; execution/export/provider preparation always revalidates actual leases. Disk changes while a media element remains displayed are rejected by native protocol; visible media-element error handling should be inspected during packaged fault acceptance.
- No Windows/Linux packaged proof claimed; no cloud sync, migration, live GC, or source-file watcher introduced.
