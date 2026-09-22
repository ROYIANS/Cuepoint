# Agent execution and recovery

## 1. Scope / Trigger
Read when changing Agent messages, execution lifecycle, retry, tool-loop integration or startup recovery. IndexedDB v8 adds studio-global agents and agentRuns; v9 adds the tool-call ledger. These records and credentials are excluded from project ZIPs.

Batch queue, selection and genuine generation-source evidence extend these contracts; read [Batch Generation](./agent-batch-generation.md) when touching those paths.

## 2. Signatures
- `beginAgentRun({threadId, connector, model, content?, retryOfRunId?}): Promise<AgentRun>`
- `checkpointAgentRun(runId, sequence, output): Promise<void>`
- `finishAgentRun(runId, status, output?, error?, finishReason?): Promise<void>`
- `withThreadRunLock(threadId, execute, locks?): Promise<T>`
- `recoverAbandonedRuns(locks?): Promise<void>`
- `executeChatRun(run, apiKey, controller, fetchImpl?): Promise<void>`
- `createRunWriter(persist, onFailure): {push(output), flush(): Promise<void>}`
- `AgentRunStatus`: running / waiting_approval / completed / failed / cancelled / interrupted.

## 3. Contracts
- Caller owns the per-thread Web Lock from recovery through atomic begin, transport and final flush. Missing Web Locks fails closed. Recovery uses `ifAvailable`, never a heartbeat timeout that could invalidate a frozen live tab.
- Begin transaction creates input/output/run together and idempotently seeds a stable general Agent. Run snapshots agent instructions, request messages, connector identity and actual model. Never copy API keys into runs; reject URL credentials/query/fragment before saving connector identity.
- Chat history is read from the scoped database in the begin transaction, not stale React messages. Only complete or legacy status-less messages enter later context. Error copy is stored separately from answer content.
- Checkpoints use monotonically increasing sequence numbers. Writes coalesce and serialize; final transition awaits flush. Terminal executions cannot return to streaming. Local write failure aborts transport and is surfaced.
- Explicit retry creates a new run/assistant message and references its predecessor, while reusing the original user message and frozen request snapshot. Only the latest unsuccessful text-only attempt without later user turns can retry. Runs with tool calls use durable continuation instead; see [Agent Tools](./agent-tools.md). Connector ID/provider/base URL and model must match; current credentials may rotate. No startup network resubmission.
- Route changes (including browser back/forward) abort the execution associated with the old thread. Bind newly created thread identity before navigation so the first send does not cancel itself; keep sending locked until final persistence settles.
- The first new user message derives default thread titles in the begin transaction. Custom titles and retry titles remain unchanged.
- Thread deletion cascades executions; late writes cannot resurrect records. Legacy v7 pending/streaming messages become interrupted, retain partial text, and instruct the user to resend (they lack a request snapshot).
- Transport makes at most one POST. Original-response JSON is supported; invalid responses/HTTP rejection do not trigger an implicit non-stream request. SSE requires protocol completion and usable answer text; malformed/truncated output, unenabled tool calls and length/filter termination fail explicitly, retaining partial deltas.
- Browser close can lose the last uncommitted tokens. Retry is a fresh model request, not exact restoration of an HTTP stream or hidden model state. Future remote jobs reconcile providerTaskId; never replay ambiguous paid submissions.

## 4. Validation & Error Matrix
| Condition | Result |
| --- | --- |
| Another tab owns thread | Refuse competing execution; preserve draft |
| Abandoned running record | Mark interrupted under acquired lock; retain checkpoint |
| Older checkpoint or terminal run | No overwrite |
| Missing run after delete | Reject checkpoint, no resurrection |
| Failed persistence | Abort and surface error; never report completion |
| Retry of old/completed/foreign run | Reject atomically |
| Changed provider/base URL or missing connector | Reject retry; invite a new message |
| Provider error contains key | Redact before persisting/displaying |
| Stream lacks completion | Failed with partial content retained |

## 5. Good / Base / Bad
Good: reopen an abandoned reply, see preserved partial text and a separate interruption notice, explicitly regenerate once.
Base: original response returns JSON; parse it without a second request.
Bad: mark every running row interrupted on mount, including a live tab's run; resend paid jobs after lost responses.

