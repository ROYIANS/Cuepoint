# D03 feature responsibility contract draft

Coordinator preparation, to be applied only after independent D03 PASS. Exact owner names are from the frozen implementation. A checker correction requires updating the corresponding signature/contract before applying this draft.

## 1. Scope / Trigger

Maintain these boundaries when changing shot editing, audio/music workspace commands, chat execution/selection, project landing, or ZIP package import/export. Feature pages own routing, visible feedback and UI interaction lifetimes. Named commands own an actual business sequence; pure codecs own data validation/remapping without persistence. Do not introduce an action registry or factory solely to reduce a file's line count.

## 2. Signatures / Owners

- `components/shots/shotEditorCommands.ts`: `applyShotBulkCommand({episodeId, selectedIds, patch, label})`, `deleteShotSelectionCommand({episodeId, selectedIds})`, and `reorderShotGroupCommand({episodeId, fullOrder, groupIds, activeId, overId})` return `Promise<UndoAction | undefined>`.
- `useShotEditorKeyboard(input)` owns its capture listener and typed callbacks. `ShotRow.tsx` owns row/sortable/viewport/slot presentation; `ShotRelationsEditor.tsx` owns relationship pending/error/retry state. `shotColumnFields.ts` maps nine text columns to their actual string fields and builds typed patches; duration/characters/scene use their dedicated editors.
- `components/audio/audioSelection.ts`: `deriveAudioSelection(snapshot, previous, intent)` returns a partial selection patch and optional seek data. Its named segment/clip/take/saved cases retain their distinct rules. The page produces seek-request tokens and owns displayed state.
- `lib/audio/buffers.ts`: `loadBuffers(schedule)` and `loadAudioBuffer(mediaId)` share playback, waveform and export decoding/cache. `exportAudioMix({projectId, projectName, chapterId, scope})` accepts `NonNullable<AudioExport["scope"]>` (chapter/project) and returns the persisted WAV Blob/name/attenuation result; the UI owns download/notice.
- `components/music/switchMusicVariant.ts`: `switchMusicVariant({projectId, draftId, target, links})` returns the resulting draft ID and variant links. The page owns synchronous action/submission locks and best-effort storage of links.
- `useChatExecutionSession(threadId)` owns `sending`, controller/thread/lock refs and `acquire()`/`release(token)`. `chatExecutionFlows.ts` exposes three named flows: `executeNewChatMessage`, `retryFrozenChatRun`, and `resolveChatRunAction`. `useChatSelection(...)` owns one current selection snapshot and revisioned setters; reference drafts remain in `useReferenceDraft`.
- `importStudioProject(file)` is the shared import feedback adapter for gallery/shell. `ProjectHomePage({projectId})` owns keyed landing queries, project-kind routing and film first-episode repair. Route files remain adapters.
- `lib/packages/projectPackageCodec.ts` parses/remaps project rows; `audioPackageCodec.ts` parses/remaps audio/music rows. Shared `PackageError` has one constructor in `packageError.ts`; existing root package exports preserve that identity. Root `projectPackage.ts` and `audioProjectPackage.ts` retain ZIP/media IO and persistence orchestration.

## 3. Contracts / Invariants

