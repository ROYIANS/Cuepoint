# Reusable Agent runtime verification

Status: **AA1–AA5 accepted within the explicit host/manual limits below.** Final source review, root/application checks, independent packed consumer, normal built browser, complete real-native ALL and current-input/protected-output binding pass. The independent whole-child review confirms no unresolved source finding. The owner approved the concrete Phase 3.4 batch and following child/parent archive+journal with “可以提交了”. Accepted source/spec checkpoint is `928d723149b2f1bd7720edc8ee7becce74ef6f72`; task-document commit and Trellis bookkeeping follow without changing accepted source inputs.

## Result and actual ownership

`packages/agent-core` owns the shared model/tool execution loop, two-pass approval barrier, typed tool validation, serialized checkpoints, capability loading, request segments and bounded context compaction. Its public root emits ESM and strict declarations. `packages/agent-providers` owns the existing Chat Completions/Responses protocols, continuation helpers and the sole bounded HTTP/SSE/error mechanisms, exposed through root and `/http`. It depends only on core; neither library imports Studio, concrete storage, a native runtime or UI.

Actual Cuepoint execution calls this core through `createStudioRuntimeHost`; the former product loop is removed. Studio retains creative tools/prompts, scope/memory/reference policies, current credential lookup and authorized browser/native HTTP. Product atomic tools still commit business effects, evidence and original completed results inside their existing transaction. An opaque capability is tied to the actually held Studio thread lock and execution lifetime. Current run/call/approval/offer predicates are checked inside the real claim transaction; the existing sole terminal writer remains authoritative. Studio's schema has no general owner/revision column, and none was introduced.

`examples/agent-todo` is a second real consumer with seven own-schema SQLite tables, typed Todo services and deterministic model fixtures. It calls the same core loop. Process ownership uses an actual SQLite transaction in a separate sidecar; business commits remain short. Conditional owner/revision updates, one execution admission, approval decisions, atomic result persistence and summary activation are implemented by this host. Reopen performs zero model work; explicit resume is required.

## Independent slice review

The checker reviewed product/tooling read-only; the serialized implementer made product changes. Canonical specs, lifecycle and the root README belong to the main session. Details and corrected findings are retained in:

- [Package/build boundary](research/package-boundary-review.md).
- [Core and Studio runtime](research/runtime-review.md), plus [implemented core contracts](research/core-host-slice.md).
- [Providers and HTTP](research/provider-review.md).
- [Independent durable consumer](research/todo-review.md).

Whole-source static closure found no unresolved source finding. It covers one loop/protocol/HTTP implementation, typed semantic ports, actual held ownership, claim/atomic/terminal behavior, one product store/schema, public emitted exports, exact analysis-only source mapping, every current source/test/native consumer and Docker/CI closure. Complete real-native execution and final current-input binding now pass as recorded below.

## Independent packed consumer

Root `agent:example:check` builds actual libraries, locally packs them, validates packed runtime dependencies before a local core override, installs offline into an outside-workspace consumer with an independent empty store, compiles copied example sources using installed emitted declarations and runs every discovered example test output. The consumer has no Studio, React, Dexie, Tauri or workspace source alias. A real import-resolution hook confirms that the provider and direct consumer use the same core instance.

The final independently reviewed report is `/private/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-agent-example-Y4XStB/report.json`, SHA-256 `7dcecbb235f7887c17790ae1762c77dc9c95c0cf826d4dc31f37cda482235971`. Node 24.11.0 / pnpm 10.15.0 execute 13 commands successfully. Strict NodeNext with `skipLibCheck=false` lists 186 inputs entirely within that temporary consumer/compiler directory. Public type/private-import negatives and public ESM resolution pass. All 19 SQLite/process conformance cases pass, with zero skips. All 384 input hashes independently match the final current files. The previous WADg0X report remains accepted slice evidence; the new packed run supersedes it after the structural repair and TypeScript cache configuration changes.

Real SIGKILL cases synchronize on durable checkpoints, not sleeps. The completed-tool case observes one committed Todo and exact completed result plus partial output before death. A new process opens with no extra request; explicit resume adds only the next model request, reuses the result once and retains one business row. The summary case observes a durable running job before death, interrupts it on reopen with no request, then activates one later summary on explicit resume. A live owner rejects another actual process, and the kernel releases the lease after SIGKILL and process exit.