## 6. Tests Required
`agentRuns.test.ts`: atomic creation, no key snapshots, deterministic ordering, stale checkpoints, immutable retry context, incomplete history exclusion, deletion, exclusive ownership and abandoned recovery, v7 migration, write coalescing/failure and runtime terminal states.
`chatStream.test.ts`: split UTF-8/CRLF/events, protocol errors/completion, abort reader cleanup, exact POST count and redaction.
Existing connector/model-policy tests retain no-write-before-compatibility behavior. Browser smoke with a local fake provider must demonstrate interruption → explicit retry → reload with old and new answers preserved.

## 7. Wrong vs Correct
Wrong: `onDelta: () => void updateChatMessage(...)`, then independently save complete.
Correct: push snapshots into the serialized writer, await `flush()`, then atomically finalize message + run.

Wrong: `setTimeout` decides a background tab died and starts its request again.
Correct: probe the thread's Web Lock; if unavailable leave it alone; if available mark unfinished local execution interrupted without network traffic.

## Unfinished-plan finishing checkpoint

### Scope and signatures
At a successful tool-free reply boundary, `saveAgentFinishingCheck(runId, expectedStep, output, responseOutput?, signal?): Promise<boolean>` may retain that reply as a process step and continue the normal loop once. `AgentRun.finishingCheck?: { step: number; createdAt: string }` is a code-owned durable one-use marker, not a verified-completion flag. `buildFinishingCheckPrompt(run, calls)` projects bounded owned historical evidence.

### Contract
Require a running smart run with enabled tools, a valid current unfinished plan and a matching owned completed atomic `update_run_plan` result from this run. An inherited task plan alone is insufficient. All ledger calls must be completed, and another model request must fit within the current segment. Persist marker, public candidate activity, assistant continuation and fixed system checkpoint in one transaction. Keep original requests/base context unchanged. Responses retains its validated output envelope including opaque reasoning; public activity never includes encrypted content. Existing request metrics, context budget, permission gates, Stop and explicit resume apply normally.

Reuse `describeRunWrites`; up to 20 receipt entries include source call IDs and historical revisions, excluding labels, arbitrary result payloads and plan text. Count uncovered/omitted writes explicitly. Completed network calls do not certify saved outputs. Instructions permit advice-only, missing-input and genuine blocked replies to finish, prohibit replaying submissions and distinguish prior facts from new effects. No forced tool choice or automatic generation retry.

### Validation and error matrix
| Condition | Outcome |
| --- | --- |
| No current-run saved plan, complete plan, conversation or no enabled tools | Normal final reply |
| Failed/rejected/unsettled/foreign call, inconsistent plan | No finishing checkpoint |
| Checkpoint already saved, including after explicit resume | No second checkpoint |
| Candidate at final segment step | Normal final reply; do not manufacture a budget pause |
| Valid checkpoint and remaining step budget | Continue through ordinary model loop |
| Abort or local save failure | No new dispatch; preserve ordinary interruption/error handling |
| Responses output differs from candidate or includes functions | Reject checkpoint before mutation |

### Good/base/bad cases
Good: save an execution plan, emit premature prose, receive the one-time ledger reminder, then use a real business tool in the same user turn. Base: a planning-only request can finish with an explanation after the checkpoint without any business write. Bad: force mutations merely to tick a plan, count bookkeeping as completed work, or infer generated audio from a returned network call.

### Required tests
`agentFinishingCheckPrompt.test.ts` checks ownership, validated receipt provenance, historical/unknown distinctions, omission bounds and exclusion of arbitrary payloads. Runtime/repository tests cover both protocols, once-only persistence, candidate history, interrupted resume, inherited plans, final-step behavior and approval preservation. Existing transport no-fallback tests remain valid: this is an additional explicit model round, not an HTTP retry.

### Wrong versus correct
Wrong: every tool-free reply means the user must type “continue”, or every unfinished plan forces more writes.
Correct: use one evidence-backed self-check only for a freshly saved unfinished plan, allow the model to explain a genuine boundary, and retain actual results independently of its prose.

This checkpoint adds at most one check request per run; any subsequent tool work consumes the existing segment budget. It is not a semantic truth filter. The candidate already streamed and remains in history. No-plan promises, false all-complete plans and unsupported free-text claims require separate acceptance and are not solved by this mechanism.
