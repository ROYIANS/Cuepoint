# Research: Agent state, original history and device boundaries

- Query: Which existing Agent, chat, task, approval, generation and device-configuration records must the shared persistence boundary preserve, and which guarantees must native SQLite integration retain?
- Scope: internal. This is planning research for the complete shared product; no production code, real profiles, keys, databases or provider requests were accessed.
- Date: 2026-10-11

## Findings

### 1. Design consequence

The current product already implements complete Agent execution, approvals, original tool history, business transaction ownership, same-device continuation, generation recovery and task evidence. The next task should adapt their existing persistence owner, not implement a new Agent or reconstruct business rules in Rust.

Local persistence and a portable synchronization projection have different requirements. SQLite must preserve all current local fields used by existing commands and explicit continuation, including validated opaque Responses items. A future portable codec must separately review fields and strip credentials, provider continuation and execution authority. Reusing the existing partial checkpoint fixture as a SQLite record serializer would lose essential product data.

This follows both the new task PRD and the parent decision: `.trellis/tasks/10-10-desktop-storage-sync/design.md:29` and `prd.md:97` require complete reviewed original arguments/results, rather than summary-only history, while excluding credentials, provider continuation tokens and active authority from future portable data. No synchronization or incoming-hydration owner is implemented by this task.

### 2. Files found

| File | Responsibility |
| --- | --- |
| `src/domain/agent.ts` | Agent configuration, full run snapshots, public activity, original call ledger, approval metadata and exact Responses continuation types. |
| `src/domain/types.ts:523` | Connector credentials and chat thread/message record shapes. |
| `src/domain/context.ts` | Frozen context sources, current base envelope and compaction job history. |
| `src/domain/agentTaskRecords.ts` | Typed task working records, source identities and immutable revisions. |
| `src/domain/agentTaskWrapup.ts` | Acceptance summary content, evidence snapshots, confirmation and versions. |
| `src/domain/agentFinalReview.ts` | Bounded final-claim review and one-use review state. |
| `src/domain/agentGeneration.ts` | Image/video generation job, paid intent, provider task IDs, target/input revisions and result mapping. |
| `src/domain/agentGenerationBatch.ts` | Batch confirmation, queued items, original/before/current application history. |
| `src/domain/audioGeneration.ts` | Sound paid-intent claim, uncertainty, observations, original result keys and dormant imported history. |
| `src/domain/audio.ts:45` | Sound provenance, including provider URLs requiring later portable review. |
| `src/db/agentRuns.ts` | Atomic begin/checkpoint/finalization, immutable request inputs and abandoned-run recovery. |
| `src/db/agentTools.ts` | Original tool-round save, CAS decisions/claims, ordered continuation, atomic local business/result owner and generation override confirmation. |
| `src/db/agentToolRecovery.ts` | Code-owned interrupted-call recovery; uncertain effects remain blocked. |
| `src/lib/agent/runChat.ts` | Existing single execution loop, serialized streaming writer and once-only tool dispatch. |
| `src/lib/agent/runOwnership.ts` | Per-thread Web Lock and lock-aware startup recovery. |
| `src/db/agentTaskRecords.ts` | Source proof, record revision CAS and version writes inside caller transactions. |
| `src/db/agentTaskWrapups.ts` | Consistent evidence reads, guarded summary publication and completion. |
| `src/db/agentGeneration.ts` | Durable claim before paid submission, guarded job updates and atomic media/result promotion. |
| `src/lib/agent/generationRuntime.ts` | Actual paid POST boundary, once-only submission and explicit known-task recovery. |
| `src/db/audioGeneration.ts` | Intent deduplication, revision CAS, device-local claim and guarded sound transitions. |
| `src/lib/audioGeneration/runtime.ts` | Raw speech checkpoint before decoding and atomic sound-output promotion. |
| `src/db/connectors.ts`, `src/db/searchConnections.ts` | Device-only secrets, connector rotation/deletion and search-setting/skill atomic coupling. |
| `src/db/agentSettings.ts` | Stable general Agent ID, default permissions and skill/context settings. |
| `src/db/cascadeCommands.ts:88` | Thread deletion cascade, retained dormant sound history and media-orphan checks. |
| `src/db/taskGenerationEvidence.ts`, `src/db/taskAudioGenerationEvidence.ts` | Original owned execution proof and current deliverable availability. |
| `src/lib/audioGeneration/outputEvidence.ts` | Sound file/provenance/selection/timeline evidence and database-error distinction. |
| `src/lib/agent/finalReviewEvidence.ts` | Current-output and historical-receipt fingerprints for bounded final review. |
| `src/lib/checkpoint.ts` | Explicitly partial project/media fixture codec; no production Agent/history codec. |
| `src/lib/productStorage.ts`, `src/lib/runtimeIdentity.ts` | Fixed trusted startup data owner, separate browser/native identity and no failed-write fallback. |
| `src/components/agent/FloatingComposer.tsx`, `ChatWorkspace.tsx` | Device send-shortcut preference and session-only sidebar preference. |
| `src/components/music/MusicWorkspacePage.tsx`, `draftVariants.ts` | Local music-variant links; draft bodies already persist in database. |

