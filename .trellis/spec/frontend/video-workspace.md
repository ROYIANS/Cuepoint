# Shared video workspace

## 1. Scope / Trigger

Apply to the shared project gallery, video project home, episode list, story
editor and shot workbench. The same React pages and route outlet serve browser
and native runtimes. The approved complete-product desktop stage uses existing
`src/db/` commands and Dexie transactions in its fixed fresh app namespace, just
as browser uses its own namespace. `usesSqliteProductStorage()` explicitly selects
the retained reference adapter where closed Tauri commands own SQLite/filesystem
transactions; Tauri presence alone cannot select it. Read
[Native Product Runtime](./native-product-runtime.md). Fresh development is the
default; no migration, compatibility reader or data mirror is implicit.

## 2. Signatures

`src/lib/videoWorkspaceRepository.tsx` supplies
`getVideoWorkspaceRepository()`, `useVideoWorkspaceRepository()` and
`useVideoWorkspaceQuery(query, dependencies)`. `VideoWorkspaceSnapshot` contains
`project`, ordered `episodes`, episode-owned `beats`, project-owned `shots` and
typed `capabilities`.

The repository's project/episode/story/shot command methods retain the existing
IndexedDB command argument semantics. SQLite reference mutations return committed receipts
for operations whose inverse must be registered by the page. A
`VideoWorkspaceUndoAction` exposes `restore(): Promise<void>`; capture this
operation's receipt rather than rebuilding an inverse from a render snapshot.

## 3. Contracts

- `ProjectGalleryPage`, `ProjectHomePage`, `EpisodeListPage`, `StoryPage` and
  `ShotEditorPage` are shared. `WorkspaceChrome` supplies one AppFrame/header and
  nested route outlet. Do not replace it with a simplified native editor.
- Browser and normal desktop queries remain Dexie live queries. SQLite reference queries subscribe to native
  invalidation and never execute a Dexie callback. A native read error must
  expose recovery and retain an existing editor draft.
- Durable writes select exactly one fixed storage owner. SQLite validation failure is an
  error, never a fallback to IndexedDB; IndexedDB failure never opens SQLite.
- Only the explicit SQLite reference lane's capabilities describe unavailable world entities, generation and media
  slots. Keep the shared page tree and disable unsupported controls or render a
  clear capability state. Empty fake entity lists are not successful writes.
  SQLite Studio route gating must still allow `/assets`: the existing native managed
  library owns file copying and must remain reachable even while media slots
  and world entities are unavailable. The normal desktop IndexedDB stage exposes
  the same implemented full product routes/controls as Web, including Agent,
  global/IP/material libraries, world, audio/music and generation. Do not retain
  a native-runtime-only capability gate over those shared IndexedDB features.
- Field baselines describe only the intended patch. Reject same-field conflicts;
  preserve unrelated concurrent changes. Undo follows the same ownership and
  field checks. Two operations on the same IDs require distinct receipts.
- SQLite baseline conflicts carry typed current/expected/requested field values.
  Numeric scalars compare by value (`0` and `0.0` agree); absent nullable fields
  compare as `null`. Never stringify a floating number as a different baseline.
  Read-modify-write settings operations serialize the complete read and patch,
  so rapid edits to different settings preserve both values.
- Ordered operations carry the complete owner-scoped list. Multi-add and bulk
  changes are single atomic SQLite commands in that reference lane; validation failure leaves no
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
| Unsupported domain/slot in explicit SQLite lane | Explicit capability state; no Dexie fallback |
| Normal desktop IndexedDB owner | Full shared implemented features; no workspace ensure/state IPC |
| SQLite reference read fails | Visible retry; no fabricated empty successful state |
| Undo receipt is stale/consumed or its target changed | Reject safely; do not overwrite newer edits |

## 5. Good / Base / Bad Cases

- Good: edit shot content in the same workbench through the selected IndexedDB
  command owner; the Agent tool uses the same durable records/transaction rules.
- Base: explicitly select SQLite, send the content baseline, receive its committed
  result and invalidate native reads; its world route shows the capability state under the same
  workspace header, with a working route back to the core editor.
- Bad: pass the whole stale shot record for a one-field edit, retry in Dexie
  after native rejection, or use a second native-only story page.

## 6. Tests Required

- Existing browser draft, baseline, reorder, bulk, undo, filter and shortcut
  behavior tests continue to pass.
- Explicit SQLite adapter tests reject malformed replies without advancing generation;
  shared consumer tests prove SQLite callbacks never reach IndexedDB owners.
- `productStorage`/`productStorageQueries` tests prove normal desktop selects
  fresh IndexedDB, retains full media queries and never invokes workspace IPC.
- Rust tests exercise fresh schema, field conflicts/merge, distinct inverse
  receipts, atomic multi-add/bulk failure, complete reorder and reopen closure.
- Isolated browser and actual normal packaged native smoke follow project →
  episode → story/beat → shot edit, including reload/reopen and full normal
  IndexedDB capabilities. Capability-unavailable checks belong to the explicit
  SQLite reference lane. Label fixture/mock evidence accurately.

## 7. Wrong vs Correct

```ts
// Wrong in the explicit SQLite lane: reconstruct inverse from a stale snapshot.
registerUndo(() => repository.reorderShots(episodeId, renderedIds));

// Correct in that lane: the command supplies its committed inverse.
const inverse = await repository.reorderShots(episodeId, orderedIds);
if (inverse) registerUndo(() => inverse.restore());
// Existing browser command fallback can retain its established undo helper.
```
