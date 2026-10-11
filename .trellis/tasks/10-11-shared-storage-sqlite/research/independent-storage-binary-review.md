# Independent focused storage / binary review

Reviewer: `/root/storage_binary_review`, dispatched Trellis checker. Date: 2026-10-12 (Asia/Shanghai). Active task: `10-11-shared-storage-sqlite`. This is a focused review of storage/binary correctness during active integration, **not** complete product acceptance. No product files, real user profiles, keys, remote providers, desktop windows or commits were touched. Source identities are in `independent-storage-binary-review-sources.json`; peers may change these files after this snapshot.

## Findings (fixed)

None. Main explicitly assigned read-only product review because other implementers own these files. The main session has accepted the findings and will coordinate fixes. Only this review, its reproducibility script, logs and source identity evidence were written.

## Findings (not fixed)

### SB01 — P1: a read lease remains usable after its managed parent becomes an external symlink

- Locations: `desktop/tauri/src-tauri/src/product_binary.rs:713`, `:718`, `:735`; compare containment-aware `PlaybackFile::read_chunk` at `:210`. `workspace.rs:735` validates root/database identities, but not binary parent directories.
- Actual trigger: create a fresh disposable native workspace; persist four actual bytes through the shared TS store and actual Rust bridge; open a managed binary lease; move `root/assets` to a sibling directory outside the workspace; replace `root/assets` with a symlink to that directory; call the existing lease's `readBlob()` and `verify()`.
- Observed: both operations succeeded and returned `[1,2,3,4]`. This is actual Rust/file evidence, not a mocked transport. The moved directory remained within the temporary test container and was removed in cleanup.
- Mechanism: the lease retains an absolute `path`; later operations call `FileIdentity.check`, which validates final ordinary-file identity/mtime but does not re-resolve parent containment. The symlink reaches the same original inode, so those checks pass. `read_start` initially uses `paths::managed`; its result is incorrectly treated as permanent containment authority.
- Required fix: revalidate root/parent containment against the fixed root and derived binary-relative path before and after each chunk and during final hash verification. Reject and retire a lease once containment/identity fails; do not accept it again merely because a path is restored. Inspect cached write-stage paths for the equivalent parent replacement seam; that write case was not executed by this review.
- Required regression: actual Rust and TS bridge tests for parent directory replacement/symlink after open, root replacement, replacement during final verification, and handle reuse after failure. Retain the valid ordinary-file and Range playback tests. Never follow or erase the external directory.
- Contracts: R5/R6/R7; AC6/AC9; native containment boundary.

### SB02 — P1: concurrent valid image preview reads fail at the native lease limit

- Locations: `src/lib/storage/nativeBinary.ts:176-180`, `src/lib/storage/binary.ts:39-51`, `src/lib/media.ts:45-50`, `desktop/tauri/src-tauri/src/product_binary.rs:669-670`.
- Actual trigger: run 12 concurrent operations using the existing `open -> readBlob -> verify -> close` path against one valid committed image binary in a disposable actual Rust workspace. Each operation closes its own lease as soon as it completes; the reproducer does not intentionally hold all leases until the whole group settles.
- Observed: 8 operations completed, 4 failed with `{code:"busy", message:"Too many active binary read leases"}`. No file was missing or corrupt.
- Mechanism: all callers issue `readStart` immediately; Rust correctly enforces 8 active leases, but TS supplies no bounded queue. A dense gallery/material grid can start these requests together. `useBinaryPreview` converts the resulting rejection to a lasting generic error until a later focus/visibility/dependency refresh.
- Required fix: queue native read-lease acquisition with a shared bounded scheduler. A slot must remain owned until native close settles, and must be released on every failed open/read/verify/close/cancel path. Remove aborted waiting requests before issuing IPC; do not relabel saturation as missing/corrupt or retry paid/user mutation callbacks. Coordinate other operations that use read leases, including audio decode/export/provider preparation.
- Required regression: more than 8 real concurrent preview reads all finish; canceled queued work never opens a native lease; a failed open/verification releases capacity; close failures cannot leave an unbounded queue/false ready state. An actual dense image-grid check remains part of packaged acceptance.
- Contracts: R5/R6; AC6/AC7.