### 3. Current Agent and history field inventory

The following is a local-persistence inventory, not a finished portable whitelist. Every listed field must keep its existing semantics in fresh native storage. Original argument and result strings are data: do not parse/re-serialize them as a storage optimization, replace them with summaries, normalize whitespace or reconstruct them from current entities.

| Record | Field groups | Source / consequence |
| --- | --- | --- |
| `AgentConfig` | `id`, `name`, `instructions`, `updatedAt`; `permissionMode`, `enabledSkillIds`, `skillDefaultsVersion`, `generationPreferences`, `contextPolicy` | `domain/agent.ts:9`. Global live settings affect new runs; frozen old-run settings remain immutable. |
| `ChatThread` | `id`, `title`, `createdAt`, `updatedAt`; `projectId`, `taskMode`, `contextPolicy`, `interactionMode`, `connectorId`, `model`, `reasoningSelection`, `excludedMemoryIds` | `domain/types.ts:540`. `reasoningSelection` includes connector ID/base URL/model/value. Studio-global and project-bound conversations both matter. |
| `ChatMessage` | `id`, `threadId`, `role`, `content`, `createdAt`; `status`, `runId`, `error`, `reasoning`, `reasoningDurationMs`, `attachments`, `referenceContext` | `domain/types.ts:560`. Errors stay separate from public answer text; partial output remains readable after interruption. |
| `AgentToolCall` identity/order | `id`, `runId`, `threadId`, `providerCallId`, `step`, `order`, `name`, `title`, `createdAt`, `updatedAt` | `domain/agent.ts:82`. Unique run/provider-call identity and chronological order prevent duplicate execution. |
| `AgentToolCall` original/effect data | `arguments`, `result`, `error`, `effect`, `highRisk`, `atomic`, `recovery`, `requiresConfirmation` | `domain/agent.ts:83`. Original payloads and code-owned metadata are retained together. Result may legitimately be absent for unknown effects. |
| `AgentToolCall` approval | `status`, `decision`, `decidedAt`, `preview`, `generationOverride` | `domain/agent.ts:100`, `db/agentTools.ts:395`. User-edited generation arguments/preview live in a separate override; original arguments and provider envelope never change. |
| `AgentRun` identity/frozen ownership | `id`, `threadId`, `projectId`, `taskId`, `agentId`, `agentSnapshot`, `userMessageId`, `assistantMessageId`, `retryOfRunId`, `createdProjectBinding` | `domain/agent.ts:175`. One-time created-project binding links exactly the originating call, not arbitrary later authority. |
| `AgentRun` frozen dispatch | `model`, `reasoningEffort`, `protocol`, `connector`, `requestMessages`, `permissionMode`, `interactionMode`, `taskMode`, `enabledToolNames`, `toolLoading`, `offeredTools`, `skillInstructions` | `domain/agent.ts:195`. `connector` is ID/provider/base URL only, never API key. Registry metadata, supplied tool set and per-step offers stay exact. |
| `AgentRun` context/history | `context`, `projectContext`, `visionCapability`, `referenceAudit`, `memorySelection`, `memoryAudit`, `activitySteps`, `plan` | `domain/agent.ts:176`. Frozen fact/reference/memory bodies and public model activity are inspectable original history, not recreated from current records. |
| `AgentRun` same-device continuation | `responseItems`, `continuationMessages`, `finalResponseStep` | `domain/agent.ts:202`, `:220`. Responses reasoning items can contain `encrypted_content`; locally required for exact explicit continuation. They are not public rendered reasoning. |
| `AgentRun` state/budget/review | `status`, `modelStep`, `modelStepSegmentStart`, `pauseReason`, `hasToolCalls`, `checkpoint`, `finishingCheck`, `finalReview`, `error`, `finishReason`, `createdAt`, `updatedAt`, `endedAt` | `domain/agent.ts:184`, `:211`. Reopen cannot reset budget or create a second finishing/final review request. |
| `AgentRun` measured usage | `modelMetrics`, `usage`, `outputTokensPerSecond` | `domain/agent.ts:205`. Absent values mean unknown, not zero; per-step records remain idempotent. |
| `AgentRequestMessage` | Role-specific `content`, `tool_calls`, `tool_call_id`; optional `referenceInput`, `sourceToolCallId` | `domain/agent.ts:38`. Tool wire arguments remain exact strings and tool outputs remain exactly paired. |
| `AgentResponseItem` | Message role/content/id/status/phase; reasoning id/summary/`encrypted_content`; function-call id/call_id/name/arguments/status; function-output call_id/output; optional reference/source IDs | `domain/agent.ts:110`. Local suffix consistency checks rely on the exact stored envelope; display messages cannot recreate it. |
| `ContextSnapshot` | `policy`, `capacity`, `capacitySource`, `history`, `summaryId`, `baseMessages`, `draft`, `selectedReferences`, `memoryEnvelope` | `domain/context.ts:19`. History entries include ID/role/content and optional frozen reference context. |
| `ContextCompaction` | `id`, `threadId`, `runId`, `previousSummaryId`, `status`, `coverage`, `input`, `policy`, `connector`, `model`, `content`, `beforeTokens`, `afterTokens`, `usage`, `error`, timestamps/`activatedAt` | `domain/context.ts:33`. Original source coverage and activated summary remain separate; partial jobs must never become active summaries. |
| `AgentTask` | `id`, `threadId`, `projectId`, `title`, `goal`, `agentId`, `acceptanceCriteria`, `revision`, `plan`, `lifecycle`, `artifacts`, timestamps | `domain/agent.ts:244`. Each artifact keeps its own ID/run/message/createdAt association. Completion is an explicit guarded action. |
| `AgentTaskRecord` + version | `kind`, `claim`, `title`, `body`, `sources`, `todoId`, `id`, `taskId`, `revision`, `author`, `runId`, timestamps; version adds `versionId`, `recordId` | `domain/agentTaskRecords.ts:14`. Sources retain type/ID and sound `resultKey`; edits do not overwrite historical rows. |
| `AgentTaskWrapup` + version | `id`, `taskId`, `threadId`, `revision`, `status`, `author`, `content`, `snapshot`, `confirmedAt`, timestamps, `error`; version adds `versionId` | `domain/agentTaskWrapup.ts:42`. Snapshot retains task revision/criteria, exact evidence/fingerprint and explicit omitted/truncated coverage. |
| `AgentFinalReview` | `version`, `status`, `candidateFingerprint`, `candidateStep`, `step`, timestamps, `reason`, `snapshot`, `claims` | `domain/agentFinalReview.ts:32`. Claim spans/text/refs/typed predicates are observations; preserve them without upgrading prose to verified truth. |

