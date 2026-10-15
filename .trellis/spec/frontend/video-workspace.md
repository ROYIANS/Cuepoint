# Shared video workspace

## 1. Scope / Trigger

Apply to the shared project gallery, video project home, episode list, story
editor and shot workbench. The same React pages and route outlet serve browser
and native runtimes. Both complete-product adapters use existing `packages/studio/src/db/`
commands through ProductStore and explicit StoreTx. The fixed startup profile
selects persistence; it does not select reduced video-only features. The retained
schema-4 prototype is separately constructed for reference tests. Read
[Native Product Runtime](./native-product-runtime.md). Fresh development is the
default; no migration, compatibility reader or data mirror is implicit.

## 2. Signatures

`packages/studio/src/lib/videoWorkspaceRepository.tsx` supplies
`getVideoWorkspaceRepository()`, `useVideoWorkspaceRepository()` and
`useVideoWorkspaceQuery(query, dependencies)`. `VideoWorkspaceSnapshot` contains
`project`, ordered `episodes`, episode-owned `beats`, project-owned `shots` and
typed `capabilities`.

The repository's project/episode/story/shot command methods retain the existing
shared command argument semantics, with a transaction-bound repository created
by `withStore(tx)` for observed snapshots. SQLite prototype mutations return committed receipts
for operations whose inverse must be registered by the page. A
`VideoWorkspaceUndoAction` exposes `restore(): Promise<void>`; capture this
operation's receipt rather than rebuilding an inverse from a render snapshot.

## 3. Contracts

- `ProjectGalleryPage`, `ProjectHomePage`, `EpisodeListPage`, `StoryPage` and
  `ShotEditorPage` are shared. `WorkspaceChrome` supplies one AppFrame/header and
  nested route outlet. Do not replace it with a simplified native editor.
- Both complete-product adapters use shared reactive queries and explicit
  readonly snapshot contexts. Native read errors expose recovery and retain
  existing editor drafts. Prototype reads retain their separate invalidation
  lane; do not confuse its tests with full-product SQLite evidence.
- Durable writes select exactly one fixed storage owner. SQLite validation failure is an
  error, never a fallback to IndexedDB; IndexedDB failure never opens SQLite.
- Only the explicit prototype's capabilities describe unavailable world,
  generation, relations and media slots. Complete browser and SQLite products
  expose the same implemented routes/controls, including Agent, global/IP/material
  libraries, world, audio/music and generation. Sync remains unavailable on both
  until its provider is implemented. Empty fake entity lists are not successful
  writes; neither Tauri presence nor SQLite ownership may hide shared features.
- Field baselines describe only the intended patch. Reject same-field conflicts;
  preserve unrelated concurrent changes. Undo follows the same ownership and
  field checks. Two operations on the same IDs require distinct receipts.
- Prototype SQLite baseline conflicts carry typed current/expected/requested field values.
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
| Unsupported domain/slot in explicit prototype | Explicit capability state; no Dexie fallback |
| Either complete-product owner | Full shared implemented features; no schema-4 fallback |
| Full SQLite read fails | Visible retry; retain draft; no fabricated empty successful state |
| Undo receipt is stale/consumed or its target changed | Reject safely; do not overwrite newer edits |

## 5. Good / Base / Bad Cases

- Good: edit shot content in the same workbench through the selected shared
  command owner; the Agent tool uses the same durable records/transaction rules.
- Base: full SQLite persists the existing story/shot/world/Agent records in one
  owner; precise committed invalidation updates the same workbench. Explicit
  prototype tests separately exercise its native baseline/receipt protocol.
- Bad: pass the whole stale shot record for a one-field edit, retry in Dexie
  after native rejection, or use a second native-only story page.

## 6. Tests Required

- Existing browser draft, baseline, reorder, bulk, undo, filter and shortcut
  behavior tests continue to pass.
- Full adapter tests reject malformed replies and preserve commit certainty;
  shared consumer tests prove SQLite callbacks never reach an IndexedDB owner.
- `productStorage`/`productStorageQueries` tests prove fixed fresh identity,
  full media queries and complete features; reference selection remains separate.
- Rust tests exercise fresh schema, field conflicts/merge, distinct inverse
  receipts, atomic multi-add/bulk failure, complete reorder and reopen closure.
- Isolated browser and actual normal packaged native smoke follow project →
  episode → story/beat → shot/world/media/Agent edit, including reload/reopen.
  Actual isolated proof precedes normal packaged SQLite activation.
  Capability-unavailable checks belong to the explicit prototype. Label
  fixture/mock evidence accurately.

## 7. Wrong vs Correct

```ts
// Wrong in the explicit SQLite lane: reconstruct inverse from a stale snapshot.
registerUndo(() => repository.reorderShots(episodeId, renderedIds));

// Correct in that lane: the command supplies its committed inverse.
const inverse = await repository.reorderShots(episodeId, orderedIds);
if (inverse) registerUndo(() => inverse.restore());
// Existing browser command fallback can retain its established undo helper.
```
