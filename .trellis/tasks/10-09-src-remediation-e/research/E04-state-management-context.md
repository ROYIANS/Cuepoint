# E04 scoped canonical state/persistence context

Source `.trellis/spec/frontend/state-management.md`; SHA256 `0fa7387041731978f6ffedb1bbdaf5187eaaffa8c55c96f74c179edc98e119af`. Exact current owner, atomic deletion, query identity and D02 boundaries. Preparation only; refresh if source changes before E04.

## Canonical lines 1–123

# State Management

> How state is managed in this project.

---

## Overview

There is no backend. Durable state lives in IndexedDB (`src/db/database.ts` + the business command owners listed in the D02 contract below). UI reads with `useLiveQuery`. Ephemeral UI (search, sort, dialog open) stays in React `useState`.

---

## State Categories

| Kind | Where | Examples |
| --- | --- | --- |
| Durable | Dexie tables via business command owners in `src/db/` | Project, Episode, Character, Scene, Prop, VisualStyle, Shot, Media |
| URL | TanStack Router | `/characters/$characterId`, `/p/$projectId/world` |
| Local UI | `useState` | library search, sort, pending delete |

Do not introduce a global client store for records that already have a Dexie table.

---

## Scenario: Studio library owner vs project owner

### 1. Scope / Trigger

Studio 角色/场景/道具/风格 are first-class libraries. Creating them must stay under `StudioShell`, not open a project picker or `/p/$projectId/...`.

### 2. Signatures

```ts
export const STUDIO_LIBRARY_ID = "studio" as const;
export function isStudioLibrary(ownerId: Id): boolean;

addCharacter(projectId: Id): Promise<Character>
addScene(projectId: Id): Promise<Scene>
addProp(projectId: Id): Promise<Prop>
addStyle(projectId: Id): Promise<VisualStyle>
copyStudioCharacter(projectId: Id, sourceId: Id): Promise<Character>
copyStudioScene(projectId: Id, sourceId: Id): Promise<Scene>
copyStudioProp(projectId: Id, sourceId: Id): Promise<Prop>
copyStudioStyle(projectId: Id, sourceId: Id): Promise<VisualStyle>
```

Dexie v2 stores:

```
props: "id, projectId, updatedAt"
styles: "id, projectId, updatedAt"
```

`projectId` on character/scene/prop/style/media is the **owner id**. For studio library rows it is `STUDIO_LIBRARY_ID`, not a real `projects` row.

`touchProject(id)` must no-op when `isStudioLibrary(id)` so create/edit does not invent a project named `studio`.

### 3. Contracts

| Field | Constraint |
| --- | --- |
| Studio create | `add*(STUDIO_LIBRARY_ID)` then navigate to `/characters/$id`, `/scenes/$id`, `/props/$id`, `/styles/$id` |
| Studio detail back | Character/Scene `back: { kind: "studio" }` → `/characters` or `/scenes`. Props/styles always return to `/props` / `/styles` |
| Project detail back | `back: { kind: "project", projectId }` → `/p/$projectId/world` |
| Add studio asset to project | Copy to a new project-owned ID and copy referenced media to new project-owned media IDs. Record `extra.sourceAssetId` only as provenance |
| Project zip | Includes copied project snapshots; studio-owned source rows are never included |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `add*` with `STUDIO_LIBRARY_ID` | Row written; no `projects` insert |
| `touchProject("studio")` | No-op |
| Source is not studio-owned | Reject snapshot copy |
| Same `sourceAssetId` already exists in destination | Reject atomically; do not duplicate media |
| Snapshot copy fails | Roll back asset and all copied media in one transaction |
| Missing detail id | See hook-guidelines: liveQuery `get() ?? null` |

### 5. Good/Base/Bad Cases

- Good: 创建角色 on `/characters` lands on `/characters/chr_…` with studio nav current
- Good: “从工作室添加” creates an independent project snapshot whose edits do not affect the source
- Base: deleting a studio source leaves existing project snapshots intact
- Bad: studio create opens a project picker or `/p/$projectId/assets/characters/$id`
- Bad: point a project row directly at studio media IDs

### 6. Tests Required

