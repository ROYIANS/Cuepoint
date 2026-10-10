# Research: Current gaps and design for reviewed audio selection and arrangement

- Query: How can R4 provide separate bulk take selection and deterministic real-duration timeline placement while preventing duplicates and preserving manual/concurrent work?
- Scope: internal
- Date: 2026-10-10

## Findings

### Requirements and current gap

The child PRD remains planning. Parent AC5 requires independently inspectable selection and placement, real duration/trim metadata, an effect preview, repeat-safe execution, concurrent-edit conflicts and preservation of manual clips unless a concrete change is approved. AC6–AC9 add ownership/permission/Stop, compact responsive UX, saved/selected/placed/not-auditioned distinctions, automated/browser and controlled real-model evidence. It can be implemented against existing takes before R3, then integrated with R3 outputs; it depends on the current R2 evidence contract.

Existing code supports individual selection and placement, chapter CAS and ephemeral undo. No reviewed bulk selection, arrangement proposal or semantic duplicate protection exists. `audio_place_take` and the inspector both create a fresh clip on every invocation, so repeating them duplicates placement. Do not count those foundations as R4 delivery.

### Files found

| File | Purpose |
| --- | --- |
| `src/domain/audio.ts` | Segment selectedTakeId, immutable decoded take metadata, absolute-source trim clip fields. |
| `src/db/audio.ts` | Validated ownership/revisions, single CRUD and full chapter clip-document CAS. |
| `src/db/audioShared.ts` | Project/row/media guards and audio transaction tables. |
| `src/lib/audio/commands.ts` | Split/duplicate/remove and chapter-level inverse undo/redo. |
| `src/lib/audio/schedule.ts` | Shared playback/export duration and absolute trim schedule. |
| `src/lib/agent/audioTools.ts` | Single selection via audio_update, explicit audio_place_take and revision-based clip edits. |
| `src/lib/agent/runWriteOutcomes.ts` | Whitelisted write receipt projection; new bulk tool names require explicit support. |
| `src/lib/agent/soundWriteReceipt.ts`, `writeReceipt.ts` | Current sound direct-write evidence shape and bounds. |
| `src/lib/audioGeneration/outputEvidence.ts` | Current saved take/media inspection, selection/placement distinction. |
| `src/components/audio/AudioInspector.tsx` | Current adopt-one-take and append-one-take controls. |
| `src/components/audio/AudioWorkspacePage.tsx` | Chapter toolbar and script/timeline/Sheet selection orchestration. |
| `src/components/audio/AudioTimeline.tsx` | Timeline-owned AudioClipHistory, playback/export and direct actions. |
| `src/components/audio/audioSelection.ts` | UI linking between script, take and clip; selecting is not a write. |
| `tests/audioFoundation.test.ts`, `tests/audioEngineCommands.test.ts` | Existing ownership, CAS, media preservation and stale-undo coverage. |
| `tests/audioEngineTimeline.test.ts`, `tests/audioOutputEvidence.test.ts` | Schedule and honest output-state fixtures. |

### Existing patterns and constraints

