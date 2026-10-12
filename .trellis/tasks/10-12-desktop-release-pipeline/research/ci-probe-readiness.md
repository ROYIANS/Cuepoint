# CI real SQLite probe prerequisite correction

Date: 2026-10-12. Owned implementation scope: seven authored paths listed below.
Root owns specs, docs and task metadata; no peer edits were reverted.

## Observed failure and cause

The owner's hosted log reports **6 failed files / 92 failed tests**, with 222
files / 3863 tests passing and the existing 1-file / 7-test opt-in skip. Every
failure carries ENOENT for the ignored local `product_store_probe` path.

Both GHCR quality and desktop quality ran ordinary root `pnpm test` before any
Rust/probe build. Six suites always construct the actual native engine even
while the default test owner remains browser. The seventh native binary suite
intentionally remains opt-in. The existing local `.tools/target` executable
masked this prerequisite; it is not a dependency shipped by git or pnpm.

A new task-owned absent executable path reproduces the exact same 92 failures
with the existing six suites (5 nonnative assertions in those files still pass).
Raw owner and reproduced failures remain in `logs/ci-probe-readiness/`.

## Implemented boundary

- `.github/workflows/desktop-release.yml` and `.github/workflows/ghcr.yml`: install
  Rust1.99 minimal, obtain absolute Cargo/rustc paths from that exact toolchain,
  and call the shared preparation before ordinary tests. Both retain bounded
  failure logs/receipts. Desktop PR paths now include the shared preparation
  script and its regressions. GHCR Node22, triggers, permissions, Docker flow and
  existing quality commands remain; desktop Node24 and release conditions remain.
- `scripts/prepare-native-test-probe.mjs`: validate actual Cargo/rustc1.99
  executables, reject compiler wrappers, require a previously absent target,
  build the locked no-default-features/test-hooks-only probe, verify newly built
  regular-file bytes/hash, exercise real ready/close/observed process exit in a
  disposable workspace, and only then append the exact executable path to
  GITHUB_ENV. Failed/stale/missing/invalid readiness cannot export a path. Cargo
  receives the actual pinned `RUSTC`, not an uncontrolled PATH compiler.
- `desktop/tauri/scripts/tool-resolver.mjs` and
  `scripts/native-storage-regression.mjs`: share exact build arguments and output
  naming. The existing acceptance runner still owns source-before/after evidence,
  build logs, actual adapters, unchanged assertions and strict outcome checks.
- `scripts/prepare-native-test-probe.test.mjs` plus `knip.json`: eight bounded
  regressions cover actual process/readiness lifecycle, build failure, stale
  directory refusal with bytes preserved, wrong compiler/wrappers, absent or
  premature/invalid probe, no environment export after invalid close, and both
  workflow prerequisite orders. CLI entries are declared precisely for Knip.

No test was removed, weakened, disabled or converted to a mock. The actual root
run keeps default browser ownership and the same opt-in skip; six suites continue
using real SQLite. The shipping product-sqlite build does not acquire test hooks.
No GUI, installer builds, provider calls, user data or remote actions occurred.

## Executed validation

| Check | Actual result / evidence |
| --- | --- |
| Absent probe before fix | 6 files / 92 tests failed, 5 passed, exact ENOENT; `cold-missing-red.log` |
| Fresh target Rust build + real ready/close/exit under Node24 | Pass, Rust1.99 both tools; `cold-build/probe-ready.json` |
| Independent fresh target build + actual readiness under Node22.21.1 | Pass; `cold-build-node22/probe-ready.json` and `cold-build-node22.log` |
| Node24 readiness/failure contracts | 8 pass; `readiness-contract-final.log` |
| Node22 readiness/failure contracts | 8 pass; `readiness-contract-node22.log` |
| Complete root test, Node22.21.1/pnpm10.15/fresh compiled probe | **228 files / 3955 tests pass**, original 1-file / 7-test skip; `full-root-green-node22.log` |
| Frozen full-run source | 1021 scoped source/test/script/Rust/config inputs unchanged; `frozen-full-test.json` |
| Root types | Pass; `root-lint.log` |
| Formal quality | Pass: zero failures; existing 12 reviewed allowances and584 visible warnings; `root-quality.log` |
| Release collector/publisher/workflow contracts | 35 pass; `release-protocol.log` |
| Whitespace | `git diff --check` pass |

The cold lanes have newly created binary and dependency targets; only the
existing downloaded crate registry was reused. Neither shared `.tools/target`
nor existing app state was deleted. Both real no-GUI builds completed, and
readiness cleanup waits for process close before removing only its newly created
temporary workspace. Their exact executable hashes and pinned paths are retained.

`implementation-receipt.json` records the seven owned source hashes and checks.
`source-before.json` is the historical pre-edit snapshot, not a frozen acceptance
claim. `frozen-before-full-test.json` and `frozen-full-test.json` prove the finished
source did not change during the green full-root run. Node-contract and release
counts overlap different checks and are not added to the root test count.

## Finite limits / follow-up

This is actual macOS ARM64 cold-compilation and real SQLite test proof, including
Node22 CLI compatibility. It is not a rerun on GitHub Ubuntu, any corresponding
Windows/Linux installer smoke, or tag/draft publishing acceptance. A new owner
push/run is still required; rerunning the old SHA would retain the missing
prerequisite. Four-target H1a and actual draft H1b gates remain pending.

No commits or Git changes beyond the authored working files were made by this
implementer. The parent session coordinates independent review, specs and concrete
local commit approval.
