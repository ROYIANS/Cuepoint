# Release source-list buffer correction: independent review

## Reviewed boundary

This review follows the owner's pasted build failure at the initial tracked-source snapshot and the latest packaging-only delivery decision. The checked production/regression scope is exactly build-release.mjs, release-source-hashes.mjs and release-source-hashes.test.mjs. Root owns task/spec updates and the separately authorized Trellis cleanup. The complete hook context, current task artifacts, source-list boundary and frontend distribution/quality/reuse/cross-layer guidance were loaded before review.

## Findings (fixed)

No production issue required a reviewer code fix. The implementation corrects the reached synchronous Git stdout overflow at its actual owner: both before/after snapshots use the asynchronous helper. Its Git top/glob exclusions match only the previously excluded root descendants. Existing fileDigest, Object.fromEntries, JavaScript sorting, clean-source checks and receipt comparisons are retained.

During review preparation the implementer added exact prefix/root-literal and own-key cases to its existing small fixture, including nested metadata paths, prefix lookalikes, root .trellis/.agents/.codex literal files and __proto__/constructor. These are verification additions; no public interface or product behavior was changed by the checker.

## Findings (not fixed)

No unresolved code violation was found in the frozen scope. The source listing has no synchronous stdout ceiling, incrementally decodes UTF8/NUL path framing, drains diagnostics with a bounded tail, waits for child close and rejects spawn/stream/nonzero/signal/incomplete outcomes. Returning a partial list/map is not a success path. The other synchronous Git calls inspect HEAD/status rather than the reached large ls-files output and remain outside this correction.

Actual cross-host compilation, installer/runtime and tag/draft delivery are not established by these local checks. This is a verification limit, not an inferred defect. The package-only workflow and independent GHCR source are unchanged; no automated testing requirement was restored. No native storage, Agent, frontend/data, migration, version, signing or publisher implementation was altered.

## Verification

All three source digests in logs/release-source-list-buffer-review/independent-proof.json exactly match logs/release-source-list-buffer-implementation/source-freeze.json. Reviewed implementation gate logs were produced after that freeze; unchanged gates were not duplicated:

- Desktop release regressions: pass, 84/84 with zero failures/skips. Five added actual-Git cases include eligible and excluded lists above 1 MiB, old default-buffer ENOBUFS reproduction, exact root-prefix parity, unusual paths, own-key mapping, changed real file bytes and failed Git/missing tracked files.
- Desktop TypeCheck: pass, exit 0.
- Desktop lint: pass, exit 0.
- Desktop quality/Knip: pass, exit 0; the new helper/export graph is reachable without a config suppression.
- Diff whitespace: pass.

The checker independently executed the complete actual-repository parity and process-error probes using approved Node24.11.0 on macOS ARM64. At that checkpoint Git contained 19,936 tracked paths / 2,396,578 NUL-list bytes; the unchanged eligible scope had 1,460 paths / 59,538 bytes. The sorted eligible set and every existing fileDigest hash match the original three-prefix reference exactly. A second complete snapshot is unchanged. Metadata cleanup can change total tracked counts later; it cannot change the rule's excluded scope.

Five separate bounded real-child probes pass: a Unicode path split inside a UTF8 code point retains its exact name; exit 0 with an incomplete trailing path rejects; exit 7 after a complete path rejects while draining 2 MiB stderr and keeping the diagnostic tail bounded; SIGTERM after a complete path rejects; missing Git executable rejects with ENOENT. The finite JSON proof records only counts, result statuses and frozen digests, never a huge source map.

No test/quality/smoke step was added to desktop Actions. No full root/SQLite/Rust suite or installer was run for this precompile-only fix, and no staging, commit, push, tag, Actions, Release or archive mutation was performed by the checker. Final task/context integrity after owner-authorized metadata cleanup is reviewed separately once root announces its final file set.

## Owner-authorized artifact retention — 2026-10-12

The owner requested deleting raw logs, JSON receipts, copied source trees and caches, keeping authored Markdown conclusions. The local checks and independent probes above completed before cleanup; their raw task-local output has now been designated disposable. These are recorded local results, not a claim of hosted build or installer success.