1. `AudioSegment.selectedTakeId` is independent of the timeline (`src/domain/audio.ts:30`). `validateAudioSegment` requires the selected take to belong to that exact segment (`src/db/audio.ts:55`). Single selection uses `patchAudioSegment` (`:136`), exposed by `audio_update` (`src/lib/agent/audioTools.ts:296`) and the inspector (`src/components/audio/AudioInspector.tsx:87`). New batch generation must not silently select.
2. Takes retain actual decoded duration/sample rate/channels and immutable source media (`src/domain/audio.ts:39`, `:57`). A clip duration is `trimEndSec - trimStartSec`; source trim is absolute, independent of timeline start (`src/lib/audio/schedule.ts:94`, `:101`). Never infer length from manuscript characters or provider requested length.
3. `validateAudioClip` checks track, take, same chapter for segment-bound sources, source trim bounds and fade limits (`src/db/audio.ts:84`). Free sources can cross chapters; segment-bound voices cannot. Arrangement must use real available media and positive finite durations as well as this validator.
4. `replaceAudioClips` compares every chapter clip ID/revision and rejects concurrent addition/deletion/change (`src/db/audio.ts:211`). It then increments revisions of every row in `next`, even unchanged clips (`:224`). A batch append can reuse its CAS semantics, but blindly replacing the entire document causes unnecessary changes to manual clip revisions and invalidates older histories.
5. `AudioClipHistory` keeps only inverse clip documents, no media bytes, and uses CAS for undo/redo (`src/lib/audio/commands.ts:26`, `:67`). Its transform executor is private and currently requires a single existing clip (`:103`); there is no batch-create history API. Add a reviewed multi-clip edit method or durable arrangement inverse; do not create a second unrelated unsafe undo stack.
6. Current inspector append uses the largest existing end in the selected track plus user pause (`src/components/audio/AudioInspector.tsx:105`); repeated clicks create new IDs. `audio_place_take` also has no idempotency key (`src/lib/agent/audioTools.ts:325`). A new batch contract needs stable operation/clip identity and same-segment placement detection.
7. Write evidence only accepts explicitly whitelisted tool/entity combinations (`src/lib/agent/runWriteOutcomes.ts:14`); bulk tools need authoritative receipts plus projection additions. A preparation/read result is never mutation proof. Do not summarize skipped/manual-preserved entries as newly placed.

### Recommended shared design

Add pure planner functions and shared transactional apply commands, used by manual and Agent UI. Suggested modules: `lib/audio/arrangement.ts` for deterministic planning; `db/audioArrangement.ts` for previews/CAS/application; focused Agent tools and one shared compact review component. Preserve the existing individually edited timeline and playback engine.

**Bulk selection is a separate action.** Input explicitly maps segment IDs and expected revisions to owned take IDs/revisions. Show current selection, proposed take, source text mismatch and saved/available/not-auditioned state. Apply all selected changes atomically or none, checking segment/take ownership, revisions and media availability inside `AUDIO_TRANSACTION_TABLES`. Already-selected entries are no-ops with no revision bump. Return authoritative per-entry previous/new selection and revisions. No clip is created or replaced by this action. Missing/ambiguous candidates must be explicitly chosen; “newest” may be a labelled draft suggestion, never an automatic write hidden in arrange.

**Default arrangement: append only the reviewed, selected, not-yet-placed segment takes to a chosen existing voice track.** Sort by saved segment order, using an explicit stable ID tie-break; the review exposes the resulting order. Default start is the largest existing clip end on that target track. Permit a reviewed explicit start and a bounded inter-segment pause (0–300 seconds, matching current controls). New clips default to full decoded source duration, gain 1 and zero fades; optional explicit trim start/end are validated against source duration. Existing clips' positions, trims, take, gain and fades remain byte-for-byte the same.

For every requested segment inspect all chapter clips linked through any of its takes, not only the selected take. If one already placed selected source exists, mark it “already placed” and skip; if another source is placed, or multiple related clips exist, mark “manual placement retained / needs review” and skip by default. The review lists exact preserved/conflicting IDs behind details. This avoids accidental duplicate voices when selection changes after a manual arrangement. Do not silently add another selected take over those existing clips. Explicit replacement can be offered only as a separate concrete operation showing exact affected clip IDs, old/new take and trim/position changes; existing single clip edits already provide an escape path. No automatic ripple/reflow is part of this child unless specifically designed and reviewed.

The current PRD's ambiguous-placement requirement can be resolved by this deterministic append/skip rule. It delivers a full conservative arrangement workflow; user expectations of bulk replacement/reflow are a product choice to surface in design rather than infer. If root chooses to support replacement now, it must be individually explicit in the proposal, preserve unaffected manual clips and test its inverse/CAS behavior fully.

