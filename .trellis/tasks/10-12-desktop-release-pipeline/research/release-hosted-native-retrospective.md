# Bug analysis: hosted frontend resources and native ownership

## 1. Root cause categories

- **E — implicit assumption / C — propagation:** desktop frontend construction
  relied on Node's hosted default heap. Both actual macOS logs show an
  approximately 2 GiB heap exhausted during Vite rendering after 13,195 modules.
  All four callers separately spawn Node; a flag on a parent does not reach that
  child. The budget belongs to the single frontend entry and remains frontend-only.
- **B — platform contract / D — host coverage:** Win32 attribute-only directory
  handles do not participate in the sharing conflict required for rename/delete
  protection. The no-delete-share mask alone was insufficient. The corrected
  pinned open requests directory-list access while ordinary stat stays metadata-only.
- **E — lifetime assumption / D — host coverage:** fixtures removed their root
  in Drop before live SQLite fields and preview directory guards were destroyed.
  Unix can unlink an open file; the bundled Windows SQLite handle omits delete
  sharing. Release the actual resource owners explicitly before namespace cleanup.
- **B — diagnostic boundary:** both nested runners retained child output only in
  runner files. Wrapper failures exposed a name instead of the original error;
  cancellation skipped failure-only uploads. Linux's single failed test cannot be
  identified retrospectively from the surviving logs.

The source defects and documented Win32 semantics support these candidates.
The Windows original log does not contain individual panic messages; teardown
double panic is an inference, not a recorded terminal cause. Linux remains unknown.

## 2. Why earlier passes did not cover these failures

Earlier root quality corrections addressed missing probe setup, export ownership,
large read selectors and decoded MiMo copy cost. The actual same-source root and
GHCR gates now pass. Those checks did not reach a cold macOS desktop frontend
renderer or execute Windows directory/SQLite semantics. Warm ARM64 builds and
Unix fixture cleanup could pass while these separate corresponding-host
assumptions remained incorrect. No dependency replacement or deadline relaxation is part of this correction.
A reached64-turn Agent prerequisite exceeded both original owner deadlines;
focused SQLite succeeds near16s with thousands of repeated historical reads.
That repeated gate signal justified a local execution-loop cost correction rather
than further unchanged full reruns.

## 3. Prevention mechanisms

| Priority | Mechanism | Concrete action | Status |
| --- | --- | --- | --- |
| P0 | Explicit owner | One frontend launcher supplies a bounded 4096 MiB old-space worker budget | Implemented; local real builds pass |
| P0 | Actual lifetime | Close preview/binary/SQLite owners before removing private fixture roots | Implemented; local lifecycle/error regressions pass |
| P0 | Real platform probe | Keep ancestor rename assertions; add DELETE-open/release check on an empty directory | Implemented; actual Windows result pending |
| P0 | Live evidence | Forward nested child output, await EOF/log writes and preserve failing status | Implemented; real process/failure contracts pass |
| P1 | Cancellation evidence | Existing finite diagnostic upload also runs on cancellation | Source change; runner survival still required |
| P1 | Spec contracts | Document budget, sharing access, teardown and diagnostic error matrix | Updated in existing distribution/storage specs |
| P1 | Cumulative read cost | Skip queried terminal history while rereading every actual execution candidate | Implemented; both full owner lanes and race/Stop regressions pass |

## 4. Systematic expansion

The scope audit covered all four frontend callers and both actual nested logging
owners. Other build/test/provider budgets remain unchanged. Binary/media fixtures
were the live-connection owners implicated by the Windows failure distribution;
full-store fixtures already close/drop before removal. Existing no-overwrite,
flush, reparse, recovery, business/Agent and deadline assertions are retained.
No migration, UI feature rewrite or broad dependency change is justified.

## 5. Knowledge capture and evidence limits

`desktop-distribution.md` records executable frontend, pinned directory and
diagnostic contracts with error rows and tests. `shared-product-storage.md`
records exact fixture teardown ownership and normal/unwind error behavior.
This repository has no Trellis source template tree to synchronize. Root owns
the concrete local work-commit review; no skill instruction overrides the owner's
remote-action boundaries. Actual H1a four-host installers and H1b owned draft
delivery remain pending; do not archive from local gates or rerun the failed old
source and describe it as verification of these changes.


## Reached Agent workload and expanded narrow boundary

Current root and SQLite full gates both hit the existing64-tool continuation
case, whose sources match earlier passing receipts. Prior actual protocol counts
identify5,426 point reads; the second execution pass rereads each settled history
row before discarding it. In64turns and two resumes,2,112 such reads can be removed
while preserving per-item Abort and every nonterminal fresh authority/atomic
claim. This is an implicit cumulative-cost assumption and missing workload margin,
not a new synchronization feature. No terminal-history rewrite support or storage
state graph is added. The exact current fixture, paid/mock execution counts,
reopen, continuation bytes and5s/20s deadlines remain authoritative.

`agent-tools.md` captures that specific boundary and regression obligations.
Matched real protocol counters confirm exactly2,112 fewer point reads, while
query/write/commit counts remain unchanged. The profile's phase arrays are empty
and no new phase timing is claimed; total elapsed improves about4%, not39%.
Both complete final owner lanes pass unchanged deadlines: ordinary3,965tests and
SQLite1,910tests plus the existing auxiliary checks. Five meaningful regression
cases preserve fresh settlement/unknown/Stop authority; the actual old-loop
comparison fails its new read bound. All1,016source inputs remain frozen. Original
Linux diagnostic absence remains separate; matching one aggregate failure count
does not identify its failing test. Local passes do not close hosted installer
or draft-delivery criteria.
