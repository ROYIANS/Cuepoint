# Release tracked-source enumeration: implementation

## Root cause and source boundary

The owner-pasted macOS ARM64 failure occurs at the initial source snapshot, before frontend compilation. `execFileSync('git', ['ls-files', '-z'])` first buffered the complete tracked-path list with Node's default 1 MiB limit, including three metadata trees that were only excluded afterward. Increasing a fixed buffer or trimming tracked history would leave the same mechanism in place.

The source correction is limited to three files:

- `desktop/tauri/scripts/build-release.mjs` imports `releaseSourceHashes(root)` at the existing before/after snapshot boundaries; all clean-source, tool, product, bundle, receipt and draft contracts remain unchanged.
- `release-source-hashes.mjs` selects the same root descendants with Git top/glob exclusions for `.trellis/**`, `.agents/**` and `.codex/**`, then consumes stdout asynchronously as UTF8-decoded NUL-framed paths. It retains JavaScript sorting, `Object.fromEntries`, existing regular-file `fileDigest` and both complete snapshots. The stderr tail is limited to 4096 characters and always drained. Spawn/stream failure, nonzero exit, signal or incomplete framing rejects before any source hash map is returned; child close is awaited.
- `release-source-hashes.test.mjs` exercises the real Git/index and worktree boundary. A separate narrowly exported path-list function permits testing a large eligible index without creating thousands of source files. There is no generic process framework, new dependency or arbitrary stdout buffer limit.

The exact pathspec was first compared against the old root-prefix filter on the current repository: all 19,936 tracked paths yielded the same 1,460 eligible paths (59,538 NUL-delimited bytes). The complete old list occupied 2,396,578 bytes. Counts identify this local checkpoint; hosted counts and later metadata cleanup may differ.

## Frozen local verification

The approved Node24.11.0 and explicit machine pnpm were used. `logs/release-source-list-buffer-implementation/source-freeze.json` records the three exact source digests and final gate outcomes. The complete four retained text logs plus freeze record total 8,299 bytes.

| Check | Actual result |
| --- | --- |
| Focused actual-Git regressions | Five cases pass, also included in the complete release suite below. |
| Desktop `test:release` | 84/84 pass, zero failures/skips; 79 existing release contracts plus five new cases. |
| Desktop `types` | Exit 0. |
| Desktop `lint` | Exit 0. |
| Desktop `quality` / Knip | Exit 0. |
| Source-only `git diff --check` | Exit 0. |

The new regressions preserve root-only exclusions, nested metadata names, prefix lookalikes, root literal metadata files, spaces/tabs/newlines/glob characters/Unicode and `__proto__`/`constructor` own keys. Actual file hashes remain stable across a second snapshot and detect a changed eligible file. Missing tracked source and a real nonrepository Git error reject.

Two finite temporary indexes demonstrate the reached size boundary: one has 9,000 excluded metadata entries and one real eligible file; the old synchronous default fails with ENOBUFS while the new source hash succeeds. The other has 7,000 eligible UTF8 paths exceeding 1 MiB and the new streamed listing exactly matches every sorted path and the old selection reference. Only the small hash fixtures create worktree files; large fixtures are index entries and are removed afterward. The explicit larger buffer exists only in the test reference, never in shipping enumeration.

The independent checker confirmed the exact current-repository 1,460-path set, every source hash and a stable second snapshot. Its five child probes also passed: split UTF8/NUL decoding, incomplete framing after exit 0, exit 7 while draining 2 MiB of stderr with a bounded diagnostic tail, SIGTERM and missing Git executable (ENOENT). Actual proof is recorded separately in `logs/release-source-list-buffer-review/independent-proof.json`. Production source and regression fixtures were frozen before all final desktop gates, and the checker matched all three frozen source digests. No source fix was required by that review.

## Limits and unchanged delivery policy

These checks reproduce and correct the precompile enumeration failure locally. No Rust/native storage, full root suite, frontend compilation or installer build was needed or run for this change. No corresponding-host package success, application runtime acceptance or GitHub draft delivery is implied. The desktop workflow remains packaging-only and contains no automated test/quality/smoke prerequisite; independent GHCR remains unchanged. No stage/commit/push/tag/Actions/Release/archive operation was performed by the implementer. Root separately owns the user's requested Trellis metadata cleanup.

## Owner-authorized artifact retention — 2026-10-12

The owner requested deleting raw logs, JSON receipts, copied source trees and caches, keeping authored Markdown conclusions. The local checks and independent probes above completed before cleanup; their raw task-local output has now been designated disposable. These are recorded local results, not a claim of hosted build or installer success.

Reviewed source SHA-256 values:

- `desktop/tauri/scripts/build-release.mjs`: `2d9305ac563e0eda32bb12bfd67e7f926ed73f08f64310eea5eff6ba9f30b958`
- `desktop/tauri/scripts/release-source-hashes.mjs`: `f729340dedbc62f4161fbc421103b2cb60a9c75c6bc756404d89fc381452e998`
- `desktop/tauri/scripts/release-source-hashes.test.mjs`: `f035e5d8d8a862785293e3812271b3e40c9ede65434d4ff433817b7d863679ab`
