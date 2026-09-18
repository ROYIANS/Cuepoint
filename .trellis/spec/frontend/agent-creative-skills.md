# Creative business tools and durable generation

## 1. Scope / Trigger
Read before extending creative CRUD, generation profiles, tool previews, recovery or media cleanup. This builds on [Agent tools](./agent-tools.md), [production contracts](./production-contracts.md) and [provider adapters](./ai-connectors.md). Connector/credential/configuration CRUD is outside the business tool surface.

## 2. Signatures
- `BUSINESS_TOOLS` in `lib/agent/businessTools.ts`: 33 strict tools; lightweight allowlists live in `businessToolNames.ts` to avoid settings → skills → repository cycles.
- Read: `business_search`, `business_detail`, `business_read_text`, `business_read_relations`.
- Mutations: project/episode/beat/shot/character/scene/prop/style create/update/delete; `creative_duplicate`, `creative_reorder`, `asset_copy_from_studio`, `slot_update`, `media_delete_orphan`.
- `AgentToolDefinition.requiresConfirmation?: boolean` is frozen into calls and checked against the registry; paid `submit_generation` requires confirmation under ask/assist/full. Other tools retain their policy.
- `AgentToolDefinition.prepare?(args, context): Promise<AgentToolPreview>`; context includes optional saved preview. `saveToolPreview(runId, callId, preview)` saves it once while pending.
- `executeAtomicTool(context, callback): Promise<unknown>` in `db/agentTools.ts`: local business mutation and successful result commit together. `AtomicToolRollbackError` certifies no committed business effect.
- `GENERATION_TOOLS`: `generation_capabilities`, `submit_generation`, `check_generation`, `apply_generation`, `list_generation_jobs`.
- `prepareAgentGeneration`, `submitAgentGeneration`, `checkAgentGeneration`, `monitorAgentGeneration`, `prepareGenerationApply`, `applyAgentGeneration` in `lib/agent/generationRuntime.ts`.
- Dexie v12 `agentGenerationJobs`: `id, &callId, runId, threadId, projectId, status, fingerprint, updatedAt`.

## 3. Contracts
- All six foundational skill groups default on. getGeneralAgentConfig transactionally upgrades legacy configurations without skillDefaultsVersion to version1 and enables all six once (user decision2026-09-19). New configurations persist version1 immediately. Later user switch choices, including an empty list, remain intact. New permissions/skills affect new runs; existing run snapshots and conversation-mode empty tool sets remain unchanged.
- Schemas accept explicit creative fields only. The business schema helper builds JSON and runtime validation together. Tool names in skill allowlists must exactly match the registry. Never expose arbitrary table writes, extra bags, credentials or Blob payloads.
- Resolve stable IDs with owner scope (`studio` or a real project); episodes and shots require the correct parent. Duplicate/reorder reuse repository semantics. Long content/relationships use bounded pagination; full script replacement is capped at 24,000 characters within the 32,768-character argument envelope.
- Prepare flushes relevant drafts and binds arguments, target, referenced entities/media or cascade scope to a revision. Execution flushes again before entering the database transaction, checks the revision inside it, and fails on change. Full permission does not bypass these checks.
- `atomic: true` is a code-owned snapshot, checked against the current registry. `executeAtomicTool` locks all local tables to permit nested domain repository transactions; callbacks must not fetch or await arbitrary outside work. A completed call returns its saved result instead of invoking the callback again. Serialization/ledger failure rolls back the business write.
- Media IDs are immutable: `putMedia` adds a new record. Replacement requires a new ID and association update. Studio copies validate all source media and include dependencies in the preview. Usage reads explain retained proposal/job references. Orphan cleanup protects those references.
- Generation profiles are verified subsets: APIMart GPT Image 2/MiniMax H3; AIHubMix GPT Image 2/Veo 3.1 Fast. Discovery is not account authorization. No automatic model/provider fallback. Native field mappings and sources are recorded in the task's `research/generation-profiles.md` (2026-09-19).
- Submission freezes connector identity, target/references and input-byte hashes; saves a call-unique job before POST. Existing calls reuse their job. Unresolved equivalent fingerprints prevent duplicate paid submissions across calls/tabs. Job storage never contains API keys, transient result URLs or Base64.
- Status stages distinguish remote work, local download and target application: `submitting`, `unknown`, `submitted`, `running`, `remote_completed`, `downloading`, `downloaded`, `applied`, `conflict`, `failed`. Local media and its job result commit together; target application and the tool ledger commit together. A changed/deleted target retains output as conflict.
- Recovery requires the same call/run/thread. Atomic local tools or code-declared repeatable queries may resume; generation requires a saved remote identity, local result or known failed state. **Unknown status always blocks**, even if an unexpected multi-task response supplied a first task ID. `ToolPendingError` alone is not proof of resumability.
- Query polling runs within the controller (up to 40 checks, backoff to 15s), outside the model-step budget. Exhausted waiting parks a resumable run. Closing the page stops local monitoring; explicit continuation queries saved jobs. Stop does not mean remote cancellation/refund.
- Public downloads omit credentials; protected Hub content uses the existing scoped downloader. Inspect expected image/video file signatures before saving. This is not full codec/duration validation. APIMart local reference videos remain unsupported because no upload adapter is verified.
- Project/thread deletion removes their jobs and unreferenced media. Late responses must verify project/thread/run existence before update/storage and cannot recreate deleted records. Applied slot media remains owned by its target after conversation deletion.
- UI uses flat change rows and readable approval summaries. Raw JSON stays collapsed. Persistent media results remain visible when completed step details collapse, with genuine preview/status and destination links. Never invent progress or prices.

