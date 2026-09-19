# Implementation plan

Status: approved to proceed on 2026-09-19 after child1 acceptance; implementation contracts reconciled with child1.

1. Read agent-tasks/execution/context/creative-skills, state-management and UI/quality specs. Recheck current domain and tests; settle exact schema and structured-response parsing through code research.
2. Reuse task acceptance expectations and add wrap-up records with additive migration, repository ownership, version checks and thread cleanup. Test legacy tasks, stale snapshots, deletion and competing writes.
3. Implement bounded evidence assembly and read-only summary preparation with strict source validation, durable cancellation/error states and manual drafting. Verify no business tools or generation submissions occur.
4. Integrate flat task review UI: prepare, inspect/edit, save partial, confirm, complete/archive/reopen. Use real entity/result links and explicit missing/stale source states.
5. Verify successful and incomplete tasks, generation downloaded versus applied, changed business targets, model errors, reload, no connector and cross-tab review. Run desktop/mobile keyboard/browser fixtures with mock providers.
6. Run local pnpm lint/test/build, update executable specs and validation artifacts, present the result, then commit/archive after user authorization. The memory-management child starts only after this deliverable is accepted.

Commands use /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm. Do not use the Codex Runtime pnpm. Avoid live paid APIs for tests.

Risk checkpoints: source coverage must be explicit; model prose never independently proves completion; network must stay outside DB transactions; archived summaries and future memory provenance must survive planned lifecycle operations without resurrecting deleted data.
