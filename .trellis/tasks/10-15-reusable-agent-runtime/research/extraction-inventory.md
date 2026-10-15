# Agent runtime extraction inventory

## Status and inspection boundary

This is read-only preparation for child 3, requested while child 2 completes its final acceptance. It does not activate child 3, approve the current working tree, or implement an API. The only file authored by this preparation is this document. No product, tooling, tests, specifications, manifests, or lifecycle metadata were changed.

Observed branch: `codex/studio-feature-organization`; observed HEAD: `03b8625fb338189e53ba3adab8808223302f6f75`. Source references below describe the uncommitted child-2 layout at inspection time. Revalidate them after the accepted child-2 commit/archive; HEAD alone does not identify those source contents.

Loaded the child-3 PRD/design/implementation plan and context manifest, child-2 task context/verification, parent design/implementation/findings and context-loading contract, Trellis before-development guidance, scoped indexes, and the execution/tools/context/project-context/memory/evidence/provider/storage/native/type/quality canonical specifications through EOF. The execution, ledger, terminal, ownership, context, tool-loading, provider, reference-wire and main host-composition modules were read in full. Domain-only retained modules below were inventoried by path, declarations and imports; this is not a claim to have audited all domain implementations in full.

No runtime checks were executed for this research. Suite names below identify existing evidence to preserve and future checks to run, not new passing results.

## Recommended executable boundary

The reusable unit is the actual execution algorithm currently in `packages/studio/src/features/agent/runtime/runChat.ts`, together with generic context/capability mechanisms. Moving only types, parsers or provider transports would leave the reusable package unable to run another application's Agent and would fail A1/A3.

The target dependency graph is:

```text
Studio UI / product commands             todo CLI / independent SQLite
             |                                      |
       Studio host adapter                    todo host adapter
             +------------------+-------------------+
                                |
                       @cuepoint/agent-core
                                ^
                                |
                     @cuepoint/agent-providers

Both hosts compose core + a ModelPort implementation.
Core imports neither providers nor either host.
Providers import core; providers never import Studio.
```

The present product call path starts in `features/agent/ui/chatExecutionFlows.ts`: fresh/retry/action flows acquire ownership, assemble or resume the durable product run, then call `executeChatRun`. `runtime/runOwnership.ts` also performs owned, zero-network abandoned-state recovery. Keep UI navigation, connector selection and product admission in Studio, but have every actual execution and resume enter the same exported core implementation.

The following control flow must execute inside core, rather than inside a callback that invokes the old Studio loop:

1. Load and validate the owned run; initialize the serialized checkpoint writer and reasoning accumulator; process an existing durable pending tool round before requesting another model step.
2. Check cancellation and the existing 32-request segment limit before context preparation, including before any auxiliary compaction request.
3. Refresh generic capability selection and invoke bounded host policy hooks in the current order: project refresh, memory refresh, context preparation/compaction, memory revalidation, final context budget, then durable model-step/audit admission.
4. Dispatch the selected model once, accumulate ordered provisional deltas, flush output, then save actual per-step usage/metrics. Finishing-policy requests consume the same existing segment budget.
5. Validate/save the entire assistant tool round and its exact provider continuation before any tool effect. Retain the two-pass preparation/approval barrier: one undecided required approval prevents execution of the round.
6. For each nonterminal execution candidate, reread the current call/run, verify frozen metadata and offered-tool scope, claim it atomically, then invoke its typed implementation. Do not add point reads for settled historical calls.
7. Reconcile durable success before classifying failures; distinguish known rollback from unknown commitment; never replay an uncertain external submission. Append confirmed results exactly once, then continue the same loop.
8. On answer, Stop, failure or budget pause, drain checkpoints and use the common settlement command. Recovery and explicit end use that same terminal transition authority.

`runChat.ts:105–237` contains the actual two-pass tool state machine; `runChat.ts:247–380` contains the actual request loop and failure settlement. Both are extraction targets. A Studio `executeChatRun` wrapper may compose dependencies and delegate to core, but must contain no second model/tool loop.

## Exact source split

Paths in the following tables are relative to `packages/studio/src/features/agent/` unless stated otherwise. Suggested destination filenames are organizational guidance, not a second approved feature taxonomy.

