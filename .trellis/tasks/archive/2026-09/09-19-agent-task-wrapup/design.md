# Task wrap-up design proposal

## Boundaries
Extend task domain/repositories, existing TaskInspector and model transport. Do not add a second execution engine or reuse working-context compaction as task memory. New tables are studio-global and excluded from project export by default, consistent with task ownership.

## Data contracts
- Reuse acceptanceCriteria:string[] from child1; snapshot criterion index plus exact text with task revision (there are no stable criterion IDs). Old tasks normalize to no expectations. Separate acceptance findings from plan-item execution status. Recheck schema after child1.
- Add durable wrap-up records with task/thread ownership, source snapshot/revision, structured draft content, evidence references, author kind (AI/manual), generation status, confirmation timestamps and versions. Human edits and model proposals remain distinguishable.
- Evidence catalog uses owned run/message/tool/job IDs and current entity availability; models may cite catalog keys only. Labels and navigation targets resolve in application code, not arbitrary model URLs. Preserve historical labels if a business target later disappears and display that it is unavailable.
- Bounded source assembly retains goals, corrections, unresolved outcomes and plan state. Large histories use explicit coverage and bounded excerpts; omitted history is disclosed. Inputs exceeding the selected model budget fail before HTTP with a larger-model/manual path; staged automatic summarization is deferred to keep preparation a single explicit request. No claims of exhaustive verification from truncated input.

## Flow
1. User opens existing task review and prepares a wrap-up or starts a manual draft.
2. Repository checks task ownership and execution readiness, snapshots sources and writes durable preparing state under a task/thread lock. No network waits inside a Dexie transaction.
3. Read-only model request uses existing connector validation, transport, bounded context and key-redaction patterns. No tools enabled. Strictly validate structured response and source references before publishing a draft.
4. User edits findings and text. Confirmation rechecks source/expectation revision, binds to the displayed version and atomically saves the confirmed record. Complete action additionally uses existing plan/busy guards and acceptance checks.
5. Archive retains confirmed wrap-up. Reopening and new work marks prior coverage historical; generating a later version preserves history. Thread deletion cascades task-owned wrap-ups and invalidates late writes.

## UI
Add a review/summary section to TaskInspector and a contextual entry near task completion. Show results first, then acceptance findings and unresolved items. Expand provenance on demand. Use one editing surface without nested bordered cards. Loading, stale, interrupted, partial and confirmed states use plain Chinese explanations. Do not inject process ceremony into ordinary chat.

## Compatibility and recovery
Additive migration after the task-orchestration schema; check actual schema version before implementation. Existing manual task workflow still works through review; no destructive backfill or fabricated prior evidence. Persist drafts, reject double/foreign confirmation, keep previous confirmed content during failures, and prevent deleted ownership from returning. Browser close cannot complete remote processing locally; retry remains explicit.

## Change boundary
Expected files: domain/agent or dedicated wrap-up types; db/database, db/agentTasks and dedicated wrap-up repository; repo thread cleanup; lib/agent source-assembly/summary adapter; TaskInspector and task workspace styles; targeted tests and frontend specs. Include shared transport changes only if existing structured response handling cannot be reused. No provider/model catalog expansion, runtime budget redesign or memory injection in this child.

## Implementation decisions after child1 (2026-09-19)
User accepted proceeding to the next reviewed roadmap child. Child1 is committed and archived.
The smallest gap is that completion currently checks only Todo, without a retained acceptance review.
Add an explicit read-only preparation path and durable review draft/versions; replace the inspector
completion shortcut with review. Existing lifecycle completion must also enforce the same repository
review guards so callers cannot bypass them. Archive may still preserve partial work.
Manual preparation works offline; AI preparation uses the current thread connector/model through
existing transport, no tools and no business execution. Structured content and evidence IDs are
validated before publishing. Keep request source coverage bounded and visibly disclose omissions.
All acceptance judgments remain proposals until the user confirms. Current drafts may be refreshed
against current sources; prior confirmed reviews stay immutable and historical. Reopen/change makes
old review coverage stale. Persist generation status, handle interrupted preparation without automatic
network retry, preserve unsaved/manual work on conflicts. Parent owns UI/specs/browser verification;
implementation agent owns domain/repositories/model helper and tests. No memory promotion in this child.