## 4. Validation & Error Matrix
| Condition | Result |
| --- | --- |
| Foreign project/episode/media or invalid schema | Reject before mutation/POST |
| Draft save failure before local transaction | Known failure, no business mutation |
| Changed approval target/reference/cascade | Reject stale preview; reread and propose again |
| Local mutation or ledger save fails | Roll back both; report known failure |
| Crash after atomic commit | Reuse successful saved result |
| Paid submit response lost without identity | Unknown; block automatic replay/resubmission |
| Unexpected multiple remote tasks | Persist IDs as unknown; require reconciliation |
| Known job query/download/storage interrupted | Keep identity; explicit resume without POST |
| Completed output but changed target | Preserve media and conflict, do not overwrite |
| Delete thread during download | No late job/media resurrection |
| Unsupported profile/input combination | Explicit local error; no paid probe |

## 5. Good / Base / Bad Cases
Good: search project → create episode → use returned ID next round → create shots → approve one generation → store local result → approve applying the unchanged slot.

Base: ordinary conversation has no tools. Existing installations automatically gain the foundational skills once; users can subsequently disable individual skills through the plus menu.

Bad: infer entity IDs, send dependent writes in the same preflight round, mutate a media Blob under the same ID, or treat remote completion as proof of target application.

## 6. Tests Required
- `agentSettings.test.ts`: all-six fresh defaults, one-time legacy upgrade, unrelated preferences retained, later opt-outs survive reload and existing runs remain frozen.
- `agentBusiness.test.ts`: full entity chain, all asset kinds, owner validation, cascade/references, retained media, complete scalar/relationship reads, stale previews and allowlist parity.
- `agentToolTransactions.test.ts`: mutation+ledger rollback, abort, replay, ownership, immutable previews and no repeated preparation after approval.
- `agentGeneration.test.ts`: both providers/image+video, real fixture bytes, exact request mappings, no duplicate POST, crash/stop/download/storage failures, conflict, thread/project deletion, input limits and secret redaction.
- `agentGenerationRecovery.test.ts`: same-owner proof matrix, known failure without ID, unknown multi-ID exclusion, independent polling budget and retained approval.
- Browser fixture: approve project creation and observe one project/episode; render a locally saved generated image, apply it and navigate to its shot; desktop/mobile overflow check. No live paid account is required.

## 7. Wrong vs Correct
Wrong: catch every network error and submit the generation again.

Correct: persist intent first, retain any remote identity, classify known pre-submit failure separately from ambiguous acceptance, and only query an existing job on continuation.

Wrong: mutate a project and then record tool success in an unrelated transaction.

Correct: use `executeAtomicTool` with the domain repository operation so the business write and completed call are one recoverable fact.


## Generation configuration review and preferences

### Scope / Trigger
Use when changing the generation form, paid confirmation, per-kind defaults or actual execution parameters.

### Signatures
- `reviewAndApproveGeneration(runId, callId, rawArgs, expected: {arguments, revision}): Promise<void>` in `lib/agent/generationReview.ts`.
- `AgentToolCall.generationOverride?: {arguments: string; preview: AgentToolPreview}`; `readGenerationReviewCall` and `commitGenerationReview` in `db/agentTools.ts`.
- `getGenerationPreferenceState(): Promise<{preferences, issues}>`, `saveGenerationPreference(kind, value|null)` in `db/generationPreferences.ts`; storage is `AgentConfig.generationPreferences` on the existing agents table.
- `recommendGenerationSelection({kind,connectors,projectDefaults?,preferences?,preferenceIssues?,aiSuggestion?,explicitSelection?})` returns independent source/status/recommendation/issues.
- `applyGenerationSelection(draft, selection, provider)` handles explicit UI choice changes without changing target/input roles or prompt draft.
- `generation_capabilities({projectId?})` now exposes per-kind recommendations alongside verified profiles and sanitized connector identities.

