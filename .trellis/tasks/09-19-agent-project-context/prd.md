# Project-owned tasks and shared creative context

Status: implementation and validation complete; committed as 6b6289b; archival approved. User confirmed project-bound operations on 2026-09-19 and explicitly
decided that compatibility with pre-project data is out of scope because the product
is still in development.

## Goal
Make the selected creative project the persistent context boundary for tasks and
conversations, so the assistant starts with current project facts and later project
memory can be reused across new conversations without repeated discovery calls.

## Confirmed requirements
- R1: Task mode requires selecting a real project before the first send. Add a
  searchable picker at the lower-left composer area. Selection alone does not create
  a task: the AI clarifies requirements then calls task_create as before.
- R2: Persist the selected project on the conversation and task and freeze it on
  each run. An existing bound conversation cannot silently switch projects; working
  on a different project opens a separately bound conversation.
- R3: Bound AI work modifies only that project. Studio asset reuse/import is allowed
  explicitly, producing independent project-owned assets. Do not allow bound tools
  to write to other projects or modify shared studio originals. Enforce this at the
  tool execution/data boundary, not only through a prompt or hidden menu.
- R4: Assemble bounded current project facts before the first request: identity,
  brief/genre/audience/tone, mode/aspect, story/world summary, default style and an
  episode/asset index. Load large scripts, shots and detailed assets on demand.
- R5: Facts derive from current business tables, not a duplicated editable memory
  document. User and AI writes update subsequent context. Same-run writes propagate
  at safe model-request boundaries without rewriting previously dispatched requests,
  Responses items or committed tool effects. Recovery never resubmits business work.
- R6: A new conversation in the same project reuses current project context. Project
  rules/experience will come from the following memory-management/retrieval children;
  this foundation must not claim unimplemented long-term-memory retrieval.
- R7: Project identity remains visible in task/chat surfaces and context inspection;
  task lists can be distinguished by project. Missing projects have an explicit
  unavailable state rather than silently falling back to global tools.
- R8: Preserve the completed task-wrap-up work, provenance and version history.
  Project binding changes context and invalidates previous current-review eligibility.
- R9: This is a clean project-first foundation; do not add migration, fallback or
  compatibility UI for unbound conversations/tasks.

## Repository evidence
- src/domain/types.ts:523 ChatThread has no project binding; Project owns basic facts.
- src/domain/agent.ts:84 AgentRun has immutable execution inputs but no projectId.
- src/lib/agent/taskContext.ts:8 shared task assembly currently covers goals/records.
- src/lib/agent/businessStore.ts:16 requireOwner/getRow validate the supplied owner,
  not the identity bound to a conversation.
- src/lib/agent/businessTools.ts:248 asset_copy_from_studio already copies independent
  project snapshots; its current scope includes both source studio and target owner.
  Scope enforcement must distinguish reads/source from destination writes.
- src/db/agentRuns.ts:52 transaction tables must expand when reading project context.
- src/lib/agent/tools.ts workspace_overview currently lists recent global projects;
  project-bound data surfaces need review, including generation/proposal paths.
- src/db/repo.ts:263 deleteProject currently deletes project entities/jobs without
  knowing about future project-bound conversations/tasks.

## Acceptance criteria
- AC1: Task-mode first send without project is guided to selection; a selected project
  is available in request1 without a business_detail discovery call (R1,R4).
- AC2: AI-created task inherits the conversation project; changing UI/model arguments
  cannot grant a bound run write access to another project or studio originals (R2,R3).
- AC3: Explicit studio import targets the bound project, including independent media;
  ordinary asset edits and generation apply remain project-owned (R3).
- AC4: Project metadata changed by a tool, manual UI or another tab reaches the next
  prepared model request/context inspector; no prior request or effect is replayed (R5).
- AC5: New same-project chat inherits current facts; unrelated project facts/rules
  are not automatically injected. Long content is budgeted and coverage visible (R4,R6).
- AC6: A deleted project is unavailable: its bound conversations and tasks remain
  inspectable as history but cannot execute or silently fall back to another project.
  No migration or reassignment flow is needed while the product is in development.
- AC7: Desktop/mobile picker, keyboard search/selection, task filtering and visible
  scope work with offline data. Existing retry/approval/wrap-up regression passes.

## Out of scope
Cross-project execution in one bound conversation, automatic project guessing,
copying all historical transcripts into every prompt, memory extraction/retrieval
implementation, background services/cloud sync and changes to paid-generation consent.