Nested history must retain reference revisions, selected text envelopes, image IDs and source digest/provenance. Image bytes are resolved only at the transport boundary, not embedded in Agent snapshots (`domain/referenceInput.ts:4–38`). Memory selection/audit also stores the exact selected body, source and envelope (`domain/memoryRetrieval.ts:3–32`); its source IDs and revisions must remain resolvable.

### 4. Paid intent, generated outputs and original associations

| Record / field | Local persistence requirement | Future portable concern |
| --- | --- | --- |
| Image/video `AgentGenerationJob` | Keep version/ID/run/thread/project/call-or-batch ownership, connector ID/provider/base URL/model/kind, target, target/input/source revisions, parameters, fingerprint, status, task ID(s), provider status/progress/error, result and timestamps. | `domain/agentGeneration.ts:20–53`. A provider task ID is a historical fact, but cannot authorize receiving-device resume/POST. No API key is stored here. |
| `GenerationBatch` / items | Keep original proposal, user draft, baseline and confirmation snapshot; included/confirmed/claimed state; selections, entity revisions, prior/current application results and all ownership IDs. | `domain/agentGenerationBatch.ts:12–64`. Confirmations and claimed queue items become history, not incoming permission. |
| Sound `AudioGenerationJob` | Keep AudioRow identity/project/revision/timestamps; intentId/input/connector/source/status/task IDs/observations/results/error/failureStage/referenceFingerprint/claim/dormant. | `domain/audioGeneration.ts:53–69`. `claim.owner`/claimedAt are local execution authority. Dormant history cannot submit or poll automatically. |
| Sound result | Keep key/provenance/title/lyrics/finalTextPreview/duration/media/take/work mapping/deleted/error. Deleted-work tombstones prevent recreation during later recovery. | `domain/audioGeneration.ts:38–50`. Result URLs in provenance may be signed or transient; require explicit future per-field portable handling. |
| Sound provider provenance | Keep provider/model/taskId/clipId/audioIndex/jobId/audioUrl/coverUrl locally. | `domain/audio.ts:45`. Original result index is provider position, not current UI ordering. URLs cannot be blindly classified as nonsecret. |
| Original tool `result` strings | Preserve full current strings, including receipts, recovery certainty, output IDs, record snapshots, truncation/coverage disclosures and returned job state. | A future codec must audit family-specific nested fields; a `Record<string, unknown>` / JSON string is not an approved generic portable bag. |

