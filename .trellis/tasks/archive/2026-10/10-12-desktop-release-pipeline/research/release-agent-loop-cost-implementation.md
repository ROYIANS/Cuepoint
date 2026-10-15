# Reached Agent continuation cost: minimal implementation

## Ownership and change

The reached final browser gate exceeded the original 5-second deadline in the
existing 64-tool continuation case; the actual full SQLite gate exceeded its
original 20-second deadline. The focused unchanged case passes, but retains
thousands of cumulative history point reads. This correction follows
`release-agent-loop-cost-research.md` and the reached scope in
`release-hosted-native-followup.md`. It does not identify the original canceled
Linux hosted failure as this case.

Only the second execution pass in `src/lib/agent/runChat.ts` changes: after the
existing abort guard, skip snapshot calls already completed, failed or rejected
before individually rereading them. Current legitimate commands retain those
terminal outcomes, and the first preflight pass already uses the same terminal
skip. The generic transition helper still accepts caller-supplied statuses;
arbitrary direct history rewrites are not claimed to be structurally impossible.

Every nonterminal snapshot retains its actual fresh read, current-run check,
argument/metadata/permission checks and atomic pending/approved claim. Freshly
failed validation, settled preparation races, unknown outcomes, durable completed
result lookup and Stop behavior remain authoritative. No helper, adapter,
provider behavior, workload, deadline or worker setting changes.

## Permanent regressions

`tests/agentTools.test.ts` adds five cases:

- Three actual mock-tool rounds complete with three candidate root point reads,
  exact results and complete continuation. `vi.spyOn` observes the actual cached
  root table's `get` without replacing its implementation, returned rows,
  transaction driver or storage owner. Explicit transaction reads are deliberately
  outside that count; this is the execution pass's read-amplification bound.
- A later awaited preparation settles an earlier pending candidate through real
  `executeAtomicTool`: the transaction changes the thread title and durably saves
  its original result. The loop reads that now-completed candidate and preserves
  the result without another execution.
- The same preparation boundary rejects an earlier candidate: no execution,
  original arguments/result retained and appended exactly once.
- The same boundary marks a claimed candidate unresolved through the actual
  recovery command: no tool dispatch, no manufactured result and resume blocked.
- Stop during later preparation, after an earlier round actually completed,
  preserves settled history and prevents claiming either new pending call.

The existing 64-turn permanent case is byte-identical within its body to HEAD,
including all original assertions, reopen/recovery, cumulative steps and final
review. All existing metadata-drift/approval/Stop tests are retained. The
unchanged `d05ToolMetadata.test.ts` verifies all five metadata fields at both
preflight and claim boundaries.

## Focused execution and negative control

Finite evidence is under
`research/logs/release-agent-loop-cost-implementation/`.

| Local check | Actual result |
| --- | --- |
| Browser Agent + metadata files, original 5-second default | 2 files, 44 tests passed; runner 2.27s |
| Actual SQLite Agent + metadata files, original 20-second per-test deadline, coverage enabled | 2 files, 44 tests passed; runner 23.663s total; no changed inputs |
| Original loop against the new three-round read bound | Expected failure: 6 actual root reads versus 3; exit 1 |
| Original actual SQLite 64-turn profile, original 20-second deadline, coverage enabled | Passed; runner 15.806s; no changed inputs |
| Candidate matched actual SQLite profile, same deadline/probe/coverage | Passed; runner 15.110s; no changed inputs |

The original-loop negative control is task-local: a transform supplies the saved
original source at its original module identity, preserving its dependency
closure. Its SHA256 equals the pre-change baseline source. No product source is
temporarily reverted. `original-loop-regression-red.log` retains the failure;
`browser-agent-final.log` retains the candidate pass.

The initial new unknown-race fixture incorrectly used ordinary atomic recovery,
which safely returned that atomic call to pending. That test failure is retained
in `browser-agent.log`. The fixture now explicitly supplies an unresolved
outcome to the existing recovery command; `browser-agent-corrected.log` and
the final file run pass. No production recovery behavior was changed.

## Matched actual SQLite protocol counts

| Request | Original | Candidate |
| --- | ---: | ---: |
| begin | 3475 | 1363 |
| get | 5426 | 3314 |
| validate | 2672 | 560 |
| abort | 2672 | 560 |
| query | 553 | 553 |
| prepare | 613 | 613 |
| seal / commit / changes | 803 each | 803 each |
| open | 2 | 2 |

Exactly 2112 history point reads and their read-only transaction lifecycle calls
are removed. The actual write/commit/query counts remain unchanged. The measured
elapsed change is small (about 0.7s total runner time); a 39% reduction in `get`
count is not a 39% application speedup or a guarantee of full-suite headroom.

The copied profile configurations still execute the historical
`logs/ci-native-loop-timeout/agentToolsProfile.test.ts`, whose own metric imports
are separate from each new database intercept's metric module. Thus the new
result files contain real complete-fixture IPC counts but empty `phases` and
`modelRequests`. No new phase timings are claimed. Both provenance files name
the actual executed fixture/hash, the unexecuted identical copy and this
instrumentation limit. `summary.json` records counts, source hashes and the
unchanged permanent 64-turn body hash.

## Final acceptance boundary

The source candidate is frozen for the root's complete browser/native/quality
gates and independent review. These focused passes do not replace that gate or
prove actual hosted Windows/Linux/macOS Intel installer acceptance. There were
no Git mutations, dependency installations, provider calls, recordings or
remote Actions/Release operations by this implementer.

The two-file SQLite verification deliberately runs serially (`maxWorkers:1`) to
avoid overlapping heavy root work; the formal complete native gate retains its
original two-worker configuration. Its total duration spans 44 tests and is not
a per-test deadline measurement. `sqlite-agent-final.provenance.json` records
the exact actual probe and source hashes and confirms no inputs changed during
this check. `git diff --check` also passes on the two code/test paths and report.