Conformance also covers full-round approval/rejection, stale claims and decisions, exact spaced arguments, cross-run IDs, scoped business writes, monotonic checkpoints and retained terminal output, cancellation, local serialization/receipt/precommit-abort rollback, lost commit acknowledgement, unreadable confirmation, one unknown external dispatch without replay, loading and 32-request segments. The unreadable-confirmation test ends non-resumably; it proves no duplicate effect, not successful later resume after a read fault clears. Successful known-result resume is independently proved by the completed-tool process case.

## Final frozen execution

The current freeze is `/tmp/cuepoint-agent-final2-scope/frozen-native-repair-final.json`, captured **2026-10-15T06:31:04.519244Z**, **1665 nonignored inputs**, SHA-256 `bfaec0d3abd97312f077be275cdb467d421142b3e5a3c3a60c4550a3b78d86fe`. Task/journal Markdown and ignored generated outputs are excluded; built/native outputs have separate identities. The exact final delta from the preceding release freeze contains only the native transaction-spy correction and its canonical specification. The earlier repair/freeze receipts remain historical; no failed command is relabelled as a pass.

Current complete quality is `/tmp/cuepoint-agent-native-repair-checks/quality.json`, finished **2026-10-15T06:30:43.881Z**, actual Node **22.21.1**, exit zero, **1343 inputs**, SHA-256 `81c820b45edbf66dbc19e6ab791390c2ab0a22ee4f67cf05eb35c539c59dcac7`. It passes the same 12 reviewed lint allowances and 15 exact unused contracts, with zero failures. Architecture covers **633 files / 2508 static value / 10 literal dynamic edges**, zero cycles or computed dynamic edges. A temporary Git index checks tracked and new inputs without changing the real index.

Actual command receipts are `/tmp/cuepoint-agent-final2-checks/report.json`, `/tmp/cuepoint-agent-final2-remaining/report.json` and `/tmp/cuepoint-agent-native-repair-checks/report.json`, plus the separate complete release rerun. The first receipt retains its failed release attempt. Every pnpm invocation uses `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` (10.15.0). Generic root/core/provider/Web/Site commands use actual Node 22.21.1; Desktop and the independent SQLite example use Node 24.11.0. The last repair changes no package/build/runtime input, and all unchanged successful receipts are retained with explicit input comparisons rather than claimed as rerun.

| Gate | Actual result |
| --- | --- |
| Root lint/types and complete quality | PASS; all declared sources and the current emitted package freshness are checked. |
| `quality:self-test` | PASS; 88 formal cases plus seven CLI/tooling cases, including actual forbidden dependency and missing/stale package negatives. |
| Full root tests after native-spy repair | PASS on Node 22.21.1; **292 passed files / 4693 passed tests**, one existing skipped file/seven existing skipped tests; **34.87 seconds**. |
| Agent package scripts | PASS on Node 22.21.1; both actual build/types/test entries, core three files/17 tests and providers one file/four tests. |
| Workspace and app types/build | PASS; eight registered packages/source roots, Web/Site types/build, Desktop types/lint/Knip/frontend and root Web/Site assembly. |
| Models/build/site budget | PASS; 381 model entries, 629 assembled files/613 entries, normal feature CSS selectors; site 49 modules, first-screen gzip **84.22 KB JS / 3.79 KB CSS** within 120/15 KB. |
| Desktop native/parity/release tooling | PASS; **120 Rust tests**, two portable contract tests and repaired complete release suite **99/99**, zero skips. Real frontend compilation is independently exercised. |
| Own SQLite packed consumer | PASS; latest offline tarballs, strict emitted declarations/runtime, actual same-core identity and **19/19** process/SQLite conformance cases, zero skips. |
| Normal built browser and Agent UI | PASS; six normal scenarios plus four Agent scenarios, eleven deterministic local model POSTs, no page exceptions or failing same-origin HTTP responses. |
| Corrected native persistence-failure file | PASS; all eight cases in **3.62 seconds**, real native bridge/coverage and the unchanged 20-second limit. |
| Complete real-native ALL | PASS; **123 permanent files / 1932 tests**, plus **six self-hosted native** and **five browser-only** cases, zero failures/skips. All 95 tools, 50 tables and 31 business assertion groups are covered; all six missing-coverage arrays are empty. |