### SB03 — P1: notification subscribers can turn a confirmed commit into a rejected caller result

- Locations: `src/lib/storage/native.ts:213`, `:236-237`; `src/lib/storage/browser.ts:61-65`; classification consequence at `src/db/agentTools.ts:385-387`.
- Actual trigger, both adapters: subscribe a listener that throws an ordinary Error; put a row; catch the rejected write; unsubscribe; get the same row.
- Observed: native returned `Error: review subscriber fault`, yet the actual SQLite row `{id:"review-notified-commit",name:"actually committed"}` was readable. The real Dexie/fake-indexeddb browser adapter likewise rejected with `Error: review browser subscriber fault`, while its row persisted.
- Mechanism: notifications execute after authoritative commit. Native's first listener throw rejects `notify`; its fallback invokes the same listeners without isolation and throws again. Browser directly invokes listeners after Dexie resolves the transaction. Both allow an observer fault to escape as a mutation failure. Existing `executeAtomicTool` wraps an ordinary caught error as `AtomicToolRollbackError`, so the error can acquire false rollback certainty even though business rows and the completed ledger committed. Normal `runChat` can recover if it successfully reads the completed ledger; that secondary recovery does not make the storage return value correct. This review did not execute the full Agent recovery sequence.
- Required fix: isolate each subscriber's failure so it cannot alter the committed callback result or prevent later subscribers receiving the event. Separate change-metadata retrieval failure from subscriber delivery failure; fallback delivery must be equally isolated. Keep durable operation status handling for genuinely ambiguous acknowledgement failures. Do not convert a confirmed commit into unknown/rollback simply because a listener failed.
- Required regression: both adapters return the original callback result when one listener throws; other listeners still run once; committed rows and sequence are retained. Add an actual `executeAtomicTool` case with a throwing subscriber proving the caller receives its committed result, saved replay returns it once, and no false rollback classification occurs.
- Contracts: R3/R4/R6; AC3/AC4/AC7.

### SB04 — P2: large supported UTF16 property names cannot decode

- Location: `src/lib/storage/codec.ts:98`.
- Actual trigger: encode an ordinary object whose property name has 180,000 `x` code units followed by one unpaired high surrogate; decode the returned `obj16` encoding.
- Observed: encoding completed, decoding threw `RangeError: Maximum call stack size exceeded`.
- Mechanism: value strings already decode in bounded 8,192-unit chunks, but `obj16` property names use `String.fromCharCode(...raw)` without chunking. The storage codec promises support for lossless arbitrary authored property names and does not declare a smaller key length cap. This is an API roundtrip failure; the review does not claim the normal UI commonly creates this input.
- Required fix: use the existing bounded UTF16 reconstruction approach for property names as well as value strings; preserve duplicate-property checks, own-property semantics and unpaired units. Do not add an undocumented product limit or normalize the key.
- Required regression: long UTF16 names, long well-formed names in an `obj16` object, mixed reserved names and duplicate malformed wire names; actual native put/get/reopen if this shape is supported in durable structured extensions.
- Contracts: R4; AC1; local lossless row codec.

### SB05 — P2: visible media-element failures have no route back to shared preview state

- Locations: `src/components/media/MediaThumb.tsx:34-39`; `src/lib/media.ts:45-61`. Inspect all other consumers of `useBinaryPreview` when fixing the shared seam.
- Source-confirmed trigger: a native video preview reaches shared state `ready`; its underlying managed file later disappears or changes; the native Range handler returns 410 on a subsequent read; the media element emits an error. The rendered `<video>` and `<img>` have no error callback, and the hook only changes state when initial URL preparation fails or when focus/visibility/dependencies refresh it.
- Consequence: the mounted view can continue reporting ready in application state instead of showing missing/corrupt/read failure, even though native delivery has refused bytes. This review did not execute that event in actual WKWebView; the source lacks the state transition irrespective of WebKit-specific error timing.
- Required fix: provide one shared, current-owner media error handler that rechecks actual binary availability and publishes missing/corrupt/error for the initiating binary/preview identity. Release/revoke its URL and preserve logical metadata. Ignore late errors from an old URL or unmounted/changed owner. An image decode error with present valid bytes should remain a preview/read error rather than falsely claim missing material.
- Required regression: actual production callbacks for deletion/corruption while mounted, obsolete URL errors after switching media, no logical deletion, and media present but unsupported/decode-invalid. Packaged WKWebView Range/seek/error acceptance remains required separately.
- Contracts: R5/R6; AC6/AC7.

