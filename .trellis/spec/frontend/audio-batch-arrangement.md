# Voice batches and reviewed placement

## 1. Scope / Trigger
Read for audio voice batches, bulk take selection, real-duration placement, history, Agent tools, output provenance or v24 ZIP/lifecycle changes. This contract covers 1–20 voice units per action and two concurrent submissions. Musical arrangement remains deferred.

## 2. Signatures (API / DB)
`audioGenerationBatches` and `audioGenerationBatchItems` retain `AudioRow` identity/revision/timestamps. A batch owns `chapterId`, owner, ordered `itemIds`, exact `confirmedItemIds`, `confirmedAt`, status and optional retry source. Items retain immutable speech/connector/speaker/reference snapshots, stable unique intent and optional linked job. `audioArrangementProposals` owns a frozen before-document, choices/items/request, owner, fingerprint and applied receipt.

Actual entry points:

```ts
prepareAudioGenerationBatch({projectId, chapterId, segmentIds, connectorId?, title?, owner?, retrySourceBatchId?});
includeAudioBatchItem(projectId, batchId, revision, itemId, included);
confirmAudioGenerationBatch(projectId, batchId, revision);
startAudioGenerationBatch(projectId, batchId, options?);
stopAudioGenerationBatch(projectId, batchId, "pause" | "cancel");
recoverAudioGenerationBatch(projectId, batchId, options?); // no paid POST
retryFailedAudioBatch(projectId, batchId, itemIds);
previewAudioSelection(projectId, chapterId, choices, owner?);
previewAudioArrangement(projectId, chapterId, request, owner?);
saveAudioArrangementProposal(proposal);
applyAudioArrangementProposal(projectId, proposalId, revision, owner?, signal?);
revertAudioArrangementProposal(projectId, proposalId, revision, signal?);
ownedAgentAudioBatchJob(job, {runId, threadId, projectId, taskId?});
```

## 3. Contracts
**Prepare and confirm.** Flush drafts before preparation/confirmation. Default selection is only segments without takes; users can choose an explicit subset. Invalid chosen units produce a numbered error, never quiet skipping. Snapshot actual project/chapter/segment revision, speaker profile, text, MiMo mode/settings, connector identity/revision and reference bytes fingerprint. Details show complete frozen settings, model, reference identity and fingerprint; credentials/raw Blobs are excluded. Preparation is not paid approval. Only the real batch confirmation freezes exact included IDs and starts dispatch. Agent `prepare_audio_generation_batch` records a draft and stops for that UI confirmation; model confirm flags cannot bypass it.

**Dispatch.** Reserve the local worker before awaiting the batch Web Lock, but authorize concurrent controls only after `ownsLock` becomes true in its acquired callback. Manual ownership uses a batch lock; Agent ownership also retains the thread lock. Missing Web Locks fails closed. Keep at most two workers, latch pause before persistence, drain all running workers/actions before releasing ownership. Before each actual POST recheck frozen target, connector, reference and confirmation. Pause/Stop cancels local waits and future sends; already accepted provider work may continue. Stable linked job/intent prevents replay.

**Recovery/retry.** Mount/reload only reconciles interrupted local status under locks; it never calls the paid dispatcher. Provider HTTP rejection explicitly classified `failureStage: "provider"` with no results is eligible for a new selected retry draft and a new real confirmation. Preflight failures, unknown POSTs, absent certainty, stored bytes and download/decode failures cannot be paid retries. Recover stored bytes/known jobs through reads/download/local decode. Imported histories are dormant. Counts use the real job and R2 current output inspection: saved, unavailable, selected and placed are separate facts. Output result `auditionVerification: "not_checked"` describes this operation's limits, not whether a user ever listened.

**Source proof.** Task records and final review share `ownedAgentAudioBatchJob`. Validate durable run/thread/task, original completed atomic prepare call, matching call result batch/project/chapter, exact batch owner/confirmed membership/item linkage/intent/input/connector. Retries trace actual same-owner/project/chapter records back to that root, at most 100 records; missing, dormant, cyclic, foreign or excessive history is unverified. A nonempty retry marker alone is no proof. Fingerprints and task blockers include every batch/item, including omitted display rows and pending/unknown items.

