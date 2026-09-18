# First repair batch execution plan

Status: approved by user on 2026-09-18; implementation and independent review complete, final verification/commit proposal in progress. See verification.md.

1. Convert research characterizations into desired-contract regression tests in normal tests for lost patches, slot concurrency, last-episode deletion, cross-episode filters, ZIP remapping and false readiness. Research probes assert current bugs and must not be copied unchanged as passing acceptance tests.
2. Repair atomic repo updates and deletion invariants; review all affected owner/reference boundaries.
3. Repair asset draft feedback and shared media edit lifecycle, including failed save/cancel/upload races and media inspection.
4. Implement episode-scoped filters + legacy/package migration, deletion pruning and reveal-target navigation.
5. Correct media/scene-aware readiness and gap detection; preserve placeholders with explicit semantics.
6. Add flush-before-backup and consistent snapshot; correct long storyboard print content.
7. Repair partial-copy retry and accessible labels/action visibility in touched modules.
8. Update relevant frontend specs and product behavior docs, run independent full-scope check, and produce verification/commit proposal.

## Validation
Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` only. Run targeted lib/repo regressions while implementing, then full lint, test and build once integrated; git diff --check. Browser checks include quota/save failure if feasible, cancel/reopen, upload/inspect, episode switching and restored filters, locate-shot, immediate backup and long print layout. Never mutate existing real user records for tests; use labeled synthetic fixtures.

## Continuing roadmap
After this repair batch: finalize the optional field inventory and actual prop/style/default relations, then media reuse and handoff/context contracts. Keep audit.md as the source for unresolved/deferred items. No full timeline/rendering engine without an explicit product decision.
