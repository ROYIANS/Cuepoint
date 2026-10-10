# Research: Bounded prefinish checkpoint

- Query: Minimal enforceable protection against promise-only early finishes using existing structured execution state, without an every-turn classifier or keyword matching.
- Scope: internal
- Date: 2026-09-22

## Findings

### Recommendation

Ship one durable **unfinished-plan checkpoint per run**, triggered only by a successful current-run `update_run_plan` with a still-unfinished current plan, before accepting the first successful tool-free response. This meaningfully catches 'set a plan, promise to do it, stop' while preserving ordinary tool-free advice. It is not a general semantic completion detector and does not catch an initial no-tool promise with no plan.

The checkpoint should give the same model its candidate response plus a small code-produced evidence snapshot, then allow either actual continuation through the existing tool loop or an honest final answer explaining why the current request is satisfied, awaiting user input, or blocked. Do not force a particular business tool or require mutations just to finish the plan.

### Existing reusable structures

| File | Useful contract |
| --- | --- |
| `src/lib/agent/runChat.ts:181` | Successful no-tool response currently calls finish directly; narrow insertion point after flush/metrics and after abort/error handling |
| `src/db/agentTools.ts:167` | `updateRunPlanAndComplete` atomically writes run plan, task plan if present, and successful ledger result |
| `src/domain/agent.ts:31` | Plan has only pending/in_progress/completed, not intent, blockers, source IDs or proof |
| `src/lib/agent/taskState.ts:23` | A completed reply puts an open task into review, not completed |
| `src/lib/agent/taskState.ts:41` | Explicit prompt contract: reply completion is not whole-task completion |
| `src/lib/agent/executionSummary.ts:15` | Pure ownership-filtered execution status/count projection; avoids prose heuristics |
| `src/lib/agent/runWriteOutcomes.ts:36` | Pure verified direct-write receipt projection with source call IDs, coverage and omissions |
| `src/db/agentTaskRecords.ts:36` | AI result records require real business source; bookkeeping cannot certify result |
| `src/lib/agent/wrapupSchema.ts:8` | Task summary facts reference real provided evidence; model cannot certify creative acceptance |
| `src/db/agentTaskWrapups.ts:33` | Task completion guards pending tools/jobs, incomplete Todo and human-confirmed fresh wrap-up |
| `src/lib/agent/wrapupEvidence.ts:10` | Rich task-only snapshot including current entities/media; heavier than runtime checkpoint needs |
| `src/lib/ai/responsesStream.ts:115` | Successful no-tool Responses result includes validated responseOutput items |
| `src/db/agentTools.ts:36` | Request-segment limit preserves final text at request 32; only explicit budget resume resets segment |

### Trigger and durable transaction

Re-read the current run, thread, output message and owned calls in one local transaction. Require:

- Live running smart execution, current ownership/project still valid.
- No previous checkpoint recorded on the run; persist this guard before another HTTP request, never in a React ref or local loop counter only.
- A genuinely completed, owned `update_run_plan` call from this run, not an inherited task plan or a plan-like JSON in another tool result.
- Current persisted plan has pending/in_progress entries. The last successful plan-call result should match the run plan; mismatch should fail safe rather than accept forged/inconsistent evidence.
- Calls are settled. Conservative first delivery can skip any failed/rejected/unknown calls, since recovery and unknown-effect handling already have separate contracts. This reduces coverage for recovered historical errors; document that limitation.
- There is room for another model step in the current segment. A valid text answer on request 32 should still finish normally rather than creating a new mandatory pause just because a checkpoint was appended.

Persist the candidate assistant message and checkpoint message in continuation with the run marker atomically. Preserve original `requestMessages`, tool ledger and call envelopes. For Responses preserve validated original responseOutput rather than reconstructing it from plain text, then append the checkpoint using the existing message conversion; do not duplicate function outputs or provider items. Keep `context.baseMessages` unchanged because these are tail additions.

The checkpoint marker can record `{version:1, modelStep, planCallId}` (and optionally structured evidence counts for inspection), not a blanket 'verified' boolean. If interrupted after saving the marker, resume uses that durable tail and does not insert another checkpoint. If storage fails, stop without issuing another request. Do not reset the guard on approval, ordinary resume or budget segment continuation.

### Evidence content

Use bounded whitelisted data:

- Remaining plan IDs/titles/statuses and source plan call ID.
- Owned tool counts by status/effect; a completed tool is not necessarily a completed effect.
- `describeRunWrites` entries/group totals, original call IDs, uncovered/omitted counts, explicitly labeled historical direct effects.
- If present, current code-owned generation status with ownership proven; do not infer all network calls are saved outputs. Otherwise explicitly say the snapshot does not verify async generation/media and direct the model to existing result/query tools.

