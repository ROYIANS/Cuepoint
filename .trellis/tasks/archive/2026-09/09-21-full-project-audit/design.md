# Audit design

## Method

Combine complete module coverage with end-to-end business traces. Begin with broad checks and architecture; deepen review around persisted data, async state machines, external side effects, large modules and changing contracts. Risk determines review depth, not whether a module disappears from scope.

For each critical operation trace both success and failure:

`route / UI / Agent tool → validated input and owner → domain rule → transaction → persisted records → reactive UI / task evidence / export`

Compare all callers of shared mutations. Expected behavior comes from accepted user decisions and current contracts; code establishes current behavior. `docs/README.md` labels product documents as direction notes, so future plans are not automatically shipped requirements. Reconcile contradictory specs with the owning historical task and implementation; unresolved product intent becomes a contract question.

## Eight review rounds

| Round | Review scope | Initial anchors | Required output |
| --- | --- | --- | --- |
| A0 Baseline | Freeze commit/environment; inventory files, routes, tables, tests and release gates; brief browser smoke | package.json, Vitest/Vite configs, tests/setup.ts, Dockerfile, CI | Check log, complete inventory, risk map and smoke outcome |
| A1 Architecture | Ownership, module boundaries, dependencies, durable/transient state, shared business rules and contradictory contracts | src/domain, src/db/database.ts, routes, tool registry, specs | Data-flow/ownership map, critical invariants and state-transition inventory |
| A2 Data integrity | Transactions, migrations, cascades, orphan media, autosave, undo, filtering/reordering, import/export and ID remapping | src/db repositories, projectPackage.ts, debouncedDraft.ts, productionHandoff.ts, episodeDelivery.ts | Migration/format/cascade matrix and reproducible integrity findings |
| A3 Agent and AI | Approval snapshots, stale previews, retries, cancellation, uncertain effects, recovery, cross-tab ownership, stream parsing and completion evidence | runChat.ts, runOwnership.ts, generation runtimes, agent repositories, src/lib/ai | Transition/fault matrix and cross-entry consistency findings |
| A4 Detailed code | Dead paths, duplicated rules, redundant state, type bypasses, closures/effects, cleanup, query/render cost, error patterns and CSS | All remaining source; prioritize ShotEditorPage.tsx, repo.ts, projectPackage.ts, AgentChatPage.tsx | File review ledger and evidence-backed duplication/refactor candidates |
| A5 User experience | Complete workflows, navigation, feedback, empty/loading/error states, accessibility, mobile layouts and measured scale behavior | Rendered studio, story, shots, production, Agent, memory and connector pages | Journey results, screenshots and performance evidence |
| A6 Boundaries and release | Untrusted files/URLs/model content, secret exposure, dependencies, generated snapshots, production deep links/caching and test effectiveness | References/renderers/transports, importers, scripts, deploy, configs and tests | Boundary/release checklist and test-gap analysis |
| A7 Reconciliation | Revalidate claims, remove false positives, deduplicate causes, close coverage holes and order repairs | All audit evidence | Final report and staged repair backlog |

Security, performance and testing are cross-cutting throughout A1–A5; A6 closes remaining gaps. A0 browser smoke informs priorities early. A confirmed critical issue is surfaced immediately, not held until A7.

## Critical invariant seeds

