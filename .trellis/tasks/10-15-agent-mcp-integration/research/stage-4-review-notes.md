# Stage 4 independent review notes

The final review covered the management/UI/Web delta and traced it through the
already reviewed E10 configuration, native port, Agent approval and E07 owners.
It did not rerun installed/full/native gates or relabel earlier fixture evidence.

## Corrections required before closure

1. Browser disconnect originally deleted current connections before retaining
   their cleanup owner and awaited only SDK close. That could label a held
   connect, response body, token refresh or code exchange drained too early.
   The final host tracks actual per-server tasks and retired connections, closes
   admission first, aborts owned IO, and preserves the same finite drainage
   observation across repeated retire/disconnect/dispose. Five real-SDK/held-port
   regressions verify actual task completion rather than token cancellation.
2. An old browser call failure or old directory notification could retire a new
   same-server registration. Final callbacks compare their captured connection
   with the current owner. Late original outcome remains available without
   retargeting or revoking the replacement. A held old invoke, reconnect, late
   rejection/notification and successful new prepare/invoke regression passed.
3. Failed or retired login checks/cancellation could leave a permanent UI lock
   after the connection owner had removed the attempt. The manager now retains
   the original server/attempt as unresolved and offers original retirement
   recovery. Actual draining keeps editing locked; actual drained releases it.
   Two additional ReactDOM tests exercise cancellation failure and external
   catalogue retirement, through the existing production controls.
4. The new management browser CLI lacked Knip discovery under its chosen name.
   Add the exact CLI entry; do not widen the all-source graph or rename a frozen
   acceptance runner unnecessarily.

During implementation, the actual Chromium network fixture also discovered
automatic replay beneath a single string-body fetch. Single-use streamed POSTs
and a bounded HTTP/2/3 compatibility requirement fixed it. The final strict
effect counters, not merely JavaScript fetch counts, establish the tested
no-replay behavior. See the browser validation record for the failed observation,
official-source rationale and corrected actual execution.

## Final independent receipts

- Integrated finite MCP source profile: 19 files / 232 tests passed.
- Finite source noEmit: passed.
- Nineteen changed Studio source files: zero ESLint errors; two unchanged
  AgentControls review warnings, no new-module warnings.
- Actual architecture: 725 owned TS files / 678 Studio / 4,538 imports;
  zero ownership/boundary failures, cycles or computed imports.
- Source and staged new-file whitespace check: part of commit preparation.

Root separately executed the strict 24-case actual Chromium SDK/HTTP2/OAuth
fixture, actual workspace SDK browser closure, emitted freshness/exports and
actual Web /agent-to-Settings management smoke. The retained UI implementer
executed the final strict 12-case browser runner after management recovery changed,
verified source hashes again after the run, and actually viewed wide/narrow
screenshots. These receipts are kept distinct from the reviewer's own execution.

No unresolved source blocker remains after the listed corrections. Full formal
quality/build/packed/release/installed macOS and Windows acceptance is explicitly
carried to the parent epic, including the reported isolated Dexie startup failure.
