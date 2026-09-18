# Agent task workspace

## Scope / Trigger
Read when modifying the task board, task-mode Send, run/task identity, checklists,
artifacts or lifecycle. Product direction beyond this batch is recorded in
`docs/agent-workflow-direction.md`: Trellis-style goal/plan/execute/verify/summarize/
archive/experience retrieval. Summary and long-term-memory extraction remain deferred.

## Signatures (DB / API)
Dexie v10 adds `agentTasks: id, &threadId, lifecycle, updatedAt` and indexes
`agentRuns.taskId`. `AgentTask` contains an independent id, unique threadId, title,
goal, general agentId, plan, lifecycle, artifact references and timestamps.
`src/db/agentTasks.ts` exports createAgentTask, createAgentTaskForThread,
updateAgentTask, setAgentTaskLifecycle, pinAgentTaskResult and unpinAgentTaskResult.
`beginAgentRun({ ..., createTask?: boolean })` optionally creates a task in the same
transaction as the run and messages. Existing linked tasks are always reused.

## Contracts
- Ordinary Q&A creates no task. Each task has one thread and zero or more runs.
- `task.plan` is authoritative for future turns; run.plan is a historical snapshot.
  update_run_plan commits task.plan, run.plan and the tool result atomically.
- Task goal/plan are included in the new run's frozen instructions and the context
  preview through buildTaskInstructions. Retries retain the original request, even
  when a previously ordinary conversation was associated with a task afterward.
- Completion is explicit. A successful run projects to review, not completed.
  Task lifecycle wins over projected latest-run state. Without runs, an untouched
  plan is pending, a started plan is running, and all completed steps mean review.
- Active and recoverable tool runs block manual edits, completion and archive.
- Completed/archived tasks must be reopened before new sends or edits.
- Artifacts reference owned successful, nonempty assistant replies; no content copies.
- deleteChatThread cascades tasks, runs, calls and messages. Project ZIPs exclude
  these studio-global execution records.
- Routes remain under the persistent Agent layout; /agent/tasks is a static child.
  Task mode belongs on home, smart/conversation mode on conversation details.

## Validation & Error Matrix
| Input/state | Result |
| --- | --- |
| No connector for manual creation | Allowed, no request dispatched |
| Empty/oversized title or goal | Reject before creation; 120/20,000 characters |
| Duplicate plan IDs, >30 steps, >1 in_progress, empty/>240 character step | Reject |
| Running/waiting approval/recoverable failed or interrupted tools | Reject manual mutation |
| Complete with unfinished steps | Reject; caller keeps editable data |
| Foreign/failed/empty reply pin | Reject; no artifact created |
| Duplicate pin or repeated task association | Idempotent |
| Missing linked task during tool plan write | Fail atomically; no successful ledger |

## Good / Base / Bad Cases
Good: create manually → edit plan → complete steps → confirm → archive → reopen.
Base: task-mode Send → tool plan → reply → review → pin → explicit completion.
Bad: close/reload an executing page and infer completion or create another task.

## Tests Required
`tests/agentTasks.test.ts`: identity, persistence, ordinary Q&A, retries, task context,
atomic plan sharing, manual exclusion, lifecycle, result ownership and deletion.
`tests/productionProposals.test.ts`: additive v6→v10 migration preserves business data.
Browser: board create, Sheet/Dialog, steps, complete/reopen/archive, desktop/mobile.

## Wrong vs Correct
Wrong: mirror the last reply status onto task.lifecycle or duplicate task data in chat.
Correct: derive live execution status, persist explicit user lifecycle, reference shared IDs.
Wrong: overwrite prior run plans when users edit a task.
Correct: update only task.plan and freeze it into the next run.