1. Studio assets and project snapshots retain distinct ownership and IDs; copied media is independent. Project/episode scope agrees in routes, reads, writes and exports.
2. Creation, deletion and restore preserve episode/shot/asset/media relationships. Concurrent last-episode deletion is guarded. Media still referenced anywhere in the supported ownership domain is not collected.
3. Latest autosave wins. Route changes and exports do not silently discard pending/failed drafts. Concurrent independent fields merge rather than replace unrelated edits.
4. Filters, selection, bulk edit, reorder and undo affect intended owned records. Design/media views operate on the same shots; manual shot status is not inferred from media against the accepted contract.
5. ZIP round trips preserve the documented project graph, metadata, legacy fields and memory provenance with correct ID remapping. Invalid input rolls back atomically. Verify precisely which global/chat/reference records are included; do not assume a project backup is a full browser backup.
6. UI and Agent mutations obey the same business rules. Approval covers exact reviewed parameters and scope; stale revisions and provider changes cannot silently change approved effects.
7. Local stop differs from provider cancellation. Unknown submission outcomes are not blindly retried. Reload and multiple tabs do not duplicate external jobs or ownership.
8. Job, batch, tool, run and task states agree. Downloaded candidates differ from applied outputs. Wrap-up and completion use current evidence rather than optimistic model claims.
9. Memory, references, images and web sources remain scoped and revision-aware. Context budgeting/compaction preserves necessary tool envelopes and approval boundaries. External text cannot grant permissions.
10. Loading, missing, empty, failed, interrupted and saved states are distinct; supported recovery paths remain visible and usable.

These seeds guide review; a suspected violation is not yet a finding. A1 refines them into exact preconditions and expected transitions.

## Browser scenario matrix

| Journey | Happy path | Boundary / interruption checks |
| --- | --- | --- |
| First use / routing | Configure test connector; create film and series; enter workspace | Empty DB, missing IDs, foreign episode, deep links, reload/back/forward, absent provider |
| Asset reuse | Create all four studio asset kinds, copy into project, edit and reuse media | Duplicate snapshot, source deletion, missing media, owner isolation |
| Story and shots | Edit script; add/reorder/duplicate beats/shots; switch views | Immediate navigation/export after typing, emoji selection, filters plus bulk edit, focus/shortcuts, delete/undo, concurrent tabs |
| Generation | Review parameters; fake single/batch submit; retrieve/select/apply | Rejection, stale preview, double click, timeout, lost submit response, refresh, pause/cancel, storage error, provider switch, target deletion |
| Agent task | Bind project; execute/approve tools; inspect records and wrap-up | Unbound/foreign scope, rejected tool, stale revision, interrupted stream, uncertain write, retry, second tab, deleted project |
| Memory / references | Import text/image; inspect provenance; retrieve/edit approved memory | Unsupported/corrupt/large file, duplicate source, wrong owner, stale revision, budget boundary, inaccessible URL |
| Delivery / backup | CSV, printable storyboard, handoff and ZIP; import into clean DB | Unicode/newlines/quoting, missing media, pending drafts, legacy/corrupt ZIP, failure rollback, normalized graph comparison |

Exercise desktop 1440×900, compact desktop 1024×768, mobile 390×844, keyboard-only interaction and 200% zoom. Check accessible names, focus order/return, dialog trapping, contrast and reduced motion. Record actual browser versions. Use available Chromium as baseline and WebKit/Safari if available for persistence, locks, file download and printing; unavailable coverage stays explicit.

Start synthetic fixtures at 10, 200 and 1,000 shots, plus ~500-message transcripts and media-rich projects. These are test sizes, not promised product limits. Measure route readiness, input lag, scroll behavior, database queries, ZIP processing, heap/object URL cleanup, polling and cancellation. Include environment/fixture details; do not invent an SLA or judge performance from file size.

## Classification

| Priority | Meaning |
| --- | --- |
| P0 | Demonstrated critical exposure or widespread destructive corruption requiring immediate attention |
| P1 | Data loss, unintended paid resubmission, ownership/approval violation or blocked core workflow without reasonable recovery |
| P2 | Functional inconsistency, recoverable failure, meaningful UX/accessibility/performance barrier or repeated domain-rule drift |
| P3 | Low-impact clarity/polish or supported maintainability improvement |

Confidence is independent: confirmed by reproduction/proof, suspected, product question, disproved. Group one root cause across all affected callers. Duplication/complexity alone is technical debt until impact is demonstrated. Extract shared code only when callers express the same concept and should change together; retain intentional compatibility and provider differences.

## Remediation shape

Order repair batches by impact and dependencies: integrity/approval/recovery, then functional consistency, then measured UX/performance, then structural cleanup. Each repair receives a minimal reproducer and regression expectation. Audit completion means coverage and evidence are reconciled, not that every finding is repaired.