`db/agentTaskRecords.ts:48–76` requires task-owned user messages, completed original non-bookkeeping tool effects or genuine generation sources. Tool-call success, a plan checkbox or a provider status GET does not itself prove completed output. Native integration must preserve these same business evidence readers and the full associations they use.

Raw speech bytes are checkpointed before decoding (`lib/audioGeneration/runtime.ts:229`), and promotion commits media, take/work and job-result mapping together (`:98–142`). Image/video media and downloaded job result are likewise one transaction (`db/agentGeneration.ts:53–68`). A file backend must stage complete verified bytes before any of these records become a ready result; nested commands must not independently commit half of the mapping.

### 5. Device-only state and its current storage

| State | Actual storage / fields | Recommendation for this task |
| --- | --- | --- |
| Provider connectors | `connectors` and `connectorAliases`, both `ConnectorConfig` containing API key (`domain/types.ts:523`, `db/database.ts:101–104`). | Device-local namespace/ownership. Preserve existing configure/rotate/delete APIs. Do not include either table in a future portable checkpoint. Local persistence is allowed; portability is not. |
| Search configuration | `searchConnections` contains Tavily API key, enabled flag, revision and timestamp (`domain/search.ts:1–9`). | Device-only. Configured/current-origin checks continue to read the actual current saved configuration. |
| Frozen connector references | Thread/run/job connector IDs, model selection, provider/base URL. | Locally retained, with keys still resolved at dispatch (`db/agentRuns.ts:30–41`). Their future portable metadata mapping needs its own designed credential-handle resolution. |
| Responses continuation | Run responseItems including encrypted reasoning, continuation chain, same-device resumable state. | Locally persisted fully. Future synchronization excludes provider continuation authority/tokens; distinguish public historical content from executable envelopes. |
| Active execution | Web Lock ownership, AbortControllers, in-memory queue/busy state; durable call running/approved state and sound job claim. | Do not serialize live controllers/locks. Persist required local checkpoints/claims, recover under the existing lock, never transfer them as authority. |
| Native identity/paths | Frozen trusted profile and absolute app-data/workspace root. | Device-only and fixed at startup. No preference/URL-driven owner switch and no write-failure fallback to IndexedDB (`productStorage.ts:19–49`). |
| Agent send shortcut | `localStorage["cuepoint.agent.sendShortcut"]`, Enter versus Mod+Enter (`FloatingComposer.tsx:237`, `:461`). | Remains a device presentation preference; it is not workspace business data. |
| Sidebar collapsed | Session storage under `SIDEBAR_COLLAPSED_KEY` (`ChatWorkspace.tsx:26–37`). | Session-only preference; no need to add to workspace SQLite. |
| Music variant links | `localStorage["cuepoint.music.variants.<projectId>"]`, draft-ID/variant associations (`MusicWorkspacePage.tsx:64–71`, `:111–118`). | **Not equivalent to a generic UI preference.** Bodies are already durable drafts, but alternate-variant navigation uses these links. Record this exception in the overall inventory; move fresh links into shared product persistence or explicitly retain/profile-isolate and validate the relationship. Do not claim every product association is SQLite-owned while overlooking it. |
| Draft editors/selections | Component/local pending drafts and submission guards. | Remain ephemeral where currently intended; existing explicit flush-before-write boundaries still apply. Do not infer a new persisted unsent-chat-draft feature. |