**Durable effect preview:** store one versioned proposal with project/chapter/track, owner/source (manual or actual Agent thread/run/call), exact segment/take selections and revisions, track/chapter revision, complete chapter clip ID/revision baseline, explicit order/start/pause/trim options, stable proposed clip IDs, proposed changes/skips/conflicts, expiry-by-revision and application receipt. The actual decoded duration values and text snapshot mismatch remain visible. A chapter/input/track change invalidates the preview; show the old reviewed contents and offer explicit re-prepare, without rebasing and applying automatically. Never trust caller-supplied complete clip rows as the source of ownership or actual duration.

**Apply transaction:** check approval/owner/skill/Stop and exact proposal revision; re-read all inputs and clip document, then validate every new or explicitly changed clip before mutation. Default append should preserve existing rows' IDs/revisions and `bulkAdd` only new clips after the same whole-document CAS used by `replaceAudioClips`. Add a reusable document-match guard rather than duplicate it in multiple components. Record proposal receipt in the same transaction. No-op proposals produce a truthful empty application without touching rows. For explicit replacement/undo, use the existing full-document CAS and validation; add a general history entry API so the timeline can undo a completed batch append as one command.

**Idempotency:** uniquely identify each prepared operation and freeze all new clip IDs in the proposal. A second apply of the same proposal returns the stored receipt without another insert; it must still inspect current clips before claiming that they remain placed. A new preview also checks segment-linked existing clips, so preparing the same intent twice does not duplicate. After a user deliberately removes/undoes the applied clips, the old proposal is historical; require a new preview to place again. Do not let an old apply call resurrect deleted or undone clips.

**Undo/recovery:** batch append belongs in chapter history, keeps original takes/media and reverses only the reviewed batch effect. Store before/after document references or receipt/inverse with revisions; stale undo rejects instead of erasing a later manual/Agent edit. Existing ephemeral history may be sufficient for current-session manual undo, but Agent and reload behavior need an explicit durable reviewed revert action if undo is promised there. Do not claim reload-restored undo with the current class. A stored proposal and atomic application receipt allow recovery after a lost tool result without rerunning a write.

**Agent adapter:** bounded tools such as `audio_select_takes` and `audio_arrange_selected` use the same repositories/planner and existing `libraryWriteTool` frozen-preview/atomic-result mechanism where appropriate. Store preparation and application separately if the review includes a complex durable proposal. Normal ask/assist/full permissions retain their existing policy; code-owned confirmation should be required for the concrete arrangement preview if the product promises review in every mode. Do not accept model `confirm` flags. Emit bounded `audio_segment` update and `audio_clip` create/update receipts for actual effects, explicit per-entry skips/conflicts and replay indicators. Extend R2 source/projection readers so this operation can be verified from the saved records and not from free text.

**Storage lifecycle:** proposal/receipt records need project and optional thread deletion guards, media/reference retention policy and a deliberate ZIP choice. Recommended project-owned arrangement proposals export as dormant history with remapped IDs; pending imported proposals cannot apply. If proposals are excluded as execution history, preserve all selected takes/clips/media and export only safe historical provenance. Adding this table should be coordinated with R3's Dexie migration rather than independently assuming v24.

### Minimal complete UX

- Add two concise chapter actions: “批量选用” and “排列已选声音”. Selection review can link directly from R3 saved result summary, but never piggyback a placement write.
- One flat shared Dialog/Sheet review shows selected, missing, already placed and manual-conflict counts; order and source duration; target track/start/pause; resulting end time; and exact added/replaced/preserved counts. IDs and full metadata are details.
- Use existing timeline to inspect the resulting clips and one undo action for the batch. Selected/saved/placed/not auditioned labels remain separate. Actual media decode/metadata checks do not imply acoustic acceptance.
- On stale input, preserve old preview and choices, disable apply, explain the changed entity and offer refresh/review. No partial write. Empty/blocked requests do not become a success toast implying placement.
- Keyboard selection/confirm/cancel and focus return, narrow Sheet layout, independently scrolling timeline, and no horizontal page overflow at 390 px are required.

### Key tests and integration acceptance

