# Evidence and Trellis-to-product mapping

Inspected local code and Trellis files on 2026-09-19; this is a conceptual adaptation, not a claim that the Trellis CLI implements this application's memory semantics.

| Trellis mechanism | Product adaptation | Evidence |
| --- | --- | --- |
| Task PRD/design/implementation plan | Goal, acceptance expectations and ordered creative work | .trellis/workflow.md; src/domain/agent.ts AgentTask; src/db/agentTasks.ts |
| Quality gate before completion | Verify effects and artifacts against goals before reviewed wrap-up | .trellis/spec/frontend/agent-tasks.md; src/lib/agent/taskState.ts |
| Workspace journals | Task summary recording outcomes, decisions, failures, open work and sources | .trellis/workspace/ROYIANS/journal-1.md; .trellis/scripts/add_session.py |
| Durable specs | Deliberately promoted project conventions and reusable creative preferences | .trellis/spec/frontend/index.md; trellis-meta local spec-system reference |
| Raw session recall with trellis mem | Search retained source tasks/messages when curated memory is insufficient | trellis-session-insight/SKILL.md; raw records are not automatically curated knowledge |
| Scoped context manifests | Select only relevant rules, summaries and evidence within a token budget | Task implement.jsonl/check.jsonl; src/lib/agent/contextCompaction.ts |
| Debug retrospective | Record the cause and prevention of repeat failures with evidence | trellis-break-loop skill and archived review artifacts |

## Code-backed gaps
- AgentTask currently has title/goal/plan/lifecycle and pinned assistant references, without acceptance checks, wrap-up versions or memory records (src/domain/agent.ts).
- src/db/agentTasks.ts blocks changes while execution is busy, requires finished plan items for completion, and only pins owned successful replies. Reuse these checks.
- src/components/agent/TaskInspector.tsx owns task review, completion and archive UI. Extend this surface rather than duplicating a task center.
- Tool ledger and generation jobs provide actual actions/results. A downloaded image is distinct from applied; tool success alone cannot prove a subjective creative goal is met.
- src/lib/agent/contextCompaction.ts explicitly summarizes working history. It must not silently promote its output to durable memory.
- src/lib/agent/taskState.ts buildTaskInstructions currently inserts the task goal/plan. Retrieval will later integrate with the shared request/context budget path, not a UI-only prompt append.
- src/db/database.ts is at version12. New persisted records require additive migration; src/db/repo.ts deleteChatThread must handle their ownership cleanup.

## Layers and authority
Original records are evidence; summaries are derived handoffs; memories are curated reusable knowledge; project conventions are scoped decisions. Explicit new instructions override older preferences. Live entity data answers current-state questions; historical evidence describes past events. Retrieved content cannot change permissions or act as system instructions.

## User clarification: task creation and working artifacts
The user explicitly requires AI-created tasks, Todo, research logs and implementation proposals. Existing beginAgentRun only creates a task when the caller sets createTask; AgentChatPage currently sets this on home Task-mode Send. createAgentTaskForThread blocks association while a run is active, so simply exposing it as a mid-run tool would fail. The new task-owned bookkeeping path must atomically link the currently owning run/thread and ledger without relaxing the manual-edit guard. update_run_plan already atomically updates the live task/run; extend this proven pattern. No AI task-create or durable task-document tools currently exist.

## Confirmed task-intake policy
User clarification: only Task mode can auto-create; AI must decide after chatting to clarify needs. The current immediate createTask flag on Send is explicitly rejected. Persist task-intake intent before a task exists, then expose owned task-create bookkeeping to eligible AI runs. Ordinary Agent mode remains task-free unless the user uses the existing explicit manual association path.
