# Batch generation implementation plan

Status: completed on 2026-09-19. Approved work commits: e6e3f94 (feature), 2903466 (contracts and validation). Child archival and session journal follow these commits.

## 0. Planning and activation

- [x] Reuse existing child and verify prerequisite, actual source contracts and initial clean checkout.
- [x] Record user-approved 1–4 candidates, at most 20 requests and two active items.
- [x] Write converged PRD, design, execution plan and curated context manifests.
- [x] Present integrated summary and obtain final planning approval.
- [x] Run `python3 .trellis/scripts/task.py start .trellis/tasks/09-19-agent-batch-generation` with session identity if requested by the script.
- [x] Load Phase 2.1; dispatch `trellis-implement` per Codex auto mode. Start the prompt with the active task path, assign explicit file ownership, prohibit nested implement/check dispatch and reverting others' edits.

## 1. Domain, persistence and ownership

- [x] Add batch/item domain types, strict proposal/limit validation and typed job-owner union.
- [x] Add tables/indexes preserving sparse single-call uniqueness and adding batch-item uniqueness without legacy rewrite.
- [x] Implement draft creation+tool ledger, CAS draft edits, clone/remove/deselect, atomic confirmation and queued cancellation. Keep Blob hashing outside transactions.
- [x] Extend deletion/table scopes, draft input ownership, retained results and late-result rejection before enabling submission.
- [x] Test limits, foreign targets/media, replay, competing confirmation, failed storage rollback, sparse identity and deletion/GC.

Owners: new batch domain/repository modules; existing `domain/agentGeneration.ts`, `db/database.ts`, `db/agentGeneration.ts`, `db/repo.ts`, plus media usage projections identified by search. Components never write tables directly.

## 2. Shared provider executor and queue

- [x] Factor owner-aware validated operations from `lib/agent/generationRuntime.ts`; preserve single-tool public wrappers and provider payloads.
- [x] Implement atomic item claim, pre-POST checks, bounded two-worker queue and same-batch intentional-candidate dedup exception.
- [x] Implement known failure continuation, unknown pause, known-job query/download recovery, polling park and cooperative cancellation.
- [x] Integrate thread locks, lock-aware abandoned recovery, navigation abort and actions after the origin run completes.
- [x] Retry definitively failed items only through a fresh reviewed draft.
- [x] Run existing single-generation/review/recovery suites and batch exact-POST/concurrency/reopen tests before UI work.

Owners: narrow generation-core extraction/new batch runtime, batch repository and necessary recovery/page controller wiring. Do not parallelize general tool execution.

## 3. Agent tools, selection and task evidence

- [x] Add bookkeeping `prepare_generation_batch` and read-only `read_generation_batch`; update media skill and strict allowlist/schema tests.
- [x] Keep both chat protocol envelopes immutable; preparation reports submitted:false and never contacts providers.
- [x] Implement selection, entity-group apply transactions, proven revision chain, candidate switching and truthful partial conflicts.
- [x] Block batch selection bypass through single apply/generic Agent slot writes; preserve explicit manual editor behavior.
- [x] Extend task provenance, evidence/fingerprints and completion blockers for draft/queue/output/current application.
- [x] Test sibling slots, A→B→A switch, replay, external edits, missing media, transaction rollback and old application evidence.

Owners: generation tools/skills, batch apply repo, relevant business-tool result boundary, task record/wrap-up repositories/evidence and tests.

## 4. Review and comparison UI

- [x] Extract only necessary shared configuration fields from `GenerationReview.tsx`; retain single-job behavior.
- [x] Add compact persistent batch progress and expanded review/comparison. Do not duplicate batch jobs in the single-result list.
- [x] Preserve drafts on live updates/save errors; flush before confirmation; show exact candidate request count and real parameters/fee notice.
- [x] Implement grouped previews, selection/apply/switch, partial outcomes, pause/cancel remaining, existing-job recovery and new-draft retry.
- [x] Verify keyboard/focus, nested Escape, touch actions, reduced motion, 1440px/390px layout and no horizontal overflow/nested borders.

Owners: new Agent batch components, shared generation form, `AgentGenerationResults.tsx`, `AgentRunDetails.tsx`, `AgentChatPage.tsx` and scoped CSS. Preserve established theme and transcript scrolling.

## 5. Verification and independent review

Use explicit machine pnpm; never Codex Runtime pnpm or unnecessary dependency installation.

```bash
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/agentGeneration.test.ts tests/agentGenerationRecovery.test.ts tests/agentGenerationReview.test.ts tests/agentGenerationReviewTransactions.test.ts tests/generationReviewDraft.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
```

Add focused batch repository/runtime/application tests and run them by exact file path. Final gate:

```bash
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
git diff --check
```

- [x] Prove two active items maximum, four intentional identical candidates, exact POST counts, no pre-confirm upload/POST, crash boundaries, no startup HTTP, cross-tab exclusion, partial/unknown/cancel races.
- [x] Native browser fixture: isolated IndexedDB and mocked providers with real media bytes; actual tool draft → edit → confirm → queue → reload → compare → apply/switch → manual conflict.
- [x] Cover both provider mappings and Chat/Responses integration, later-turn batch access, mobile/keyboard and native transaction/evidence behavior.
- [x] Main session independently validates browser UI; save reproducible scripts/screenshots and exact outcomes.
- [x] Dispatch independent `trellis-check` over full changed scope; verify findings and rerun affected checks after fixes. No nested agents or commits from implement/check agents.
- [x] Record `validation/quality.md`; no paid calls needed.

## 6. Parent integration and finish

- [x] Verify parent AC0–AC5 using actual Task A → reviewed summary → promoted memory → Task B → batch selection/output → current evidence. Record remaining gaps explicitly; child completion does not automatically complete parent.
- [x] Update executable frontend specs/index and retrospective for identity, recovery, selection and evidence lessons.
- [x] Propose session-owned logical work/docs commits, follow approved commit/archive/journal order; no push implied.
- [x] Archive child after verification/authorized commits and update parent with exact integration status.

## Rollback checkpoints

Tables/drafts may land before submission is enabled. Hold new tool/UI until queue ownership and recovery tests pass. A single-job regression returns to the local shared-core refactor; never weaken guards to force batch success. Disable new submission entry points on regression while preserving accepted/unknown jobs and local media for retrieval. Never compensate storage/network failures with a new paid POST or database deletion.
