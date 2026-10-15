# Final execution receipts

Status: all required execution lanes have reached passing terminal results against the final source/configuration bytes. The first failed root, release-fixture and native attempts remain preserved separately. Main owns task verification, lifecycle and commits; this document records implementation execution evidence.

## Final identities

The final nonignored consumed-input freeze is `/tmp/cuepoint-agent-final2-scope/frozen-native-repair-final.json`: **1665 files**, SHA-256 `bfaec0d3abd97312f077be275cdb467d421142b3e5a3c3a60c4550a3b78d86fe`. Task/journal documents are outside this source freeze. Ignored library outputs and native-generated permission definitions have their own current receipt identities. A temporary Git index includes all new files; the final `git diff --cached --check` passes at `/tmp/cuepoint-agent-final2-scope/cached-check-native-repair-final.log`. The real index was not modified.

The post-execution cross-receipt comparison is `/tmp/cuepoint-agent-final2-checks/current-binding.json`. It recomputes every captured hash from actual current files, compares each common input across receipts and separately checks all Web output bytes:

| Receipt | Captured identities | Final current result |
| --- | --- | --- |
| Nonignored freeze | 1665 source/configuration/spec files | Zero mismatches. |
| Complete quality | 1343 current analysis inputs | Zero mismatches. |
| Independent packed consumer | 384 producer/compiler/source/configuration/output inputs | Zero mismatches. |
| Final browser wrapper | 1343 quality inputs plus 625 emitted Web files, both before and after | Zero mismatches. |
| Native ALL | 1394 inputs before and after, including actually consumed emitted libraries and derived permissions | Zero mismatches; `changedInputs: []`. |
| Protected predecessor bytes | 99 files, including all 85 historical snapshots | Zero mismatches. |

All shared hashes agree: quality/native share 1338 identical inputs; quality/isolated share 135; browser/quality share all 1343. Native has **105 ignored inputs outside the nonignored freeze**: 15 Tauri-generated permission TOML files and 90 emitted core/provider files (including their build receipts). Native's own before/after/current identity covers those; the 1665-file freeze alone does not claim to cover them. The sole product schema remains SHA-256 `3c897189ef6f71517c55c86b5d24b7f9cd0e1cfd88d1b916b46345662187eff0`.

## Actual commands and versions

Every pnpm invocation uses `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`, observed version 10.15.0. Generic root/library/Web/Site commands run with actual Node 22.21.1 first on PATH. Desktop and the independent `node:sqlite` consumer run on Node 24.11.0.

The command records are `/tmp/cuepoint-agent-final2-checks/report.json`, `/tmp/cuepoint-agent-final2-remaining/report.json`, `/tmp/cuepoint-agent-native-repair-checks/report.json` and the consolidated `/tmp/cuepoint-agent-final2-checks/closure.json`. Failed reports retain their original nonzero exit codes; the consolidated record references later passing repairs explicitly.

| Executed lane | Actual terminal outcome |
| --- | --- |
| Root `lint` | PASS; actual emitted library build and complete TypeScript project build. |
| Complete quality on Node 22 | PASS; 1343 inputs, 12 existing reviewed allowances and 15 existing reviewed unused contracts, zero failures. Architecture covers 633 files with zero static cycles. |
| `quality:self-test` | PASS; all 88 self-test scenarios and seven actual CLI/tooling tests. |
| Latest root `test` on Node 22 | PASS; 292 files / 4693 tests passed, one existing skipped file and seven existing skipped tests. This full run follows the final native transaction-spy repair. |
| `models-dev:verify`, root `build`, `landing:budget`, `workspace:check` | All exit 0. Site first-screen JS 84.22 KB gzip / 120 KB budget; CSS 3.79 KB / 15 KB budget. |
| Core actual `build`, `types`, `test` scripts | All exit 0; three test files / 17 tests pass. |
| Provider actual `build`, `types`, `test` scripts | All exit 0; one test file / four tests pass. |
| Web and Site actual `types` / `build` | All exit 0 on Node 22. |
| Desktop `types`, `lint`, `quality`, `build:frontend` | All exit 0 on Node 24. Actual frontend compilation runs the real library builder. |
| Desktop `test:parity` | PASS; immutable portable fixture check and two Rust oracle cases. |
| Desktop `test:native` | PASS; 120 Rust cases across all unit/integration suites (73 + 4 + 22 + 2 + 10 + 9), no failures. |
| Desktop `test:release` after fixture repair | PASS; 99 tests, zero failures/skips. Raw `/tmp/cuepoint-agent-release-repair-final.log`. |
| Todo actual `build` / `types` | Both exit 0. |
| Root `agent:example:check` | PASS; 13 real commands, strict emitted declarations/ESM, offline install and frozen reinstall, all 19 discovered SQLite/process tests. |
| Final real-native ALL | PASS; 123 permanent files / 1932 tests plus six self-hosted native and five browser-capability tests. |

Latest complete quality: `/tmp/cuepoint-agent-native-repair-checks/quality.json`, SHA-256 `81c820b45edbf66dbc19e6ab791390c2ab0a22ee4f67cf05eb35c539c59dcac7`. All 1343 current input hashes agree. The only post-application-build changes were isolated test-fixture repairs and main's canonical execution guideline; library/product/configuration and emitted application bytes remained unchanged. Root tests and quality were rerun, all affected release/native cases were rerun, and the final browser wrapper verified actual current input/output bytes. No unchanged heavy build or semantic suite was claimed to execute again.

