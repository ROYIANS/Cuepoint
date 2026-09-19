# Memory foundation research — 2026-09-19

## Available source contracts
- `src/domain/agentTaskWrapup.ts`: structured decisions/lessons contain sourceIds;
  wrap-up captures task/thread/revision/confirmedAt and bounded evidence excerpts.
- `src/db/agentTaskWrapups.ts:getTaskWrapupState`: current confirmation, source
  availability, stale fingerprint and historical versions are already available.
- `src/components/agent/TaskWrapup.tsx:ReviewDocument`: the natural source-side entry
  for selecting a decision/lesson to retain. No additional model call is needed to
  propose existing structured entries; do not represent deterministic selection as
  a fresh AI extraction or infer verification from a completed run.
- `src/db/repo.ts:deleteChatThread`: deletes task/summary history. Independent promoted
  memory therefore needs its own bounded provenance snapshot and live source resolver.

## Ownership and storage
- Project binding is delivered and archived. `AgentTask.projectId` required; current
  facts come from business tables, never duplicated into an editable memory copy.
- Dexie current version 15; new memory tables can be additive with no data migration.
- `src/db/repo.ts:deleteProject` removes project assets and generation jobs but keeps
  task/chat history. Proposed memory policy: explicit project deletion removes memory
  and its revisions, while existing task history follows the established contract.
- `src/lib/projectPackage.ts:exportProjectZip/importProjectZip` export/import business
  tables and remap IDs; task/chat/summary data are absent. Memory backup must carry
  source excerpts but never claim old live task links resolve in the imported project.

## UI integration
- `WorkspaceChrome` owns project navigation/actions for film and series. A project
  memory route can reuse the workspace shell, loading/not-found behavior and primitives.
- `AgentControls` owns the flat searchable plus menu. A bound project memory entry can
  link to the same management view without adding permanent composer controls.
- `TaskWrapup` can expose source-to-memory promotion next to confirmed decisions/lessons.
  Completed/archived source tasks must remain usable as sources without reopening them.
- Existing CAS patterns keep conflicting editor drafts intact. Reuse this pattern for
  memory edits, activation and replacement rather than last-write-wins.

## Scope decisions proposed for final review
Project-only categories: convention, preference, decision, lesson. Explicit user review
before activation; manual entry works offline. Exact duplicate detection and same-topic
conflict hints are deterministic; no claim of complete semantic contradiction detection.
Source deletion retains independent memory with missing-source label and excerpt;
user can reaffirm applicability. Project deletion removes owned memory; hard memory
delete removes its revisions too. Project ZIP includes memory but imports entries as
pending review, with detached provenance. Automatic retrieval remains the next child.
