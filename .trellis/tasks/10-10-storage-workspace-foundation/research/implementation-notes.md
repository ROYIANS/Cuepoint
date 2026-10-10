# Workspace foundation implementation evidence

Date: 2026-10-10. Scope: browser-compatible foundation only, with disposable IndexedDB fixtures. No production migration, operating-system file access or provider operation was performed.

## Actual boundary

- `src/lib/workspace.ts` owns workspace identity validation, media-relative references, supplied device-local root resolution, independent Blob staging, SHA-256 integrity and staging disposal. IDs, rather than display names, determine storage components. Studio retains its special owner without inventing a project.
- `uploadMediaFile` prepares complete bytes outside the database transaction and hands a copied Blob to the existing `putMedia` command. That command still validates ownership and atomically inserts/touches. Its failure identity and rollback remain authoritative.
- Cancellation is checked before/after every bounded read, after hashing, across chunk yields and before persistence. Once persistence starts, its actual committed result wins; the caller cannot report cancellation after creating a ready row. Staging disposal releases this browser adapter's reference; it does not delete source bytes or durable media.
- `src/lib/sha256.ts` extracts the existing synchronous production-revision byte hash. `targetRevision` keeps the same canonicalization and `sha256-v1:` output format. Imports do not acquire a new WebCrypto or secure-context prerequisite.
- `tests/helpers/workspaceBinaryFixture.ts` is a read-only fixture tool, not a product export API. It snapshots selected owner fields in a transaction, then hashes outside it. It reports media table Blobs, file material versions and nested setting media separately; version identity prevents historical content from being collapsed into current media.
- The fixture enumerates current slot/cover/reference/material-use, recording, export/music, selected-take/clip, voice-input and retained generation/proposal/batch references, including `audioArrangementProposals` choices, embedded historical take IDs/media/selected-take references, item and clip take IDs, before clips, and receipt selected/added/before/after take references. Embedded take snapshots resolve in their proposal scope even if a live take was deleted; their media still requires the expected owner. Missing owners, foreign owners, missing references, empty bytes and unreadable bytes are explicit observations. The tool performs no deletion, repair, execution or replay.

## Stable comparison input

`tests/fixtures/workspace/originalProductionRevision.ts` is the unchanged source captured from `8b8b709e:src/lib/productionRevision.ts`. SHA-256: `1ee25abc919f5366adc71a3af1b43fb934d12da78acf2e00364ca4423636827e`. The regression checks those bytes, compares current canonical revision outputs and checks the extracted byte hash against Node's standard SHA-256 across block/padding boundaries. The test does not depend on an active dated task directory.

## Compatibility and remaining limits

- `browser-local` names the current single local browser adapter. It is deliberately not a cross-device workspace identity. A later checkpoint/native child must persist and bind a real workspace identity.
- The current `MediaRecord` shape and Dexie schema are unchanged. Hashes and relative references are returned by the staging boundary, not new database columns. Record IDs and owners allow later adapters to derive owned locations.
- The browser importer reads/copies/hashes at most 256 KiB per turn and yields macrotasks between turns. Incremental SHA-256 keeps only its compression state and a 64-byte pending block, with at most 128 bytes of final padding. The complete source and copied Blob still consume storage proportional to file size, and total hash CPU grows with file size. Browser Blob allocation, IndexedDB persistence/quota and device scheduling remain platform-dependent; this does not establish native filesystem performance or constant total memory. The disposable fixture enumerator still uses a full binary `arrayBuffer` outside its read-only transaction; it is a test inventory tool, not a product import/export path. No file-size limit, dependency or Worker architecture was added.
- Path checks establish lexical owner-local paths, including canonical lowercase UTF-8 hexadecimal identity components; they do not establish real filesystem containment through symlinks. The native filesystem adapter must enforce actual-root containment and its own platform path limits.
- Fixture reference resolution means that the referenced row exists under the expected owner. Binary readiness is a separate observation; it does not certify decoding, playback or paid-provider output quality.
- Materials/audio/generated owners are inventoried but their production mutation paths are not rerouted in this child. The approved first integration remains `uploadMediaFile` only. Shared copy contracts for other owners and actual migrations remain later work.

## Validation history

Initial targeted run: 328 passed, one fixture assertion failed because it confused the `field: "blob"` location label with a transported Blob property. The corrected assertion checks actual properties and serialized byte content.

Initial quality run found control-character regex lint errors and unused exports; repaired without allowances. A subsequent quality run had zero source/architecture/unused failures but failed the input-stability guard because a simultaneous build reformatted generated routes. The generated file was restored only after TypeScript token equality with HEAD was verified. Stable serial quality verification passed.

Initial implementation checks after the HTTP-compatible hash extraction (before independent review corrections):