Reviewed source SHA-256 values:

- `desktop/tauri/scripts/build-release.mjs`: `2d9305ac563e0eda32bb12bfd67e7f926ed73f08f64310eea5eff6ba9f30b958`
- `desktop/tauri/scripts/release-source-hashes.mjs`: `f729340dedbc62f4161fbc421103b2cb60a9c75c6bc756404d89fc381452e998`
- `desktop/tauri/scripts/release-source-hashes.test.mjs`: `f035e5d8d8a862785293e3812271b3e40c9ede65434d4ff433817b7d863679ab`


## Final cleanup integrity review — 2026-10-12

The owner-authorized cleanup was independently audited after execution. The raw task-local logs, JSON proof/freeze records, copied sources, dependency trees and caches mentioned above have **actually been deleted**, rather than merely marked disposable. Their completed local results and the three frozen source digests remain recorded in Markdown. No new raw logs, JSON files, fixture directories or temporary outputs were created for this final audit. Historical prose pointing to removed raw paths is not a claim that those files remain retained.

The temporary pre-cleanup inventory was read without copying it into the repository. All **348 task-core files** still match their pre-cleanup SHA-256 values; all **89 task identities and statuses** remain intact: 87 completed and two in progress. Every one of the inventory's **1,072 retained task paths** remains present. Non-task helper/spec/runtime differences are limited to the explicitly authorized retention rules, workflow/guide index and developer journal updates. No unapproved management file difference was found.

Across **176 implement/check JSONL manifests**, all **1,029 actual file references** resolve, with no duplicate file rows or malformed JSON. The 48 retained historical _example rows are instruction placeholders, not missing actual paths. Two duplicate distribution-spec rows in the active manifests were reported and root removed them, keeping the current packaging-only reason. Archive path repairs and removal of disposable references preserve usable context without manufacturing source/spec copies.

All research files are Markdown. No task-local raw logs, JSON proof, source-code copies, node_modules/dependency trees, generated build/cache output or copied context trees remain. All 13 specifically selected scope/handoff/preflight exceptions remain present, together with the named final quality, storage, UI and shared-product acceptance/review conclusions. Seventeen independent ignore-rule positive/negative controls pass: authored conclusions and task core/context files remain visible, while raw output and copied workspaces are ignored.

The three reviewed packaging source digests still match the freeze listed above. Desktop workflow, GHCR workflow, root scripts and product source have no additional changes; only the intended release source-list correction exists outside Trellis. Diff whitespace remains clean. Metadata-only cleanup does not invalidate the previously completed 84/84 release regressions or desktop TypeCheck/lint/Knip outcomes; those unchanged source gates were not redundantly rerun.

No unresolved cleanup-integrity issue remains. The retention guide accurately distinguishes recorded historical conclusions from deleted raw output and identifies Git revision 00a465ab132d0dc7c8d140702e34eb9a24fe79ef for recovery of formerly tracked artifacts. Cleanup-checkpoint totals in the concise conclusion precede new retention/conclusion/journal text and are not represented as an immutable final byte count. Actual hosted package builds, collection and draft delivery remain pending; neither active task was completed or archived by this audit.


### Final historical-Markdown delta

After the preceding cleanup checkpoint, content review identified 19 formerly ignored local Markdown files made visible by the new retention rules. Root removed 11 duplicate, superseded preparation/proposal or implementation-note files (154,089 bytes) and retained eight substantive diagnostic/stage-review conclusions. These are historical local files, not outputs created during this review; their removal adds no Git-tracked deletion.

The independent final delta check confirms that exactly those 11 authorized paths are absent from the earlier 1,072-path retention inventory. Its other 1,061 paths remain, including all 13 selected exceptions. All 348 task-core hashes remain exact; all 1,029 actual JSONL references resolve without duplicates, and the 48 example rows remain valid placeholders. All eight approved substantive newly visible historical files remain. Diff whitespace passes. No additional unresolved cleanup or source-integrity issue was found, and no raw evidence was recreated.
