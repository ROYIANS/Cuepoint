# Existing generation boundaries

Date: 2026-09-19. Read-only source inspection for batch-generation planning. This records current behavior and design implications, not approved product decisions or freshly executed tests.

## Review and execution

- `src/lib/agent/generationTools.ts`: `submit_generation` is a network tool with unconditional confirmation; `check_generation` queries existing work; `apply_generation` is a separate atomic write. `list_generation_jobs` returns the current conversation's latest 30 records.
- `src/lib/agent/generationReview.ts:8`: `reviewAndApproveGeneration` revalidates the original preview before and after preparing user edits. Target and input identities cannot change through this form.
- `src/db/agentTools.ts:245`: review requires the owned resumable run, pending confirmation, no existing override/job and no unknown/running sibling. Approval and override commit together.
- `src/components/agent/GenerationReview.tsx:43`: editable form state is local React state until confirmation. Existing controls support configured connector, verified model, prompt and provider-specific parameters.
- `src/lib/agent/runChat.ts:50`: preflight prepares all calls and waits for outstanding approvals; the second loop executes each tool sequentially. `submitAgentGeneration` includes monitoring, so simply approving several calls does not provide concurrent queue execution.

Implication: grouped edits/approval need a durable reviewed item set with atomic confirmation and clear reload semantics. A batch executor must preserve existing tool envelopes, project ownership and confirmation rules rather than globally parallelizing ordinary business tools.

## Identity, recovery and cancellation

- `src/domain/agentGeneration.ts`: jobs bind run/thread/call/project, connector destination, model, target, input revisions and fingerprint. There is no batch ID, candidate ID or unsent queue state.
- `src/db/agentGeneration.ts:6`: claim deduplicates by call ID and blocks an equivalent active fingerprint. Fingerprints cease blocking once a job is failed, applied, downloaded or conflicted.
- `src/lib/agent/generationRuntime.ts:153`: the durable job is claimed before provider submission. The target is rechecked after uploads and before the paid POST. Saved jobs recover through monitoring instead of resubmission.
- `src/lib/agent/generationRuntime.ts:182`: ambiguous acceptance becomes unknown; unexpected multiple provider task IDs also require reconciliation. Existing image profiles explicitly set `n = 1` in `src/lib/agent/generationProfiles.ts:41`.
- `src/lib/agent/generationRuntime.ts:306`: monitoring retains remote identity, parks after a bounded wait and does not cancel remote work when local waiting stops.

Implication: intentional repeated candidates need separately confirmed item/attempt identity while retries keep the same identity. Do not disable fingerprint protection wholesale or assume a provider-native multi-output parameter. Queue cancellation must record unsent cancellation separately from stopping local monitoring of accepted work. Unknown outcomes must never silently become retryable failures.

## Selection and target conflicts

- `src/lib/agent/generationRuntime.ts:27`: `readGenerationTarget` computes the baseline from the entire entity, not just the requested slot.
- `src/lib/agent/generationRuntime.ts:325`: application checks the original baseline, input availability and local output, then writes the slot and job through the atomic tool ledger. Conflicts retain output.
- `src/components/agent/AgentGenerationResults.tsx:28`: persistent results display real per-job statuses and media previews plus target links. The component does not expose candidate grouping, comparison, selection or direct application controls.
- `src/db/agentGeneration.ts:50`: media and job result commit together; updates cannot resurrect deleted jobs/projects, and late queries cannot regress downloaded/applied results.
- `.trellis/spec/frontend/production-contracts.md`: existing reviewed production proposals offer guarded apply/undo, but are a separate local workflow. Reuse must be explicit; never treat current state as the original generation baseline.

Implication: applying one slot changes the baseline seen by other slots/candidates on that entity. Batch selection must account for its own authorized writes without accepting unrelated manual changes. Candidate switching after application is a distinct product choice and requires a reviewed current-state replacement contract. Unselected outputs must remain accessible and retained.

## Spending and capability boundaries

The inspected generation profile, capability tool, review UI and runtime provide verified parameter combinations and a fee warning, not a priced quote or account balance. Display actual request count, provider/model and relevant output settings; exact monetary estimates require a separate reliable data source. No provider documentation refresh or paid capability probe is needed to preserve the existing adapters during this planning step.

## Existing verification assets

`tests/agentGeneration.test.ts` covers real fixture bytes, both providers, lost responses, duplicate submissions, polling/download recovery, changed targets and inputs, concurrent same-call claims, deletion, storage rollback and secret redaction. `tests/agentGenerationRecovery.test.ts` covers durable approval and resume proof. `tests/agentGenerationReviewTransactions.test.ts` covers approval rollback and database reopen with one POST.

Batch validation must additionally exercise partial success, intentional identical candidates, unsent cancellation, concurrency bounds, cross-tab claiming, reload without new POST, grouped confirmation rollback, same-entity multi-slot application and selection conflicts. Browser verification must cover the actual comparison/selection controls on desktop and mobile using mocked providers and disposable data.

## Product decision record

1. Resolved on 2026-09-19: the user approved multiple targets with one candidate by default and up to four explicitly requested candidates per target, compared before application.
2. Resolved on 2026-09-19: the user approved 20 candidate requests per batch and at most two active items.
3. Integrated review proposal is now in PRD R7–R11 and design.md: grouped explicit confirmation, guarded switching, known-failure continuation, unknown pause, and fresh reviewed drafts for known-failure retries. It awaits final integrated planning review, not separate repeated permission prompts.

No final design or implementation readiness is implied by this evidence.

## Follow-up inspection: recovery, lifecycle and evidence

- `src/db/database.ts:184` declares a unique `callId` index for generation jobs. A single batch tool call cannot simply insert several jobs under that same call ID; batch item identity and parent-call ownership must be explicitly modeled.
- `src/db/agentToolRecovery.ts:8` resumes generation calls by reading their single job and proving known identity/result/failure. Batch recovery needs an item-wise proof, including durable unsent work, rather than applying this single-job check to the first item.
- `src/db/agentTools.ts:113` resumes only the latest run and blocks unknown calls. A batch must expose durable results without depending on resuming an old model run after later conversation turns.
- `src/db/productionProposals.ts` provides guarded replacement/undo but requires a real project (not the studio library), immutable generation source revisions and current baseline agreement. It is not a drop-in batch selection engine, especially for studio targets and sibling slots on one entity.
- `src/db/repo.ts:595` retains all job output/input media during orphan cleanup. Preserve this behavior for unselected candidates and include any newly introduced durable references in lifecycle/ownership checks.
- `src/lib/agent/wrapupEvidence.ts:50` distinguishes current applied output from historical job status by reading the actual target slot. Candidate replacement must keep this truthful: a previously selected candidate must not continue to prove the current applied result.
- `src/db/agentTaskWrapups.ts:47` blocks completion for active/unknown jobs and unresolved tool calls. New queued items, cancelled-unsent items and partial batch outcomes need corresponding evidence and completion semantics.

Confirmed execution bounds: 20 candidate requests per batch, maximum two active items within that batch. This is a product-level local queue policy, not a verified provider/account concurrency allowance. Count independent candidate requests explicitly in the confirmation interface. Larger sets can be divided into separately reviewed batches.