- Root `lint` passed. A temporary strict TypeScript project also included the new tests/helper and passed.
- Full Vitest: 184 files passed; 3,267 tests passed and one existing test skipped. A subsequently added immutable-source checksum assertion was validated by the final three-file workspace run: 40 tests passed.
- Stable serial `quality`: PASS, with zero lint/architecture/unused failures, zero static cycles and the existing 13 reviewed lint allowances / seven unused contracts. There are 548 visible review warnings; this is not a warning-free claim.
- `quality:self-test`: all 88 cases passed. Model catalogue verification passed for 197 files / 85 providers / 1,855 models.
- Final production build passed. The existing large-chunk warning remains. Generated routes were restored after token equality proof, so no generated route diff remains.
- `git diff --check` passed.

The coordinator's independent check remains separate from these implementation results. No commit or push is included in this run.

## Independent review corrections

The frozen pre-fix observations remain under `research/independent-probes/pre-fix-review-probe.test.ts` and `pre-fix-observations.json`. They identified a 32 MiB import main-thread gap of about 460 ms and a 128 MiB gap of about 1.84 s, case-insensitive identity path collisions, and omitted audio arrangement history. Recording the cost alone was insufficient; the implementation was corrected within the approved child boundary.

- `Sha256` now shares an incremental update/digest core with the synchronous production-revision wrapper. Standard Node SHA-256 comparisons cover 55/56/63/64/65-byte padding, partial backing-buffer views, arbitrary update boundaries, empty updates, repeated digest, rejected updates after finalization and sources above 1 MiB. The original source fixture bytes, canonicalization and output format remain unchanged.
- Managed copy now uses bounded independent chunks and macrotask yields, preserving stage/commit ownership and cancellation semantics. Actual `Blob.slice(...).arrayBuffer()` interception proves incomplete/read-failed chunks, pending later-chunk cancellation, cancellation during a yield and a parent deleted during copying leave no ready media record. Timer opportunities are asserted semantically, without making a CI wall-time threshold a product performance claim.
- UTF-8 lowercase hex paths remove ASCII case and separator aliases across POSIX/Windows roots. IDs remain stable and valid Unicode remains distinct, including normalization variants; malformed UTF-16 is explicitly rejected.
- Typed fixtures use real selection and arrangement preview/save/apply commands. Positive, removed-live-take, missing-media, foreign embedded/media/receipt ownership and unreadable-binary cases verify reference projections and unchanged source records. Raw retained-owner projection fixtures remain supplementary coverage, not substitutes for producer invariants.

The first corrected full suite had one 4 MiB byte-array deep-equality assertion hit Vitest's 5 s timeout under concurrent suite load; all other 3,283 tests passed with one pre-existing skip. The same byte comparison now uses Node Buffer equality, retaining exact content verification without per-byte assertion overhead. A separate strict test typecheck found an implicit fixture array type and was corrected with explicit `AudioSegment[]` / `AudioTake[]` annotations. These failed checks are retained here, not treated as passing evidence.

Final serial repair verification:

- Five formal workspace test files: 56 passed (495 ms recorded run, not a product latency guarantee).
- Root TypeScript `lint` and the extra strict test/fixture TypeScript project passed.
- Full Vitest: 186 files passed; 3,284 tests passed and one existing test skipped.
- Production build passed (14.45 s recorded run); the existing large-chunk warning remains.
- Stable serial `quality`: PASS; 13 reviewed lint allowances, 548 visible review warnings, zero lint/architecture/unused failures, 442 owned graph files, 1,798 static value edges, six literal dynamic edges and zero static cycles. Raw output: `research/repair-quality.log`.
- `quality:self-test`: 88 cases passed (`repair-quality-self-test.log`). Model catalogue verification passed for 197 files / 85 providers / 1,855 models at revision `ebe586289d55936b738e4dc822dbdd745196b4f3` (`repair-model-bank.log`).
- Generated routes were proven TypeScript-token equivalent to HEAD `8b8b709e85b390e2c4f68cc8e931487703ab9144`, then restored to baseline SHA-256 `f1572df02731d204a1ef38e4b744a39aa5b2c9dc7a3d85d1d6d3d3b6b6b09d65`. An external generator subsequently reapplied formatting; coordinator was notified to finalize the route after all browser/test watchers finish. This is not a semantic source change or grounds to revert unrelated edits.

Independent post-fix evidence is frozen at `research/independent-probes/post-fix-observations.json`, with source hashes and raw stdout. Under Node v24.11.0/macOS/Vitest/fake-indexeddb, the same 32 MiB import loop measured a maximum event-loop gap of 6.79 ms versus 460.9 ms before correction; 128 MiB measured 9.85 ms versus 1,844 ms. The latter took 2.28 s overall. Sampled RSS grew by roughly 134 MB; these before/after process samples do not measure exclusive or peak allocations. This is actual importer JavaScript responsiveness evidence, not real browser disk, media decoding, rendering, device scheduling or memory-bound proof.

Product and formal test source is frozen for independent final review. The coordinator owns task lifecycle/spec updates and final generated-file cleanup; this implementer performed no commit, push or task lifecycle change.
