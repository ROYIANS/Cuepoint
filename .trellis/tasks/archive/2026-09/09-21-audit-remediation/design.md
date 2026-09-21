# Remediation design

Use the approved audit report section 9 as source of requirements. Responsibility is split by stable modules for parallel Trellis execution.

1. Data owner: draft controller/UI consumers and repository persistence, old metadata preservation, connector uniqueness and migration, undo conflict handling (F01/F04/F05/F06). Track dirty fields and compare latest persisted field baselines atomically. Clean drafts may rebase; conflicting dirty text must survive and surface an actionable error. ZIP metadata is additive and legacy-readable. Preserve historical connector identities needed by job/run recovery when resolving duplicates.
2. Agent owner: task source projection, shared final paid-submit checks, safe errors, atomic plan declaration with old ledger compatibility, project visible defaults and copy (F02/F03/F07/F08/F09/F13). Reuse existing contracts and preserve authored history while source tool data is sanitized. Keep unknown external effects non-repeatable.
3. UI owner: raw decimal draft, interactive shortcut priority, SPA batch navigation protection and measured shot-list rendering (F10/F11/F12/PERF-01). Preserve keyboard drag, visible-selection, routing, focus and reorder behavior.
4. Root: release checks, Agent route dependency analysis and lazy loading (Q01/PERF-02), bounded unused-code cleanup, integration and browser checks. Do not replace the UI library or add a default E2E framework.

Shared files are coordinated explicitly. Fix correctness before cleanup; tests assert observable outcomes, not source text. Product/source data remains local to disposable fixtures. Report any unavoidable compatibility tradeoff with evidence.
