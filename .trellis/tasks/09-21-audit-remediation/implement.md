# Execution

- [x] Data integrity fixes with focused reproducer and migration/roundtrip tests.
- [x] Agent boundary fixes with original reproducer plus both-protocol/legacy-ledger regressions.
- [x] UI fixes and shot rendering improvement with focused tests/browser traces.
- [x] Analyze Agent bundle contribution; isolate heavy optional paths and measure cold route.
- [x] Add CI quality gate before image publication.
- [x] Resolve approved cleanup candidates after active paths are stable.
- [x] Independent review, full lint/test/build/model-bank verification, browser audit replays, compare measured performance.
- [x] Update executable specs, Chinese results and audit finding disposition.
- [x] Phase 3.4: user confirmed the concrete commit plan; code commits 8fb2a6f and 3e62493 created.
- [x] Phase 3.5: archive after documentation commit and append session journal; keep mixed prior/current journal changes unstaged to preserve the prior audit boundary.

Commands use local pnpm explicitly with Node bin PATH. Root runs full quality checks after workers finish; workers run focused suites. Avoid concurrent build/generation. The original audit scripts are immutable evidence; copy and adapt them into this task evidence directory. No real providers.