| Current source and anchor | Move to core/providers | Retain or adapt in Studio |
| --- | --- | --- |
| `runtime/runChat.ts:47–84` | Core checkpoint writer: coalescing, serialized writes, monotonic sequence, failure propagation, flush. | Persistence callback bound to the existing assistant-message/run transaction. |
| `runtime/runChat.ts:105–237,247–380` | Core execution loop, tool preparation/approval/execution state machine, 32-step budget, cancellation, result reconciliation, terminal command dispatch. | Thin composition entry; product scope validation, generation override selection, product context refresh and finishing policy become explicit hooks. |
| `runtime/runChat.ts:98–102` | Generic support for validated effective execution input distinct from original wire arguments. | `submit_generation` override rules, preview validation and original-arguments preservation. |
| `runtime/toolDefinition.ts` | Typed tool definition/registry/context metadata, callback inference and validation relationship. | Adapter binds product services/project binding; public core types must not mention `ProductStore`, `projectId` or generation previews. |
| `runtime/tools.ts:26–32,138–177` | Approval matrix, registry lookup, bounded raw JSON parsing, offered-name enforcement, metadata comparison. No default creative registry in core. | Workspace overview, product plan tool, assembled domain tool registry and plan/task semantics. |
| `runtime/businessSchemas.ts:16–89` | At most the neutral parser/JSON-schema contract and generic recipes required by the shared tool API. | Domain schemas from line 91 onward, video constants, owner/episode/shot/material fields. Do not move the file wholesale. |
| `runtime/toolErrors.ts` | Generic validation/pending/unavailable/rollback/uncertainty envelopes and bounded safe diagnostics. | Product recovery codes, episode/field-path guidance, `business_read_text` recommendations and domain-specific recovery instructions. |
| `models/agent.ts:23–61,133–172,249–256` | Neutral statuses, permission/interaction modes, wire calls, schemas, effect metadata, usage/metrics, checkpoint output, capability state, segment constant. Split mixed declarations explicitly. | Rich `AgentRun`, creative configuration/task fields, reference/memory/pricing/connector snapshots, `MusicGenerationReviewSnapshot`, generation recovery and review payloads. |
| `models/agentToolSelection.ts` | Frozen enabled ceiling, step-specific offers and pending-call pinning selectors. | No creative catalog data is needed by these selectors. |
| `commands/agentRuns.ts:58–215` | Admission contract and generic state validation only. | Entire product transaction assembling task/project/skills/model/reference/memory/thread/messages/run. This is not a reusable storage implementation. |
| `commands/agentRuns.ts:218–235` | Checkpoint and settle command semantics. | Existing ProductStore transaction and run/message identity checks behind the host adapter. |
| `commands/agentRuns.ts:238–268` | Generic recovery decision rules and terminal command. | Legacy local repairs, generation batches/jobs and context-summary record repair in one host transaction; zero HTTP. |
| `commands/agentRuns.ts:272–300` | Pure idempotent step-usage aggregation where useful. | Durable record updates and existing product display/cost data. |
| `commands/agentRunTerminalState.ts:18–60` | One generic terminal transition function/decision shared by loop, recovery, budget and explicit end. | One atomic adapter writer for run + assistant message and any associated ledger updates; preserve existing output/timing mapping. |
| `commands/agentTools.ts:56–108,117–292,325–355` | Segment/admission, ledger-round, claim/approval/park/resume, result-append and interruption semantics. Core selects transitions; host commits them conditionally. | Concrete table scope, product latest-run/project checks, dispatch audits and reference-result follow-up construction at 272–286. |
| `commands/agentTools.ts:295–323` | Generic local tool commit contract. | `updateRunPlanAndComplete`, task records/versions and plan/task business mutation. |
| `commands/agentTools.ts:359–408` | Explicit rollback/unknown outcome types, immutable preview contract and result-size requirements. | Actual shared local transaction at 381–408; music-review preview codec/limits at 363–376. |
| `commands/agentTools.ts:411–466` | None of the paid-generation review policy itself. | Generation review read/CAS, target fingerprint, unchanged input/owner checks, independent saved override. |
| `commands/agentToolRecovery.ts` | Generic classification driven by explicit effect/recovery evidence. | Exact legacy plan repair, local batch-draft reconstruction, existing generation-job evidence. Never infer replay safety from error prose. |
| `runtime/runOwnership.ts` | Host-neutral exclusive-coordination/recovery orchestration contract. | Web Locks adapter, fail-closed browser capability check, product abandoned-batch enumeration/repair. No `navigator` access during core import. |
| `runtime/contextPolicy.ts:1–17`, `runtime/contextUsage.ts:4` | Policy normalization and token estimate algorithm. | Model/catalog capacity resolution; UI usage categories, colors, formatting and product reference/memory labels. |
| `runtime/contextPlanner.ts` | Whole-turn grouping/protected selection, budgets/reserves/thresholds, exact verified-prefix operations. | Constructing product reference/memory provenance text and selecting current product history. Preserve current image-token cost through a typed input. |
| `runtime/contextCompaction.ts` | Bounded eight-pass compaction algorithm, request/usage accounting, protect-current/tool-chain rules, summary activation ordering. | Durable summary-job transactions, product liveness checks, product context/base projection and audit records. Do not leave the entire compaction loop in a Studio callback. |
| `models/context.ts` | Neutral context policy/summary execution projection. | Product history scope, selected references, memory and connector provenance; split the mixed snapshot. |
| `runtime/toolLoading.ts` | Generic capability-group loader, ceiling/pending pinning, selected-group replacement and atomic loader-result state update. | Creative catalog, project-kind preloads, foundation tool names/instructions, SMART prompts and created-project notice at line 127. |
| `runtime/skills.ts` | Only a generic catalog assembly function if shared loading requires it. | All creative skill definitions, default skill IDs, tool-group contents and instructions. |
| `commands/agentFinishingCheck.ts`, `runtime/finishingCheck.ts` | Core calls a typed answer-candidate policy and performs any requested next step under the same budget. | Plan/receipt eligibility, one-use marker, final answer/opaque envelope checkpoint, creative finishing prompt and plain-Q&A exclusion. |
| `providers/chatStream.ts:75–142` | Core reasoning accumulation/finalization, usable with any ModelPort. | No product dependency needed. |
| `providers/chatStream.ts` remaining transport/parser | Providers Chat Completions request/parser/tool-delta assembly, limits, completion policy, usage/first-token timing, abort/error/redaction behavior. | Product references, connector IDs and reasoning-policy selection leave the transport input. |
| `providers/responsesStream.ts` | Providers Responses transport/parser, wire conversion, validated opaque continuation codec, complete-envelope/tool-pair verification and bounded streaming. | Product reference envelopes and connector-definition allowlists/effort policy; host materializes inputs before dispatch. |
| `providers/openaiCompatible.ts:10–23` | Providers neutral auth-header and chat-URL helpers. | Key masking UI, model discovery/test-connection/catalog behavior and settings/runtime probe integration; do not relocate the whole module. |
| `providers/referenceWire.ts` | Protocol-only message/content conversion may be a provider helper after product materialization. | Live frozen scope, reference/material authorization, binary leases/availability, vision checks, pixel loading and send-time encoding all stay Studio. |

