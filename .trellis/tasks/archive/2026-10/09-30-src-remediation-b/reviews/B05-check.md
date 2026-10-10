# B05 independent check — PASS

Date: 2026-09-30. Active task: `.trellis/tasks/09-30-src-remediation-b`. Role: direct `trellis-check`; PM-03/04/06 only. No agents spawned. Base HEAD `20b0204c9fab43e1265b94761ee880649be2fca9`.

B05 product acceptance **PASS after one concrete checker correction**. No unresolved material blocker. Finding closure remains the coordinator's responsibility; this check did not change ledger, task, spec or status.

## Scope and source integrity

Read check.jsonl dependencies, PRD, design, execution plan, `research/B05-task-id-contract.md` and `research/B05-implementation.md`. Traced the actual adapter, runtime, repository and ZIP paths rather than relying solely on handoff claims. The initial hashes of all seven B05 source/test files match the implement handoff. `B05-check-snapshot.json` contains the required repository-relative **before/after mappings for every edited/new B05 source/test**, explicit checker edits, versions, caller hashes and latest-unit comparisons. Before is checker arrival, not git HEAD. All **37 prior B01–B04 source/test/script paths** match their latest applicable unit snapshots; zero mismatches. The db/package trace files were unchanged.

Checker edits are exactly:

- `src/lib/audioGeneration/taskIds.ts`: reject unpaired UTF-16 surrogates through the shared ID predicate; scan Unicode code points to enforce controls without a control-character regex.
- `tests/apimartAudio.test.ts`: malformed-surrogate submit/query, real Request Unicode/whitespace/percent-literal encoding, and exact 512/513 UTF-16-unit boundaries.
- `tests/audioGenerationRecoveryAudit.test.ts`: malformed-surrogate paid uncertainty, local historical recovery, strict storage, snapshot, import rollback and unchanged-row assertions.

The other four B05 source/test files retain the handoff hashes. No B06, C06 byte limits, provider request policy or wider refactor was introduced.

## Concrete defect found and fixed

Before correction, `isAudioTaskId('task\ud800')` and its lone-low-surrogate equivalent accepted the ID. Successful JSON submission could therefore return it, and real repository storage could retain it. `getApimartMusicTask` then evaluated `encodeURIComponent(taskId)` outside the envelope catch and rejected with **URIError: URI malformed** instead of producing a local validation result. A JSON escape can carry this malformed UTF-16 input without JSON parsing failing.

This is a **path-segment encodability constraint**: an accepted durable provider ID must be representable in its existing encoded detail endpoint. Replacing malformed characters would alter an opaque remote identity; accepting them would recreate a paid-but-unqueryable task. The fix rejects malformed identities consistently at submit, direct read, storage, ZIP and historical recovery through the one pure guard. It neither normalizes IDs nor changes the endpoint.

The guard still applies `value.length <= 512` in **UTF-16 code units**. Iterating code points distinguishes valid surrogate pairs from lone surrogate values; a legal pair is accepted and still counts as two units in the length check. Real Request tests accept 256 music-note characters (512 units), accented Unicode, preserved surrounding nonblank whitespace, `task/1` encoded as `task%2F1`, and literal `%2e%2e` double-encoded as opaque content. A 256-note string plus `x` is 513 units and is rejected in submit/query; ordinary 512/513 ASCII boundaries remain covered. Exact `.` and `..` remain rejected before fetch.

Red evidence: `B05-check-surrogate-before-tests.json` and its log/run record show **89 cases, 79 passed, 10 failed**, including both high/low surrogate variants at provider, detail, paid-runtime, historical-runtime and store boundaries. The detail failures record the actual URIError. After correction, the same regressions pass; package branches previously stopped at failed storage assertions now execute through actual snapshot and import paths. Fifteen additional cases relative to the initial 188 are included in the final 203.

## Accepted behavioral evidence

