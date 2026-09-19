# Task orchestration implementation outline

Status: implemented and independently checked on 2026-09-19; see validation.md. User approved commit and archive on 2026-09-19.

1. Add persisted Task-mode intake intent and frozen run eligibility. Remove immediate Task-mode UI creation; test that first ambiguous messages and reload create no task, while ordinary Agent mode cannot request task creation.
2. Implement additive acceptance/working-record persistence and current-run task binding, keeping manual busy guards and atomic tool outcomes.
3. Register focused task bookkeeping tools and instructions; reuse Todo tool and existing permission/continuation patterns.
4. Add source-backed research/proposal/progress records and bounded context assembly. Verify no fabricated evidence, envelope rewriting or duplicate work.
5. Extend task UI and test clarification-to-task, AI Todo/research/proposal updates, user corrections, reload/resume, stale/conflicting edits, ordinary chat and desktop/mobile flows. Include a representative multi-step creative request and verify actual entities against the recorded work.
6. Run local pnpm lint/test/build; update specs and validate, then commit/archive on approval. Proceed to task-wrapup only after acceptance.

Use /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm. No live paid requests for automated validation.
