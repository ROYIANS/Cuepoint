# Unified chat and task workspace

## Scope
Depends on execution and tools/permissions. Add goals, ordered checklist, one general Agent assignee, status, artifacts and linked runs. Agent and task modes use one data source. Ordinary Q&A need not create a board task. Retrying adds a run to the same goal; board and chat show matching state. Stop/reopen and failed/approval states remain navigable.

## Acceptance
Verify persistence/reload, shared identity and every transition across chat/runtime. Existing conversations and project data must remain usable.

## Upstream boundary
Execution and tools/permissions APIs have been verified. The overall scope and sequential implementation are user-approved. Summary/reflection and memory follow the direction in `docs/agent-workflow-direction.md` and remain a subsequent layer.

## Refined acceptance (2026-09-19)
- Task mode creates one durable goal linked to its conversation; ordinary Q&A does not.
- Users can create/edit tasks and ordered checklists manually without a connector.
- Board and chat share task identity, checklist and status across retry and reload.
- Distinguish successful reply (awaiting review) from user-confirmed task completion.
- Expose complete assistant replies as explicitly pinned result references.
- Archive/reopen is explicit; active/unsettled runs cannot be silently hidden or completed.
- Use a polished minimal dark board and focused task inspector; desktop and mobile
  layouts must preserve keyboard access, visible feedback, empty/loading/error states.