The current normal built browser report is `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-agent-browser-final-bdrvZc/report.json`, **06:31:09.319Z–06:31:23.558Z**, SHA-256 `5d94ea354cf82b5a3dc88c719df4469618f11324628fc64a30876db1d892c967`. It rechecks all **1343 current quality input hashes** and **625 Web output hashes** before/after without drift. The actual HTML loads `assets/web/index-DThtrQvY.js`, SHA-256 `6d1990170a002bc0513471037dfbfe21ada7ae829ed0bbfc423d580cd7e7019e`. [Browser acceptance](research/browser-acceptance.md) records actual UI/database assertions, disposable configuration, blocked external font/icon attempts and finite host limits.

The accepted fresh-directory complete native receipt is `/tmp/cuepoint-agent-native-final2/acceptance.json`, started `2026-10-15T06:31:53.161Z`, finished `2026-10-15T06:39:25.369Z`, exit **0**, SHA-256 `a3823c8c8b16d274ec7f3120fefbd39fa59a335525e9c4e0d1e60aafdc5547ed`. Actual permanent-file output reports **123/123 files and 1932/1932 tests passed**; registered additional suites pass **6/6** and **5/5**. The original runner, full instrumentation, original 20-second deadlines and internal concurrent scenarios remain unchanged. `VITEST_MAX_WORKERS=1` changes file scheduling only. Coverage confirms successful execution, accepted/rejected arguments for all **95 tools**, actual native business commits for all **50 tables**, and **31 command/assertion groups**. All six missing-coverage arrays and `changedInputs` are empty. The actual probe SHA-256 `bb7a0bb154dc60a41dc56082bc37cb651298c8b6359930bc3c393ae95c2c3f54` matches the current binary.

Main's final independent binding is `/tmp/cuepoint-agent-final-input-binding.json`, SHA-256 `81d7529d9df1020e1879f60e11dcbaf63a8d44b1ffa08b4f89b88e560433c889`. It rehashes **1343 quality / 1665 frozen / 384 isolated / 1343 browser / 1394 native-before / 1394 native-after** entries against actual current files, with zero differences. All pairwise common entries agree; the complete current nonignored source/config/spec set equals the freeze exactly. All **625 current Web outputs**, **99 protected inputs** and the product schema match. Coverage JSON, terminal logs and actual probe identity are separately checked. The checker independently reviews these final native counts, coverage and map identities before accepting the whole child and cumulative parent review.

## Failed full-lane attempt and repair boundary

The first frozen Node 22 full test attempt is retained under
`/tmp/cuepoint-agent-final-checks`. It completed with **13 failed / 278 passed /
1 skipped files**, **111 failed / 4579 passed / 7 skipped tests**. Its preceding
quality/self-tests passed; they did not establish a passing full integration.
The first 1667-input freeze and quality receipt are therefore historical attempt
identities, not final acceptance.

The failures exposed three integration seams missed by the focused suites:
the new Web Locks test fixture implemented only the three-argument form while
actual Audio uses the two-argument exclusive form; direct/historical protocol
consumers still requested moved endpoint exports; and the stricter Studio guard
caused deleted-run cleanup to reject after a late tool returned. The repair must
preserve actual exclusive queuing versus `ifAvailable` refusal, exact
snapshot-requester-only adaptation and every original business assertion. After flushing provisional output, core
may stop cleanup only after an actual successful read confirms the run is
absent; failed reads cannot prove deletion. An absent run produces neither a
cleanup write nor a confirmed settlement event. Existing rows retain strict
ownership/step guards and the sole terminal writer.

The focused repair, new freeze, complete root/application checks and fresh isolated-consumer report subsequently pass as recorded above. No browser or native acceptance was run against that first failed root attempt.

## Subsequent test-fixture failures