The repository stores connector secrets locally already; this research does not establish an OS keychain, encryption-at-rest, new credential vault or portable secret format. A proposed database layout must document device-local scope and must never synchronize the live database file. It must not claim that an API-key-free run means every original tool result or user-authored string is universally secret-free.

Fresh development does not require reading old IndexedDB to carry data or keys forward. New native configuration should use the existing connector page/commands. Do not silently import an existing profile or inspect its secrets as part of research or acceptance.

### 6. Atomicity / CAS / recovery contracts to preserve

| Boundary | Existing code pattern | Required native consequence |
| --- | --- | --- |
| Begin a run | `db/agentRuns.ts:68–202`: one write transaction creates user+assistant+run, optionally nested task/default Agent, then updates thread. History is read within the transaction. | Preserve one owner and snapshot. Never create message and run through unrelated commits or stale React data. |
| Streaming | `agentRuns.ts:205–214` monotonically checks checkpoint; `runChat.ts:45–81` coalesces and serializes output; finalization at `agentRuns.ts:217–234`. | Final flush awaits durable checkpoint; terminal state cannot return to running. Failed writes abort transport and surface a save error. |
| Original tool round | `agentTools.ts:105–147`: full wire envelope + immutable ledger rows + public activity + Responses envelope commit together, before invoking any tool. | Unique `(runId, providerCallId)`, consistent exact arguments, no streaming-fragment execution, no detached insertion races. |
| Approval | `agentTools.ts:173–187` validates latest run/owner and awaiting state, then saves one decision; `:395–422` commits reviewed generation override and decision together. | SQL/storage CAS must reject double/foreign/stale decisions. Reopen retains pending approval without dispatch. |
| Execution claim | `runChat.ts:171–187` rechecks code-owned metadata/permission, CAS claims pending/approved -> running, executes, then saves result. | Multiple windows/callers cannot both claim. A JSON row read + blind independent put is insufficient CAS. |
| Atomic local tool | `agentTools.ts:340–368`: outer transaction covers `db.tables`, nested business writes, result serialization/limit and final ledger update. | Existing shared command transaction remains one SQLite commit. Receipt/history/result serialization failure or precommit cancellation rolls back all nested effects. Do not open independent nested Rust commits. |
| Unknown paid effect | `runChat.ts:188–204` distinguishes proven atomic rollback from ambiguous write/network effects; uncertain jobs stay unknown. | Commit outcome/error certainty must be truthful. IPC timeout after potential native commit is not automatically proof of rollback. Preserve read/reconcile paths and do not wrap all errors as `AtomicToolRollbackError`. |
| Explicit continuation | `agentTools.ts:190–259` checks latest owner, rejects unknown/running/awaiting, appends each ordered tool result once; Responses exact call/output pairs validated. | Same-device resume uses saved result/envelope; completed tools never rerun. Budgets reset only at an explicitly continued structured segment pause. |
| Startup ownership | `runOwnership.ts:19–40` acquires/probes the thread lock; `agentRuns.ts:237–265` reconciles abandoned state and crash-before-park approval. | Preserve actual lock exclusivity and release. No heartbeat timeout invalidation of live owners; no startup HTTP/tool submission. |
| Paid job | `agentGeneration.ts:10–25` commits intent before HTTP; `generationRuntime.ts:198–279` validates current durable owner/connector then starts one POST. | Network/hashing/uploads are outside write transactions. Known task IDs survive downstream failure; reopening or repeated resume never creates another POST. |
| Sound intent | `audioGeneration.ts:39–81` deduplicates intent and CASes revision/claim/status. | Preserve source binding and transition matrix; no second claim for prepared/claimed/dormant work. |
| Task records | `agentTaskRecords.ts:79–119`: validate evidence, revision CAS, write record+immutable version+task timestamp. | One transaction with caller tool result where used as an Agent tool. A failed version write cannot leave a revised main document. |
| Summary/completion | `agentTaskWrapups.ts`; spec `agent-task-wrapup.md:26–87`: one consistent source snapshot; HTTP outside transaction; guarded publication/confirmation/current evidence. | Preserve source fingerprints and read snapshots. Do not split completion into independent data writes or drop the consistent transaction to avoid adapter constraints. |
| Bounded checks | `agentFinishingCheck.ts:42–103`; `agentFinalReview.ts:26–82`. | Durable once-only finishing/review markers plus budget reservation. Original public text and exact Responses final envelope remain, review is not replayed on startup. |
| Deletion | `cascadeCommands.ts:88–118` removes owning chat/task/run/call history in one transaction; audio source history is retained dormant; orphan checks include historical before/result/input refs. | Late requests cannot reinsert deleted owners. Garbage collection respects history, nested provenance and surviving logical references. |

