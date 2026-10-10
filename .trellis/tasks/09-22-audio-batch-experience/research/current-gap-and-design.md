# Research: Current gaps and design for batch speech production

- Query: Which current audio generation, Agent approval and UI contracts can deliver R3 without duplicating submission logic, and what must be added for durable batch review, progress, Stop and retry?
- Scope: internal
- Date: 2026-10-10

## Findings

### Source requirements and actual gap

The child PRD remains a planning backlog. The parent `09-22-agent-creative-experience/prd.md` owns AC4: an 11-segment batch with 9 saved, 1 failed and 1 pending must report those exact states; reload retains progress; retry contains only explicitly approved eligible items. AC6–AC9 additionally require existing paid approval, project/revision/skill/Stop enforcement, concise desktop and narrow UX, distinct saved/selected/placed/not-auditioned states, automated coverage and a controlled real-model evaluation. These are acceptance obligations, not optional follow-ups.

There is no audio batch record or batch speech tool in the current source. Single-job generation is already durable and must be reused. Existing `agentGenerationBatches` are image/video-specific: `generationKind` selects image/video from `ProductionTarget` (`src/domain/agentGenerationBatch.ts:75`), and their job/snapshot schema is different from `AudioGenerationJob`. Reusing their queue invariants and presentation pattern is appropriate; inserting speech into that schema by casting is not.

### Files found

| File | Purpose |
| --- | --- |
| `src/domain/audioGeneration.ts` | Speech/music inputs, durable single-job lifecycle, result provenance and manual/Agent source union. |
| `src/db/audioGeneration.ts` | Unique intent preparation, CAS claim, allowed lifecycle transitions and result ownership. |
| `src/lib/audioGeneration/runtime.ts` | Existing provider submission, raw response checkpoint, real decode/save and recovery. |
| `src/lib/audioGeneration/defaults.ts` | Shared saved speaker profiles and MiMo-first connector defaults. |
| `src/lib/audioGeneration/reference.ts` | Owned clone media/container/size/fingerprint validation. |
| `src/lib/agent/audioGenerationTools.ts` | Current single paid approval, immutable preview fingerprint and same-call recovery. |
| `src/domain/agentGenerationBatch.ts` | Existing 20-request/two-worker media batch policy; unsuitable speech data model. |
| `src/db/agentGenerationBatches.ts` | Pattern for atomic drafts, confirmation, claims, failed-only new drafts and abandonment recovery. |
| `src/lib/agent/generationBatchRuntime.ts` | Pattern for lock lifetime, in-memory pause latch and draining siblings after faults. |
| `src/components/audio/SpeechControls.tsx` | Manual single speech action; pending manuscript flush and current speaker checks. |
| `src/components/audio/AudioWorkspacePage.tsx` | Existing compact chapter toolbar, manuscript, responsive inspector and timeline host. |
| `src/components/audioMusic/shared.tsx` | Existing per-job polling and job disclosure; no aggregate batch view. |
| `src/db/audioShared.ts` | Shared transaction tables, media guards, result detachment and project ownership. |
| `src/db/database.ts` | Dexie tables and latest schema v23. |
| `src/lib/audioProjectPackage.ts`, `src/lib/packages/audioPackageCodec.ts` | Audio job ZIP snapshot/import, remapping and dormant history. |
| `tests/audioGenerationAgent.test.ts`, `tests/audioGenerationRuntime.test.ts` | Paid approval, inherited speaker, uncertain submit, stored-byte recovery and partial results. |
| `tests/agentGenerationBatchSafety.test.ts` | Existing useful fault-injection queue tests to adapt. |

### Existing contracts to preserve

