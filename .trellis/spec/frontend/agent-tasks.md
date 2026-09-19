# Agent task workspace and working records

## 1. Scope / Trigger
Read when modifying Task-mode intake, AI task tools, task/record context, the task
inspector, checklist, evidence, lifecycle or deletion. The broader Trellis-inspired
product direction is in `docs/agent-workflow-direction.md`; automatic wrap-up and
cross-task long-term memory remain separate future deliveries.

## 2. Signatures (DB / API)
- Dexie v10: `agentTasks: id, &threadId, lifecycle, updatedAt`; `agentRuns.taskId`.
  v13 additively introduces `agentTaskRecords` and `agentTaskRecordVersions`.
- `ChatThread.taskMode?: boolean` persists intake intent; `AgentRun.taskMode?`
  freezes eligibility. Legacy unlinked threads are ordinary Agent conversations.
- `AgentTask`: unique threadId, title, goal, acceptanceCriteria?, revision? (legacy
  1), plan, lifecycle, artifacts, timestamps. Each task has one thread, many runs.
- `createChatThread({..., taskMode?})` creates no task. UI never passes createTask
  to beginAgentRun. Its compatibility flag remains available for explicit callers.
- `createAgentTask`, `createAgentTaskForThread`, `updateAgentTask(id, patch,
  expectedRevision?)`, lifecycle/pin APIs remain guarded manual operations.
- `AgentTaskRecord`: id/taskId, kind research|approach|progress|verification|question,
  claim observation|proposal|decision|result, title/body, sources, todoId?, revision,
  author user|ai, runId?, timestamps. Version rows add recordId and versionId.
- `listTaskRecords(taskId)`, `listTaskRecordVersions(taskId, recordId)`,
  `saveTaskRecord(taskId, input, {id?, expectedRevision?})` are manual APIs.
- AI tools: task_read, task_create, task_update, task_record_read,
  task_record_write; current-task identity comes from the durable owning run.
  Reuse update_run_plan for Todo. Tool schemas are strict, no foreign taskId input.
- `getTaskContext(threadId, instructions, taskMode, interactionMode)` returns
  shared instructions/task/records/taskToolNames for beginAgentRun and context UI.

## 3. Contracts
### Intake and ownership
- Task-mode Send persists intake only. AI clarifies material missing requirements,
  then calls task_create with the understood goal, deliverable, constraints,
  acceptance criteria and initial Todo. A clear first request needs no ritual
  interview. Ordinary Agent mode cannot auto-create tasks; conversation-only mode
  exposes no tools. Linked manual/legacy tasks continue normally.
- Task tools and update_run_plan are core Task-mode abilities, independent of
  optional skill switches. Eligibility and enabled tool names are frozen per run.
- Creation verifies latest running owner, enabled tool, frozen eligibility, open
  lifecycle and genuine user-message sources. Task, run binding, initial requirement
  record and successful tool ledger commit atomically. Repeated creation returns
  the existing task, never overwrites it. Manual busy guards remain in place.
- Business writes, paid generation, permission policy and task completion are not
  authorized by task bookkeeping. Completion/archive remain explicit user actions.

### Records, evidence and editing
- New AI task criteria cannot claim Todo already complete. update_run_plan commits
  task.plan, run.plan, reasoned history and successful ledger together. Checklist
  state alone does not prove business completion.
- Record source IDs must resolve to current-thread user messages or completed,
  non-bookkeeping tools owned by this task. Decisions require user evidence;
  observations require sources; completed results require successful actual effects.
  Failed, cancelled, unknown/conflicting or still-pending generation outcomes cannot
  become completed-result evidence just because the status-reading call finished.
- Provenance establishes origin/status, not truth of every sentence in AI prose.
  User/manual records are labeled distinctly. Arbitrary URLs or invented source IDs
  cannot become validated evidence. Tool result links reuse code-produced targets.
- Every edit appends a revision. Existing-record writes require expectedRevision;
  manual task editors capture revision at opening. Stale writes fail without dropping
  the draft. Goal/acceptance and Todo changes append readable before/after records.