#### Device/workspace physical separation has a real transaction consequence

`saveSearchConnection` updates a device secret and enables the Agent research skill in one current transaction (`db/searchConnections.ts:12–30`). `beginAgentRun` and `executeAtomicTool` use all current tables, with nested settings and readers. Generation's final guard reads current connector configuration within the same read snapshot (`generationRuntime.ts:207–220`).

If the implementation physically separates device tables into a different database/service, these operations cannot simply become independent commits or reads and retain their old guarantees. Either retain one local transactional owner with explicit device/workspace table classifications, or design and prove the coordination boundary. A future transport still receives only reviewed projections, never the local SQLite file. Device-local is a portability/security scope; it does not require an improvised second transactional owner.

#### Availability and storage errors need a shared seam

Image/video evidence requires a real nonempty Blob with correct owner/type (`taskGenerationEvidence.ts:64–69`), then checks the actual current legal slot (`:114–123`). Sound evidence reads actual output/provenance/media, rejects missing/empty/foreign bytes, and separately validates current selection/placement (`outputEvidence.ts:53–136`). A metadata-only placeholder carrying the declared positive byte size would falsely establish availability after a managed file is deleted.

`outputEvidence.ts:125–130` currently propagates database errors only when they are `Dexie.DexieError` or `DOMException`; other clip-validation exceptions become unavailable placement. SQLite/IPC errors need an adapter-independent distinguishable storage-error contract at this boundary. Otherwise a database read failure may be treated as a successful complete inventory with fewer placements. Preserve logical missing-media records and original history, while explicit availability reads report missing bytes and real storage failures propagate.

### 7. Explicitly deferred portable/history work

`lib/checkpoint.ts:6–9`, `:30–33`, `:51` supports only `cuepoint.protocol-fixture.v1`, schema 1, partial coverage with `project` and `media` records. It has no production chat, Agent, task, job, setting or full-history codec. The checkpoint spec explicitly disclaims all durable-table coverage (`.trellis/spec/frontend/checkpoint-protocol.md:55`).

For later synchronization, record the following review backlog, without implementing it here:

1. Review original arguments/results per tool family, including arbitrary nested result text, URLs and historical associations; do not drop unreviewed bags while claiming complete history.
2. Split or explicitly project historical display/approval facts from live run status, claims, resumable provider envelopes, loaded/offered tool authority and confirmation snapshots. Incoming history must be dormant, unable to approve/claim/submit/retry.
3. Define portable nonsecret connector metadata and device-side credential resolution; receiving-device credentials are independently configured.
4. Review signed/transient result/discovery/provenance URLs, diagnostic fields and opaque provider envelopes separately. Preserving original local records does not authorize transporting every raw field.
5. Define original-history completeness and explicit omission evidence, retaining references and immutable binary versions needed by history; keep source bodies distinct from bounded UI/context previews.

