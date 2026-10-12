# Research: existing 64-turn Agent persistence cost

- Question: Why can the unchanged two-segment Agent test exceed both the browser 5-second and actual SQLite 20-second deadlines during the final release follow-up checks, and what is the smallest safe optimization?
- Scope: read-only current-source analysis, previous actual protocol observations and root-owned final-candidate runs. No new test run, product edit, fixture edit, deadline change or remote operation was performed by this researcher.
- Date: 2026-10-12.

## Observed evidence and limits

The final-candidate ordinary root run in `logs/release-hosted-final/root-tests.log` failed the existing `tests/agentTools.test.ts:139` case at 5016 ms; 3959 other tests passed. Its unchanged isolated browser rerun passed, with 2.17 seconds total runner duration. The complete actual SQLite lane also failed this case at its unchanged 20-second deadline. Root's subsequent focused actual SQLite execution passed the unchanged case in 16529 ms, with 17.32 seconds total runner duration. These are local macOS observations, separate from the owner's original macOS frontend OOM and Windows native-fixture failures.

Earlier `ci-native-loop-timeout.md` already measured the same existing case at 16.715 seconds through the real Rust probe. Its actual request counts included 553 `query` calls, all `equals`, zero `anyOf`, 5426 `get`, 3475 `begin`, and 803 `commit` calls. The first 32 turns took 4.882 seconds and the second 32 took 9.780 seconds. Point-read roundtrips summed to 7.662 seconds; commit roundtrips summed to 2.758 seconds. These totals include the process transport and Rust work and do not isolate disk time or CPU time.

All 17 inspected Agent/storage/fixture/configuration files still equal current HEAD `946664ab235e0996da138796bd7d364381dab6ab`; hashes are retained in `logs/release-agent-loop-cost-research/provenance.json`. The release follow-up changes have not rewritten this Agent path. Its equality selectors do not reach the earlier `anyOf` byte-group scheduling correction. Neither the prior observations nor this read-only analysis proves a specific resource-pressure cause for the difference between focused and full-suite times. A focused pass is not a replacement for the complete gate.

## Definite repeated work in the existing implementation

### Historical settled calls are point-read again before being discarded

`src/lib/agent/runChat.ts:102` loads and sorts every call belonging to the run. The first preflight pass at lines 108–110 already skips snapshot calls with status `completed`, `failed` or `rejected`. The execution pass at lines 167–170 instead calls `db.agentToolCalls.get(saved.id)` for every historical entry and only then skips the same terminal statuses.

With one new call per turn, that second pass performs `1 + 2 + ... + 64 = 2080` point reads across the 64 ordinary tool rounds. Only 64 of these are candidates for execution; 2016 read already settled historical calls. The two resume-entry passes add another `32 + 64 = 96` settled-call point reads. Thus 2112 point reads in this exact workload are attributable to revisiting terminal snapshots before discarding them. This arithmetic describes the source path, not a newly measured optimized request count.

These are root-table reads. `TableHandle.get` delegates to `bulkGet`, and `makeStore` opens a root readonly transaction when no explicit transaction backend exists (`src/lib/storage/store.ts:68–70,134–140`). The native driver therefore performs `begin`, `get`, `validate`, and `abort` for each such ordinary inline point read (`src/lib/storage/native.ts:285–312`). The adapter decodes the complete row and the common table facade clones it. The browser owner opens an actual Dexie transaction, hydrates the row and clones it as well. This repeated cost exists in both owners and grows quadratically with the number of cumulative calls.

### Other existing costs remain, but are not part of the minimal proposal

- `saveToolRound`, `executePendingTools`, `upgradeLegacyPlanCalls`, `prepareRunContext`, and `appendToolResults` repeatedly load all `runId` ledger rows. The current facade and native adapter hydrate complete results rather than projecting only status. The earlier actual 553 equality queries demonstrate how often this path is entered; their individual returned-byte costs have not been measured for this candidate.
- `appendToolResults` scans cumulative calls and searches cumulative continuation messages. It preserves exact original call/result pairs and prevents replay. This research does not propose removing that validation or rebuilding its semantics.
- The persisted `AgentRun` grows with continuation messages, activity steps and per-step reference audits. Each common get clones the complete value; updates clone and stage complete rows, and native `prepareBatch` losslessly encodes and serializes them. The exact current bytes or isolated encode/clone times are not yet measured.
- `pauseAtModelStepLimit`, `refreshRunToolLoading`, project refresh, two memory refreshes, and legacy-plan upgrade enter read/write transactions even along their no-change path. Native successful read/write settlement seals and commits even when no mutations exist. That is visible in current source, but changing generic no-op transaction semantics or authority checks would be substantially broader than the historical-call read correction.
- Context budgeting serializes the cumulative continuation at the preparation and final dispatch boundaries. The foundation-only, unbound fixture skips actual project facts, project memory selection and deferred-tool loading; it must not be described as exercising heavy real-provider or project-workspace execution.
- Complete native coverage appends committed-table records synchronously in the existing `storeFactory` subscription. This seam is test instrumentation, not product provider work. No measurement establishes it as the dominant cost, and this proposal does not disable it.

