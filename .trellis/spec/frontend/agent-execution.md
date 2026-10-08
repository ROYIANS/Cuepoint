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

## D01 Agent query, selection and preparation boundaries

### 1. Scope / Trigger
Read when changing generation batch preparation/application, task edit commands or per-request tool offers. Command orchestration must not become the import owner of a read-only guard or pure selector. The three remaining value SCCs were removed on 2026-10-08; preserve this direction when adding callers. This was structural remediation, not a demonstrated initialization-crash fix.

### 2. Signatures
- `domain/agentToolSelection`: `getOfferedToolNames(run: Pick<AgentRun, "enabledToolNames" | "toolLoading" | "interactionMode">): string[]`, `toolNamesForCall(run: AgentRun, step: number): string[]`; discovery name `load_tool_groups`, loaded-tool ceiling `36`.
- `db/agentGenerationTarget`: `readGenerationTarget(target: ProductionTarget)` returns the owned entity, current slot, revision and label. It joins an existing caller transaction and opens none.
- `db/agentTaskGuards`: `editableAgentTask(id: string): Promise<AgentTask>` is a read-only guard; command owners supply their write transaction.
- `lib/agent/generationPreparation`: `prepareGenerationSnapshot(raw: GenerationSubmitArgs, signal: AbortSignal)`, `loadGenerationInputs(job: AgentGenerationJob): Promise<MediaRecord[]>`, `resolveGenerationConnector(id: string, frozen?: Pick<AgentGenerationJob, "provider" | "baseUrl">)`. Batch uses `Awaited<ReturnType<typeof prepareGenerationSnapshot>>`; do not duplicate its structural return type.

### 3. Contracts
DB tool ledger, project creation and finishing check import the pure selector leaf directly. Discovery execution stays in `toolLoading`; its compatibility exports serve actual runtime/UI/test consumers, not DB reads. Conversation offers, legacy runs, dedup order, enabled ceilings and historical per-step offers remain unchanged.

Batch imports preparation and the DB target reader; runtime retains paid submit/poll/download/application and durable ownership. Task records and lifecycle commands import the task guard directly. Keep atomic ledger, record/history, batch and wrap-up commands in their existing owners rather than distributing them among readers.

Preparation performs abort/schema checks, draft flush and connector/profile validation before a short read-only target/media snapshot. Blob hashing and image-header inspection follow outside that snapshot and all write transactions. Application rechecks current targets inside the existing outer write transaction before nested slot writes and final ledger/history persistence. Readers must preserve Dexie transaction lifetime through every await.

### 4. Validation & Error Matrix
| Condition | Required behavior |
| --- | --- |
| Missing nonstudio project or foreign/missing entity | Reject before preparation/application mutation |
| Shot missing or foreign episode, missing slot | Preserve the existing target error; no inferred ownership |
| Missing task/thread, deleted project, preparing summary or busy run | Refuse manual edit; guard performs no writes |
| Missing/foreign/empty/wrong-kind input | Reject before hashing/transport; preserve existing message and check order |
| APIMart oversized reference or invalid MiniMax H3 format/header/dimensions | Preserve 20 MiB and model-specific checks outside writes |
| AIHubMix encoded inputs plus UTF-8 prompt and overhead exceed 32 MiB | Reject preparation without paid submission |
| Changed frozen provider/base URL or input revision | Preserve durable job and refuse replacement/replay |
| Abort or downstream ledger/history failure | Keep cancellation semantics or roll back the complete caller transaction |

### 5. Good / Base / Bad Cases
Good: prepare a confirmed batch outside writes, recheck targets in its application transaction, then commit slot/job/history together. Base: a studio asset has no project row and still uses the existing owner/slot checks. Bad: DB tool selection imports discovery registration, a target read imports the paid runtime, or a successful nested slot write survives a later ledger failure.

### 6. Tests Required
Use actual tool/loading/approval/finishing, generation/batch/recovery and task/record/wrap-up entry regressions. `d01DependencyBoundaries.test.ts` covers real leaf consumers; native `tests/fixtures/d01/harness.ts` proves hash/flush outside transactions, real single/batch application and guard recovery. Preserve native fault injection after nested slot/job writes, asserting shot/job/ledger/history rollback. AST must distinguish value/type edges and show no new static or literal-dynamic value SCC. Static comparison uses identical tool versions and separate complete baseline/current TypeScript programs; absent new baseline files are not source-rule errors. Native synthetic media proves exercised persistence, not decoding, providers or full product UI.

### 7. Wrong vs Correct
Wrong: move files while keeping DB callers importing the orchestration module, or hash a Blob inside the application write callback. Correct: import the meaningful reader/selector/preparation owner directly, prepare before writes, and preserve the existing atomic command and its final ledger/history validation.

## Typed tool and memory wire compatibility

Both preparation/approval and execution-claim boundaries use `toolMetadataMatches` for effect, computed risk, normalized atomic/recovery/confirmation. Typed tool arguments do not authorize metadata or replace durable ledger/transaction/paid recovery checks. Existing frozen offered sets and actionable model argument self-correction remain. See [D05](./agent-tools.md#d05-schema-linked-tool-protocol-2026-10-08).

## Shared generation capability boundary

Generation review, shared single/batch fields and project output settings use the actual dependency-free domain/generationCapabilities.ts facts/projections. Request validation preserves provider lowering/error order and D05 typed schema output. Rendering cannot infer frame mode or silently repair an invalid proposal into authorization; target/input/revision/approval/paid-recovery owners remain. See [D06](./asset-output-foundation.md#d06-shared-generation-capability-contract-2026-10-08).

Provider transport sharing follows `ai-connectors.md` D07: explicit per-adapter browser/JSON policy, retained generic inline-image native parsing, HTTP authority and cancellation/redaction. Paid POST submission remains once-only; existing generic read/probe fallback and separately initiated GET recovery keep their own explicit policies. No shared request helper may replay an uncertain paid submission.