Shared HTTP leaves also need deliberate placement. `platform/http/requestBoundary.ts` currently reaches product `runtimeFetchFor`; moving that import to providers would preserve a hidden Studio dependency. Providers should accept the request implementation and preserve exactly-one-dispatch semantics; Studio injects its current runtime transport and native authorization. `boundedResponse.ts`, `boundedSse.ts`, base-URL helpers and credential redaction contain reusable mechanics, but some are also used by media. Move required neutral leaves once to a declared package export, or inject the exact leaf contract; update existing callers rather than create copied parsers. Keep media limits/policies in Studio. Core may own a pure safe-diagnostic helper consumed by both providers and Studio, avoiding a reverse dependency.

## Minimal semantic host contracts

These are required operations and invariants, not permission to build a generic storage framework. Keep concrete StoreTx/table enumeration inside the Studio adapter. A second independent host must implement these semantics without importing Studio. Method names may change during implementation if the guarantees remain explicit and tested.

| Contract | Required input/output and semantics | Existing implementation anchor |
| --- | --- | --- |
| Exclusive coordination | `withExclusive(scope, ownedTask)` passes an opaque host-validated ownership token. A competing live owner cannot execute, recover or approve-and-resume. Recovery only proceeds after ownership is acquired; missing browser locks fail closed. No timeout/heartbeat implies death. | `runtime/runOwnership.ts:20–43`; UI flows acquire before begin/resume. |
| Atomic begin/admission | Host validates the frozen input and creates all host-linked records atomically; returns only a typed execution projection plus an owned expected-state token. Duplicate/superseded begin is rejected. | `commands/agentRuns.ts:58–215`. |
| Owned reads | Read current run/call and confirmed result through identities, not generic table CRUD. Absence, stale state, unreadable durable outcome and a confirmed completed result are distinct results. No missing read silently means rolled back. | `runChat.ts:174–218`; `agentTools.ts:31–53`. |
| Durable checkpoint | Compare ownership, run/message identity, active status and monotonic checkpoint sequence. Return stale/refused explicitly. Serialized writer is core-owned; the host commits the run/message effect. | `agentRuns.ts:218–229`; `runChat.ts:47–84`. |
| Model-step admission | Core supplies the selected step/offers/context decision; host conditionally commits step increment, offered schemas, capability/context/reference/memory audit before HTTP. Budget must not be silently replenished by an ordinary resume or approval. | `agentTools.ts:56–108`. |
| Ledger round and claim | Save all wire calls, original arguments, immutable metadata/preview and provider continuation together before any effect. Claim each eligible call with expected current state and ownership; never perform execute-as-read-then-write. | `agentTools.ts:117–193`; `runChat.ts:105–237`. |
| Approval/park/resume | CAS a decision against the exact latest run/call, frozen arguments/preview and required permission. A decision can be saved with no usable credential; HTTP only follows explicit eligible resume. Waiting, interrupted and unknown are different states. | `agentTools.ts:195–247,411–466`; `ui/chatExecutionFlows.ts:174–213`. |
| Local tool transaction | Bind a typed local-services view to one host transaction; execute local mutation, receipts/evidence, result validation/serialization and completed ledger write inside that transaction. Returning from it reports commitment certainty explicitly. | `agentTools.ts:381–408`; `features/library/agent/libraryToolHelpers.ts`; `runtime/writeReceipt.ts`. |
| Confirmed result append | Append only terminal calls with validated saved results once, in original round order; append the provider function output exactly once. Host may add a validated product-reference follow-up under the same commit. | `agentTools.ts:249–292`. |
| Context summary persistence | Begin durable summary job before HTTP; activate only against the verified current base/run/scope, atomically replace that base and retain continuation suffix, and never turn a committed completed summary into failed after a late error. | `runtime/contextCompaction.ts:36–164`. |
| Common terminal commit | Apply the one core terminal decision through one conditional host writer; update run, assistant message and required ledger classification atomically. Flush writer first. Repeated/stale completion cannot overwrite a later terminal state or erase earlier visible output with empty final text. | `agentRunTerminalState.ts`; `agentRuns.ts:231–268`; `agentTools.ts:56–73,325–355`. |

