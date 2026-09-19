# Project-owned tasks and shared creative context — design

## Boundaries
Project is the durable creative scope. A chat thread belongs to at most one project;
a task and each run inherit that project. The same thread cannot change project after
its first bound request. Task creation remains AI-driven after clarification. This
child adds project binding and current context, not memory extraction/retrieval.

## Data flow
1. Project picker reads local `projects` and writes `ChatThread.projectId` before
   Task-mode send. An unselected Task-mode composer blocks send with an inline picker
   action. Agent/conversation mode may remain projectless until the user selects one.
2. `beginAgentRun` resolves the thread's project and writes immutable `projectId`
   into `AgentTask`/`AgentRun` snapshots. The same transaction captures a bounded
   `ProjectContextSnapshot` from business tables and current scoped memory-ready
   records (memory records are not implemented here).
3. `getProjectContext(projectId)` returns current project identity, creative brief,
   world/story summary, settings, default style, episode index, asset index and
   generation defaults. It returns coverage/truncation metadata and leaves long
   scripts/shots/details to explicit business tools.
4. Request assembly combines project context, task context and current user request.
   Existing task records remain bounded and separately inspectable. A completed tool
   write does not mutate prior request messages; the next model boundary obtains a
   fresh project snapshot. Continuation/retry uses the durable run snapshot and never
   replays effects.
5. Tool execution gets a frozen `projectId` in `AgentToolContext`. Bound write tools
   require destination ownerId equal to that project, except the explicit studio-copy
   operation whose source is `studio` and destination is the bound project. Reads may
   inspect studio only when the tool contract permits it. Model-provided ownerId is
   never sufficient to widen scope.

## Persistence and deletion
Add `projectId?: Id` to ChatThread only as the selected conversation binding; add
required projectId to tasks; runs inherit the thread binding (optional for intentional
projectless Agent chat). Bump
Dexie additively. Since this product has no released data, do not build migration or
fallback UI for unbound rows. Project deletion preserves bound conversation/task/run/review history as unavailable
for execution; no operation falls back to another project.

## Context freshness
Business tables are the source of truth. A manual edit, AI write or another tab is
picked up by the next request and context inspector live query. Same-run tool results
remain in the transcript and the next step receives only changed visible facts; no hidden cache
may outlive a project revision. Fingerprint project context from project updatedAt,
entity revisions/updatedAt, generation defaults and scoped records so changes are
visible and stale continuation cannot silently reuse old facts.

## UI
Composer footer shows a compact project pill beside mode/device controls. Searchable
popover lists projects, marks the selected one, includes keyboard navigation and an
empty state. Task mode with no selection shows the same popover/request affordance.
Task details and the composer show the project name. Context usage/details identifies
the bounded project snapshot and coverage; token estimates include it in the
instruction envelope without double counting. Keep the flat dark visual language; avoid a
permanent project card or nested panel.

## Security and failure
Missing/deleted project returns an explicit unavailable state and disables send/tools.
Foreign owner IDs are rejected before preview/approval and again before execution.
Cross-tab project changes use expected thread/project revision and preserve drafts.
No network is introduced for project context; all reads are local Dexie transactions.
