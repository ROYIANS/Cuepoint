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