1. Pure planner: deterministic order with equal orders, real decoded fractional duration, trim contribution, start/pause validation, no text-length estimates, correct append end, no script reorder causing implicit timeline changes.
2. Repositories: all-or-none bulk selection, owned segment/take/media, stale revision, mismatched text disclosure, same-selection no-op; no placement from selection.
3. Arrangement: first apply creates exact reviewed clips; repeated apply creates none; re-prepare skips existing same-segment clips including different takes; preserve manual position/trim/gain/fades; multiple/split/manual sources are explicit conflicts; no old receipt resurrects undone/deleted clips.
4. Concurrency: added/deleted/edited chapter clip after preview, changed track/segment selection/take/media, project/chapter deletion and simultaneous apply all reject safely with no partial write. Add whole-document CAS before bulk inserts, not only a take or individual clip CAS.
5. Undo: one batch entry reverses all its additions without copying/deleting media; redo reuses stable IDs safely; later manual edit blocks stale undo; external apply clears/conflicts with incompatible current-session history.
6. Agent: existing strict permissions, disabled skill, conversation mode, bound foreign project, stale frozen preview, Stop and replay; accurate receipt projection and partial/skipped/available evidence. No claim that “selected” means “placed” or “not auditioned” means acoustically approved.
7. ZIP/cascade/retention/legacy schema tests, existing foundation/history/schedule/fingerprint/export regressions.
8. Actual desktop/390 px isolated browser fixture: generated/imported takes -> inspect/choose subset -> apply selection -> arrangement preview -> apply -> repeat -> manual move -> stale apply/undo -> recovery. Include keyboard, Sheet focus, horizontal scrolling and audible/playback availability through the existing player. Then controlled real-model trace selects and arranges through real tools with actual stop/approval outcomes; metadata-only/mock assertions do not satisfy acoustic/live acceptance.

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` for `lint`, `quality`, targeted tests and build, as required by AGENTS.md. Research changed no application source and ran no test suite.

### Related specs

- `.trellis/spec/frontend/audio-music.md`: sources/selection/timeline separation, CAS, media/ZIP, timeline direct actions and workspace owners.
- `.trellis/spec/frontend/agent-tools.md`, `agent-creative-skills.md`, `agent-execution.md`: preview/approval/result atomicity, replay and scope/Stop.
- `.trellis/spec/frontend/agent-write-evidence.md`, `agent-task-wrapup.md`: whitelisted saved receipts and verified current sources.
- `.trellis/spec/frontend/component-guidelines.md`, `hook-guidelines.md`, `quality-guidelines.md`: responsive existing UI and repository/test gates.

### External references and versions

No external documentation or new package is necessary for this internal repository/planner design. `package.json` declares React `^19.1.1`, Dexie `^4.2.0`, Zod `^3.25.76`, Vitest `^5.0.1` and fake-indexeddb `^6.2.5`; these are declared ranges. Existing Web Audio decode/schedule and repository guards remain the implementation reference.

## Caveats / Not Found

- No product source, task metadata, spec or git operation was changed. This file proposes contracts; it does not verify implementation or acceptance.
- Root can adopt one chapter/track, append missing selected voices, 0 pause default and preserving all existing segment-linked clips as routine defaults. Bulk replacement/reflow must be explicitly designed if desired; no current evidence authorizes silently moving human edits.
- Current undo is ephemeral and inaccessible for bulk adds. Its extension or a reviewed durable revert is necessary before claiming undo behavior for a new batch/Agent path.
- `replaceAudioClips` increases untouched clip revisions. Default append should avoid that churn while retaining equivalent whole-chapter CAS; a new helper must be tested rather than weakening concurrent-edit checks.
- R2 evidence contracts are being researched concurrently; new tool receipts and current result inspection must be coordinated. R3 schema/source changes and R4 migration/proposals should be reserved together.
- Live model/provider/audio audition and native browser coverage were not performed in this research. Full acceptance cannot be replaced by planning or mocked tests.