- Create from each studio library: URL stays `/characters|scenes|props|styles/$id`
- `touchProject("studio")` does not create a project row
- Copy each asset type: new asset/media IDs, project ownership, field/extra preservation, and source independence
- Copy the same source twice: second copy rejects without extra rows
- Delete source: snapshot and copied media remain
- Missing id shows 找不到, not an infinite 加载中

### 7. Wrong vs Correct

#### Wrong

```ts
const projectId = await pickProject();
const character = await addCharacter(projectId);
await navigate({ to: "/p/$projectId/assets/characters/$characterId", params: { projectId, characterId: character.id } });
```

#### Correct

```ts
const character = await addCharacter(STUDIO_LIBRARY_ID);
await navigate({ to: "/characters/$characterId", params: { characterId: character.id } });
```

Project reuse is also copy-on-add:

```ts
const snapshot = await copyStudioCharacter(projectId, studioCharacterId);
// snapshot.id !== studioCharacterId
// snapshot.projectId === projectId
// snapshot.extra?.sourceAssetId === studioCharacterId
```

---


## Canonical lines 592–638

## Scenario: Deletion returns its committed shot snapshot (A03 / PD-02; 2026-09-30)

### 1. Scope / Trigger

Manual episode-scoped shot deletion followed by short-lived undo. Rendered data can be older than the data actually deleted; only the deletion transaction owns the recovery snapshot.

### 2. Signatures

```ts
interface DeletedShotsSnapshot {
  projectId: Id;
  episodeId: Id;
  shots: Shot[];
  media: MediaRecord[];
}
deleteEpisodeShots(episodeId: Id, ids: Id[]): Promise<DeletedShotsSnapshot | undefined>;
restoreShots(shots: Shot[], media?: MediaRecord[]): Promise<void>;
```

### 3. Contracts

- Same `PRODUCTION_TABLES` write transaction reads and validates all current selected rows, collects all firstFrame/lastFrame/clip reference and result media records including Blobs, performs deletion, reindexes siblings and cleans orphan media. Nested `deleteShots` participates in this transaction.
- Return scoped snapshot only after transaction success. Preserve selection order in the snapshot; restoration derives positions from captured shot order rather than selection order. Existing callers may ignore the return value.
- UI passes selected IDs, then registers `restoreShots(snapshot.shots, snapshot.media)` only when a nonempty snapshot returns. Do not build recovery data from rendered shots or a pre-deletion asynchronous media query.
- Shared media remains retained by global reference checks. Recovery snapshots still include referenced media needed if its last remaining reference disappears later. `restoreShots` retains parent/owner/reference, existing-ID, ordering and atomic rollback checks.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Empty selection | Return undefined; no undo action |
| Missing/foreign/duplicate target or missing episode | Reject; no partial deletion |
| Text or media committed after the page render | Snapshot the latest values actually deleted |
| Shared media remains referenced | Keep committed media |
| Delete/reindex/touch/cleanup fails | Roll back rows, order, project and media; no successful snapshot |
| Restored ID already exists | Reject restore atomically; do not overwrite it |

### 5. Good/Base/Bad Cases

Good: new text and image committed between render and deletion are present after undo. Base: empty selection does nothing. Bad: deleting the latest row but restoring an earlier rendered row, or retaining its obsolete media IDs.

### 6. Tests Required

Use actual repository transactions to verify latest text/all slot references/Blob recovery, capture under the same deletion transaction, shared-media retention/final-reference deletion, selection-order independence, scope/duplicate/missing rejection, rollback for each write stage and existing-ID restore rejection.

### 7. Wrong vs Correct


## Canonical lines 727–766

## Scenario: Query identity and manual route departure (B01 / SS-01, PU-05; 2026-09-30)

### 1. Scope / Trigger

A live-query dependency changes while its previous result is retained, or a project/episode/asset/material editor is about to be removed. Query identity, saved target and manual draft lifecycle must agree.

### 2. Boundaries

Project Chrome is keyed by project ID; shot/print content by project+episode; four asset detail contents by owner+entity. Query envelopes also tag their dependencies, including null/empty outcomes, before row ownership checks. Material detail keeps an active ID until parent-driven selection passes its existing guard, then queries and keys the editor by the matched material ID.