## Other inspected mechanisms

- Native commit acknowledgement recovery checks durable status with the same workspace/operation/fingerprint; committed outcomes are checked against operation/fingerprint, and pending/not-found/status failure remain unknown. No additional defect was found in that focused path, apart from SB03 after confirmation.
- Binary claims are hashed and published before the SQL writer, checked against every declared carrier, claimed inside the row/receipt transaction, and rechecked before COMMIT. Already committed references are validated against the binary catalog; missing files may correctly retain logical references. No new carrier/claim atomicity defect was found by source inspection. Existing actual carrier/recovery proofs are reused below; they are not rerun or upgraded to packaged claims.
- Indexed projections implement numeric order and UTF16 code-unit order; overlay matching and primary-key tie sorting use the shared comparison. Query pages track one table epoch, and explicit scopes remain enforced. This focused review does not independently certify every index/registry case.
- Large metadata pages and transfers are bounded at IPC, and requested byte transfers use bounded chunks. `Collection.count/first/limit` currently retrieve the full selected row set before reducing it (`store.ts:14-19`); representative large-history/count/limited-query measurement is still needed under the implementation plan. No benchmark or broad performance failure is claimed here.
- Opaque native preview URLs and range primitives have source/unit evidence. CUA is blocked by locked macOS, so this report claims no real WK playback/seek, microphone, print or packaged relaunch outcome.
- Owning runtime/workspace specs still describe the prior IndexedDB stage. Main must synchronize their final executable contracts after verified SQLite activation; this interim review does not rewrite them while implementation is active.

## Verification

- **Repository `pnpm lint` / TypeCheck: PASS**, exit 0. Exact command: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint`. This repository script runs `tsc -b --pretty false`; log: `independent-storage-binary-types.log`.
- **Formal ESLint/quality gate: not rerun in this focused review**. Main retains the complete-scope formal quality and source freeze gate. The passed TypeScript script is not misrepresented as a new zero-warning ESLint pass.
- **Targeted observational reproduction: completed, exit 0, confirmed failures above**. Exact command: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node .trellis/tasks/10-11-shared-storage-sqlite/research/independent-storage-binary-repro.mjs`. Source is bundled in memory using the already installed Vite/esbuild dependency; no install or output module mutation. Logs: `independent-storage-binary-repro.log`. Exit 0 means the observations were collected and cleanup completed, not that these findings passed.
- **Actual native proof scope:** pinned `desktop/tauri/.tools/target/debug/product_store_probe`, shared TS adapter to Rust worker to SQLite/managed disk. This JSON-line fixture is not production Tauri IPC or WKWebView.
- **Reused prior owned proof:** binary worker's 13/13 actual Rust file/SQLite tests, 2/2 explicit TS-to-Rust product carrier tests, focused consumer/query/access tests, and shared adapter conformance evidence in worker handoff/check logs. No redundant rerun or additional passed-case count is claimed.
- **Diff whitespace:** `git diff --check` passed at review snapshot.
- **Full product/Agent/UI/macOS gate:** pending main integration and final independent check. Expected WIP test seams were not treated as delivered failures. No completion/activation/Windows/Linux claim is made.

Main coordination accepted SB01/SB02/SB04/SB05 for binary/shared owners; SB03 was sent immediately after its both-adapter actual reproduction. Findings remain open until repaired source and affected regressions are verified.
