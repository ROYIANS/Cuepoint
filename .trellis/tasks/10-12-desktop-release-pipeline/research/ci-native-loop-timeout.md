# Research: native 64-turn Agent continuation timeout during full acceptance

- Query: Does the new query byte grouping cause the local full-SQLite lane's existing 32-request continuation case to exceed its 20000ms deadline, and what evidence is needed before any correction or retry?
- Scope: internal static source comparison and focused actual Node24/SQLite execution; no GitHub/Linux or product change.
- Date: 2026-10-12

## Findings

The root session's first final full-SQLite `all` run reported one existing Agent case exceeding 20000ms (observed20053ms, file25976ms), with1904other tests passing across108files. The owner-supplied GitHub failure concerned oversized identities; this Agent failure was discovered during additional local native validation and is a separate case. The new oversized-identity regressions passed in that full lane. Root reports `changedInputs:[]`; raw full-lane evidence remains owned by root.

The unchanged permanent Agent case passed in a focused actual SQLite run using Node24.11.0 and the current actual `.tools/target/debug/product_store_probe`, with the original native20s global timeout. Runner duration was16.30s. A second focused research-only instrumentation copy also passed at the same20s deadline, with all15original assertion lines unchanged and the original64tool turns retained. Runner duration was16.83s; this observation additionally enabled the same synchronous table/tool coverage mechanism as the permanent complete native gate.

Actual query observations establish that the changed grouping branch is not reached:

| Observation | Instrumented current case |
| --- | ---: |
| Actual `query` requests |553 |
| `equals` selectors |553 |
| `anyOf` selectors |0 |
| Maximum selector key count |1 |
| Maximum serialized selector-key bytes |133 |
| `requestStart` / `requestChunk` / `requestFinish` |0 /0 /0 |
| `readTransfer` |0 |
| Mock model/tool turns |64, exactly32in each segment |

This supports an existing deadline margin sensitive to runtime conditions, independent of the new `anyOf` scheduling branch. It does not establish CPU contention, disk pressure, storage defect or an earlier individual-case duration.

### Phase timings and existing workload

| Phase | Actual local time |
| --- | ---: |
| Create/configure run |0.077s |
| First32tool turns |4.882s |
| Close/reopen SQLite fixture |0.016s |
| Recover thread runs |0.019s |
| Second32tool turns |9.780s |
| Final resume, finishing check and review |0.962s |

The full observed fixture lifecycle was16.715s. Phase totals exclude several unchanged assertions and fixture setup/teardown. RPC observations across that lifecycle include3475`begin`,5426`get`,803`commit`,553`query` calls; direct `get` roundtrip time totals7.662s and commit roundtrips2.758s. Timings include transport and actual Rust work, not isolated CPU profiling.

The second segment's greater cost is consistent with existing cumulative ledger reads and point reads; causality requires counterfactual testing before changing that product logic. `src/lib/agent/runChat.ts:102` reads all calls for the current run. Its first pass skips settled calls, but the second pass at `runChat.ts:169-172` fetches each saved call before checking settled status. The64tool-turn sequence therefore includes a static sum of2080such reads (`1+...+64`), plus96on the two resume-entry passes (32+64), before other reads. This is current unchanged behavior, not a request to omit authority reads. `saveToolRound`, `prepareRunContext`, `upgradeLegacyPlanCalls` and `appendToolResults` also read cumulative `runId` ledger queries. `appendToolResults` reconstructs the complete continuation without replaying completed tools, while run metadata/audits grow with each turn.

Several model-boundary functions open read/write transactions even on their no-change path (`pauseAtModelStepLimit`, `refreshRunToolLoading`, project/memory refresh and `upgradeLegacyPlanCalls`). `NativeDriver.runTransaction` still prepares/seals/commits a successful `rw` callback. These facts explain why a64turn persistence regression has many native operations; they do not prove a new regression or authorize altering commit/authority contracts to make the deadline pass.

### Prior evidence and source identity

The prior frozen complete native lane is `research/logs/frozen-shared-storage-all/acceptance.json`:

- Node24.11.0, actual `.tools/target/debug/product_store_probe`, same native-owner configuration (`maxWorkers:2`, `testTimeout:20000`, `hookTimeout:20000`).
-108files /1903tests passed, native lane288.81s; full runner exit0 and no changed inputs.
- Its minimal `native-tests.log` contains only whole-lane timings, so the previous32segment case duration is not available.

Of23 inspected source paths,21match the prior frozen source hashes. The two changed paths are `src/lib/storage/native.ts` (approved query-only byte grouping) and `scripts/native-storage-regression.mjs` (earlier portable probe-tool seam). The Agent case, execution loop, bookkeeping, context helpers, native bridge, probe fixture, native Rust query/store files and Vitest config remain byte-identical. All23inputs remained unchanged throughout these focused observations.

The current probe executable SHA differs from the earlier frozen complete-lane probe. Both digests and sizes are recorded in `logs/ci-native-loop-timeout/provenance.json`; do not describe them as the same binary. The inspected Rust store/query sources match, and no rebuild was performed in this investigation. Prior compile/link output identity is insufficient to infer runtime performance equivalence.