`useManualDraftGuard(dirty, pending, onDiscard)` serves actual slot/output/relations callers. It uses the router resolver plus unload protection; pathname departure blocks, same-path focus/search keeps the editing session. Pending work suppresses discard. Explicit discard awaits cleanup; failure displays an error and does not proceed. Before discard starts, Continue resets the navigation resolver and preserves the active draft, frozen baseline, owned media and retained failed-upload File. Once discard has canceled the media session, a cleanup failure leaves the editor readable but disables further saves/uploads in that canceled session; retry cancellation/cleanup before departure, rather than resuming writes against a closed DraftMediaSession. Mounted slot-open notifications must balance close and actual unmount so retained row context does not persist after the last editor disappears.

### 3. Contracts

- Same-target field/slot live updates preserve the editing session. Keys must not include updatedAt, whole records, search, or selected focus.
- A04 SlotEditSession still freezes owner/target/title/callback/baseline; route guards supplement rather than replace its target check and transaction CAS. Failed saves retain local draft and media for retry.
- Project output still saves only changed fields against frozen baselines and follows the authoritative acknowledgement protocol. Route departure has the same dirty/pending protection as browser unload.
- Relation saving/error state is an unresolved manual session; failed selection remains available for retry or explicit discard.
- Material B→C requests while confirmation is open resolve to the latest requested ID. Continue restores the active parent selection, permitting a later repeated B request. A stale confirmation callback cannot publish an obsolete selection.
- Missing rows do not silently destroy open assigned manual editors. Retain only matched session context needed for readable drafts, mark the target unavailable and disable writes; normal initial missing queries show not-found. Asset/material retention lasts only for active editing. The unavailable project shell can preserve unknown descendant mounts, but must expose not-found, hide normal project affordances, make inline Outlet controls inert, and disable assigned portal editor actions through WorkspaceUnavailableContext. This is readable session context, not write authorization.
- This scoped protection does not claim universal draft survival after deletion in every unrelated child, layout/filter removal, forced process shutdown, or browser restart. Such coverage requires its own verified contract.

### 4. Validation Matrix

| Trigger | Required behavior |
| --- | --- |
| Old null/empty result after target change | Loading until envelope matches; no repair/write/export against old identity |
| Matching envelope but foreign owner row | Not-found; no editor or write target |
| Dirty pathname/history departure | Continue preserves; explicit discard permits target remount |
| Pending upload/save | No discard; wait or continue editing session |
| Save conflict / failed upload | Draft, original baseline, owned media/File remain; retry still targets opening owner |
| Same-path locate/search | Keep slot session; do not discard or remount |
| Parent material B→C selection | Latest requested target wins only after guard; continue restores active selection |
| Assigned target disappears | Readable protected draft plus unavailable status; writes disabled |

### 5. Verification

`tests/b01QueryIdentity.test.ts` executes actual consumers and captured queriers against fake IndexedDB with explicit stale rows/null/empty envelopes; its lightweight hook host is not ReactDOM. `scripts/b01-browser-regression.mjs` with `tests/fixtures/b01` exercises actual ReactDOM, Radix, browser history/router blockers and isolated IndexedDB. It controls read/picker/mutation timing through documented fixture seams and simplifies surrounding routes. It must not be described as an unmodified full-app or paid-provider E2E test. Set installed browser tooling through B01_PLAYWRIGHT_PATH/B01_CHROMIUM_PATH when absent from normal resolution; do not install product dependencies for this fixture. Keep focused A04 regressions with this change.



## Canonical lines 813–865

## D02 production persistence responsibility boundaries

## 1. Scope / Trigger
Production persistence has explicit business owners rather than a single `repo.ts`. Use these owners from actual source/test/fixture callers; schema and migrations remain in `database.ts`. Cross-domain transactions remain whole commands, not a collection of table CRUD calls.