Do not expose all of these as one unconstrained `transaction(callbackWithTables)` port. A small command-oriented persistence interface may group operations, but core must continue to own the transition choice and loop. Conversely, hiding `executeChatRun`, `executePendingTools`, compaction or capability selection inside a host `execute` callback would leave the real algorithm product-bound.

There is an important current-state constraint: `AgentRun` has checkpoint/model-step/status/offer snapshots, but has no durable general-purpose `revision` or `ownerId` column. Do not describe the existing checkpoint as an owner revision. Define an opaque adapter expected-state token backed by current transaction predicates and the acquired ownership capability. Revalidate the relevant current fields inside every commit. The todo host can use its own explicit SQLite revision/claim fields. If a stronger Studio persistent revision is found necessary, surface that design/schema consequence; do not create a second product database or silently claim existing fields provide it.

### Typed tool execution and certainty

Use a definition equivalent in expressiveness to `Tool<Args, Services, Preview, Result>`, with schema-owned parsing and function-property callbacks preserving argument inference. Schema/result/preview extension types must be validated and bounded. The core context contains execution/call identity, signal, validated preview/input and explicitly typed services; the generic package does not require Studio services. Each host binds its concrete service type. Avoid `any`, unchecked records, a string-key service locator and a public `store?: ProductStore` field.

Keep these distinct:

- Original immutable model arguments, validated prepared preview, saved user decision and optional validated effective execution override. A paid-generation review override must not overwrite the original protocol call.
- Ordinary preflight/prepare work and the local atomic mutation callback. Draft flushing, authorization reads or remote requests are not automatically moved inside a long-running local database transaction.
- A tool's returned business value and the durable confirmed result. Serialization, result-size checks and receipt production happen before local COMMIT; an unsupported/oversized result rolls back the mutation.

A minimal outcome discriminant is `committed | rolled_back | unknown`, with typed value/serialized result only where known and an operation identity for reconciliation where needed. A failed acknowledgement after COMMIT, or failure to read the completion record, cannot manufacture `rolled_back`. If a confirmed saved result is obtainable, it wins over a later transport/observation error and is reused without execution. If the durable outcome cannot be read, core interrupts with unknown commitment and refuses replay.

