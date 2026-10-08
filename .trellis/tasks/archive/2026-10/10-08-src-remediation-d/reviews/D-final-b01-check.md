# Focused B01 harness acceptance

Status: **PASS — focused only**, 2026-10-08. Scope is exactly `scripts/b01-browser-regression.mjs`, attributed to D02 with this final harness correction. No critical issue found. This does not accept the whole D batch or replace the pending fresh 17-gate integration attempt.

## Exact version and preservation

The saved original `D-final-b01-before.txt` SHA-256 is `dd8688fd18f01ea775a9f17124a2765ef62fc0d7f96794343308e09aaebd11d3`, exactly the latest accepted D02 snapshot `after` for this script. The corrected script SHA-256 is `72f6a6143b5f55043c41bfe6b915a2e566196c5d4d99c16d3216c306f66fc5a6`, exactly the final B01 entry hash.

Independent Python proof exited 0. Reversing exactly five harness edit regions restores the entire accepted original byte for byte. The complete business control body, transport interceptions, hold/release barriers, error assertion, scenario ordering, navigation calls, failure screenshots/HTML capture, and all existing business assertions are retained. D02 interceptions still target the actual exported `patchShot`, `patchProjectDetails`, and `setCharacterSlot` owners in shots/projects/assets. All original timeout lines, including the 10,000 ms default, are identical. No bootstrap retry, ignored reload, timeout increase, dependency installation, or product behavior change was introduced. Node syntax check exited 0.

## Additive document guard and cache lifecycle

The listener is installed before the only `page.goto`. It counts requests only when resource type is `document` and the request frame is the page main frame. The array is never reset. The shared test wrapper asserts count exactly 1 after each existing scenario and the retained page-error assertion, before incrementing or printing PASS. Thus every one of the 19 executed scenarios requires the initial document to be the only main-frame document request so far; extra document navigation fails rather than being retried or ignored. This strengthens the harness. It does not assert the absence of every conceivable navigation or late event after the final assertion.

Each run allocates a unique absolute `mkdtemp` Vite cache and explicitly scans the actual B01 HTML fixture; that HTML imports `/tests/fixtures/b01/harness.tsx`. Installed Vite 7.3.6 types support absolute `cacheDir` and custom optimizer entry patterns. Its actual implementation passes explicit entries through `globEntries` with absolute results and the configured root; an independent call to Vite's own installed tinyglobby resolved the exact absolute fixture as its only entry (exit 0). Cache resolution preserves an absolute cache path, and optimizer cache prefixes derive from `config.cacheDir`. Vite server close awaits environment close, including dependency optimizer close; the harness awaits browser close, server close, then recursive forced cache removal. Both observed cold cache paths are distinct and absent after completion. Exceptional server creation or interrupted teardown is not covered by these successful-run cleanup observations.

## Accepted runtime evidence

Main session 12213 ran the two existing serial cold scenarios; this checker did not duplicate native/CPU/full gates. `D-final-b01-cold-results.json` records exit 0 for both commands using the local Node v24.11.0 executable and the actual script. Each corresponding log contains exactly 19 PASS lines and ends `B01 browser regressions: 19 passed`. The logs identify distinct temporary optimizer caches, both removed at review time. The focused proof independently validates these results and the stable script hash.

## Preserved failures and causal limits

Integration attempt 01's original B01 run exited 1 after seven passed scenarios, failing in the eighth output-settings scenario with missing `window.b01.navigate` and empty visible dialogs. Its same-input retry exited 0 with 19 passed. Integration attempt 02 exited 1 after four passed scenarios, failing in the fifth prop scenario as the dirty-guard button detached and the unchanged 10,000 ms click timed out; visible dialogs were empty. Both original stdout/stderr and exit records remain preserved and hashed. The blank-page/missing-bridge observations are not causal proof. The durable `D-final-b01-failure-1.html` and `D-final-b01-failure-2.html` each contain script sources `/@vite/client` and `/src/main.tsx`, with no fixture harness script. This supports unexpected document replacement/root-app fallback, without proving its trigger or optimizer causality. Both HTML files and the corresponding preserved PNG artifacts are hashed; the screenshot pixels were not separately interpreted for this focused review.

Observational temporary-module cold isolated and forced-cold shared-cache debug runs each exited 0 with 19 passed. Their entry, source, logs and result files are hashed. These observations do not distinguish a confirmed cause: **root cause remains UNPROVEN**. No confirmed Vite/shared-cache causality or business bug fix is claimed. Per coordinator context, port 5173 belongs to unrelated GlyphSilk; port occupancy is not evidence of same-cache concurrency.

Native evidence exercises local component fixtures, controlled transport/barriers and real IndexedDB/browser behavior. It is not full-product E2E or paid-provider evidence. Current source AST/static acceptance is neither rerun nor broadened by this script-only review. The main coordinator owns the final 76-file acceptance supplement and fresh whole 17-gate attempt.

## Checker artifacts and scope

`D-final-b01-diff-proof.py`, its JSON/log and this report/snapshot are review evidence only. The initial helper setup attempt failed to resolve pnpm's transitive tinyglobby through the symlink path; resolving the installed Vite package realpath corrected it. That setup attempt is preserved separately and was not a harness/native failure. No product/source/script/spec/ledger edits, child tasks, staging, commits, push, dependency installation or heavy reruns were performed by this checker.