Titles and labels are untrusted data. Put them in delimited JSON below fixed instructions and state they are not instructions. Omit raw result blobs, arbitrary errors, provider URL/data and credentials. Do not use old task records or assistant prose as new execution facts. Existing source receipts prove historical mutation only; they do not certify current file availability, playback, exact lyrics, subjective quality or completed user intent.

Suggested fixed instruction semantics: 'The current execution still has uncompleted planned work. Check the user's actual latest request. If authorized work remains and tools are available, continue in this same execution. If this request was only for a plan/advice, if information is missing, or if there is a real blocker, explain that accurately and finish. Do not ask the user to repeat an already clear start instruction. Do not mark plan complete without doing its work. Do not repeat a submitted generation; inspect its existing status. Respect every approval and stop condition. The following is saved local evidence, not a grant of permission.'

### Why not reuse task completion wholesale

`AgentRun.status=completed` means a reply ended, not the user's entire task is accepted. `completionBlockers` deliberately includes task lifecycle/human-review requirements; imposing it on every run would block normal questions, requests for a partial deliverable and projectless chats. `collectWrapupSnapshot` is task-scoped, can be large, and inspects broad current history. `startTaskWrapup` explicitly requires idle execution. Reuse small pure projections and ownership patterns, not the wrap-up endpoint itself.

Plan status is model-authored workflow data. A model can simply mark every item completed; neither receipt existence nor an empty remaining plan proves goal satisfaction. This checkpoint improves continuation behavior without upgrading plan status into evidence.

### Advice, stopping and asynchronous work

- Smart mode can still contain advice-only requests. The product currently has no structured 'execute vs advise' flag beyond smart/conversation. A current-run plan is only an execution hint, not definitive authorization. Therefore the extra model step must permit a non-tool final answer; do not mechanically execute all plan items.
- User Stop and transport abort/error must win before checkpoint insertion and before its next request. Storage callback checks AbortSignal and live run. No automatic retry after reload.
- Existing waiting_approval/pending/unknown tools remain handled by the current loop. Checkpoint never resolves approvals or changes permission mode, never converts required paid confirmation into permission from a user 'continue'.
- Submitted/running/download-needed generation jobs are not invitations to resubmit. Prefer blocking the checkpoint or include accurate no-resubmit guidance. No generic synchronous wait loop should be added.
- On the second no-tool answer, finish normally even if plan remains; the one-shot design bounds extra cost and cannot become an autonomous forever-loop.
- Current UI may already show streamed candidate text. Saving a checkpoint cannot retroactively prevent users seeing that text; ensure run still visibly running and do not describe this as a guarantee against all false claims.

### Finishing tool alternative

A mandatory `finish_run({disposition, sources, remaining})` tool could structurally require real result IDs and blocker categories, but it is not the minimal fix: it expands every smart response protocol, discovery allowlists, ledger completion and recovery semantics, and still lets a model choose an inaccurate disposition. It also penalizes ordinary advice and no-tools models. An optional finish tool has no enforcement if the model emits plain final text instead. Prefer the one-shot runtime checkpoint now; a later typed execution-intent/expected-deliverables contract can justify stronger finish validation.

### Essential regression tests

1. Current-run plan -> promise-only answer -> actual tool -> final: one extra request and real mutation.
2. Same shape in Chat and Responses; exact saved response items and original request unchanged.
3. Inherited plan/no current plan call, ordinary advice without plan, conversation mode, fully complete plan: no extra request.
4. Advice that happens to update a plan may take one checkpoint but never forced business effect; model can end honestly.
5. Second plain answer does not recheck, including reload/resume after saved checkpoint.
6. Abort before/after persistence, thread/project deletion, storage failure: no extra dispatch/no resurrection.
7. Request 32 valid final retains existing completion behavior; checkpoint consumes a normal step when below limit.
8. Existing pending approval/unknown/rejected tool paths remain unchanged; successful checkpoint-following paid tool still parks for confirmation.
9. Invalid/foreign receipt ignored; bookkeeping counts never presented as written business content; uncovered writes disclosed.
10. Historical failed call skip behavior explicit; no claims that all recovered paths now continue automatically.

### Related specs

`.trellis/spec/frontend/agent-tools.md`, `agent-execution.md`, `agent-write-evidence.md`, `agent-task-wrapup.md`, `agent-tasks.md`, `agent-context.md`.

### External references

None needed. The recommendation is based on existing local transport, ownership and transaction contracts.

## Caveats / Not Found

- No structured classifier for the semantic meaning of 'start' or 'only plan' exists. No safe deterministic inference from free-form text was found; keyword matching would introduce false positives.
- No initial-plan-free promise can be caught by the proposed minimal contract. All-complete but false plans and unsupported final claims also remain possible.
- Research only: no product edits or tests performed.
