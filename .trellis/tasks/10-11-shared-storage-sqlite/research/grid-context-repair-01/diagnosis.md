# Actual packaged grid context saturation

Date: 2026-10-12. Owner: native_grid_context_fix. Source and command identities are in `acceptance.json`.

## Observed gap and change boundary

The root session imported 65 disposable images into an isolated packaged SQLite product with 70 total materials. Later visible thumbnails decoded and managed file descriptors returned to zero. After navigating to projects, saving an IP link and returning to assets, the actual WK product error boundary displayed `Too many concurrent storage contexts`. The root's original host record remains in `../packaged-host-01/grid-mounted.json`.

The gap belongs to native root query admission in `src/lib/storage/native.ts`. The Rust owner correctly retains its independent 64-context safety limit. The TypeScript driver previously counted concurrent readers but admitted every reader behind the same resolved writer promise. MaterialCard opens one observed compound material-version query per mounted material; a burst exceeding 64 can therefore request too many native contexts even when every started context eventually closes. Disposal suppressed observer publication but did not retire its still-queued read.

The repair changes only that root admission owner and its adjacent regression file. There is no Rust/native media, database format, business rule, UI, owner activation, fallback, migration or supplier change. The frozen native binary remains usable for these tests. The root session owns rebuilt application and final full-scope acceptance.

## Executable causal evidence

Before changing production source, the new actual Rust probe regression issued 70 simultaneous material-version compound queries. Exactly six rejected with the host's same `Too many concurrent storage contexts` error. A second case disposed 70 observations queued behind a held writer; those obsolete reads still began and caused another ceiling rejection. Both failures are preserved in `before.log`, with the old production file recoverable by the recorded HEAD and SHA-256. The two existing FIFO tests still passed.

This demonstrates admission saturation. It does not establish a persistent context leak or substitute for the original WK navigation sequence. The direct queries use the same facade/compound selector as the MaterialCard subscription, but are not a browser-rendered grid.

## Final behavior

One FIFO admits up to 32 root readonly snapshots per driver. A queued writer waits for every earlier reader, runs exclusively, and keeps later readers behind it. The native 64-context guard is unchanged. Admission lasts through existing context validation/abort or commit reconciliation, and releases in `finally` on all outcomes. Every root callback still runs at most once; explicit nested transaction handles join their existing root without queuing again.

An observation has an internal AbortController. Disposal removes a waiting read from the queue before native begin; cancellation after admission is checked again before invoking its query. An already running query continues through the existing guarded settlement and cleanup, with late publication suppressed. No polling, mutation retry, context-limit increase or whole-library binary hydration was introduced.

## Verification and limits

- Three consecutive bursts of 70 real material-version snapshots all returned the correct version IDs. The actual acknowledged live context count stayed greater than one and below 64, and returned to zero after every burst.
- Seventy observations disposed behind a held writer invoked zero query callbacks, issued zero additional begin calls and published no result/error. Only the writer and a final sentinel read began.
- A 70-reader batch with one actual callback failure completed before its queued writer and later reader. All 70 callbacks ran exactly once; the writer committed, the final read saw it, and the failed snapshot released admission.
- The existing cancellation/late-failure FIFO and concurrent-reader/writer-priority cases remained passing.
- The neighboring native/browser conformance and query lifecycle batch passed 4 files / 151 tests. Final admission passed 5 tests after the narrow cancellation Error normalization. TypeScript passed. Final single-file ESLint has zero errors and two existing complexity warnings. Initial lint errors remain recorded; no debt/allowance changed.

Actual rebuilt WK navigation from the 70-item grid to another page and back, saving afterward, is still required. This report does not claim that packaged host gate, normal SQLite activation, full-task completion or Windows/Linux acceptance. The recommended owning-spec addition is to record bounded FIFO readonly admission and cancelable queued observations alongside the current native root transaction contract.