1. `prepareAudioGeneration` validates provider/target/clone reference and persists the complete normalized input (`src/lib/audioGeneration/runtime.ts:76`). `prepareAudioGenerationJob` replays only an exactly matching unique `intentId` (`src/db/audioGeneration.ts:39`). A batch item needs its own stable intent, not the single-call intent shared across items.
2. The single-job claim is an atomic transition from `prepared` to `submitting`, checking project, expected job revision and target revision (`src/db/audioGeneration.ts:63`). Once transport has started, ambiguity is paid uncertainty; there is no provider idempotency guarantee.
3. `submitAudioGeneration` checks twice before transport, including a caller-provided approval guard (`src/lib/audioGeneration/runtime.ts:174`). Speech checkpoints returned bytes before decode (`:221`); `refreshAudioGeneration` retries local decode/download without a paid POST (`:245`). Batch retry must distinguish provider re-generation from local processing recovery.
4. The current Agent guard requires an approved/running durable call and run and hashes arguments, target, speaker, connector credentials and clone bytes (`src/lib/agent/audioGenerationTools.ts:55`, `:127`). `speechArgs` resolves the saved segment speaker and explicit legacy APIMart choices (`:165`). Reuse/factor this normalization and fingerprinting rather than duplicating subtly different batch defaults.
5. Current generation never selects a take or places a clip (`src/lib/audioGeneration/runtime.ts:115`; `src/domain/audio.ts:30`). Batch completion must likewise keep selection and placement separate for R4.
6. Current workspace polling does GET/local recovery every seven seconds, including abandoned `submitting` jobs (`src/components/audioMusic/shared.tsx:116`). It never sends a POST. Submit and refresh both use the same per-job `locked` helper (`src/lib/audioGeneration/runtime.ts:42`), which already protects live submission from recovery in the same process and across tabs with Web Locks. Preserve that helper/lifetime in the batch path; do not preclaim a job and move paid work outside it. Without Web Locks the fallback is process-local, so a separate cross-tab batch dispatcher guard must not promise broader recovery ownership than it enforces.
7. The existing batch runtime stops dispatch in memory before attempting a pause write, holds ownership while all workers and UI writes settle, and uses `Promise.allSettled` (`src/lib/agent/generationBatchRuntime.ts:62`). A rejected sibling or pause-storage failure must not release the lock and start another dispatcher.

### Recommended architecture and policy

**Add a separate audio batch domain and repository, with the existing single audio runtime as transport.** Suggested modules: `domain/audioGenerationBatch.ts`, `db/audioGenerationBatches.ts`, `lib/audioGeneration/batchRuntime.ts`, plus focused Agent adapter and shared UI component. Add Dexie v24 batch/item tables after checking concurrent work has not already allocated v24. Do not enlarge `AudioGenerationJob` status semantics merely to encode the batch's queue status.

Recommended batch policy: one audio project and chapter; 1–20 included items; initially one request per distinct segment; two workers. These match the proven media queue and fully cover the 11-item criterion. Permit explicit segment subsets and missing-take defaults; do not silently split a >20 request into multiple paid batches or omit overflow. One bounded, explicit error lets the user choose the next subset. The limit is a local product safety policy, not a claimed provider limit.

Suggested durable batch fields: schema version, project/chapter, owner (`manual` or validated Agent thread/run/preparation call), title, revision, lifecycle (`draft`, `ready`, `running`, `paused`, `settled`, `cancelled`), ordered item IDs, confirmed item IDs/version/time, retry-source batch, pause reason and timestamps. Item fields: immutable identity, original segment ID/order/text/profile baseline, editable included flag, normalized speech input, segment/speaker revisions, connector identity/fingerprint, clone reference fingerprint, frozen confirmed snapshot, stable intent ID and actual audio job ID. Never persist keys/base64 in these records.

Treat the owner/source change explicitly. Current `AudioGenerationJob.source` only supports manual or an approved individual Agent call (`src/domain/audioGeneration.ts:56`). The recommended addition is a typed batch/item source that carries original manual/Agent provenance and cannot be submitted without the batch's durable approval guard. Update `submitAudioGeneration` to require that guard for both Agent and batch sources. Do not fabricate one synthetic paid tool call per item or label Agent-prepared batches as manual to bypass the guard. Update current output/task evidence readers alongside this union so a batch preparation is not mistaken for a submitted generation. Legacy manual and individual Agent records remain accepted unchanged.

