# D08 text draft protocol — coordinator preparation

Preparation only until D07 independent acceptance. Original PU06 concerns direct live-row text writes in ShotEditorPage PlainCell/shot number/content/other text columns, beat titles in ShotEditorPage, and StoryPage beat title/content/timeOfDay. The actual StoryEditor main episode title/logline/script already use useDebouncedDraft; B06/CAS/import session corrections must remain. Original audit established fragmented failure/recovery and lack of flush registration, not measured lost keystrokes.

## Current actual reusable owner

Reuse lib/debouncedDraft.ts controller/hook (400ms delay, per-project pending registration, retained entity-field draft keys, baseline, error/retry/useLatest, visibility/pagehide/beforeunload behavior) and existing DraftStatus. AssetTextField is an actual working example; do not build another timer/store/globalformframework. Local scalar text must display immediately, retain initial field baseline through writes and live updates, show failure, keep retry/adopt-latest semantics, and flush before backup/navigation/dispatch. Use a small meaningful shared text-draft component/hook only if both shot and beat consumers need its real common behavior; keep visual chrome/field labels in their feature components.

## Expected boundary after D03

Reread accepted ShotRow/column mapping/ShotRelationsEditor and StoryPage after D03 extraction. Change only free text: shot shotNumber/content/notes/category/sound/emotion/cameraAngle/cameraGear/focalLength/sceneCloseup and story beat title/content/timeOfDay. Existing duration draft and membership/relationship/slot actions are distinct. They must keep their existing intent and atomic commands, not be converted into full object autosave. Existing main episode title/logline/script draft remains intact.

Add an optional typed per-text-field baseline to actual db/episodes patchStoryBeat (same txn), following assertDraftBaseline before mutation; existing nontext callers without baseline preserve behavior. db/shots patchShot already accepts per-field baselines. The parser/normalization path for a beat and missing beat must be read precisely; same-field remote changes reject preserving local input, unrelated fields/beat order/refs may change. For baseline-bearing text saves, missing project/episode/beat/shot rejects instead of silently reporting saved; old callers without a baseline keep their documented omission/no-op behavior unless another authorized invariant requires a change; UI scope identity and draft retention prevent old drafts from targeting another record. Do not change sorting/reorder or bulk undo.

## Lifecycle and actual verification

Stable keys include project and entity/field; component persist callbacks must stay attached to the same scope for a controller lifetime. Debounced writes and failures must be visible to row/beat retention so virtualized/unavailable rows or route changes cannot silently discard them. Preserve B01 missing-row last-scope behavior and controller flush/reopen backup safety. React state alone must not lose a pending marker before the first await. Navigation uses existing guard/flush policy, not a second global router mechanism.

Run existing debouncedDraft/draftConcurrency/manualDraftBaseline/parent/shot/beat/field intent tests. Add meaningful actual component/repository regressions for delayed/rejected text writes, same-field conflict versus unrelated edit, retry/adopt-latest, missing target and owner switch. Native actual UI tests need immediate typing retention, visible error/reopen retry, backup/globalflush failure blocking and final latest text, IME/composition/caret under delayed storage, row virtualization/missing target and navigation. Preserve finite fixture limitations; no claim of browser crash-proof saves or full production E2E. No timeout loosening or source-string assertions replacing behavior.

Writer captures exact before/after and calls accepted D02 owners; main spec/ledger closure only after independent fullscope PASS. No product edits, tests or finding closure performed by this proposal.