- Bulk undo uses the repository's atomic inverse; deletion undo uses its actually deleted rows and retained Blobs. UI render snapshots cannot replace those results. Reordering retains its full-order inverse and filtered-group behavior; it does not invent a new revision protocol.
- Row extraction retains active/drag/viewport keep-alive and slot identity. Relationship checkboxes remain explicit membership intent; clear/bulk replacement stay distinct. Pending/error state still protects departure. D03 keeps the existing text-cell commit policy; D08 separately owns draft/baseline/retry behavior.
- Audio selection is a partial patch, not universal resetting. Repeated segment, missing clip/take, owner/chapter and saved-take transitions remain asymmetric. Player epoch/disposal, audition/seek/composition cleanup, pointer capture, Alt snapping and undo history remain Timeline-owned.
- Export executes flush → fresh immutable repository snapshot → schedule/decode/render outside writes → atomic `addAudioExport` → UI download. A render result is not persisted from live component data. Current fingerprint/scope/duration/evidence validation remains in the persistence command.
- Variant switching flushes, rereads the current draft, validates its project, reuses a legal target or creates one, then links it. Synchronous page action/submission locks cover the whole command. Storage failure does not retroactively turn a successful database command into failure.
- Chat acquires its synchronous lock before awaiting. A session token owns release; an old token cannot unlock a new session. Abort/effect cleanup does not release while transport's final flush is still running. Home binds the destination before navigation and moves only the captured reference owner; restoration is legal-owner guarded, and acknowledgement occurs only after begin succeeds.
- Retry uses the original frozen run connector/model. Run decisions are persisted before credential checks; cancellation does not require a connector. Selection reconciliation retains connector/base-URL/model/thread identity and increments mutation revision before awaiting. Optimistic field persistence remains field-local; no all-field rollback policy is added.
- ZIP parsing, raw modern-ID/FK validation, full audio metadata freshness, legacy normalization, remapping, hashing and compression remain outside writes where required. Modern raw relationships are checked before tolerant parsers can repair/drop them; full fingerprint validation precedes schema allowlisting. The root import saves the entire project/media/production/audio graph in one complete transaction. A late audio relationship failure rolls back earlier inserted rows and Blobs.
- Imported paid-job history remains sanitized/manual/dormant; mounting, focusing and polling an imported project cannot resume paid work. Snapshotting and export history retention stay compatible with the existing C contracts.

## 4. Validation / Error Matrix

| Condition | Required behavior |
| --- | --- |
| No effective bulk/delete/reorder result | No fabricated undo action |
| Save/relation/variant/export failure | Existing visible feedback/retry/draft guard remains; no partial success notice |
| Decode/render failure | No export/media rows and no download |
| Route/stop/effect replay during chat | Abort the owner, retain lock until its final flush, preserve other owners' unsent drafts |
| Begin fails after home navigation | Keep transferred owner and a visible retry without creating a second topic |
| Missing connector after approval decision | Persist the decision, expose recoverable error; do not replay a paid request |
| Invalid raw package FK, stale fingerprint, or late audio relation | Actionable public package error; no partial imported graph |
| Imported running history | Sanitize to dormant/manual; no provider call on mount/focus/poll |

## 5. Good / Base / Bad Cases

- Base: a bulk shot patch returns its atomic inverse and produces one undo action; repeated audio segment selection retains the existing take/seek behavior.
- Good: a home chat navigation transfers the frozen reference payload while later home edits survive; an abort still holds the execution lock until final flush completes.
- Good: native video/audio/music ZIP round-trips preserve accepted rows; a forced late audio validation failure observes earlier inserts and then rolls them all back.
- Bad: rebuilding an inverse from rendered rows, acknowledging references before begin, releasing on abort before flush, saving a live audio snapshot, validating only allowlisted fingerprints, or importing table groups in separate transactions.

## 6. Tests Required

Use the real command/controllers and actual module mock identities. Cover repository-result undo, typed selection intent, lock/epoch/effect replay and frozen retry/approval sequencing. Retain B01 unavailable/dirty navigation and B07 actual history/reference-owner cases. Package regressions must use real ZIP bytes, current raw relationships, fingerprint boundaries, observed pre-fault writes and all-table rollback. Native audio verifies decode/render/cache/persistence, not acoustic quality. Preserve failed fixture attempts and prove a fault was reached; do not weaken assertions or increase timeouts to hide setup errors.

## 7. Migration / Limits

Every moved owner has an actual caller. `productionContext.ts` and `generationIntent.ts` receive comment-only historical boundary markers. Their bodies/public APIs are unchanged, and their only current value consumers are the two corresponding test files; the latter also type-imports `ProductionContext`. They are not claimed as active production owners. Active paid/resumable execution remains in the existing agent runtimes; E07 separately owns dead-export/reference cleanup. The audio persistence root also retains pre-existing parse/remap compatibility exports without inventing consumers; the project codec calls the pure audio codec directly. No D04 context snapshot, D05 schema/serializer, D06 capability, D07 transport or D08 text-draft contract is advanced by D03. Existing page/import/keyboard complexity remains explicitly measured; improved inherited metrics are not a claim of a clean formal static gate. Browser fixtures use controlled local transport, with zero external/provider requests, and do not establish full live-provider E2E coverage.
