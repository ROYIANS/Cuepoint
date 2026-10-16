# E08 foundation review

Date: 2026-10-16. Scope: native grant/scan/process/claims, decoder resources and
release identity, shared prepared-reference adoption, project admission/receipts and
video-derivative lifecycle. This is a foundation source review; Stage 3 transport,
tools and interaction are being checked separately. It does not establish packaged
or Windows runtime acceptance.

## Findings fixed

1. **Ancestor identity during scan** — `desktop_media.rs` checked ancestors when
   entering a directory but only checked the root while hashing individual videos.
   The native owner added one `Grant::check_ancestors` guard before directory reads,
   child classification, every hash chunk and final acceptance. A deterministic
   fixture replaces an ancestor while preserving the video's own identity, length
   and mtime, and rejects before reading the first content chunk. Reviewed the fix
   and independently ran its actual focused native regression.
2. **Uncertain wait evidence** — the process wait-failure branch retained ownership
   correctly but lacked a reachable regression. The native owner added a narrow
   injected wait seam around a real sleeping child. Tests verify background reaping,
   `unknown` status, retained frozen input and denied release/canceled classification.
   This does not test Windows execution or a genuine operating-system wait failure.
3. **Agent derivative selection** — ordinary `business_search` media and legacy
   `material_search` still exposed generated PNG rows as independent source assets.
   Filtered derivatives at their actual list owners, and rejected direct derivative
   promotion in both `sourceLegacy` preparation and `promoteLegacyMaterial`.
   A real ProductStore/registered-tool regression exercises both searches and denied
   preparation/direct command, while existing video promotion/adoption remains valid.
4. **Exact Agent approval at the command boundary** — admission previously hashed
   the current call without checking that confirmation was actually approved for
   this selection. `agentAuthority` now checks write/non-atomic metadata, the actual
   false risk flag, required confirmation, `decision: approve`, and exact
   `preview.revision === targetRevision({projectId, selection})`. Admission and item
   publication share this guard. Actual-store cases reject missing/rejected approval,
   changed effect/atomic/confirmation metadata, substituted preview/selection and
   revoked approval before publication; the exact approved selection succeeds.
5. **GC could erase uncertainty quarantine** — `preparedClaims` held only weak
   references, so losing all renderer references could let a repeated native prepared
   reply acquire a new capability after uncertain commit. Live preparations remain
   weak; committed/discarded/unknown stage identities now retain strong terminal
   state. Retention is bounded at 4,096 identities and refuses new claims rather
   than evicting uncertainty. Tests cover repeated consumed/uncertain raw replies,
   shared clone reservations, rollback invalidation and a full retention bound that
   preserves its original unknown operation. Tests do not depend on forced GC.
6. **Expired grant blocked replacement** — native `RevokeDirectory` reused the
   read-authority guard, so a cached directory grant could no longer be revoked
   after its idle expiry. Revocation now validates the ID and existing scope under
   the owner lock, without requiring a live source grant. Already-absent IDs return
   an idempotent revoked result without effects; existing foreign grants still
   reject. Focused actual-owner regressions cover expiry/replacement, repeated
   revocation, operation cancellation and denied foreign-scope revocation.

## Verified design boundaries

- The new IPC has trusted-window and actual product-session validation. It carries
  opaque IDs, not source/executable/output paths. Decoder work runs independently
  of the single product storage worker; prepared binaries use that existing worker.
- `BinaryRequest::Availability` first checks committed binary metadata. A successful
  response, including missing/corrupt byte state, therefore establishes committed
  identity for native release/discard decisions; file existence alone is not used.
- Prepared claims are collected from registered row carriers into the existing
  native transaction. Original video, reciprocal PNG relation, provenance, receipt
  and project touch commit together. Lost admission never returns start permission.
  Publication rechecks owner and intent, and project deletion prevents resurrection.
- Source revocation fences native reads/preparation. Adoption of a previously
  prepared authorized copy is governed by Studio intent/Stop ordering; generic
  ProductStore commit has no native grant fence. The spec explicitly states this
  finite boundary. Unix process-group ownership and Windows direct-child kill/wait
  promises remain distinct.
- Derivative closure covers retained roots/orphans, project copy, immutable material
  snapshots, ZIP mapping, ordinary pickers and poster failure/release behavior.
  Historical package provenance cannot restore a grant or import dispatch permission.
- Decoder preparation and runtime use measured compiled pins, finite archive
  allowlists and exact resources. Release receipts include resources/source notices,
  with Linux explicitly null. Actual Windows installer extraction and Mac signing
  remain pending. Root separately preserves exact tracked upstream notice/config bytes.

## Verification performed by this reviewer

- Scoped root ESLint: 23 foundation Studio TS/TSX files, actual root rules with the
  explicit source type project: 0 errors, 44 warnings.
  No warning is relabeled as a zero-warning pass. Test/config files outside root
  typed lint patterns are not claimed as linted.
- Strict noEmit: `tests/typecheck/tsconfig.desktop-media-source.json` passed on the
  current production tree and selected test files. Intermediate integration-file
  construction errors were reported to their owner and fixed before this pass.
- Six affected source suites passed, **53 tests**:
  `desktopMediaImports`, `nativePreparedBinary`, `mediaDerivatives`, `materialLibrary`,
  `mediaPreviewFailure` and `materialIntegration`.
- Native focused `--features desktop desktop_media`: **16 passed, 1 explicitly
  ignored resource-dependent fixture**, no failures. Two existing vendored HTTP
  unused-variable warnings remain. The native owner separately ran the explicit real
  FFmpeg fixture successfully; this reviewer did not rerun that resource fixture.
- Decoder/resource + release pipeline Node source tests: **73 passed**. These are
  script regressions, not an actual release or hosted packaging run.
- Scoped `git diff --check` passed for the reviewer's changed product/tests. Root
  retains final staging/whole-scope whitespace and exact Git input identity checks.

## Findings not fixed / remaining gates

No unresolved foundation source blocker remains after the fixes above. The live
Stage 3 producer/controller/UI must still complete its independent review; this
review does not declare that integration finished. Actual Windows execution,
Unicode/volume/process behavior, Intel/macOS14 compatibility, installer-contained
resource identity, signing, system dialogs and installed preview/Stop remain the
owner's batch-end gates. The exact compiler/runtime redistribution-source caveat is
retained in `apps/desktop/media/SOURCE.md`; this review is not public-release or
legal approval. No full build/package, install, full native suite, paid service,
push or additional task creation was performed by this reviewer.