For external tools, persist stable intent/operation identity before the existing supplier dispatch and expose a typed reconciliation result. Do not redesign media protocols or automatically repeat POST. `features/video/agent/generationRuntime.ts:149–284` distinguishes already-claimed work, uncertain POST outcomes and known provider-task evidence; its monitor/check path is not a permission to resubmit. `agentToolRecovery.ts` contains exact local/batch/generation proofs that remain host-owned.

### Model and opaque continuation

Core needs a typed model request/result/event contract and a generic continuation parameter. Providers supply concrete validated Chat/Responses codecs; core must not import their implementation or recognize a product connector ID. The host may compose provider continuation with its separately validated product reference provenance. Do not use a generic JSON bag as the continuation API.

The codec needs pure operations for initial input conversion, exact assistant tool-round validation, appending confirmed results, verified-base replacement and continuation token overhead. It must preserve every validated Responses item, including `id`, `summary` and exact `encrypted_content`, across durable round saves, final-answer saves, explicit resumes and compaction. Core persists the opaque value through the host; public content/reasoning events never contain ciphertext. Existing reference metadata is removed/materialized at the Studio boundary, not copied into provider public types.

Studio resolves current credentials at dispatch and checks frozen connector identity/model compatibility; secrets never enter run snapshots, approvals, checkpoint/event payloads, example records or diagnostic output. Current UI resolves a connector when entering a flow; extraction must make the actual request boundary explicit, including auxiliary context requests, rather than infer freshness merely from that entry resolution. Reference scope, pixel/material loading and binary leases also remain request-time Studio work. Preserve current abort propagation, exactly-one POST, no hidden retry/fallback, bounded reads and secret redaction before diagnostic truncation.

### Policy hooks and terminal ownership

Use narrow hooks that return validated decisions or perform named durable host effects: current scope validation; effective tool input; project/memory/reference context materialization; audit preparation; and answer-candidate finishing decision. Keep generic ordering, budgets, compaction selection, capability loading, approval policy and subsequent model/tool dispatch in core.

The finishing hook may atomically checkpoint the candidate/final Responses envelope and the one-use product marker, then return `continue` or `complete`. It must not run a private request loop. Plain Q&A remains one model request, and the finishing request uses the same segment limit.

Preserve a single terminal writer as a structural rule. Core owns the reusable terminal transition command. The Studio persistence adapter funnels all runtime completion/failure/Stop, step-limit pause, startup interruption and explicit-end paths through the one host transaction writer currently represented by `settleRun`. That writer may remain a private host leaf or be refactored into a validated pure decision plus host application; it must not coexist with a new core path that writes the same fields independently. The todo adapter applies the same terminal command to its own schema.

Ordered events should distinguish provisional content/reasoning deltas from confirmed checkpoints, tool decisions/results and terminal state. Durable events are emitted after the corresponding commit. Event ordering cannot substitute for persistence, and encrypted continuation is never rendered as activity.

## Product dependencies already outside Agent

These owners are already separate after child 2. Keep their policy/data there rather than pulling them into core because the old Agent loop imports them:

| Existing owner | Policy/service consumed by Agent | Core-facing boundary |
| --- | --- | --- |
| `features/settings/commands/connectors.ts`, `models/reasoningPolicy.ts`, model catalog | Current keys, connector aliases/identity, model capabilities/capacity/pricing, effort and Responses allowlists. | Request-time model adapter configuration; frozen neutral model settings. |
| `features/references/agent`, reference models; `features/library` material access | Selected-reference validity, provenance/audit, vision capability, historical output sanitization, binary source authorization. | Validated host context and normalized materialized model content. |
| `features/memory/agent/memoryContext.ts` | Bound-project memory query/ranking/selection, live refresh, audit and replacement of only the verified base layer. | Named host context-refresh hook; generic prefix protection remains core. |
| `features/projects` plus `agent/runtime/projectContext.ts` / `projectScope.ts` | Project-kind policy, frozen/current owner checks, newly-created-project binding, typed product snapshot and changed-state notice. | Explicit scope validation/materialization and product payload codecs. |
| `features/library/agent/libraryToolHelpers.ts` and other feature tools | Typed business mutations, stale-target checks, draft preflight, local receipts and business result. | Host-bound typed tool implementations with the existing shared local transaction. |
| `features/video/agent/generationRuntime.ts`, `agentGeneration.ts` | Supplier submission intent, stable job/task identity, uncertain external effects, monitoring and apply. | Network tool implementation and evidence-based reconciliation; no resubmission policy in core. |
| `features/audio/agent`, `features/music/agent` | Audio/music creative schemas/tools, strict generation review snapshot and audio-specific recovery. | Typed tools/previews/results; no audio/music entity type in core. |
| `platform/product`, `platform/storage`, native/binary/runtime HTTP services | ProductStore singleton, SQLite/Dexie adapters, transaction certainty, binary leases and authorized native transport. | Private Studio implementations of persistence/commit/model transport ports. |

