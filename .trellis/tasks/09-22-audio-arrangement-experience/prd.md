# Reviewed take selection and timeline arrangement

## Current delivery status — 2026-10-10
Implemented and accepted for the approved R4/R5 scope, with independent review, integrated quality/test/typecheck/build/model-bank gates and native selection, real-duration arrangement, grouped undo/redo, duplicate prevention, cross-tab conflict and narrow/keyboard evidence. Ready for the parent session's archive workflow; this PRD does not change `task.json`, commit or archive. See [final acceptance](validation/2026-10-10-final-acceptance.md) and [native evidence](acceptance/2026-10-10-native-acceptance.md).

## Goal and ownership
Deliver R4, R5 from [the initiative](../09-22-agent-creative-experience/prd.md).

## Scope
Provide independent batch selection and reviewed deterministic timeline placement using actual durations and trims. Repeated action avoids duplicates, preserves manual work and reports conflicts.

## Acceptance
Owns AC5, AC6, AC7, AC8, AC9; the parent criteria are reproduced verbatim with evidence and detection limits in [final acceptance](validation/2026-10-10-final-acceptance.md). Actual repository/protocol effects and ordinary native selection/placement/history/conflict evidence support acceptance. The shared real-model audio sample records actual reads/edits/batch preparation; it is not claimed as a live LLM arrangement invocation.

## Dependencies
Depends on R2 evidence contract; can use existing takes without R3, then integrate with R3 saved results.

## Approved implementation boundary
The user-approved design is delivered: selection and placement have separate exact previews/confirmations; arrangement uses actual decoded duration/trim metadata and appends only unplaced voices. Whole-chapter CAS rejects stale approval instead of overwriting edits. Every existing clip record is retained, explicit conflicts are disclosed, historical replay never resurrects deleted/undone additions, and one guarded insertion group supports current-session undo/redo. A separately reviewed durable inverse remains available after reload; transient undo history is not restored by reload. See [design](design.md) and [implementation record](validation/2026-10-10-implementation.md).

## Constraints and status
Parent UX, authorization, evidence and compatibility constraints apply. On 2026-10-10 the user authorized completing this existing backlog task and replied “批准，按这套设计实现” to the R3/R4 design. Implementation and the required acceptance are now complete for this scope. Native synthetic-audio placement and shared real-model/provider results are separately identified; duration/placement metadata does not certify acoustic quality. Historical design/research and earlier pending handoff boundaries retain their original date and are superseded for current status by final acceptance. No musical arrangement, broad DAW or semantic synchronization is added to this child scope.
