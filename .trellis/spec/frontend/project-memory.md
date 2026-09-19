# Project Memory

## 1. Scope / Trigger

Use for project-owned, user-reviewed reusable knowledge: conventions, creative preferences,
decisions and lessons. Automatic retrieval and AI read tools follow `agent-memory-retrieval.md`;
this management repository never grants permissions. Current project facts remain authoritative.
No global memory owner or legacy data backfill exists.

## 2. Signatures (API / DB)

- `src/domain/projectMemory.ts`: `ProjectMemory`, `ProjectMemoryVersion`, `MemoryInput`,
  `MemorySourceRef`, `MemoryCandidate`, `MemorySaveOptions`.
- Dexie v16: `projectMemories` and `projectMemoryVersions`. All repository calls in
  `src/db/projectMemories.ts` require `projectId` explicitly.
- `createProjectMemory(projectId, input, { replace?: { id, expectedRevision } })` and
  `promoteProjectMemory(projectId, ref, input, options)` return `{ memory, duplicate }`.
- `updateProjectMemory(projectId, id, input, expectedRevision)`;
  `setProjectMemoryStatus(projectId, id, 'active' | 'disabled', expectedRevision)`;
  `deleteProjectMemory(projectId, id, expectedRevision)`.
- `replaceProjectMemory(projectId, oldId, newId, { oldRevision, newRevision })`.
- `listMemoryCandidates(projectId, taskId, summaryId, summaryRevision)`;
  `getMemorySourceState(projectId, id)` returns human/confirmed/historical/missing/imported.
- Read helpers: `listProjectMemories`, `getProjectMemory`, `listProjectMemoryVersions`.
- `/p/$projectId/memory?memory=$id` → `ProjectMemoryPage`, shared `MemoryEditor`.

## 3. Contracts

- Every mutation reads current rows and project ownership inside the write transaction.
  CAS mismatch rejects. Changed rows append a full immutable version snapshot. Replacement
  compares both revisions and writes both histories atomically. Hard delete removes all
  versions; project delete cascades both tables; source chat deletion retains memories.
- `MemoryInput` is strict, bounded and contains only category/title/topicKey/body/
  applicability/tags and optional `inclusion: 'relevant' | 'project'`. Absence means
  relevance-only; project-wide priority requires explicit opt-in. Preserve this field
  through revision snapshots and ZIP import/export. Never send a full persisted record as an input payload.
- Topic keys use shared NFKC + whitespace + lowercase normalization. Exact content or
  exact summary source deduplicates without overwriting edits or reactivating old rows.
  Same-topic different active content raises `MemoryConflictError(existingIds)`.
  This is deterministic matching, not semantic contradiction detection.
- Summary promotion references exact task/summary/revision/decision-or-lesson/index/text.
  Resolve confirmed source from DB, validate project and thread ownership. Completed,
  archived and historical confirmed summaries remain eligible after explicit user review.
  Save bounded original text and evidence; derive live links from current ownership.
- `pending_review` imports require explicit activation. Active, disabled, superseded and
  pending-review are distinct. Superseded entries are immutable except permanent deletion.
- Editors retain local drafts across live refreshes. On CAS conflict, show current content
  and require explicit reconciliation before advancing expectedRevision. Closing/route
  navigation protects dirty state; pending saves cannot be dismissed. Promotion editor
  state belongs to stable `TaskWrapup`, not conditionally mounted summary entries.
  Report promotion editing/pending state to its inspector to prevent destructive closing.
- Memory view queries convert storage read failures to local result/error states via
  `readMemory`; never let a live-query error unmount an open draft. Show retry and block
  submission until reads recover.
- Detail displays imported evidence as well as live-summary evidence; imported sources
  cannot be treated as current verified task outputs. Saved promotion links locate its row.
- ZIP `memories.json`/`memoryVersions.json` share the business/media snapshot transaction;
  compression happens afterwards. Import validates project ownership, identity, unique
  versions, contiguous history, latest snapshot equality and replacement cycles before
  writes. Normalize all current/history topic keys at this boundary too. New IDs remap
  references; detach live source links but preserve excerpts/evidence. Add a pending-review
  current version while retaining historical states. Permanently deleted replacement
  targets may be absent; clear those links and explain in import revision. All writes
  share the project import transaction. Absent files are empty; malformed/null data rejects.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Missing/studio/foreign project or source | Reject without writes |
| Forged source text, index or unconfirmed revision | Reject; user must reselect source |
| Double submit / normalized duplicate | Return existing row, never reactivate |
| Same-topic different active body | Show conflicts; explicit replacement or edit topic |
| Another editor saves | Keep local draft; show latest version for explicit reconciliation |
| Source summary refresh | Keep promotion editor and frozen source reference mounted |
| Source chat deleted | Retain independent row/history; show missing source and excerpt |
| Imported memory activated | Check active conflicts, clear old supersededBy and add version |
| Imported full-width/whitespace topic | Normalize consistently; cannot bypass conflict check |
| Invalid package chain or storage failure | Reject/rollback entire imported project |
| Permanent memory deletion | Delete current and all versions; keep original task summary |

## 5. Good / Base / Bad Cases

- Good: confirm a task lesson, edit its reusable formulation and applicability, save,
  then inspect its exact source and later revisions in project memory.
- Base: manually create/edit/disable/reactivate knowledge with no connector configured.
- Bad: promote an unconfirmed model draft, infer current validity from historical evidence,
  silently accept a stale revision, or bypass the reviewed retrieval policy when injecting stored entries.

## 6. Tests Required

- `tests/projectMemories.test.ts`: ownership, strict source validation, CAS, immutable
  history, idempotent concurrent submission, atomic replacement rollback, completed and
  old confirmed sources, source deletion, project cascade, pending review lifecycle.
- `tests/projectMemoryPackage.test.ts`: coherent export, source detachment/evidence,
  remapped IDs/history, strict chain validation, failure rollback, absent files, deleted
  replacement targets, normalized imported topic conflicts after activation.
- Browser fixture in task validation: offline editor, dirty close/navigation, CAS draft
  reconciliation, source-refresh draft retention, promotion deep link, missing source,
  status/replacement/history/delete, mobile overflow and keyboard.

## 7. Wrong vs Correct

Wrong: `<ConfirmedEntry>{open && <MemoryEditor />}</ConfirmedEntry>` stores the draft under
an entry that vanishes when a new summary is created.

Correct: entries emit a candidate; stable `TaskWrapup` owns the candidate and editor, keeps
its exact original source reference, and reports editing/pending to the inspector.

Wrong: import raw `topicKey` while normal CRUD writes `normalizeMemoryText(topicKey)`.

Correct: validate the original package chain, then normalize current and every historical
snapshot with the same helper before persisting the detached imported aggregate.
