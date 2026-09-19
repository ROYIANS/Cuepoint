# Implementation plan

Status: approved by the user via “ok”; implementation in progress.

1. Define memory domain/schema, current/version tables and project ownership contract.
   Implement manual CRUD, source promotion, stable deduplication and atomic replacement.
   Add focused tests for provenance validation, CAS, races, history and deletion.
2. Extend project deletion and ZIP snapshot/import transactions. Validate remapping,
   pending-review imports, detached sources, failure rollback and export consistency.
3. Implement project memory feature page/route and workspace navigation. Use existing
   UI primitives and styling, flat list/detail layout, loading/missing states, search,
   categories, editing, explicit disable/delete and history with draft protection.
4. Integrate confirmed summary promotion and bound-chat plus-menu navigation. Completed
   sources remain valid entry points. Do not implement tools or request injection.
5. Independent review of data ownership, revision conflicts, source freshness, package
   trust boundaries and source deletion; fix verified issues with regression coverage.
6. Full local pnpm lint/test/build and git diff --check. Disposable Edge fixture:
   promote confirmed lesson, offline edit/disable/replace/history/delete, simultaneous
   edits, source deletion, project isolation, export/import, desktop/mobile/keyboard.
7. Update code-spec and validation artifacts, present concrete grouped commit plan,
   then archive and journal only after user approval.

Expected files: src/domain/projectMemory.ts; src/db/projectMemories.ts and database.ts;
src/lib/agent or memory scoped validators/source helpers; src/lib/projectPackage.ts;
src/db/repo.ts deletion only; src/components/memory/*; project memory route plus generated
route tree; WorkspaceChrome; TaskWrapup; AgentControls and required project prop wiring;
tests/projectMemory*.test.ts and package/deletion regressions; Trellis specs/artifacts.
No generic UI refactor or request/run protocol changes. Rollback boundary is new memory
aggregate and entry points; existing task summaries and project facts remain unchanged.
