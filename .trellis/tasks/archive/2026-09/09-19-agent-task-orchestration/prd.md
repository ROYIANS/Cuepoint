# AI-managed task workspace and working records

Status: implemented and independently checked on 2026-09-19; see validation.md. User approved commit and archive on 2026-09-19.

## Goal
AI turns a creative request into an actionable, persistent task: define the goal, establish Todo, research actual sources, write a proposed approach, execute, record progress and verification, and preserve enough state to resume. The user should not have to manually maintain the process to make tasks useful.

## Confirmed requirements
- R1: Only Task mode permits AI task creation. Selecting Task mode and sending the first message persists a task-intake conversation, not a task row. AI first clarifies the outcome, scope, deliverable and material constraints; it creates the task when these are sufficiently clear. A sufficiently specific first message may be enough, but sending alone never triggers creation. Ordinary Agent mode never creates a task automatically. AI can then edit the owning task title/goal and acceptance expectations. Reuse the existing task when continuing the same work. No duplicate tasks from reload, repeated tool calls or resumption.
- R2: Maintain Todo with stable IDs, ordering, execution states and reasons for changes. Reuse the existing task/run plan synchronization. Completed Todo must reflect actual work; marking a checklist item cannot substitute for performing an action.
- R3: Add durable task records for research findings, proposed approach/implementation plan, progress, verification and pending questions. Records distinguish observations, proposals, confirmed decisions and completed actions; link to actual runs/tool results and available sources.
- R4: Scale ceremony to complexity. Small work needs a concise plan/result; complex work needs investigation and a reviewable approach. Record useful findings and rationale, not hidden chain-of-thought or verbose token-by-token logs.
- R5: AI can read and update its current task records while owning execution. Users can inspect and edit when safe. Preserve manual editing guards during live execution and expose concurrent/stale edits; no general administrative database access.
- R6: At execution start/resume, use the current task goal/plan and selected working records within the shared context budget. Keep durable history and current summary distinct; avoid reinserting the entire archive. Frozen retry/continuation envelopes remain valid.
- R7: Task bookkeeping uses the established code-owned bookkeeping policy, without redundant creation approval after requirements are already clear. Creating a task or saving an approach never authorizes additional business edits, paid generation or automatic task completion. Existing permission/confirmation policies remain authoritative.
- R8: Flat task workspace shows goal, Todo, research, approach and progress with readable source links. User corrections remain visible to subsequent work. Refresh and explicit continuation preserve task identity and completed actions.

## Acceptance
- AC1: An ambiguous first message in Task mode creates no task row; clarification survives reload. After sufficient clarification, an AI tool creates/links one task, saves Todo and a proposal, executes supported business tools, and records real progress with entity/result links (R1-R3).
- AC2: A correction to the goal or proposal is reflected in later authorized work without silently rewriting historical records (R3,R5,R6).
- AC3: Reload, interrupted execution and repeated task-tool delivery do not duplicate task/documents or replay completed effects (R1,R5,R8).
- AC4: Cross-task IDs, arbitrary source references, unsupported execution claims and stale updates fail explicitly. Unknown outcomes stay unresolved (R3,R5,R7).
- AC5: An equally clear ordinary Agent-mode request never automatically creates a task. A clear Task-mode request can be turned into a task by AI without redundant questioning. Basic tasks remain lightweight; planning/research records are readable and editable on desktop/mobile. Existing ordinary conversation and manual task flows remain available (R4,R8).
- AC6: Given a reopened unfinished task, AI can identify completed work, outstanding Todo and relevant findings without requiring the user to restate them (R6).

## Current evidence
src/db/agentRuns.ts creates tasks at begin only when createTask is true; AgentChatPage sets this in home Task mode. src/db/agentTasks.ts has manual lifecycle/ownership guards. update_run_plan in src/db/agentTools.ts commits task/run plan and tool result together. No task-document storage exists. See parent research/trellis-mapping.md.

## Confirmed decisions
- Task mode is necessary but not itself the creation trigger. Persist intake intent across conversation turns and reload.
- AI owns the create decision after clarification; do not use a UI keyword classifier or create a placeholder task immediately on Send.
- Ask only for materially missing requirements; do not impose a fixed interview length or duplicate confirmation.
- Requirements clarification can include deliverables, scope, constraints and acceptance expectations. The resulting task goal must reflect the clarified request, not just copy the first message.
- Existing manual task creation and existing linked tasks remain compatible. Ordinary Agent conversations do not auto-create tasks.

## Out of scope
Long-term memory promotion/retrieval (later children), autonomous completion, web-search connector implementation, arbitrary filesystem research, cloud background work or multi-agent teams. Research records use sources the existing tools can actually inspect or that the user provides; logging research does not create internet access.
