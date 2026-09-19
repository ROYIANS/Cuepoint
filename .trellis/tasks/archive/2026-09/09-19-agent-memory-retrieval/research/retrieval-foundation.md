# Retrieval foundation inspection — 2026-09-19

## Confirmed source decisions
The current conversation, parent PRD and docs/agent-workflow-direction.md already
contain the user's intent; no historical chat search is needed. Project binding is
mandatory for Task intake; ordinary projectless chats are valid. Knowledge remains
project-owned, user-reviewed and editable. New same-project conversations reuse it;
current facts and explicit user corrections outrank historical knowledge. No legacy
backfill, global memory, server or background worker is requested.

Memory-management is committed and archived (2fedc10 / 4a244f9). Active entries are
eligible; disabled, superseded and pending_review imports must be excluded. Source
absence is distinct from memory validity: promoted knowledge survives source deletion.

## Existing integration points
- src/lib/agent/taskContext.ts: getTaskContext is shared by new requests and context
  inspector; currently includes bounded project facts and up to 8 task records.
- src/db/agentRuns.ts:88-105: request assembly and retry snapshot handling. Retry uses
  previous context.baseMessages/requestMessages; memory metadata must match that
  actual envelope, rather than silently recording today's freshly selected entries.
- src/lib/agent/runChat.ts:144: project facts refresh before prepareRunContext and
  startModelStep, after pending tool results settle. Memory refresh must respect the
  same settled-boundary and Chat/Responses consistency contracts.
- src/lib/agent/contextCompaction.ts:34: rebuilds from frozen agent instructions;
  memory handling must survive compaction without restoring excluded obsolete text.
- src/components/agent/ContextUsagePanel.tsx:32-48: preview vs actual active-run envelope.
  Selection must share a pure planner and token estimator, not a UI-only approximation.
- src/lib/agent/contextUsage.ts: estimateTokens is character-based, not provider billing.
  Memory needs its own attributed estimate without double-counting the system envelope.
- src/lib/agent/projectContext.ts: formatProjectContext explicitly says memory is not
  retrieved yet; replace that outdated sentence when retrieval ships.
- src/domain/projectMemory.ts: category and free-text applicability exist. No explicit
  project-wide/always-include flag exists. Category alone cannot prove universal scope.
- src/lib/agent/taskContext.ts TASK_TOOL_NAMES: task_read and task_record_read target
  current-task recall. Any previous-task recall must enforce same-project ownership,
  bounded results and availability rather than adding unrestricted task-ID access.

## Proposed policy needing user input
A two-layer approach: explicitly project-wide knowledge receives automatic priority;
context-specific memories are selected against the current user request/task. Do not
infer project-wide relevance solely from convention/preference category. Alternative:
rank all categories by current intent only. The former reduces omission of general
rules at the cost of a small persistent budget; the latter is leaner but can miss
unstated conventions. Resolve this policy before final design and activation.

## Follow-up design checks
Freeze actual IDs/versions/content and selection reasons per request; define how user
exclusion and memory update/deactivation affect future model boundaries while keeping
previously dispatched history auditable. Retrying a request is not resubmitting old
business effects. Bounded source recall must remain a read capability, respect normal
interaction mode, and never convert retrieved text into permission or verified output.
