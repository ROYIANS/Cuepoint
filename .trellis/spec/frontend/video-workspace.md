# Shared video workspace

## 1. Scope / Trigger

Apply to the shared project gallery, video project home, episode list, story
editor and shot workbench. The same React pages and route outlet serve browser
and native runtimes. Persistence differs below the page boundary: existing
`src/db/` commands own browser Dexie transactions; closed Tauri commands own
native SQLite transactions and app-managed files. Fresh development is the
default; no migration, compatibility reader or data mirror is implicit.

## 2. Signatures

`src/lib/videoWorkspaceRepository.tsx` supplies
`getVideoWorkspaceRepository()`, `useVideoWorkspaceRepository()` and
`useVideoWorkspaceQuery(query, dependencies)`. `VideoWorkspaceSnapshot` contains
`project`, ordered `episodes`, episode-owned `beats`, project-owned `shots` and
typed `capabilities`.

The repository's project/episode/story/shot command methods retain the existing
browser command argument semantics. Native mutations return committed receipts
for operations whose inverse must be registered by the page. A
`VideoWorkspaceUndoAction` exposes `restore(): Promise<void>`; capture this
operation's receipt rather than rebuilding an inverse from a render snapshot.

## 3. Contracts

- `ProjectGalleryPage`, `ProjectHomePage`, `EpisodeListPage`, `StoryPage` and
  `ShotEditorPage` are shared. `WorkspaceChrome` supplies one AppFrame/header and
  nested route outlet. Do not replace it with a simplified native editor.
- Browser queries remain Dexie live queries. Native queries subscribe to native
  invalidation and never execute a Dexie callback. A native read error must
  expose recovery and retain an existing editor draft.
- Durable writes select exactly one owner. Native validation failure is an
  error, never a fallback to browser storage.
- Capabilities describe unavailable native world entities, generation and media
  slots. Keep the shared page tree and disable unsupported controls or render a
  clear capability state. Empty fake entity lists are not successful writes.
  Studio route gating must still allow `/assets`: the existing native managed
  library owns file copying and must remain reachable even while media slots
  and world entities are unavailable.
- Field baselines describe only the intended patch. Reject same-field conflicts;
  preserve unrelated concurrent changes. Undo follows the same ownership and
  field checks. Two operations on the same IDs require distinct receipts.
- Native baseline conflicts carry typed current/expected/requested field values.
  Numeric scalars compare by value (`0` and `0.0` agree); absent nullable fields
  compare as `null`. Never stringify a floating number as a different baseline.
  Read-modify-write settings operations serialize the complete read and patch,
  so rapid edits to different settings preserve both values.
- Ordered operations carry the complete owner-scoped list. Multi-add and bulk
  changes are single atomic native commands; validation failure leaves no
  partial rows. Missing project/episode/beat owners reject mutations.
- The normal packaged frontend is the root product application. A fixture
  WebView or mocked native adapter is additional evidence, not proof that the
  packaged shared UI works.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Native response has extra/malformed fields | Reject before updating accepted generation |
| Missing project or episode | Show missing state; block child writes |
| Same field changed since draft baseline | Keep draft; show conflict and recovery |
| Different field changed since baseline | Apply intended patch; preserve other field |
| Invalid owner, order, duration or UTF-16 range | Atomic rejection, no partial mutation |
| Unsupported native domain/slot | Explicit capability state; no Dexie access |
| Native read fails | Visible retry; no fabricated empty successful state |
| Undo receipt is stale/consumed or its target changed | Reject safely; do not overwrite newer edits |

## 5. Good / Base / Bad Cases

- Good: edit shot content in the shared workbench, send its content baseline,
  receive the committed result and invalidate native reads.
- Base: enter a native world route and see the capability state under the same
  workspace header, with a working route back to the core editor.
- Bad: pass the whole stale shot record for a one-field edit, retry in Dexie
  after native rejection, or use a second native-only story page.

## 6. Tests Required

- Existing browser draft, baseline, reorder, bulk, undo, filter and shortcut
  behavior tests continue to pass.
- Native adapter tests reject malformed replies without advancing generation;
  shared consumer tests prove native callbacks never reach browser owners.
- Rust tests exercise fresh schema, field conflicts/merge, distinct inverse
  receipts, atomic multi-add/bulk failure, complete reorder and reopen closure.
- Isolated browser and actual normal packaged native smoke follow project →
  episode → story/beat → shot edit, including reload/reopen and unavailable
  capability states. Label fixture/mock evidence accurately.

## 7. Wrong vs Correct

```ts
// Wrong: reconstruct native inverse from a stale component snapshot.
registerUndo(() => repository.reorderShots(episodeId, renderedIds));

// Correct: the native command supplies its committed inverse.
const inverse = await repository.reorderShots(episodeId, orderedIds);
if (inverse) registerUndo(() => inverse.restore());
// Existing browser command fallback can retain its established undo helper.
```
