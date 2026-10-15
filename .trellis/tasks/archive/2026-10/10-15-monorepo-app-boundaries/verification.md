# Child 1 implementation verification

## Scope and result boundary

Application/workspace relocation is implemented on `codex/monorepo-app-boundaries`. Web, desktop and site now have independent entries/configuration, with one Studio product implementation and a small distribution package. Studio's internal feature organization and reusable Agent packages remain the subsequent approved children. After independent review, the user approved the concrete checkpoint batch; source/spec changes are committed as `bb3a9580`. No push, hosted dispatch or publication occurred.

All pnpm commands below used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` (10.15.0), with machine Node 24.11.0. Root remains authoritative version 0.1.3. Pinned Rust is 1.99.0, Tauri CLI 2.12.1. Existing native caches were renamed on the same filesystem. See `research/baseline.md` for pre-edit failures, dependency handling and exact preservation evidence.

## Acceptance mapping

| Criterion | Concrete implementation and observed evidence |
| --- | --- |
| WA1: independent owners/builds | Five private workspace packages and explicit `workspace:*` dependency edges. Web and desktop import the same `@cuepoint/studio/bootstrap`; site imports only distribution exports. Independent web/site builds and desktop `build:frontend` passed. Root `build` passed with separate asset namespaces and checked assembly: 672 files, 656 manifest entries. |
| WA2: output/runtime/native paths | Both HTML entries and report maps survive assembly. Entry scripts, local HTML resources, manifest imports/dynamic imports/CSS/assets and module-report references are checked before replacement. Site budget passed: eager gzip JS 84.18 KB / 120 KB and CSS 3.79 KB / 15 KB; 49 modules across eager/lazy chunks, no Studio/Agent closure. Fresh real browser route reloads and bounded normal native launch passed as described below. Rust include uses the single unchanged Studio schema; portable TypeScript/Rust oracle parity passed twice against immutable comparator bytes. Version/release tooling tests passed. |
| WA3: complete gates | Root types/full tests/formal quality/self-tests/model verification, desktop types/lint/unused/native/parity/release checks passed. Architecture scanned 564 owned TS/TSX modules, 2277 static value edges and ten literal dynamic edges, with no cycles or boundary/omission failures. Actual filesystem source inventory is compared to the compiler program, so a missing individual file in a populated root fails. Real Rust/SQLite all-suite evidence is recorded separately below. |
| WA4: explicit package boundaries | The real gate rejects forbidden site-to-Studio edges, type-only bypasses, sibling app traversal, private source access despite an otherwise allowed package edge, invalid export-map entries and foreign aliases. Tests also reject an unregistered package or source root. No root-src compatibility tree, duplicate product, hardcoded root node_modules depth import or wildcard Studio export was added. Existing native fixture helpers have individually named reference exports; Electron is explicitly classified as a retained historical lane. |
| WA5: authored reviewable evidence | Pre-edit boundary inventory, baseline/preservation report, this verification, built-browser evidence and independent review report are retained in the child task. Root/package README commands and canonical scoped Trellis registration reflect actual owners. Final independent review/task advancement remains main-owned. |

## Checks executed

| Command / lane | Observed outcome |
| --- | --- |
| Root `lint` | Passed, including moved application/library TypeScript and configuration. |
| Root `quality` | Final frozen-input receipt passed all three sections: 12 exact pre-existing lint allowances, 601 review warnings, no failures; architecture 564 files / zero static cycles; unused 15 exact reviewed contracts, zero unmatched candidates. No input changed during that run. |
| Root `quality:self-test` | 88 formal negative/repair cases passed, followed by two workspace/assembly Node tests containing actual CLI failure cases and safe-output closure cases. |
| Root `test`, actual fresh pinned probe available | Final full rerun passed 280 files / 4655 tests, with one file and seven pre-existing tests skipped. The probe was built from current locked Rust in a fresh target directory and required valid ready/close acknowledgements. |
| Probe preparation + workspace/assembly targeted Node tests | Ten passed; failure-contract assertions and packaging-only workflow policy retained. |
| Root `models-dev:verify` | Passed: 381 entries, pinned package 0.0.104. |
| Root `build` / `landing:budget` | Passed; assembled closure and budgets detailed above. |
| Desktop `types`, `lint`, `quality` | Passed through direct declared tool dependencies. Standalone Knip reports informational redundant-entry/CSS hints; exit zero and no unused candidate failures. |
| Desktop `test:parity` | Two real Rust tests passed, including exact current TypeScript oracle equality and malformed wire rejection; original fixture unchanged. |
| Desktop `test:native` | 120 Rust tests passed across storage/runtime, bridge/protocol and portable-contract targets. |
| Desktop `test:release` | 99 passed, preserving source/version/receipt/payload and packaging-only release policy assertions. |
| Native icon generator `--check` | Passed read-only pixel/container/artifact checks with existing Python/Pillow. Original native icons and provenance bytes were preserved; historical web evidence path keys are explicitly not claimed to match current keys. |
| Dedicated agent-tool type contract | `tsc --project tests/typecheck/tsconfig.agent-tools.json --noEmit` passed with its source include moved to Studio. |
| E06 isolated producer build | Passed: actual Web Vite config, 11800 modules / 1085 frozen source inputs / 668 output assets, graph and first-load fingerprints, exact route-source restoration. |
| Existing E06 icon browser runner | Passed all 188 actual publisher/wrapper comparisons with existing Playwright 1.62.1 and Chrome 151. |
| Existing E06 production parity / browser scenarios | Nine rich-text/loading/scrolling/reasoning cases and four empty/selected/plain/code scenarios passed. Real built asset response bodies were matched to emitted assets. |
| Existing E04 library browser runner | All 16 before/current query, transaction, cover, subscription, scope and narrow-layout scenarios passed. Only stale observation/UI locators were repaired; product and immutable snapshots remained unchanged. |
| Existing E04 media browser runner | Passed isolated43, freshness42, count4, rollback16, caller30 and retained-release12 cases, with zero owned/shared source drift, one document and zero external requests. Immutable internal snapshot paths remain under their original `src/db` layout. |
| C01/D08 historical source selection | New current Studio module IDs selected all six original `src`-layout baseline inputs in a temporary old-layout check; no-baseline current passthrough and existing instrumentation remained. |
| Existing E03 strict historical CSS pairing | **Failed** at first `audio-1440-script` exact geometry/style equality after actual fixture startup. Current two CSS files remain byte-identical to pre-edit HEAD; historical snapshots and strict assertions were preserved. See the explicit failure evidence in `research/baseline.md`. This is not counted as passing acceptance. |
| Additional B01 existing browser runner | Actual fixture transforms/boots, then first legacy delayed `.get`-based `加载项目` assertion times out. Current ProductStore queries bypass that historical fixture read gate. Vite also warns about forced tooltip/ogl optimizer entries; tooltip is declared under Studio and actual source discovery loads it, while ogl was already undeclared in the original package manifest. No assertion/product repair was made; this broader historical harness is not counted as passing. |

## Actual native all-suite acceptance

The final frozen-input run passed **107 permanent suites / 1833 tests** against the current locked Rust SQLite probe, plus **six self-hosted native cases** and **five browser-only capability cases**. The permanent lane took 306.50 seconds, self-hosted lane 44.67 seconds and browser-only lane 529 milliseconds. Probe build and all three test commands exited zero. The registry contained 95 tools, with 2873 observed tool events and 50 table coverage entries. Missing valid arguments, invalid arguments, successful executions, committed tables, business tables and owner assertions were all empty.

This run started at `2026-10-15T02:25:09.608Z` and finished at `2026-10-15T02:31:02.536Z`, after main's explicit final input freeze. Its 1217 before/after source identities were identical; every final identity was independently rehashed against the current file and had zero mismatches. The actual probe SHA-256 is `bb7a0bb154dc60a41dc56082bc37cb651298c8b6359930bc3c393ae95c2c3f54`. Full local evidence is `/tmp/cuepoint-monorepo-native-all-verified/acceptance.json`, its companion logs and `tool-and-table-coverage.json`; the acceptance receipt SHA-256 is `7fcc412dd65e1075ed92eeff64f4024f6b8507a576a0dfcd5c4776f28348a0a7`.

The final formal quality receipt finished at `2026-10-15T02:25:29.673Z` with exit zero and no failures. All 1173 receipt inputs were independently rehashed after native completion against current files, with zero mismatches. Its local path is `/tmp/cuepoint-monorepo-baseline/quality-verified-report.json` and SHA-256 is `37f435493dc4eae2bc52631a1df9ddbbf29556dd8dbe09801d224695c9b5177c`. Desktop scripts/UI, package quality configuration and final relocated standalone producers are included in those identities. Product, tooling, tests and configuration received no writes between the explicit final freeze and these completed checks.

Earlier preliminary relocation evidence also passed, but premature final attempts were explicitly stopped when independent review identified additional path fixes; those stopped attempts are not counted as passing evidence. The final completed receipts above replace them. Writer handoff has been sent to main and the independent reviewer; only authored task verification prose was updated afterward. Raw local `/tmp` evidence is transient, while this authored report records the finite outcomes and digests.

## Startup and deployment observations

Main's `research/browser-acceptance.md` records fresh Chrome 151 startup at 1440x900 for direct reloads of `/agent`, `/projects`, `/settings` and `/assets`: correct empty-state/settings controls, default automatic update checks off, sole IndexedDB namespace `aifenjing`, zero Runtime exceptions. The final Web HTML hash and `/assets/web/index-Butkrwy3.js` entry remain identical to that report.

An actual isolated normal SQLite product bundle built successfully with identifier `dev.cuepoint.review.monorepochild1`, preserving normal shared Studio entry, CSP and native services. Its executable stayed alive for ten seconds and created the dedicated `product-workspace-v1/workspace.ready.json`, state SQLite and writer SQLite files. The exact spawned process was then terminated. This establishes bounded normal launch/storage initialization only; it does not establish manual WebView interaction, every worker/media flow or user-data reopen.

Assembled output validation, the existing Nginx configuration and real Web browser refreshes cover their stated scopes separately. This host has no Nginx executable; Docker's daemon socket is absent and `docker info` exits one. Therefore an actual Docker/Nginx site-root/SPA deployment was not executed. Docker Desktop/system services were not started or modified for this task.

## Limits and rollback checkpoint

Mac ARM64 local execution does not establish Windows/Linux installers, installer/Save interaction, live provider generation, performance or every native WebView/media behavior. Those are unchanged independent acceptance lanes. Existing Electron historical commands already reference absent renderer/test/main inputs and are documented as incomplete retained evidence; normal desktop does not execute them.

The accepted source checkpoint is `bb3a9580`; the original tracked state is starting commit `d0efb823`. Immutable snapshots, schema, native icon/provenance and portable oracle comparator hashes provide preserved rollback/provenance anchors. Reverting product work must preserve concurrent Trellis work and ignored native caches. The user authorized local checkpoint commits and continuing to child 2 after independent review on 2026-10-15. Manual/deployment limitations above remain explicit rather than being converted into passing results.