## 2. Signatures and owners
| Owner | Actual existing public behavior |
| --- | --- |
| `productionRecords` | `emptyProject/Episode/Shot/Character/Scene/Prop/Style` constructors |
| `productionShared` | `PRODUCTION_TABLES`, timestamp, ownership/reference/order and patch guards |
| `projects` | Project/video/audio/music creation, metadata/settings/output/cover writers |
| `episodes` | Episode/story/beat lifecycle, scoped filters/order, deletion and restoration |
| `shots` | Shot edits, character membership intent, bulk inverse/undo, reorder, slots, committed delete snapshots |
| `assets` | Four creative asset types and text/slot/delete commands |
| `media` | `putMedia`, `collectMediaIds`, `deleteMediaIfOrphan`, slot validity/recycling |
| `assetReuse` | Studio snapshot copies and `releaseMaterialUse` |
| `connectors` | Saved connection/alias CRUD and `resolveConnector` |
| `chat` | Ordinary thread/messages, metadata and project binding |
| `cascadeCommands` | `deleteProject`, `deleteChatThread`, `setProjectArchived` |

Moved command signatures and return values remain unchanged. Existing cross-owner support exports are intentional real consumers, not new forwarding APIs. The five legacy unconsumed read/message exports remain separately tracked for later cleanup; their presence does not authorize using an all-purpose facade.

## 3. Contracts
Constructors import no database. Shared persistence scope/guards import no command owners. Media retention never imports asset/shot command modules. Episodes/shots share guards without mutually importing commands. Cascade commands preserve original full store sets and atomic ordering, including audio, references, material history and generation outcomes. D01 readers/preparation/selector imports keep their accepted dependency direction.

All actual imports, type queries, module mocks, namespace spies and browser interception paths target the concrete consumed owner. Business tools use named owner functions and retain existing schemas/permissions/atomic receipts; their actual asset dispatch map is not a replacement global repository namespace. No `export *` facade or dynamic import hides the removed owner.

Project creation and media/asset creation retain parent checks, studio exceptions and transaction-local touch. C05 generic patch rejection, dedicated slot/cover validity and global orphan/history protection remain authoritative. Project/thread cascades and studio material release never compose separately committed child delete APIs. Blob preparation, ZIP compression, hashing and transport remain outside write transactions.

## 4. Validation & Error Matrix
| Condition | Required result |
| --- | --- |
| Missing nonstudio parent at create | Reject without child or media insertion |
| Generic media patch or invalid dedicated target/owned Blob | Existing rejection; no partial mutation/touch/recycle |
| Field/slot/bulk baseline mismatch | Existing conflict and whole-group atomicity |
| Any project/thread cascade late storage failure | Roll back all earlier child/history/media/binding changes |
| Release event/storage failure | Restore copy, binding, retained-media flag and bytes |
| Media still selected or protected by reference/material/audio/proposal/job/batch history | Retain media under existing owner/global rules |
| Genuine unreferenced media after successful release | Remove only the existing computed orphan set |

## 5. Good / Base / Bad Cases
Good: import a named shot command and preserve its transaction-returned inverse for undo; execute thread deletion as one existing lifecycle command and retain selected production media. Base: asset creation for the studio owner does not require an invented project row. Bad: reconstitute the old repo namespace in a barrel or delete each table through separately committed feature APIs.

## 6. Tests Required
Actual entry tests cover parent, media, scoped relationships, CAS/bulk undo/deletion snapshots, proposals/generation/history and ZIP storage. Mocks/spies must intercept the module the feature imports. Native late-fault tests observe earlier writes, inject failure afterward, and compare durable rows plus Blob bytes before/after; successful retry distinguishes retained references from true orphans. Existing B01/B07/C01/C02 fixtures cover migrated UI/session/native entries. Preserve the stronger D01 single/batch late-ledger/history fault proof through a later import-only verification clone, without rewriting its historical evidence.

Fault-injection fixtures must guarantee a real field update before installing the hook, capture expected rollback state after setup, and assert the hook was reached. An equal millisecond timestamp can be a no-op; neither sleep nor timeout inflation proves transaction rollback.

AST distinguishes value/type edges and must retain zero value SCCs. Static baseline/current programs use the same tool versions and complete separate source roots; moved-body diagnostics remain inherited and absent files contribute zero baseline source-rule diagnostics.

## 7. Wrong vs Correct
Wrong: `import * as repo` from a new facade and `vi.spyOn` a different wrapper than the UI calls. Correct: named imports from the concrete owner and spies on that same module, while cross-table transaction ownership remains in the explicit lifecycle command.