Agent-owned task orchestration, wrap-up evidence, plans, creative skills, SMART instructions and finishing/write-receipt policy also remain Studio features. Their current folder name does not make them general runtime concerns.

## Complete 59-file classification

This inventory covers the four inspected Agent source directories. It excludes UI/query/store files and domain tools in other features, which remain host consumers. “Split” requires removing core/provider implementations from Studio after wiring; retained host wrappers are allowed only for composition/policy/storage.

| Directory | Split / move | Retain Studio-owned |
| --- | --- | --- |
| `runtime` (27 files) | `runChat.ts`, `runOwnership.ts`, `toolDefinition.ts`, `tools.ts`, `toolErrors.ts`, `businessSchemas.ts`, `contextPolicy.ts`, `contextUsage.ts`, `contextPlanner.ts`, `contextCompaction.ts`, `toolLoading.ts`, `skills.ts` (only generic assembly if required). | `businessStore.ts`, `taskContext.ts`, `projectContext.ts`, `projectScope.ts`, `activityAttention.ts`, `writeReceipt.ts`, `taskWrapup.ts`, `wrapupEvidence.ts`, `taskTools.ts`, `wrapupSchema.ts`, `taskState.ts`, `finishingCheck.ts`, `runPresentation.ts`, `runWriteOutcomes.ts`, `chatTurns.ts`. |
| `commands` (18 files) | `agentRuns.ts`, `agentTools.ts`, `agentRunTerminalState.ts`, `agentToolRecovery.ts` (split generic semantics from concrete persistence/product recovery). | `agentTaskGuards.ts`, `agentGenerationTarget.ts`, `agentSettings.ts`, `agentGenerationBatches.ts`, `chat.ts`, `lifecycle.ts`, `agentTaskRecords.ts`, `agentContextPreview.ts`, `agentGeneration.ts`, `agentTaskWrapups.ts`, `contextSettings.ts`, `agentFinishingCheck.ts`, `agentProjectCreation.ts`, `agentTasks.ts`. |
| `models` (10 files) | `agent.ts`, `agentToolSelection.ts`, `context.ts`. | `projectContext.ts`, `agentGeneration.ts`, `chat.ts`, `agentGenerationBatch.ts`, `agentTaskRecords.ts`, `chatTitle.ts`, `agentTaskWrapup.ts`. |
| `providers` (4 files) | `chatStream.ts`, `responsesStream.ts`, neutral URL/auth leaves of `openaiCompatible.ts`. | `referenceWire.ts`; product discovery/test-connection/masking remainder of `openaiCompatible.ts`. |

This yields 22 split/move candidates and 37 retained files; some split candidates keep substantial host-owned code. It is not a proposal to move 22 complete files or reorganize unrelated domains again.

## Host conformance matrix before implementation

Every listed existing suite must run through the extracted production path after the switch. Root/browser-mode tests exercise the normal host; entries marked **native** are currently registered in `tests/fixtures/shared-storage/nativeAcceptanceSuites.json` and must also run against the actual pinned Rust/SQLite probe. Being registered does not establish a new pass in this research. `chatStream.test.ts` is currently a root protocol suite, not an entry in that native suite manifest.

The core column requires direct tests of core's real loop with an independent semantic persistence fake/adapter. Do not satisfy it by mocking a host method that runs the old Studio loop. The todo column requires independently owned SQLite tables plus built public exports; memory-only simulation is insufficient.