**Selection and placement.** Agent tools are `audio_select_takes`, `audio_arrange_selected`, `audio_read_arrangement`, `audio_revert_arrangement`. Every write uses mandatory exact preview confirmation in ask/assist/full. Selection updates only explicitly chosen segment versions; placement never changes selection. Arrangement follows manuscript order and actual decoded duration/absolute source trims, explicit voice track, optional start and gap. Append defaults to the real original track end. Any already placed segment is skipped even if a different/manual version is placed. Preserve every original clip, including trims/gain/fades/revisions; preview exposes actual retained parameters and conflicts. No automatic delete, move or reorder.

**CAS/history.** Whole chapter/entity fingerprints and exact original clip ID/revision sets are rechecked atomically with additions and receipt persistence. `AudioArrangementConflictError` distinguishes snapshot/proposal change; UI retains old preview, disables confirmation and requires explicit reprepare. Ordinary storage errors remain retryable. Repeated application returns historical receipt plus current added IDs, never resurrecting deleted/undone clips. Current-session `AudioClipHistory` groups one arrangement; undo/redo use whole-document CAS and preserve unrelated rows exactly. Refresh does not restore transient history. Agent inverse is a separately approved durable operation. Empty no-op cannot fabricate a 1–40-entry write receipt; missing evidence remains uncovered.

**Lifecycle/ZIP.** Project/chapter deletion removes owned batch/proposal records, blocks late completion and retains independent existing sources/exports as specified by audio-music. Retain snapshot clone references while required by jobs/batches. ZIP excludes credentials and chat execution, strips Agent identities, remaps all references and imports historical rows dormant. Deleted/missing historical take/media IDs do not restore entities or authorize network activity. Reject explicitly nondormant imported history.

**Clone hashing boundary.** Audio snapshot confirm/link reuses `validateSpeechReference` within the existing write owner through bounded `Dexie.waitFor` SHA-256 of a size-limited reference. This is a specific existing audio exception to the image/video preparation rule; never place unbounded network/decode work inside a write. Moving hashing outside requires paired frozen byte identity and in-transaction CAS, not removal of the check. Image/video preparation continues to hash outside writes.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Zero/>20 chosen units, duplicate/foreign/changing unit | Refuse before paid request |
| Changed text/profile/connector/reference before confirm/POST | Keep old draft/job, require renewed preparation |
| Missing/busy lock, acquisition pending | No unauthorized control/write/POST |
| Network/abort/protocol uncertainty after POST | Retain uncertain intent; no automatic resubmission |
| Explicit eligible provider failure | New selected draft, new UI confirmation |
| Corrupt/deleted output or wrong provenance | Unavailable/unverified, never counted saved |
| Existing clips for a segment | Preserve and skip; disclose conflicts |
| Stale preview/undo/redo | Typed conflict, no overwrite |
| Ledger/receipt persistence failure | Complete local transaction rollback |
| Dormant import, missing historical source | History only; zero paid replay/resurrection |

## 5. Good / Base / Bad Cases
Good: an 11-unit batch reports 9 available saved outputs, one explicit failure and one unknown pending submission; refresh keeps each fact and retry confirms only the failure. Base: bulk selection changes two segment choices while the timeline stays identical. Bad: replacing hand-trimmed clips, treating draft preparation as generated audio, or using a retry string to manufacture provenance.

## 6. Tests Required
`audioGenerationBatch.test.ts`, `audioBatchFinalReview.test.ts`: real confirmed dispatch and locks, concurrency, midqueue Stop, delayed lock refusal, clone changes, explicit failure stages, unknown/local recovery zero POST, forged origins/retry cycles, deleted projects, task freshness and full package flows. `audioArrangement.test.ts`, `audioArrangementAgent.test.ts`, `audioArrangementPackage.test.ts`: duration/gap/trim, exact retained rows, stale CAS, actual Chat/Responses approval and receipts, empty no-op, ledger rollback, historical replay and dormant full-reference remapping. Native UI checks separately cover actual decode, 11-item partial status, confirm/no-POST-before-confirm, reload/retry counters, manual clip retention, group history, cross-tab stale preview, 390px layout and Escape focus. Real provider/model/device/acoustic acceptance is recorded separately from fixture evidence.

## 7. Wrong vs Correct
Wrong: `job.status === "saved"` proves the whole batch and acoustic quality, or a registered worker means its lock was acquired. Correct: inspect each actual owned result/media, report separate selected/placed/not-checked facts, and gate controls on acquired ownership.
