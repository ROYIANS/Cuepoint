# Preimplementation planning review

Date: 2026-10-11. Read-only independent review by `parity_plan_review`. This is plan review, not code acceptance or implementation approval.

## Outcome

The complete-feature-first reuse direction is coherent: one shared Web product/Agent, temporary isolated desktop IndexedDB, preserved SQLite reference/test lane, SQLite-independent export, full P1–P10/registered-tool acceptance and honest actual packaged evidence.

Two actionable issues were found and corrected before final user review:

1. **P1 — HTTP 2.8.2 pending-body cancellation:** tagged source retains a response Arc during the awaited chunk read while cancel closes only the table entry. `design.md` and `implement.md` now explicitly allow a narrow provenance-preserving cancellation-aware dependency patch if reproduced, with stalled-body Stop/timeout, server disconnect, cleanup and late-event tests. Shared protocol/plugin infrastructure remains the implementation; no bespoke HTTP engine is authorized.
2. **P2 — zero-length Save contract:** research incorrectly required nonzero size while design preserved existing helper behavior. Research now accepts non-negative safe-integer size. Its outdated unresolved timeout/export-cap text now points to the final 30-second connection bound, 256 KiB chunks, two transfers/two-minute progress timeout and no new global ZIP cap.

## Remaining execution risks

- Real suppliers may reject an Origin header; actual supplier acceptance remains separate from fixtures.
- Official plugin upload buffers the body; current limits and concurrency remain explicit.
- Dynamic URL capabilities remain additive until restart, distinct from product wrapper configuration checks.
- Actual app/store isolation requires distinct IndexedDB namespace and WebKit identity, not only a renamed bundle.

These are visible implementation/acceptance checks, not unresolved product scope decisions. No source implementation, dependencies, tests/builds or provider requests were performed in the planning review.

## Planning gates

- User selected complete-feature-first Tauri with internal IndexedDB, Agent priority and later centralized SQLite.
- PRD was rewritten against the selected outcome, requirements, exclusions and observable AC1–AC9; superseded world-only research is labeled as such.
- Complex design and ordered implementation plan are present.
- Both context manifests contain 17 real existing spec/research entries and pass validation without truncation warnings. Larger owning specs are read directly by relevant roles.
- Task remains `planning`; final summary and subsequent explicit implementation approval are the next gate.