**Preparation and approval:** model tool `prepare_audio_generation_batch` creates only an atomic local draft with `submitted:false`; `audio_read_generation_batch` reads bounded state. This mirrors the already reviewed media batch flow. Manual toolbar prepares the same draft using flushed repository inputs. User confirmation snapshots the exact included items atomically, and is the paid authorization for the batch even in full permission mode. No paid POST or audio generation occurs during draft creation/confirmation. A changed segment, speaker, clone byte fingerprint, connector destination/credential, inclusion list or draft revision invalidates confirmation and preserves the old review. Never offer a generic approval fallback for missing/malformed batch snapshots.

The direct batch confirmation must retain permission and scope semantics: require existing project/owner, current Agent thread/task ownership and relevant enabled skill, no conversation-mode bypass, compatible latest execution, and exclusive thread lock for Agent batches. Paid dispatch is a separate explicitly approved activity; original preparation calls can already be completed. Therefore do not reuse the single-tool guard that requires the preparation call to stay `running` for the whole asynchronous queue. Port the existing media batch ownership/confirmation guard, with a batch-owned job source and explicit Stop integration. Agent Stop and page teardown pause local dispatch/waits; user cancellation additionally marks never-sent items cancelled.

**Dispatch and recovery:** lock one batch dispatcher across tabs (Web Locks, fail closed if unavailable where the existing Agent ownership policy requires them; manual batches use an equivalent project/batch lock). Claim an eligible item and persist its prepared job link before sending; the unique stable intent and job claim are the final duplicate barrier. Immediately before each POST revalidate snapshot, approval, dispatch eligibility, owner and Stop. Definite provider rejection can let independent items continue. Uncertain speech acceptance pauses all new sends and remains unresolved; no automatic POST replay. In-flight siblings retain their results and finish/checkpoint before releasing ownership. A browser reload performs local reconciliation only and presents an explicit continuation action; it must not auto-dispatch paid unsent items.

Continuation first retries stored-byte processing or known GET jobs; then sends only previously confirmed, still-current unsent item identities. A stale queued input requires a new reviewed proposal, not automatic rebase. Cancel means unsent items cancelled, accepted/uncertain attempts retained, with no promise of remote cancellation/refund.

**Retry:** create a new unconfirmed draft containing only explicitly selected definitive failures eligible for re-generation. Retain original batch/item/job provenance and new unique item intent IDs. Saved, pending, uncertain, deleted saved results and recoverable local download/decode failures are not paid retry candidates. Local recovery gets its own action and does not consume new approval. If the provider failed after a submitted task, only classify it definitive from verified provider evidence; missing IDs are not such evidence. The distinction may require an explicit failure-stage field on audio jobs rather than parsing error strings.

**Storage lifecycle:** extend audio transaction tables, project deletion and late-result guards; retain clone reference media for cancelled/draft batch history; release only genuinely removed references. Decide ZIP compatibility deliberately. Recommended: audio batches are project workflow records and export as dormant historical batches with remapped chapter/segment/job/reference IDs; imported records never dispatch, confirm or poll. If choosing execution-history exclusion instead, scrub batch source links into a bounded historical provenance representation; do not leave imported jobs with dangling typed batch owners. Include this decision in design and tests.

### Minimal complete UX

- Add a compact “批量配音” action in the existing chapter toolbar. Default preview includes the current chapter's nonempty segments lacking a saved take; offer a visible subset review and make excluded/invalid entries clear. Existing single Generate remains available.
- One flat Dialog/Sheet review shows exact item/request counts and fee disclosure, text and inherited voice summaries; full inputs/details on demand. Do not invent a money estimate. Save/flush changes before confirmation and retain the draft on failure.
- One persistent progress surface shared by audio workspace and Agent: e.g. `11 段 · 已保存 9 · 失败 1 · 待处理 1`. Expand to exact per-item states, cause and result link. Distinguish queued, actively submitting, pending, saved, failed, uncertain, cancelled and local recovery.
- Distinct actions: pause, cancel unsent, continue eligible queue, recover existing output, create failed-only retry draft. No “retry all” behavior. Saved takes still show not auditioned, selected and placed independently.
- Dialog focus/Escape, keyboard inclusion controls, live status without disruptive re-announcement, and 390 px layout are part of acceptance. Use existing shadcn/default radii and no new nested card/form wall.

