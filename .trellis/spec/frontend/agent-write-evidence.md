# Agent direct-write evidence

## 1. Scope / Trigger
Read when changing local creative tool results, receipt production or the compact saved-changes display. Receipts describe direct effects at execution time; they are not current-state snapshots, full cascade reports, semantic goal verification or asynchronous generation evidence.

## 2. Signatures
- `createWriteReceipt(entries): WriteReceipt` and `readWriteReceipt(value)` in `lib/agent/writeReceipt.ts` define version 1, `coverage: direct_targets`, 1–40 strict entries with kind, operation, id, ownerId, optional revision and a label up to 160 characters.
- `captureBusinessDeletion` / `withBusinessWriteReceipt` wrap exactly project/episode/beat/shot/character/scene/prop/style create/update/delete inside `executeAtomicTool`.
- `libraryWriteTool` has an optional code-owned `receipt(args, result)` callback. Sound editing opts in through `soundWriteReceipt`; other library tools are unchanged.
- `describeRunWrites(run, calls)` projects owned saved calls for `AgentWriteOutcomes`. No database migration, additional model request or network call is introduced.

## 3. Contracts
Receipts and business mutations commit atomically with the tool result. Receipt failure or result overflow rolls back the write. Replay returns the original saved result. Receipts are never accepted as model arguments, reconstructed from preview or inferred from count changes.

Business create/update keeps existing top-level keys/items and adds whitelisted bounded `record` and `recordTruncated`. Shot `record.effectiveStyle` distinguishes inherit/explicit/none and resolves actual project-owned style. Project creation records real seeded entities. Audio/music seed receipts carry their actual numeric repository revision, not a business-row hash, so follow-up sound edits receive the correct CAS version. Direct delete receipts report the explicit target only. A batch shares a record budget; truncation is conservative across items. Long or truncated fields still use existing detail/text/relation reads. Copy, reorder, duplicate, slot and media tools remain uncovered by this version.

Sound coverage: audio_create/update, audio_place_take/edit_clip/remove_clip, music_save_draft/update_work/reuse_work. Audio split retains its existing array result without a receipt. Draft writes and voice configuration are not generated sound; segment selection is not placement; media metadata is not audition evidence. Receipt labels are bounded data rendered as text, never commands or links.

Reviewed v24 selection/arrangement adds `audio_select_takes`, `audio_arrange_selected` and `audio_revert_arrangement` with actual segment-update/clip-create/clip-delete entries. A zero-effect no-op has no fabricated receipt; see [the voice batch contract](./audio-batch-arrangement.md).

Projection requires run/thread ownership, completed status, write effect, atomic flag, supported tool/entity/operation, valid revision for non-deletes and matching owner for bound runs. Unbound project_create accepts its returned new owner. A newly bound run accepts only the exact `createdProjectBinding.callId` with matching projectId and returned owner; arbitrary bound project_create calls cannot use this exception. Reject invalid receipts as a whole. Missing or unsupported completed-write receipts remain uncovered, not proof of no effect. Read/network/bookkeeping payloads never supply direct-write evidence.

Display counts operations, including successive edits to the same entity. It deduplicates duplicate call rows but does not erase creation after a later deletion. Display at most 60 entries, disclose omitted operations and uncovered calls, and reveal original call records using existing activity navigation. No result-supplied URL is used. The compact disclosure stays outside the auto-collapsed process panel and preserves the existing shadcn controls. Streaming assistant text is not rewritten; evidence appears only from saved completed calls.

## 4. Validation & Error Matrix
| Condition | Result |
| --- | --- |
| Receipt construction/serialization or ledger failure | Atomic rollback, no successful receipt |
| Saved completed call replayed | Exact historical result, no new write |
| Foreign run/thread/owner, unsupported operation, invalid payload | No counted receipt evidence |
| Read/network/plan result includes receipt-like object | Ignore for direct-write outcomes |
| Completed legacy write without receipt | Explicit uncovered count, never zero-effects claim |
| Failed/rejected/unknown/pending write | Never counted as saved direct evidence |
| Multiple writes to one ID | Separate historical operations |
| Large records / many operations | Explicit truncation / omitted detail count |

## 5. Good / Base / Bad Cases
Good: a saved script returns its exact target/revision, appears as a script edit, and the next model request receives the same saved receipt. Base: an old call without evidence remains inspectable in the original process. Bad: a completed paid call is presented as saved audio, or a planned six-shot script is counted as six created shots.

## 6. Tests Required
`agentBusiness.test.ts` covers normalization, effective style modes, exact seeded IDs, 20-shot result limits, rollback and saved replay. `audioMusicAgentTools.test.ts` covers actual script/draft receipts, no implied take/clip generation and ledger rollback. `audioAgentExecution.test.ts` verifies Chat and Responses continuation receives committed receipts. `runWriteOutcomes.test.ts` covers ownership/status/tool gating, malformed/oversized payloads, repeated edits and explicit coverage limits. Desktop/narrow browser acceptance remains separate from pure/repository tests.

## 7. Wrong vs Correct
Wrong: mark a whole creative goal complete because a receipt exists or a call returned successfully.
Correct: show bounded recorded direct effects with their original call provenance, disclose missing coverage, and separately establish saved generation, placement, audition and goal completion.

## Script source-range impact (2026-10-10)