| Semantic invariant | Existing root / actual native regression anchors | Required new core conformance | Required independent todo SQLite proof |
| --- | --- | --- | --- |
| Begin freezes request/permissions with no secrets; duplicate begin refused | `agentRuns.test.ts` **native**; `sharedNativeAdmission.test.ts` **native**. | Two admissions/owners cannot start two executions; no tool catalog change broadens a frozen run; no credentials in durable/events payload. | Separate processes compete for one scope; one admitted run; own schema contains no API key and no Studio table. |
| Live ownership excluded; abandoned recovery is zero-network | `agentRuns.test.ts`, `agentToolsReview.test.ts` **native**. | Fail-closed missing coordination; stale ownership token cannot claim/checkpoint/settle; recovery does not call the model or tools. | Hold a real process-exclusive ownership mechanism, reject a second process; terminate owner, reopen and recover without network; explicit resume required. Do not use elapsed time as death proof. |
| Monotonic/coalesced checkpoints and sole terminal state | `agentRuns.test.ts` **native**: out-of-order/post-terminal checkpoint, slow writer, failure/Stop cases. | Real writer coalesces/serializes; flush precedes settlement; competing stale terminal attempts cannot overwrite state; empty final output retains prior text. | Two connections/process attempts race stale revision/terminal writes; run/output/ledger remain consistent after reopen. |
| Entire tool round saved before effects, immutable original arguments | `agentTools.test.ts`, `agentToolsReview.test.ts`, `responsesStream.test.ts` **native**. | Real loop rejects mismatched continuation/call identity before execute; preserves round order, at-most-one claim and original wire arguments. | Inspect durable calls before a blocked local tool; crash/reopen retains original call/decision/preview and uses the same result chain. |
| Approval matrix, multiple decisions, rejection and stale preview | `agentTools.test.ts`, `agentToolsReview.test.ts`, `agentToolTransactions.test.ts`, `agentGenerationReviewTransactions.test.ts`, `musicGenerationReview.test.ts` **native**. | Ask/assist/full and forced confirmation; two-pass barrier; one decision per exact call; reject appends an explicit result without execute; no credential lookup needed to save a decision. | CLI approval/rejection on two pending calls; changed arguments/revision/old claim denied; reopen retains decisions and only explicit resume executes approved work. |
| Local business + evidence + result one transaction | `agentToolTransactions.test.ts`, `sharedRegisteredToolSuccess.test.ts`, `sharedRegisteredToolArguments.test.ts`, `nativeRegisteredToolParity.test.ts` **native**. | Core consumes a committed result once and does not independently complete an atomic result a second time; typed transaction services are actually used. | Todo mutation + audit/evidence row + tool result commit together; fail result write/receipt or abort before COMMIT and assert every local change rolled back. |
| Result serialization/bounds failure rolls back | `agentToolTransactions.test.ts` **native**. | Nonserializable/oversized result cannot become success; known rollback continues as a failed tool result without unknown misclassification. | A mutating todo tool returns oversized/nonserializable data; reopen proves no todo/audit/completed ledger write survived. |
| Unknown acknowledgement is not rollback; committed result wins | `sharedNativeOutcome.test.ts`, `sharedNativePreparationOutcome.test.ts`, `sharedNativeRunChatOutcome.test.ts` **native**. | Inject commit-then-throw, unreadable confirmation and later known-success observations; preserve committed result, otherwise block as unknown; no second execution. | COMMIT succeeds then process/acknowledgement fails; reopen reads confirmed result and resumes without duplicate todo mutation. Unreadable outcome remains unknown. |
| External intent before dispatch and no unknown replay | `agentTools.test.ts`, `agentContextualOwnerRecovery.test.ts`, `agentGeneration.test.ts`, `agentGenerationBatchSafety.test.ts`, `webResearchRuntime.test.ts` **native**. | Model requests a deterministic external-effect test tool; persisted intent precedes dispatch; ambiguous failure blocks automatic retry/recovery/ordinary resume. | A fake external tool writes intent and records one dispatch, then dies/fails ambiguously; reopened run refuses another dispatch until a typed confirmed reconciliation, without claiming supplier cancellation. |
| Stop at preparation/stream/local commit/remote waiting | `agentTools.test.ts`, `agentToolTransactions.test.ts`, `sharedNativeRunChatOutcome.test.ts` **native**; `chatStream.test.ts` root and `responsesStream.test.ts` **native**. | Abort before claim/next request; reader cleanup; flush partial output; known committed result remains success; cancellation is not proof remote work stopped. | Actually interrupt a deterministic stream and a pending tool; reopen retains partial output/call certainty and no silent continuation. |
| Segment 32, resume rules, no hidden model requests | `agentTools.test.ts`, `agentFinishingCheck.test.ts` **native**. | Actual loop hits 32, permits final answer at step 32, parks unresolved continuation, replenishes only explicit budget resume; count requests exactly. | Deterministic model exceeds segment, process reopens with unchanged cumulative steps, explicit resume grants only the next segment; approval alone adds no segment. |
| Generic loading with frozen ceiling and per-step offers | `toolLoading.test.ts`, `toolLoadingMeasurement.test.ts` **native**. | Custom noncreative catalog loads groups; pins approved pending calls; rejects never-offered same-round call even after loader execution; loader state/result atomic. | Todo read/write capability groups, disabled group refusal, reopen preserves loaded state and pending approval without replaying loader/tool. |
| Context budgets/compaction and exact continuation | `contextManagement.test.ts`, `responsesStream.test.ts` **native**. | Same budget math, protected current/tool chain, eight-pass limit, separate summary metrics; verified base replacement retains opaque suffix byte-for-byte; failed activation rolls back. | Own SQLite summary/run state with a deterministic summarizer; crash before activation, reopen, no startup model request; explicit resume performs only unfinished work. |
| Product scope/memory/reference/finishing remains host policy | `agentContextualOwnerRecovery.test.ts`, `agentProjectContext.test.ts`, `memoryRetrieval.test.ts`, `materialReferenceWire.test.ts`, `agentFinishingCheck.test.ts` **native**. | Noncreative policy hook can continue/complete a candidate while real core owns next step and shared budget; generic hook tests contain no Studio entity names. | Todo scopes to its own list/workspace; no project/shot/media/creative skill dependency; optional custom finishing rule uses the same loop, not a second implementation. |
| Protocol request/stream/privacy behavior | `chatStream.test.ts` root; `responsesStream.test.ts`, `providerCacheUsage.test.ts`, `reasoningPolicy.test.ts`, `materialReferenceWire.test.ts` **native**. | Model-port events/cancel/metrics normalized; no ciphertext or key in public events. Protocol specifics belong to providers' direct tests. | Packed providers import/execute deterministic fetch fixtures outside workspace; exact request count, bounded stream/abort, secret redaction and opaque round trip. No paid request. |
| Typed tools and emitted public package closure | `tests/typecheck/agentToolDefinition.ts`, `toolValidationSafety.test.ts`, `toolValidationDiagnostics.test.ts` (the latter two **native**); architecture/quality gates. | Negative compile tests reject mismatched args/services/preview/result; package export graph rejects Studio/providers leakage from core and private-path bypasses. | `agent:example:check` builds/packs/installs into a temporary directory outside workspace, compiles and runs emitted `.js`/declarations using only declared public exports. Node >=24.11 / `node:sqlite` is example-only. |