- Records have bounded title (120), body (12,000), sources (12) and optional valid
  Todo link. Internal full requirement/Todo snapshots have a larger dedicated bound;
  they must not make otherwise valid task updates fail. Large snapshots are read-only
  in the record editor; task fields are edited from Overview.
- A record edit changes that document, not task goal/Todo automatically. Old versions
  remain visible. Referenced Todo may later be removed; readers explain that state.
- Active or recoverable tool executions block all manual mutation, completion and
  archive. Completed/archived tasks require reopening before changes or new sends.

### Context, recovery and presentation
- New runs use current task goal/criteria/Todo and a bounded current-record selection:
  latest eight records, at most 1,200 body characters each. Full records/history and
  source bodies are read through bounded tools. The same helper drives context UI.
- Newly created tasks/records reach an active run through ordinary saved tool results.
  Never rewrite its frozen system/request history or opaque Responses envelopes.
  Retry/resume uses saved continuation; completed task and business tools never replay.
- Keep record history distinct from context compaction and long-term memory. Reopening
  a task and sending again uses current records; previous snapshots remain unchanged.
- Flat inspector has Overview (goal, acceptance, Todo, results, executions) and Working
  records (search, kind filters, expandable content/sources, versions, manual editing).
  Homepage/task intake remains a conversation until AI creation; no empty task card.
- deleteChatThread cascades task records and revisions with runs/calls/messages.
  Late writes after deletion fail. Project ZIPs exclude these studio-global records.

## 4. Validation & Error Matrix
| Input/state | Result |
| --- | --- |
| Ambiguous first Task-mode Send / reload | Persist intent and conversation; zero task rows |
| Ordinary Agent / conversation-only create attempt | Reject before mutation |
| Repeated task_create / committed call recovery | Same task and saved result |
| Foreign source/record/task ownership | Reject; no durable write |
| Stale record/task revision | Conflict, latest data and editor draft retained |
| Unknown/failed business or unfinished generation source marked result | Reject unsupported completion claim |
| Source/record exceeds preview length | Truncate preview; page full body through read tool |
| Running/waiting/recoverable tools | Reject manual mutation |
| Empty/oversized title, goal or acceptance | Reject; title120/goal20k/20 criteria of500 |
| Duplicate IDs, >30 steps, >1 in_progress, empty/>240 step title | Reject |
| Complete with unfinished steps | Reject; checklist must be resolved first |
| Ledger/version storage failure | Roll back task/record/binding and ledger atomically |
| Deleted conversation / late result | No resurrection |

## 5. Good / Base / Bad Cases
Good: Task intake → clarify → task_create → proposal → real business tool → sourced
verification → user reviews; refresh/reopen preserves task and actual work.
Base: ordinary Q&A has no task; explicit manual create/edit/complete still works.
Bad: first Send creates placeholder; tool bookkeeping substitutes for actual work;
network status-read returning failure is reported as a successful generation.

## 6. Tests Required
- `agentTasks.test.ts`: identity/manual exclusion/lifecycle/artifact ownership/deletion.
- `agentTaskOrchestration.test.ts`: intake persistence, disabled eligibility, atomic
  creation/rollback/dedup, frozen Responses and retries, revisions/manual corrections,
  bounded context, foreign IDs, full actual tool loop and disabled optional skills.
- Independent review tests: source outcome validation, full legal snapshot sizes,
  bounded source reads and model-facing metadata.
- `productionProposals.test.ts`: additive v13 migration preserving existing entities.
- Browser local fixtures: Task-mode first send → clarification → reload → actual tool
  loop → business entity → sourced result/Todo; manual correction in next request;
  record editor/history/conflict on desktop and narrow mobile. No paid API required.

## 7. Wrong vs Correct
Wrong: set lifecycle=completed when a run ends, or claim a Todo checkbox proves work.
Correct: persist actual effects/evidence and keep completion under user control.
Wrong: overwrite earlier run requests with live task documents after task creation.
Correct: atomic tool result now, bounded new snapshot on next send.
Wrong: save one mutable log or paste its entire version archive into every request.
Correct: preserve append-only revisions, inject current bounded excerpts, read on demand.