The first Desktop release command failed eight of 99 cases because its isolated copied launcher lost the new relative builder dependency. The test fixture now preserves the real directory topology and proves compiler preparation before worker startup. Original arguments/cwd/environment/heap/exit-code/signals assertions remain. The complete rerun passes **99/99**; a separate real frontend build exercises the actual compiler. The named fixture stub proves launcher sequencing only.

The first complete real-native ALL, `/tmp/cuepoint-agent-native-final/acceptance.json`, naturally finishes **06:28:28.998Z**, exit **1**: 122 passed/one failed files, 1931 passed/one failed tests, plus six self-hosted and five browser-only passing cases. Its sole failure is the original 20-second persistence-failure test in `webResearchRuntime`; the test spy forwarded only the former five command parameters and dropped the current transaction/claim predicate. The resulting root transaction waited on its own outer SQLite writer. The minimum rest-parameter forwarding correction preserves the completed-transition fault injection, all business assertions and the original deadline. The entire eight-case real-native file then passes in 3.62 seconds. This is a new test-host integration defect, distinct from the predecessor's default-two-worker timing limit.

Both failed attempts remain retained. [Repair boundaries](research/final-repair-boundary.md) records exact paths, transaction reasoning and actual focused/full reruns. The final root and quality are rerun after this last test correction; browser and source identities are freshly rebound. Package/build/runtime inputs are unchanged and are checked exactly before their earlier successful receipts are retained.

## Acceptance traceability

| Criterion | Actual implementation and assertions | Final state |
| --- | --- | --- |
| AA1 — reusable ESM/types and independent installation | Public core/provider exports, exact dependency boundaries, strict outside-workspace declarations/runtime, forbidden private/product imports and same-core identity. | Accepted; actual package/root checks and outside-workspace emitted ESM/types/identity pass. |
| AA2 — actual browser/native Cuepoint bindings | Real Studio host, held ownership and conditional claim, existing atomic tools/store/sole terminal writer, fresh main and auxiliary credentials, preserved product policies. | Accepted; actual normal built browser and complete real-native ALL pass with current receipt binding. |
| AA3 — semantic failure conformance | Direct core, actual Studio ownership/credential/claim tests and independent own-SQLite conformance cover approvals, stale/duplicate execution, cancellation, rollback, durable completion, unknown effects and terminal behavior. | Accepted; complete root/native and 19-case independent SQLite/process conformance pass. |
| AA4 — durable independent application | Own Todo tools/schema and real processes, live competition, SIGKILL/reopen/zero-request startup/explicit resume of known results and interrupted summary. | Accepted; 19/19 packed-consumer cases and all 384 current input identities match. |
| AA5 — protocols, privacy and full source discovery | Existing protocol/opaque continuation/credential/reference/native transport assertions, single HTTP owner, actual forbidden-edge CLI negatives and full registered source/build/native coverage. | Accepted; current protocol/root/quality/build/native coverage and final map binding pass. |

## Protected bytes and finite limits

The independently rechecked 99 protected files, including all 85 historical source snapshots, retain their accepted predecessor hashes. The sole product schema remains SHA-256 `3c897189ef6f71517c55c86b5d24b7f9cd0e1cfd88d1b916b46345662187eff0`; raw `/tmp/cuepoint-agent-protected-bytes.json`. Final freeze binding independently retains all of those identities.

No paid-provider, npm publication, push, tag, hosted dispatch or deployment acceptance is claimed. The example uses deterministic model/external fixtures. The real-native lane is a Rust JSON-line SQLite harness, not a WKWebView or OS Save/reopen measurement. Other-OS packaging, microphone/decoded playback and manual narrow UI remain unperformed unless replaced by explicit current evidence. Docker/CI source closure is separately reviewed; an unavailable Docker daemon cannot establish an image build or Nginx runtime pass.

Accepted predecessor historical comparator limits carry forward: E04 Library's second ordered-Map comparison fails both its retained original and current implementation while the inspected values agree; the first scenario passes and later scenarios were not executed. Earlier E03 CSS/B01 comparator failures and prior default two-worker native deadline failures remain recorded in the predecessor. This extraction does not silently fix those unrelated cases or infer their acceptance from current unit/build checks. Final native acceptance uses the existing one-worker override while preserving original deadlines, full instrumentation and internal concurrency tests.