Actual process termination/reopen must be observable in the todo harness, with synchronization on a known durable checkpoint rather than a sleep. Exercise explicit resume in a new process. An in-process re-created object or a mock reopen is not the durable restart acceptance.

Existing real-native certainty tests must keep their actual Rust probe and commit/acknowledgement assertions. New core fakes complement those tests and cannot replace them. Source discovery, Knip, lint/type coverage, architecture graphs, fixture provenance/current-source mapping and native source-identity inputs must cover all new package sources and updated consumers when implemented.

## Suggested checked slices and handoff constraints

1. After accepted child-2 context is available, record baseline and define neutral types/semantic ports plus architecture/export tests. Register every new package source immediately. Do not relocate product schema or introduce a second store owner.
2. Extract the checkpoint writer, two-pass tool state machine and full request loop into core; implement Studio semantic persistence/coordination adapters and narrow product policy hooks. Existing production regression suites must exercise these new imports.
3. Extract provider transport/parsers and continuation codec; remove product connector/reference/HTTP imports from public provider types and emitted closure. Keep request-time credential/reference/runtime transport composition in Studio.
4. Extract actual generic compaction/capability algorithms, preserving current constants and policy ordering. Retain creative catalogs/context selection/finishing policy and domain previews/results in Studio.
5. Switch all production UI/resume/recovery/terminal callers; delete the former implementation and transient bridges. Check that neither a Studio callback nor a todo copy contains a parallel loop.
6. Add the independent SQLite todo host and deterministic multi-process conformance, then run outside-workspace packed type/runtime proof. No npm publication is needed.
7. Run affected package/root/browser/actual-native gates and complete AA1–AA5 evidence. Root build/landing/model and existing standalone harness closure still apply; API compilation and example-only success cannot finish child 3.

This research leaves implementation, final API selection, lifecycle activation and acceptance to the subsequent formal child-3 dispatch. The main immediate design issue is not whether a generic interface can be named; it is ensuring core owns real state transitions while each host retains its atomic commit and product authorization boundary.