No production codec, synchronization provider, remote hydration, account, multiuser concurrency, paid replay mechanism or old-data migration is needed to finish the current local SQLite task.

### 8. Acceptance recommendations

Use the unchanged existing Agent runtime/commands against both adapters, and validate the native adapter through actual Rust SQLite transactions plus the packaged shared product. Fake IndexedDB passing is useful browser coverage but insufficient native persistence evidence.

| Scenario | Required proof |
| --- | --- |
| Full original record round-trip | Persist/reopen both protocols with exact argument/result strings, generation overrides, approval decisions, source IDs/revisions, public activity/reasoning, opaque same-device response continuation, task records and versions, usage/review markers. Compare before/after semantic field snapshots and exact original strings. |
| Atomic business failure | Inject failure after nested project/episode/shot or sound writes but before final tool ledger/history write. Assert no partial business effect, no completed result and no success receipt. Cancellation/result overflow must also roll back. |
| Approval crash/race | Crash/reopen after awaiting call but before parking run; recover waiting state under lock, zero requests; mixed approve/reject survives; double/stale/foreign approval rejected. |
| Claim race | Two calls/windows attempt one tool or sound intent; exactly one durable claim, one execution/paid fake-provider submission. |
| Streaming persistence | Out-of-order checkpoints do not overwrite newer/terminal output; final flush awaited; failed write aborts stream and preserves last durable text with error. |
| Resume/restart | Saved completed business result and continuation survive native process reopen; explicit resume uses original result once. Unknown paid outcome blocks continuation, repeated resume/reopen has zero extra POST. |
| Known remote recovery | Persist provider task ID, fail after submission/checkpoint; explicit recovery can issue existing GET/download only, never a new paid POST. Preserve siblings, original result index and deleted-output tombstones. |
| Context/reviews | Atomic shorter-summary activation retains exact sources and Responses suffix; interrupted summary/final review never auto-retries; segment allowance and once-only markers survive reopen. |
| Current output evidence | Remove managed bytes while retaining media/job/take/work/slot records. History remains readable; availability/completion evidence becomes unavailable, selection/placement claims are not fabricated. Inject database/IPC read error and require explicit failure, not a clean missing inventory. |
| Deletion and late result | Delete owning chat/project during pending request; late output cannot resurrect owner/run/ledger; retained audio project sources are dormant; history-aware orphan cleanup preserves referenced files. |
| Device-only isolation | Fresh native profile neither reads browser/old native IDB nor carries secret records into any workspace portable projection. Connector rotation/deletion and native HTTP origin policy remain functional through current saved configuration. No key appears in run/receipt/error snapshots. |
| Settings/localStorage exception | Reopen restores Agent defaults and source-owned task data. Send shortcut/sidebar remain intended local preferences; music alternate-variant links retain their designed fresh persistence association. |
| Full UI/function reuse | The same actual Agent page, loops, business tools, source/evidence UI, approvals and Task inspector execute through adapter selection. No native-only reduced Agent, alternate command implementation or hidden IDB fallback. |

Existing focused tests to reuse/extend:

- `tests/agentRuns.test.ts`, `agentRunReview.test.ts`: atomic begin, checkpoint, lock/recovery, immutable request and save failure.
- `tests/agentTools.test.ts`, `agentToolsReview.test.ts`: permissions, segments, approval crash window, mixed decisions, owner lock, late deletion and unknown precedence.
- `tests/agentToolTransactions.test.ts`: nested domain+ledger commit, injected final-ledger failure, cancellation, result overflow and exact replay.
- `tests/agentGenerationReviewTransactions.test.ts`: approval+override rollback and database reopen executes the reviewed request once.
- `tests/agentContextualOwnerRecovery.test.ts`, `agentGenerationRecovery.test.ts`: typed certainty, original arguments, known paid intent/reopen with zero new POST.
- `tests/agentTaskOrchestration.test.ts`, `agentTaskOrchestrationReview.test.ts`, `agentTaskWrapup.test.ts`: full task tool loop, evidence revisions, summary ownership/CAS and guarded completion.
- `tests/contextManagement.test.ts`, `agentFinishingCheck.test.ts`, `agentFinalReview.test.ts`: exact continuation/history, atomic summary/check markers and no replay.
- `tests/agentGenerationEvidence.test.ts`, `audioGenerationRecoveryAudit.test.ts`, `audioGenerationRuntime.test.ts`: real output mapping, unavailable/foreign/removed bytes, sibling recovery and retained tombstones.
- `tests/helpers/workspaceBinaryFixture.ts`: history-aware binary-reference inspection supplements, but does not substitute for, the complete current task's table/byte inventory and real file-owner crash tests.

