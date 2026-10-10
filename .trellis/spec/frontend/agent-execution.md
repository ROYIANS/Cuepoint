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

## Bounded terminal finishing check (2026-10-10)

### 1. Scope / Trigger
A successful tool-free terminal answer from a smart run may receive one execution check, including when no plan was written. The user approved this extra request and the separate read-only claim review. Conversation, Stop, genuine input/approval boundaries and segment budgets remain authoritative.

### 2. Signatures
`saveAgentFinishingCheck(runId, expectedStep, output, responseOutput?, signal?): Promise<boolean>` persists `AgentRun.finishingCheck: {step, createdAt, reason: "unfinished_plan" | "terminal_reply"}`. `buildFinishingCheckPrompt(run, calls)` projects owned historical evidence. `reviewFinalReply` is a separate zero-tool request; see [write evidence](./agent-write-evidence.md).

### 3. Contracts
Require running smart mode, enabled tools, exact current model step, remaining segment budget and unchanged durable thread/project/task ownership. Every existing call must be completed and belong to this thread. If an `update_run_plan` exists, validate its atomic bookkeeping call, offered tool, original arguments and saved result against the current plan; no-plan and all-complete-plan replies can still be checked. The marker is durable once per run, including explicit resume.

Atomically preserve the original candidate as public activity plus assistant continuation and a fixed system check. Responses retains the exact validated envelope and opaque reasoning; public activity contains no encrypted content. Requests, permissions, Stop, metrics and normal tool loop remain intact. Project facts, direct receipts and plan steps are different evidence. Receipt projection caps at 20 entries and explicitly discloses omissions and uncovered calls. Advice/planning-only requests may finish without writes. This is bounded model self-checking, not guaranteed detection of every promise or false claim.

### 4. Validation & Error Matrix
| Condition | Result |
| --- | --- |
| Conversation, no tools, terminal/foreign/stale run or task | No check dispatch |
| Failed/rejected/unsettled call or malformed/inconsistent saved plan | No check dispatch |
| Marker already exists or final segment step reached | No additional execution check |
| No plan or completed plan, otherwise eligible | One normal-loop check allowed |
| Stop, persistence failure or invalid Responses envelope | No dispatch or partial mutation |

### 5. Good / Base / Bad Cases
Good: one user action request progresses from a premature candidate through an actual business tool. Base: advice-only prose finishes after explaining that no action was requested. Bad: ticking a plan counts as completion or bypasses generation approval.

### 6. Tests Required
`agentFinishingCheck.test.ts` and `agentFinishingCheckPrompt.test.ts`: both protocols, no-plan/completed-plan, advice, exact opaque envelope, once-only resumed runs, stale owner, final step and no replay. Runtime fixtures must accept the real extra request and assert actual paid counts, usage and receipts; never turn the feature off to preserve old counters.

### 7. Wrong vs Correct
Wrong: a no-call answer always requires another user “continue”, or a saved plan authorizes more writes. Correct: persist one bounded evidence-based check, retain the original candidate, and let the normal permission/input/budget rules decide the next action.

## Contextual ownership and typed recovery (2026-10-10)

### 1. Scope / Trigger
Business and sound tools that omit project ownership, stale targets and execution failures across preparation, atomic local writes and paid submission.

### 2. Signatures
`frozenProjectScope(context)`, `resolveBusinessOwner(args, context)` and `requireBoundProjectScope(context, requestedProjectId?)` read durable run/thread scope. `ToolRecoveryError`, `toolFailureResult`, `readToolRecoveryFailure` carry `code`, `executed`, `effectCertainty`, `error`, `recovery`.

### 3. Contracts
An omitted owner/project resolves only from an exact validated durable run/thread binding. Explicit IDs are preserved and foreign targets reject; unbound business actions require an explicit owner, including `studio`. Never infer episode identity. Preserve raw model arguments and original approval envelopes; resolve a separate parsed argument copy.

Typed guard codes are PROJECT_REQUIRED/SCOPE_MISMATCH/NOT_FOUND, TARGET_NOT_FOUND/SCOPE_MISMATCH, EPISODE_REQUIRED/SCOPE_MISMATCH and STALE_TOOL_PREVIEW. Certainty comes from the actual boundary, never exception wording: preflight/read = `not_started`, proven atomic local rollback = `rolled_back`, ambiguous writes = `unknown`. Unknown effects have no invented success/failure result or automatic replay. A paid POST followed by a summary-read failure cannot be wrapped as atomic rollback. Stop is not a correction invitation.

### 4. Validation & Error Matrix
| Boundary | Result |
| --- | --- |
| Omitted owner, valid bound run | Resolve owner; original arguments unchanged |
| Explicit foreign owner or run/thread mismatch | Typed scope rejection before effects |
| Deleted project or target, absent episode | Typed actionable recovery; no replacement inference |
| Stale approved preview | Re-read/reprepare and renewed approval |
| POST may have happened, downstream read fails | Unknown; retain job/provenance, no resubmission |

### 5. Good / Base / Bad Cases
Good: correct an omitted bound project without asking to reopen the conversation. Base: studio action explicitly identifies studio. Bad: replacing a supplied foreign owner or assuming a caught paid error means nothing happened.

### 6. Tests Required
`agentContextualOwnerRecovery.test.ts`: bound/unbound/studio/foreign/deleted scope, no guessed episode, raw arguments and approvals retained, atomic result failure, real POST checkpoint followed by read failure, reopen and repeated resume with zero extra POST. Existing D05 historical schemas remain immutable with only explicit approved compatibility deltas.

### 7. Wrong vs Correct
Wrong: `catch (...) { throw new AtomicToolRollbackError(...) }` wraps the entire paid operation. Correct: wrap only actual preflight or atomic transactions; retain uncertain paid intent and expose its existing job for read-only recovery.

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