### Key tests and full acceptance

1. Real fake-indexeddb repositories: 1/11/20/21 limits, duplicate/foreign segments, empty inputs, strict snapshots, one atomic confirmation, stale segment/speaker/connector/reference, double-confirm race, replay and stable intent uniqueness.
2. Runtime: two active requests max; 9 saved/1 failed/1 pending exact persisted summary; reload causes zero POST; explicit continuation submits only unsent items; concurrent tabs cannot double-submit; saved/deleted outputs are never regenerated.
3. Fault injection adapted from media batch safety: acceptance write failure, pause write failure, one worker throw with another in flight, Stop before/after POST, connector change before second request, project/chapter/thread deletion, and workspace polling during live speech submission. Assert exact POST count and held lock lifetime.
4. Retry: definitive failure yields new unconfirmed subset, excluding saved/pending/uncertain/local decode recovery; explicit subset approval yields only those POSTs. Local bytes recover without POST.
5. Evidence: batch preparation is not output proof; partial results keep item/job/take/media provenance; persisted deleted history is unavailable, not “saved”; selected/placed/not-auditioned remain separate.
6. ZIP/cascade/media retention tests and all existing single speech/music approval/recovery tests.
7. Actual browser fixtures at desktop and 390 px using isolated IndexedDB and intercepted realistic providers, focus/keyboard/reload/Stop/partial/retry paths, no page overflow. Controlled real-model trace must demonstrate batch tool choice, approval/stop reasons and a genuine paid-output or explicitly documented environment blocker; fixtures alone do not close AC9.

Checks use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` per user instructions; `lint` is typecheck, and `quality`, relevant tests and build are separate checks. Research did not run these because no source changed.

### Related specs

- `.trellis/spec/frontend/audio-music.md`: source/selection separation, CAS, paid generation, MiMo/clone, recovery, package/dormant history and workspace owners.
- `.trellis/spec/frontend/agent-batch-generation.md`: queue limits, durable review, lock lifetime, pause latch, unknown/retry/deletion and narrow UX.
- `.trellis/spec/frontend/agent-tools.md`, `agent-execution.md`: immutable permission snapshots, paid confirmation, latest-run/recovery/Stop and argument/result bounds.
- `.trellis/spec/frontend/agent-write-evidence.md`, `agent-task-wrapup.md`: authoritative receipts/provenance and current result verification.
- `.trellis/spec/frontend/quality-guidelines.md`, `component-guidelines.md`, `hook-guidelines.md`: test/architecture gates and loaded versus missing live-query semantics.

### External references and versions

No external lookup or new dependency is required for this internal design. Repository `package.json` declares Dexie `^4.2.0`, React `^19.1.1`, Zod `^3.25.76`, Vitest `^5.0.1`, fake-indexeddb `^6.2.5` and Vite `^7.1.5`; these are declared ranges, not independently verified installed versions. Existing provider source adapters remain authoritative for the supported request contract; recommended batch/concurrency policy is local and makes no claim about vendor throughput.

## Caveats / Not Found

- This is research, not implementation or acceptance. No task status was changed and no provider/model request was made.
- Product decisions can reasonably use the defaults above without another user question: one chapter, 20 items, two workers, one take per selected segment, explicit retry, and no automatic selection/placement. Root should record them in design before activation.
- Concrete live acceptance still needs a selected configured model/voice connector and an approved small speech sample. Credentials, balance and browser/device capability were not inspected here. Full real microphone acceptance belongs to the integrated audio/music task.
- Parent-owned R6/R7 film batching/synchronization and remaining R8 structured music intent are separate declared backlog. Clearing/archiving the parent must not erase them or claim this audio batch delivers them; root must explicitly preserve/deliver their agreed scope.
- Concurrent R1/R2 work can change evidence/ownership helpers. Coordinate on their finalized contract and reserve schema versions jointly. The file/line citations describe the inspected snapshot and may shift after implementation.