| Finding / boundary | Independent conclusion and executed evidence |
| --- | --- |
| PM-03 provider duplicates | Canonicalization validates every ID, retains first-seen unique order, permits 100 unique IDs even when raw rows repeat, rejects 101 unique IDs without a partial accepted set. Durable normal submission stores two unique tasks; 1 original POST, 2 detail GETs and 2 downloads complete two works. |
| PM-03 legacy duplicates | Runtime reads the owned row without preemptive strict observation validation, verifies the project, canonicalizes valid taskIds, writes only taskIds through existing revision-CAS, then validates observations and enters query/download. Actual DB assertions at the first GET prove that repair is persisted first. Legacy absent-observation recovery performs 2 GETs + 2 downloads and **0 POST**. |
| Prior evidence and downloads | Two repeated historical IDs with completed/processing observations preserve input/source/connector, results, lastVerified and existing result identity at the repair checkpoint. Processing/query-failure/retry passes retain the saved sibling and complete the remaining work: total 6 GETs + 2 downloads, **0 POST**. Unknown/query-failed statuses preserve historical evidence without presenting it as a fresh provider fact. |
| Assistant ownership | Actual task-evidence recovery retains the original source/call/job and saved results, does not certify unresolved siblings, and rejects adoption by another task. No new call/job is manufactured. |
| PM-04 path safety | Shared guard rejects blank, control/C1/DEL, dot segments, overlength, invalid types, sparse holes, malformed surrogate and oversized collections. Direct detail reads reject locally with zero fetch. Real Request preserves the fixed detail path for raw slash, valid Unicode, whitespace and literal percent sequences. |
| Invalid active history | Actual invalid legacy rows remain byte-for-byte equal as DB values after the rejected query; zero provider fetch and zero paid replay even on a subsequent submit invocation. Paid malformed submission remains uncertain with an existing claim and exactly one original POST. |
| PM-06 cancellation | Submit/detail JSON bodies distinguish aborted signal, independent Error named AbortError and DOMException named AbortError from ordinary SyntaxError. Binary speech and CDN fetch/body AbortErrors receive aborted classification without relying on an aborted signal. Failed HTTP diagnostic body keeps ordinary malformed JSON as HTTP failure. Exact one-call assertions exclude extra requests. |
| Store and ZIP | `validateAudioTaskObservations` validates taskIds before optional-observations early return. Actual prepare/claim validation and patch use it (`src/db/audioGeneration.ts:18,53,67,105`); snapshot/import both use it (`src/lib/audioProjectPackage.ts:192,202`). Invalid patch preserves the row/revision; corrupt ZIP import leaves every table unchanged; snapshot rejects the same invalid collections. Prepared music and speech empty collections remain valid, including dormant ZIP history. |

Recovery is entirely GET/download and revision-checked local writes. Existing original claim/history, media ownership and ambiguous paid-outcome safeguards are retained.

## Final verification

All package-manager commands used the explicit local executable `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`. Observed pnpm **10.15.0**, Node **v24.11.0**, isolated ESLint **v9.39.5**. No install or bundled Codex pnpm was used.

Final focused Vitest: **9 files, 203 passed, 0 failed, 0 pending**, exit 0, JSON `success: true`.

| Test file | Cases passed | Result |
| --- | ---: | --- |
| `apimartAudio.test.ts` | 47 | PASS |
| `audioAgentExecution.test.ts` | 18 | PASS |
| `audioFoundation.test.ts` | 10 | PASS |
| `audioGenerationAgent.test.ts` | 17 | PASS |
| `audioGenerationRecoveryAudit.test.ts` | 45 | PASS |
| `audioGenerationRuntime.test.ts` | 21 | PASS |
| `audioOutputEvidence.test.ts` | 12 | PASS |
| `audioTaskEvidence.test.ts` | 16 | PASS |
| `projectPackage.test.ts` | 17 | PASS |

Exact commands, timing and exits: `B05-check-tests-run.json`, `B05-check-lint-run.json`, `B05-check-diff-check-run.json`, `B05-check-eslint-run.json`. Raw output and assertions: corresponding `.log` files, `B05-check-tests.json` and `B05-check-eslint.json`. The final focused command executes the nine files above with `pnpm exec vitest run --reporter=json --outputFile=...`; there is no full-suite claim.

- Local pnpm `lint` (`tsc -b --pretty false`): exit **0**, no diagnostics.
- `git diff --check`: exit **0** across current tracked changes.
- Existing isolated ESLint configuration, four B05 product sources only: exit **0**, **0 errors / 12 inherited warnings**. The new helper has zero diagnostics. `B05-check-eslint-summary.json` compares original audit signatures: **no new non-complexity signatures**; unsafe task_id member access and control-regex signatures are removed. Existing complexity/nested-ternary warnings remain outside this root unit. The initial scan's relocated no-control-regex error is preserved in `B05-check-initial-eslint.json` and removed by the shared character check.

Initial unchanged-code run: 188/188. After the surrogate correction: 200/200. Final additional explicit Unicode length boundaries: **203/203**. The final run supersedes earlier counts.

## Spec drift, limitations and handoff

Re-read the coordinator-updated B05 executable section in `audio-music.md` after the surrogate correction. **No remaining drift**: the spec explicitly rejects unpaired UTF-16 surrogates, accepts valid pairs and counts them as two UTF-16 units. Its final SHA-256 is saved in the snapshot. The checker did not modify this spec.

Tests execute actual Dexie repositories/package code under fake-indexeddb, mocked fetch/Response, real Request URL normalization and the existing deterministic decode seam. No live paid APIMart call, real CDN, browser-native IndexedDB scheduling, real WebAudio decoder or UI automation was exercised. The invalid-history path intentionally preserves paid history with a local diagnostic; it does not silently repair malformed IDs. Existing dormant/prepared/saved early returns remain unchanged. Batch-wide integration/build/full-scope review belongs to the coordinator's later gate.

Acceptance: **PASS for B05 PM-03/04/06 after the checker fix, with no outstanding material blocker**. Coordinator may use this evidence for ledger closure and batch progression. No commit, push, archive, task/status/ledger mutation or message to another thread was performed.
