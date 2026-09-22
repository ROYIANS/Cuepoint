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

Projection requires run/thread ownership, completed status, write effect, atomic flag, supported tool/entity/operation, valid revision for non-deletes and matching owner for bound runs. Unbound project_create accepts its returned new owner; bound runs cannot use this exception. Reject invalid receipts as a whole. Missing or unsupported completed-write receipts remain uncovered, not proof of no effect. Read/network/bookkeeping payloads never supply direct-write evidence.

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