Test fixtures should use isolated synthetic state and a local fake provider with exact request-count assertions. Storage integration does not require new paid-provider purchases merely to re-prove unchanged transport. If a concrete transport/storage interaction requires a real sample, record it separately; never imply fake transport proves provider or acoustic quality.

## Related Specs

- `.trellis/workflow.md`: task is planning; writes allowed here only in this research directory for the dispatched researcher.
- `.trellis/spec/frontend/native-product-runtime.md`: fixed startup owner, single shared product/runtime, no fallback/mirror, same Agent business/result transaction and no paid replay.
- `.trellis/spec/frontend/agent-execution.md`: immutable begin/checkpoints, lock ownership, interrupted recovery and contextual certainty.
- `.trellis/spec/frontend/agent-tools.md`: original envelope/ledger, permission snapshots, CAS approvals/claims, budget segments and exact Responses continuation.
- `.trellis/spec/frontend/agent-context.md`: protected live chain, exact compaction source prefix and atomic activation.
- `.trellis/spec/frontend/agent-tasks.md`: atomic task/record/version/result, true effect sources and manual lifecycle boundaries.
- `.trellis/spec/frontend/agent-task-wrapup.md`: consistent evidence snapshot, genuine current outputs, source fingerprints and guarded confirmation/completion.
- `.trellis/spec/frontend/agent-write-evidence.md`: atomic historical direct receipts, truthful coverage, bounded one-use final review and unchanged prose.
- `.trellis/spec/frontend/workspace-storage.md`: internal independent copied bytes, missing logical records retained and history-aware binary closure.
- `.trellis/spec/frontend/checkpoint-protocol.md`: current fixture is explicitly partial; production codecs remain future work.
- Parent `.trellis/tasks/10-10-desktop-storage-sync/prd.md` / `design.md`: full reviewed original history, device exclusions, incoming dormant authority and fresh development.

## External References / Versions

No new external behavior or API is proposed by this internal field/ownership audit, and no external source was required. Package declarations inspected locally: React `^19.1.1`, Dexie and dexie-react-hooks `^4.2.0`, `@tauri-apps/api` `2.12.2`, HTTP JS/Rust plugin `2.8.2`, and Tauri Rust `=2.12.2` (`package.json:39–53`, `desktop/tauri/src-tauri/Cargo.toml:33–35`). Range declarations are not a claim about the installed lock resolution. Binding/SQLite/file-worker implementation and external documentation verification belong to the other native-storage research topic.

## Caveats / Not Found

- This is a source audit and acceptance recommendation, not implemented SQLite behavior or a passing-test report. No test suite/provider was run and no actual user profile/secret/database was read.
- The partial checkpoint codec contains no full production-history sanitizer or remote hydration authority. This task must not advertise full synchronization coverage.
- Per-field/family portable secrecy review is deliberately deferred. Local exact original strings may contain user-authored content, transient provider URLs or fields requiring future review; the absence of an API key field is not a universal secrecy guarantee.
- The shared database includes local secrets and cross-domain atomic commands today. Physically splitting owners needs proven coordination; reducing atomicity to avoid that work is unacceptable.
- Original local Responses continuation is required by current same-device explicit resume, while future portable continuation exclusion is required by the parent. Those requirements coexist; do not sanitize local persistence using portable rules.
- Existing legacy repair/upgrades in shared browser code are not requirements to implement SQLite historical readers. Fresh native storage is the explicit user default; do not add native migration/backfill/import of existing IDB/prototype state.
- Error-class and real-byte availability seams are concrete adapter risks. They require tests at the actual evidence readers, not only table round-trip tests.
- Only the focused Agent/device boundary is owned by this report. General table/query inventory and Rust/file lifecycle are separate research files, so this report does not claim the complete schema/transaction/file audit by itself.
