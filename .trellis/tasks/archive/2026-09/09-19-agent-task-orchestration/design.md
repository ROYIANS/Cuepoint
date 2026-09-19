# Task orchestration design notes

Status: implemented and independently checked on 2026-09-19; see validation.md. User approved commit and archive on 2026-09-19.

## Smallest behavior gap
Task-mode currently creates a shell, and update_run_plan maintains a checklist. There is no AI entry point to bind an in-progress creative request to a task or persist structured working records. This belongs in domain/repository/registered bookkeeping tools, not a component-only trigger.

## Design boundaries
- Current-thread task-create/ensure, task-read, task-update and task-record read/write tools with strict schemas and current-run ownership. Resolve task identity from trusted execution context whenever possible. No arbitrary task deletion or cross-task mutation surface.
- Preserve unique task/thread identity. A dedicated transaction may associate the owning live run, task and successful tool ledger; do not remove the existing manual create/edit busy guard. Dynamic task linking must not rewrite prior request messages or opaque Responses envelopes.
- Reuse update_run_plan; place acceptance expectations on task and keep historical run snapshots distinct. Add bounded, versioned task records with type/title/body/source references/revision. Stable source references must belong to the task or explicit allowed input.
- New-run context includes selected current records through the shared builder/budget. During active continuation, tools return new records and decisions as ordinary durable tool results. Never retroactively mutate frozen requests to inject a newly created task.
- New tables require additive migration, explicit ownership cleanup, no network in transactions and idempotent ledger commits. Verify parent task scope/project identity before future memory work; task currently has no authoritative projectId.

## UI direction
Extend the existing task inspector/workspace with a concise overview, Todo and record sections. Prefer flat navigation and readable document content over repeated bordered cards. Important decisions and unresolved questions are visible; detailed logs expand on demand. Existing generation review/permissions remain unchanged.

## Task-mode intake and AI creation
- Add optional persisted thread task-intake intent; legacy unlinked conversations default to ordinary Agent behavior, linked tasks retain their identity. Home Task-mode Send saves intent and starts an ordinary durable conversation run without passing the existing createTask flag.
- Freeze task-intake eligibility in each new run. Only eligible smart-mode runs receive task-create capability; conversation-only mode still receives no tools. A model tool cannot turn an ordinary Agent run into a task by supplying an approval/eligibility argument.
- Instructions guide the assistant to clarify uncertain goals and material constraints before requesting task creation. Creation is a structured tool with title, clarified goal, initial Todo and acceptance expectations, not a heuristic in the Send handler. No new creation confirmation modal is required.
- The create transaction verifies run/thread ownership, frozen eligibility, open lifecycle and no conflicting task. It links run/task/thread and persists the successful tool result atomically. Repetition returns the same task rather than changing its goal or creating another. Concurrent tabs remain under the thread execution lock.
- Task context for the current run arrives in the returned tool result. The next run builds its snapshot from the persisted task and selected records. Original request messages, prior run snapshots and encrypted provider continuation remain immutable.
- Existing precreated tasks are retained; do not delete them as a migration. Manual creation stays available. Keep beginAgentRun createTask compatibility for internal/manual callers if required; change the Task-mode UI path deliberately and test it.

## Working record contract
Use a dedicated task-record table with taskId, kind (research/approach/progress/verification/question), stable ID, revision, content, source references and creation/update metadata. Record edits require expected revision and preserve prior versions; current records and chronological events are distinct. Mark whether content is an observation, proposal, confirmed decision or completed result. Reference IDs are validated against owned task evidence or explicitly supplied source data; arbitrary strings never become verified tool evidence. Keep array/text payloads bounded through strict schemas. Technical limits follow existing tool payload budgets and must be tested at boundaries.

Goal/acceptance edits through AI are current-task scoped and ledger-atomic. Reuse Todo validation and task/run synchronization. A change to user constraints must be anchored to the conversation; autonomous scope expansion is not authorized by bookkeeping access. Linked records can refer to a Todo ID; allow unresolved records without inventing completion.

## Context and recovery
At a fresh task run, include current goal/acceptance/Todo and a bounded index or selection of working records. Provide read tools for details and history; do not paste every research log into system instructions. Treat task records as user/work data with source provenance. Context inspector estimates the same assembled input. Stop or reload preserves records and intake intent; continuing tools follows existing atomic no-replay rules. Editing between runs affects subsequent snapshots, never past ones.

## Compatibility and failure matrix
| Situation | Required behavior |
| --- | --- |
| First ambiguous Task-mode message | Persist intake intent, no task row |
| Clear Task-mode goal | AI may create after understanding; no mandatory redundant interview |
| Ordinary Agent-mode or conversation-only run | No automatic task-create capability |
| Repeat task-create / reload after commit | Same task and saved result, no duplicates |
| Foreign task/record/source ID | Reject before write |
| Concurrent/stale manual or AI record edit | Explicit conflict; preserve latest record |
| Linked completed/archived task | Existing reopen guards apply |
| Unknown business effect | Record uncertainty; do not mark verified completion |
| No web-search tool | Research only actual available local/user sources; no fabricated online research |
| Deleted conversation | Cascade owned records; late writes cannot resurrect them |

## Migration and affected files
Add optional thread/run intake fields and task acceptance fields; add versioned record storage through an additive migration after the actual current database version. Integrate cleanup in deleteChatThread. Expected changes: domain/types and agent types, db/agentTasks and a task-record repository, db/database and repo cleanup, task tools/skills/registry, beginAgentRun/context builders, home/detail task UI and TaskInspector, focused tests/specs. Avoid changing existing media submission, permission semantics or model budget accounting.

## Risks and limits
AI readiness judgment cannot be guaranteed by schema alone. Evaluate ambiguous/clear/corrected prompts using fixtures and validate the resulting structured goal, while preserving user edits. Actual internet research, attachments and cross-task memory remain later capabilities. Task documents store concise evidence and rationale, never hidden chain-of-thought. Pure frontend does not run after the page closes.