### 1. Scope / Trigger
`episode_update` with an explicitly supplied `patch.script` reports the existing normalizer's actual range invalidations. It does not synchronize beat/shot prose or order.

### 2. Signatures
The successful atomic tool result adds `scriptImpact: {version: 1, ownerId, episodeId, invalidatedBeatRangeIds, invalidatedBeatRangeCount, omittedBeatRangeIds, retainedShotIds, retainedShotCount, omittedShotIds, semanticSynchronization: "not_performed"}`.

### 3. Contracts
Inside the same business mutation/result/receipt transaction, compare normalized persisted before and after stories. Only valid-before and absent-after ranges count. Script-only normalization retains beat order; compare each actual association by its retained position so legacy repeated IDs do not conceal sibling invalidation. Arrays each cap at 40 with exact totals and omissions. Retained shots are filtered by actual project and episode, ordered deterministically and never written. Preview discloses possible range clearing and absence of semantic synchronization. Replays return exact saved historical impact, even after manual edits. Title/logline-only patches contain no impact field.

### 4. Validation & Error Matrix
Valid unchanged excerpt → retained range. Newly mismatched excerpt → one invalidation. Preexisting malformed/no range → no new invalidation. Duplicate IDs → assess each original association. Foreign episode/project shots → excluded. Stale episode or result/ledger overflow → reject/rollback, no impact success. Concurrent manual shot edits → retain current shots unchanged.

### 5. Good / Base / Bad Cases
Good: one of two valid excerpts becomes mismatched and the result reports exactly one lost association. Base: unchanged script yields zero invalidations. Bad: script length or an ID Set estimates invalidation, or a script update claims shots were synchronized.

### 6. Tests Required
`agentFilmScriptImpact.test.ts`: actual repository/tool/ledger, valid/malformed/repeated IDs, title-only, 40+ bounded totals, cross-scope shots, exact original bytes/revisions, stale preview, concurrent shot edits, saved replay, ledger/oversized result rollback and both protocol continuations receiving committed impact.

### 7. Wrong vs Correct
Wrong: infer all same-ID ranges survived because one sibling is still in an ID Set. Correct: compare each normalized association in its preserved order and disclose bounded historical IDs plus exact counts.

## One read-only final reply review (2026-10-10)

### 1. Scope / Trigger
After the final candidate and at most one execution finishing check, eligible smart runs can use one additional model request to inspect completion claims. User approval covers this bounded extra cost. It is not a guaranteed semantic certification mechanism.

### 2. Signatures
`beginAgentFinalReview(runId, expectedStep, output, signal, responseOutput?)`, `reviewFinalReply(...)`, `finishAgentFinalReview(runId, candidateFingerprint, claims?, reason?)`; persisted `AgentRun.finalReview: AgentFinalReview` version 1.

### 3. Contracts
Atomically save candidate/snapshot fingerprints and a one-use pending marker while reserving one actual segment model step. Fresh review messages contain only fixed instructions, original final text and code-owned bounded evidence: at most 20 historical receipts and 40 current outputs from at most 20 jobs, plus exact coverage disclosures. No tools, memory, image inputs, raw results, credentials or original reasoning envelope are offered. Use the same frozen model/protocol/effort, normal transport metrics, a 30-second deadline, 24,000-character response cap and 4,096 output-token request. Original streamed prose/reasoning remains intact. Responses retains its final opaque envelope in the original run separately; review output never becomes public prose or future business continuation.

Parse strict JSON with up to 20 claims, exact ordered nonoverlapping UTF-16 start/end/text and owned evidence refs. `assessment` is a model judgment; only typed `historical_write`, `output_available`, `output_selected`, `output_placed` predicates are code-compared. No refs forces unknown. A predicate match verifies that structural fact, never the entire sentence or acoustic quality. Pending review does not auto-replay on reload/resume. Owner/candidate/output/batch-item fingerprint changes make it unverified/stale. Image batch outputs currently remain outside this review coverage.

### 4. Validation & Error Matrix
| Condition | Result |
| --- | --- |
| Conversation/no tools/unresolved calls/stale ownership | Ineligible, no dispatch |
| Final segment step, oversized text/context | Unverified budget/content/context; no invented pause |
| Stop/timeout/transport/invalid JSON or refs/spans | Preserve original answer; explicit unverified reason |
| Current evidence changed during review | Stale, discard claims |
| Imported/forged output or preparation-only batch | No supported output proof |
| Review already claimed or interrupted | No second review request |

### 5. Good / Base / Bad Cases
Good: final text's precise saved output claim references one currently available owned result. Base: no completion claims returns an empty list without certifying prose. Bad: label a whole answer truthful because a model says consistent, or infer no effects from missing evidence.

### 6. Tests Required
`agentFinalReview.test.ts`, `audioBatchFinalReview.test.ts`: exact spans/refs, zero-tool envelope in both protocols, opaque original Responses retention, model judgments versus structural predicates, permissions/Stop/timeout/budget, interrupted no-replay, all-source freshness and forged batch/retry origin rejection. Live model tool choices/stops and compact desktop/narrow observations remain separate evidence.

### 7. Wrong vs Correct
Wrong: rewrite an uncertain answer into “nothing happened” or inject the full original tools/context into a review. Correct: keep original content, send one bounded zero-tool snapshot, show structural findings and disclose unverified claims.