### Smallest useful next step

Root may perform one final complete `all` lane recheck on the unchanged source with the original two-worker owner configuration and original deadlines, now that focused verification shows the new grouping branch is absent and the complete Agent contract succeeds. Keep the first full-lane failure, both focused passes and final full-lane outcome together. A focused pass cannot replace the final full native gate.

If the complete lane repeats the same timeout, obtain bounded instrumentation of the unchanged case under that lane's actual workload before selecting a correction. Keep per-phase request/call counts, exact query kinds, original assertions and deadline. Compare current and prior algorithm/source under equivalent instrumentation if proposing a product optimization. Do not raise deadlines, shrink64turns, skip the case, retry indefinitely or claim the fresh `anyOf` fix caused it without evidence.

### Files found and code patterns

| Path / anchor | Purpose |
| --- | --- |
| `tests/agentTools.test.ts:139-165` | Complete two32turn segments, reopen/recovery, immutable old calls and final cumulative67steps. |
| `tests/agentTools.test.ts:19-28` | Shared setup and mocked controlled tool; no paid provider/business workspace execution. |
| `tests/helpers/finalReviewFixture.ts` | Actual ordinary mock rounds plus bounded read-only final-review fixture. |
| `src/lib/agent/runChat.ts:99-106,169-172,239-276` | Cumulative call loading, point authority reads and model/context loop. |
| `src/db/agentTools.ts:56-76,113-157,202-271` | Segment pause, durable tool round, continuation/resume and immutable result chain. |
| `src/lib/agent/toolLoading.ts:120-126` | Short no-loading branch; this case enables foundation skills only. |
| `src/lib/agent/projectContext.ts:125-132` | This unbound thread returns without loading project entities. |
| `src/lib/agent/memoryContext.ts:10-25` | Unbound thread returns without project memory retrieval. |
| `src/lib/agent/contextCompaction.ts:77-90` | Settled ledger/context checks; ordinary test responses stay fixture-owned. |
| `src/db/agentToolRecovery.ts:70-86` | Equality `runId` scan to upgrade legacy plan calls; no change to settled controlled calls. |
| `src/lib/storage/native.ts:109-126` | New byte scheduling applies only to `anyOf`; actual case never enters it. |
| `src/lib/storage/native.ts:282-310` | Actual snapshot/commit owner and complete successful `rw` settlement. |
| `tests/fixtures/shared-storage/nativeDatabase.ts` | Actual Rust fixture lifecycle, no fallback. |
| `tests/fixtures/shared-storage/storeFactory.ts:9-17` | Full native gate's synchronous commit coverage append. |
| `vitest.config.ts:33-37` / `scripts/native-storage-regression.mjs:91-103` | Existing20s/two-worker explicit SQLite lane and fixed real probe. |

### Research instrumentation and files written

`research/logs/ci-native-loop-timeout/` contains:

- `focused-permanent-node24.log`: unmodified permanent case passed at the existing timeout;1passed/21name-filtered skipped.
- `agentToolsProfile.test.ts`: task-only copy; identical64turn sequence and all15original assertion lines. Phase/model-call observations change no product values or budget.
- `nativeDatabaseProfile.ts`, `metrics.ts`, `instrumented.config.ts`: task-only actual fixture with intercept/read-only timing. Captures type/count/bytes, no provider keys, authored payloads or user data.
- `instrumented-node24.log`, `instrumented-result.json`, `instrumented-summary.json`: actual pass, phase timings,553equality selectors and zero new-branch entries; original20sdeadline retained.
- `profile-coverage/`: finite actual coverage records using the same original coverage seam. This test's controlled `execute` overrides mean these records do not claim real workspace tool-business execution.
- `provenance.json`: previous/current source/probe identities, unchanged inputs and focused exits; raw original full-failure ownership remains with root.

## Related specs

- `.trellis/spec/frontend/shared-product-storage.md`: exact original tool chains and certainty, no replay, native transaction admission/authority and current local history semantics.
- `.trellis/spec/frontend/quality-guidelines.md`: complete final frozen native validation, real probe requirement, evidence versus actual product claims.
- Task PRD AC6: final full browser/native storage gates; an incidental local margin observation does not expand packaging scope or close corresponding-host acceptance.

## External references

No external source was needed. Evidence is current repository code, prior frozen source receipts and actual disposable local SQLite runs. Versions observed: Node24.11.0, pnpm10.15.0, Vitest5.0.1; existing real Rust probe, no new compilation.

## Caveats / Not Found

- This incidental failure is local full-SQLite validation, not the owner's GHCR oversized-identity failure. No hosted/Linux32segment failure was inspected.
- No global CPU, memory or disk-pressure measurements were taken. Available disk space alone does not prove an IO cause; no unsupported cause is asserted.
- Prior logs do not provide individual-case timings. The current probe differs from prior linked output and remains recorded truthfully.
- Focused observations establish current success and an absent new branch, not full-suite success or universal stability at20s.
- No source, test, deadline, worker configuration, cache, user data or Git action was modified. Research copies remain diagnostic and outside product/CI entry points.
