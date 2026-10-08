# D08 shot/beat text draft contract draft

Coordinator preparation only. Apply after independent D08 acceptance and reconcile exact actual shared component/hook/baseline signatures. No product or timer implementation is created by this draft.

## 1. Scope / Trigger

Maintain this contract when changing shot scalar text fields or beat title/content/time-of-day editing. Immediate local text, field-specific conflict checks, visible failed-save recovery and registered flush/retention belong to one existing draft protocol. Duration, relationship membership, media slots, reorder/bulk undo and main episode editor drafts remain distinct existing owners.

## 2. Signatures / Owners

- `components/drafts/TextDraftField.tsx` reuses `lib/debouncedDraft.ts` and existing `DraftStatus`, including project flush registration, retained entity-field keys, initial field baseline, retry/useLatest and unload/visibility policy. Its keyed control captures one persist callback for the project/draft-key lifetime; input marks parent retention pending before updating local draft. This is shared text presentation/lifecycle, not a replacement timer/store.
- `components/shots/ShotTextField.tsx` binds `ShotRow`/typed column mapping to `patchShot` text drafts for shot number/content/notes/category/sound/emotion/camera angle/gear/focal length/closeup. Existing duration and relationship editors keep their own contracts.
- `components/story/BeatTextField.tsx` binds ShotEditor beat titles and StoryPage beat title/content/time-of-day to `patchStoryBeat` using the same protocol. Main episode title/logline/script already use it; preserve their B06/CAS/import behavior.
- `lib/useTextDraftRetention.ts` owns readable row/beat pending-status retention only; existing debouncedDraft owns persistence/retry. Missing loaded rows can retain pending/error display without claiming the target still exists.
- Actual `db/shots.patchShot` already supports field baselines. Actual `db/episodes.patchStoryBeat` gains only the optional typed text baseline needed by these consumers. Final signatures come from accepted source, not a full-object autosave API.

## 3. Contracts / Invariants

- Local text updates synchronously on input, independently of the live row and database timing. The controller retains the captured field baseline through deferred writes, live notifications and failure; current remote data cannot silently replace an in-progress local draft.
- Stable draft keys include project, entity and field. Persist callbacks target that same owner for the controller lifetime. Switching scope cannot attach an old draft to another record or publish another owner's completion/error.
- Same-field remote changes reject and preserve local input; unrelated field/order/reference edits remain mergeable. Validate baseline inside the same mutation transaction before changing the record.
- Baseline-bearing text saves reject missing project/episode/beat/shot rather than reporting saved. Existing nontext/no-baseline callers retain their original omission/no-op behavior unless a separately accepted invariant requires otherwise. Missing target is not an empty successful write.
- Pending/error/retained drafts participate in existing row/beat retention and departure protection. Virtualization, unavailable queries, component unmount and route change cannot silently discard registered work. Use existing guard/flush mechanisms rather than adding another timer store or router guard.
- Failed saves expose status and retry/adopt-latest actions. Retry keeps the same local text and owner; adopting latest is explicit. Reopening a retained field restores the draft/error rather than showing falsely saved live data.
- Project backup, navigation/dispatch and global flush obey the existing barrier: await latest pending writes; reject on unresolved failures and preserve drafts. A ref/controller pending marker is established before awaiting, not solely through later React state.
- Preserve IME/composition and caret/focus behavior under live updates and delayed persistence. This protocol does not change sorting, relationship intent, atomic inverse, paid request or model selection behavior.

## 4. Validation / Error Matrix

| Condition | Required behavior |
| --- | --- |
| Fast typing/delayed storage | Immediate stable local text, serialized latest persistence |
| Same field changed remotely | Conflict/error; keep local text and explicit retry/latest options |
| Unrelated field/order/reference changed | Apply text without overwriting unrelated changes |
| Target deleted while dirty/pending | Reject save and retain visible/reopenable draft |
| Virtualized/unmounted/route-switched field | Registered work and owner remain coherent; no cross-target write |
| Backup/global flush fails | Block success/departure according to existing guard; preserve draft and retry |
| IME/composition/live row notification | Preserve in-progress text, caret/focus and valid final save |
| No-baseline/nontext legacy caller | Preserve documented original behavior |

## 5. Good / Base / Bad Cases

- Base: a shot text edit displays immediately, debounces through the existing controller and flushes before project backup.
- Good: a remote change to another field merges; a same-field conflict keeps local text and offers explicit latest/retry.
- Good: a virtualized or missing row retains its failed draft and reopening restores it; global flush cannot claim success on a missing target.
- Bad: a controlled input renders directly from a live row while saving each keystroke, a callback targets the latest route instead of its captured owner, or a missing baseline-bearing target returns success.

## 6. Tests Required

Use actual text component/controller/repository entry points. Cover deferred/rejected writes, same-field versus unrelated updates, retry/adopt-latest/reopen, missing target and owner switching. Retain existing debouncedDraft/draftConcurrency/manualDraftBaseline/parent/shot/beat intent and B01 missing-scope/navigation proofs. Native UI verifies immediate typing, visible failure, global-flush/backup barrier, IME/caret under delayed storage and virtualized/unavailable retention. Demonstrate fault reach rather than increasing timeouts; no source-string tests as substitutes for behavior.

## 7. Migration / Limits

Use current D02 persistence owners and accepted D03 row/command boundaries. No replacement timer store, form library, whole-object autosave, global guard duplication, reorder/CAS rewrite or main-episode editor redesign. A finite local browser fixture does not promise crash-proof persistence or all IME/browser combinations. Existing dirty/manual draft contracts and paid execution barriers remain. Whole-D integration/full-scope independent review and E/QG01 work remain separate acceptance.