## Independent packed consumer

Final report: `/private/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-agent-example-Y4XStB/report.json`, SHA-256 `7dcecbb235f7887c17790ae1762c77dc9c95c0cf826d4dc31f37cda482235971`. It captures 384 exact inputs, all still equal current files after final native execution. Neither later fixture/guideline change is a consumed input of this gate.

The outside-workspace strict NodeNext compiler uses installed emitted declarations with `skipLibCheck=false` and no source aliases. It lists 186 files entirely in the temporary consumer/compiler tree. Public runtime resolution records the same real core instance for direct and provider imports; forbidden private/product dependencies are rejected. Dynamic test discovery maps `examples/agent-todo/src/conformance.test.ts` to `dist/conformance.test.js`; all 19 process/SQLite cases pass with zero skips. Live-owner competition and SIGKILL/reopen/explicit resume exercise the real shared core loop and own SQLite schema, including a completed tool/result checkpoint and interrupted-summary activation.

Packed hashes: core `a03f19dfb982584f88d32794172a37eb8c02b6bcf6bf590970d9b671c65c5091`; providers `8c1a384bafa6704d0e984db1dc848d3d44df72b620593d9a962615975983e810`. The older WADg0X receipt is incremental historical evidence, not the final packed source identity.

## Actual built browser

Final wrapper: `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-agent-browser-final-bdrvZc/report.json`, SHA-256 `5d94ea354cf82b5a3dc88c719df4469618f11324628fc64a30876db1d892c967`. Main ran it after the latest complete quality receipt and before final native. All UI processes exited before native began.

It binds 1343 current quality inputs and all 625 emitted Web outputs before/after with no drift. Six normal product scenarios include Audio/Music/Video creation and two Audio chapters/two tracks retained after reload. Four Agent scenarios exercise approval and actual creation, rejection without writes, partial SSE Stop, zero-request reopen and explicit continuation without repeating the completed read result. Eleven POSTs target only the local deterministic service. There are no page exceptions or failing same-origin HTTP responses. Thirty external font/icon requests are blocked; this result does not claim all external resources loaded or no network request failed. No paid-provider or native-WebView acceptance is inferred.

## Full real-native ALL

Final receipt: `/tmp/cuepoint-agent-native-final2/acceptance.json`, SHA-256 `a3823c8c8b16d274ec7f3120fefbd39fa59a335525e9c4e0d1e60aafdc5547ed`. It reaches **exit 0 at 2026-10-15T06:39:25.369Z**. Exact invocation is Node 24.11.0, `VITEST_MAX_WORKERS=1`, `tooling/native-storage-regression.mjs --suite all --evidence-dir /tmp/cuepoint-agent-native-final2`. The empty evidence directory is new; no prior result was overwritten. No heavy check or browser process runs concurrently.

The runner builds the current locked Rust probe, then executes all 123 permanent files / 1932 tests successfully in 405.19 seconds, followed by all six self-hosted native and five explicit browser-capability cases. Original 20-second test/hook deadlines, full tool instrumentation and each test's internal concurrency remain unchanged. Installed Vitest gives the worker environment value priority over configuration; a finite actual process observation is retained at `/tmp/cuepoint-agent-native-final2-environment.json`.

The real probe is 13,997,416 bytes, SHA-256 `bb7a0bb154dc60a41dc56082bc37cb651298c8b6359930bc3c393ae95c2c3f54`. Coverage records **95 registered tools**, **50 current tables**, **31 owner-assertion groups** and **3147 tool instrumentation events**. All six missing arrays are empty: successful execution, valid arguments, invalid arguments, native committed tables, native business tables and native owner assertions. Native before/after/current maps contain 1394 equal inputs and `changedInputs` is empty. Raw native-suite logs and `tool-and-table-coverage.json` remain in that directory.

## Retained failures and finite limits

The first root attempt (`/tmp/cuepoint-agent-final-checks`) fails 111 tests; the repaired full root suite passes. The desktop release attempt in `/tmp/cuepoint-agent-final2-checks/report.json` retains 91 pass / eight fail; the corrected complete suite passes 99 / 99. The first native ALL (`/tmp/cuepoint-agent-native-final/acceptance.json`) naturally completes exit 1 with 122 files / 1931 tests passing and one transaction-spy timeout; its additional suites pass. The unchanged completed-write fault injection with full typed transaction/claim forwarding passes the entire eight-case file under identical native instrumentation in 3.62 seconds, then the new complete ALL passes. Details are in [final-repair-boundary.md](final-repair-boundary.md); no timeout, business assertion or product transaction is relaxed.

Docker/CI source closure is reviewed, but no Docker image/runtime pass is claimed when the daemon is unavailable. Real-native evidence is a Rust JSON-line SQLite harness, not WKWebView/OS Save/reopen, other-OS packaging, microphone or decoded-playback acceptance. The inherited E04 ordered-Map comparator and other explicitly documented predecessor limitations remain finite historical limits; these checks do not invent acceptance for them. No paid model request, publication, push, release, hosted dispatch or deployment was performed.