### Contracts
- Keep original `call.arguments`, `call.preview`, Chat assistant tool_calls and Responses function_call envelopes immutable. User changes live in generationOverride and apply only to a confirmed submit_generation. Actual result discloses provider/model/parameters used, so the model sees the user's final selection.
- Review does no remote query/upload/paid POST. It validates original preview before/after preparing the revised draft, requires unchanged target and inputs, and CAS-commits override+preview+approve together. Require latest owned resumable run, awaiting approval, enabled generation tool, no prior decision/override/job or unknown/running sibling.
- Execution rechecks the new fingerprint immediately before submission. Approval is not permission to apply stale targets. Resume cannot bypass the confirmation flag.
- The inline form starts with AI's proposed connector/model/prompt/parameters. UI choices include only verified profiles on configured connectors. Changes replace provider-specific parameters rather than merging incompatible old fields; fixed input roles determine text/frames/reference mode. APIMart frames have no explicit ratio. Temporary empty prompt editing is preserved, but submission requires a valid prompt.
- Global defaults remember only connector/model/reusable parameters. Never remember prompt, target, references, credentials, input mode or adaptive ratio. Preferences have independent image/video entries; transactional saves preserve the other modality. Reads do not create settings or rewrite invalid stored choices. Clear works even if the saved connector disappeared.
- Recommendation order: explicit user intent, existing project defaults, global defaults, AI suggestions. An invalid/ambiguous higher-priority selection is surfaced instead of silently choosing a lower one. Project settings identify a provider, not an account: multiple APIMart connectors require disambiguation.
- AI receives recommendations in capability discovery. The form never silently replaces an already prepared proposal; one-click default application is explicit. Saving a new default happens only after successful confirmation. A preference-storage error does not revoke the confirmed request or cause another submission.
- Paid generation review is rendered inside flat step details. The form supports keyboard labels, inline errors, reset to AI proposal, cancel, optional default save/clear and responsive parameter controls. Step technical details distinguish original and confirmed parameters. Multiple pending approvals must all resolve before runtime continuation.

### Validation & Error Matrix
| Condition | Outcome |
| --- | --- |
| No confirmation, including full access | No generation submit POST |
| Original target/input/config changed | Reject review; ask for a fresh proposal |
| Edited target or reference IDs/roles | Reject; this form edits configuration only |
| Review concurrently confirmed/rejected or job exists | CAS rejection, no second decision |
| Approval write fails | Roll back override and decision together |
| Approved override + reload | Execute saved override once, preserve original envelope |
| Default connection missing/ambiguous | Explain selection problem; no hidden replacement |
| Empty prompt while changing model | Keep draft; confirmation remains disabled |
| Switching defaults with frame inputs | Preserve frame mode; remove APIMart explicit ratio |

### Good / Base / Bad
Good: AI proposes AIHubMix → user selects APIMart/16:9/2K → one confirmed POST uses APIMart and returns actual parameters.

Base: user accepts the AI proposal unchanged. Normal business tools retain existing permission behavior.

Bad: rewrite Responses call arguments to match a form edit, auto-submit in full mode, merge image-quality parameters from one provider into another, or remember a shot-specific prompt globally.

### Tests Required
`agentGenerationReview.test.ts`: all permission modes, Chat/Responses envelope integrity, real adapter payloads, CAS and stale preview/job/ownership guards. `agentGenerationReviewTransactions.test.ts`: commit failure rollback and reload/one POST. `generationPreferences.test.ts`: strict storage, priority/ambiguity, read-only failure handling, concurrent modality saves and clear. `generationReviewDraft.test.ts`: immutable context, mode derivation, provider parameter replacement and temporary prompt editing.

Browser: full mode still waits; AIHubMix→APIMart edits and prompt/16:9/2K reach exactly one POST; per-kind preference persists; keyboard/desktop/mobile form controls remain accessible.

### Wrong vs Correct
Wrong: change the model's durable function-call envelope after the user edits its arguments.

Correct: retain that envelope, atomically record a separately validated confirmed override, execute it and disclose the actual configuration in the tool result.