## Minimal optimization proposal and invariant rationale

In the second `executePendingTools` pass only, after `controller.signal.throwIfAborted()` and before the root point read, skip `saved` snapshots whose status is already `completed`, `failed` or `rejected`. Keep the existing fresh read and terminal-state check for every snapshot that was not terminal. Do not cache an entire ledger or use a snapshot to authorize execution.

Current legitimate product commands preserve terminal-call immutability:

- The first preflight pass already skips the same terminal snapshots. The loop's error cleanup explicitly states that completed calls remain immutable.
- `cancelAgentRun` changes only `pending`, `awaiting_approval`, and `approved` calls into rejected calls.
- `markRunningToolsUnknown` and `interruptThreadRuns` inspect `running` calls. The explicit legacy-plan predicate excludes stored results and terminal statuses. Batch recovery targets its separately defined unknown preparation state.
- Approval and generation-review commands require the matching awaited approval state. `executeAtomicTool` reuses a completed result rather than reverting it to pending. Reissuing a model action creates a new call identity; it does not reset a completed historical call.

There is an important precision limit: `transitionToolCall` exposes generic caller-provided `from` and `to` statuses; its implementation does not enforce a universal state graph. The conclusion is that **current legitimate product callers do not reverse terminal states**, not that arbitrary direct database writes are impossible. Supporting unsupported terminal-history rewrites is outside this proposal and outside the existing first-pass semantics.

The following safety boundaries must remain exactly as they are:

- Abort is checked for every visited snapshot, including skipped history.
- A nonterminal snapshot is reread immediately before execution, so a completed/rejected/failed result saved after preflight is still skipped.
- The current run is reread; stopped, deleted or changed ownership cannot authorize a claim.
- Metadata, offered tool, parsed arguments, approval and permission checks still run against the fresh candidate/current run. The atomic `pending | approved -> running` claim remains the execution gate.
- New failed states written by the first preflight pass are not accidentally trusted as snapshot terminal: the original snapshot remains pending, so the fresh read is retained.
- Completion lookup, atomic durable outcome resolution and unknown-effect handling remain intact. No failed lookup becomes permission to replay a side effect.
- Complete ledger queries, continuation reconstruction, exact 64 mock executions, 32-step segments, reopen/recovery, immutable original calls, 67 cumulative final model steps, finishing check and final review are retained.

## Validation and narrow profiling strategy

1. Keep the existing permanent 64-turn test byte-identical and retain both owner deadlines. Compare it before and after through the same actual browser and Rust SQLite entry points, then run complete frozen-source root and native lanes. Retain the current failures as evidence; do not rely on repeated unchanged reruns for acceptance.
2. Add a small separate regression with settled history plus a new pending candidate. Observe actual root-table point reads or actual protocol requests without replacing the adapter or returning fake records. Assert that terminal history does not cause additional per-record execution reads and that a fresh candidate is read/claimed exactly once. The original implementation must fail that read-amplification bound. Run on both actual owners.
3. Add a two-call preflight race: a later awaited preparation commits an earlier pending candidate to `completed` (with original result), `rejected`, or `unknown`. The execution pass must reread its candidate. Completed/rejected work must not execute; unknown work must block continuation and must never be replayed. Assert the final ledger, original result/arguments and exact model/tool counts, not only the final run label.
4. Keep or add Stop/deletion between preflight and claim; no later tool executes or resurrects a run. Existing `d05ToolMetadata.test.ts` already drifts all five metadata fields during a later preparation and asserts that the earlier candidate cannot claim; run these unchanged for both owners. Existing lifecycle/approval/uncertain-outcome tests provide further required coverage.
5. If additional attribution is needed, reuse the prior task-only actual `NativeInvoke` intercept. Count each request type, each query selector kind, request/reply bytes, and durations, plus phases first32/reopen/recovery/second32/final resume. Store only numeric/table/type data; do not record provider credentials or actual user payloads. Instrument complete fixture lifecycle including reopen. Optional common-facade timings should wrap real calls and preserve returned values and awaited ordering.
6. Do not infer optimized performance from the arithmetic alone. Measure the optimized candidate before claiming time saved. If the complete native lane still fails, use its actual workload and counters before widening to ledger projections or no-op transactions.

No heavy execution was duplicated: root owned the new focused SQLite run while this researcher inspected source and existing receipts. No cross-platform installer proof follows from these local Agent observations.
