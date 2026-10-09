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

## Scenario: Episode owns story and shots

### 1. Scope / Trigger

A project is either a single film or a series. Both use Episode as the story/shot owner; film mode hides the unnecessary episode-management step while series mode shows 第N集. World stays on the project. Episode ownership is a Dexie v3 schema contract.

### 2. Signatures

```ts
type ProjectMode = "film" | "series";
normalizeProjectMode(raw: unknown): ProjectMode; // missing/unknown -> "series"
createProject(name: string, mode?: ProjectMode): Promise<Project> // default mode -> "film"
type ShotWorkspaceView = "design" | "media";
type ShotStatus = "draft" | "ready" | "framed" | "clipped" | "approved";
// UI labels: 草稿 / 可生成 / 已出图 / 已成片 / 通过
normalizeShotStatus(raw: unknown): ShotStatus; // missing/unknown -> "draft"
interface ShotFilters {
  statuses: ShotStatus[]; // empty = all
  beatIds: string[]; // includes SHOT_UNASSIGNED_BEAT ("none"); empty = all
  gaps: Array<"missingFirstFrame" | "missingClip">; // OR within dimension; empty = all
}
normalizeShotFilters(raw: unknown): ShotFilters;
updateShotSettings(projectId: Id, patch: Partial<ShotSettings>): Promise<void>
addEpisode(projectId: Id): Promise<Episode>
deleteEpisode(id: Id): Promise<void>  // refuse if it is the last episode
addShot(projectId: Id, episodeId: Id, options?: { beatId?: Id }): Promise<Shot>
addShots(projectId: Id, episodeId: Id, count: number, options?: { atOrder?: number; beatId?: Id }): Promise<Shot[]>
parseShotPictureSlots(raw: Record<string, unknown>): {
  firstFrame: GenerationSlot;
  lastFrame: GenerationSlot;
  clip: GenerationSlot;
}
```

Dexie v3 stores:

```
episodes: "id, projectId, order, updatedAt"
shots: "id, projectId, episodeId, order"
```

`Project.story` is only the series logline. Script and beats live on `Episode.story`. Shots must have `episodeId`. `Shot.status` is manual (never auto-derived from media). Gap filters are derived at read time from first-frame / clip slots.

### 3. Contracts

| Field | Constraint |
| --- | --- |
| New project | Same transaction creates episode 1 |
| Film home | `/p/$projectId` redirects to its sole episode story; episode chrome includes 世界 and does not route through the episode list |
| Series home | `/p/$projectId` episode list + series logline; `/p/$projectId/world` for 世界 |
| Episode interior | `/p/$projectId/e/$episodeId` story, `/shots`, `/produce` |
| Nested route ownership | The route's episode must belong to the route's project before rendering or mutating |
| Shot pictures | `firstFrame` / `lastFrame` / `clip`; old `frame` → `firstFrame`; old `reference` refs merge into `firstFrame` without replacing `result` |
| Shot workspace | `design` prioritizes text/relationships; `media` shows first/last/clip. Both edit the same Shot rows. Missing preference defaults to `design` |
| Shot status | New / missing / unknown → `draft`. Design and media views share status, filters, selection, and reorder |
| Shot filters | Persist on `Episode.shotFilters`; `getEpisodeShotFilters` normalizes and scopes beat IDs. Dexie v6 migrates legacy project filters to episodes. Empty arrays mean show all. Dimensions AND together; values within a dimension OR |
| Zip | `episodes.json` optional; missing file synthesizes episode 1 from `project.story` + all shots. Project props/styles and their media round-trip with the same package. Missing shot `status` imports as `draft`; episode filters round-trip with remapped/scoped beat IDs; legacy project filters migrate on import |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Delete last episode | Refuse; UI hides 删除 |
| Episode belongs to another project | Treat as missing; do not create or show cross-project shots |
| Delete shots from multiple episodes | Reindex every affected episode independently |
| Query shots by `projectId` only | Wrong: mixes every episode |
| Old IndexedDB / zip without episodes | Upgrade/import creates episode 1 and moves story + shots |
| Project mode missing from old record/zip | Normalize to `series` so existing navigation does not change |
| New project mode omitted | Default to `film` |
| Partial shot settings update | Merge with normalized stored settings; never replace unrelated settings with `undefined` |
| Missing / unknown shot status | Treat as `draft` for UI, filters, CSV/print, and package import |
| Empty filter arrays | Show all shots; do not invent a sentinel `"all"` value |

### 5. Good/Base/Bad Cases

- Good: 第2集 新建镜头 does not appear on 第1集
- Base: a film owns one episode but opens directly on its story
- Bad: `/p/$projectId` renders `StoryPage` for the whole project

### 6. Tests Required

- New project opens with 第1集; 新建第2集 increments
- New default film skips the episode list; an explicitly created series opens the episode list
- Missing mode remains series, while package round-trip preserves an explicit mode
- Workspace view, status, filters, and existing shot settings survive partial updates and package round-trip
- Shot isolation per `episodeId`
- Route and repo reject a mismatched `projectId` + `episodeId`
- Deleting a mixed set reindexes every affected episode
- `parseShotPictureSlots`: `frame.result` kept on `firstFrame`; `reference` ids appended to first-frame refs
- Zip round-trip preserves nested `extra`, props, styles, imported media MIME types, and shot `status`
- Combined status / beat / gap filters match; missing status counts as draft

### 7. Wrong vs Correct

#### Wrong

```ts
db.shots.where("projectId").equals(projectId).sortBy("order")
```

#### Correct

```ts
const episode = await db.episodes.get(episodeId);
if (!episode || episode.projectId !== projectId) return [];
db.shots.where("episodeId").equals(episodeId).sortBy("order")
```

---

## Scenario: Script ranges and ordered episode content

### 1. Scope / Trigger

Use when creating a beat from script selection or changing episode, beat, or shot order.

### 2. Signatures

```ts
reorderEpisodes(projectId: Id, orderedIds: Id[]): Promise<void>
reorderBeats(episodeId: Id, orderedIds: Id[]): Promise<void>
reorderShots(episodeId: Id, orderedIds: Id[]): Promise<void>
duplicateBeat(episodeId: Id, beatId: Id, options?: { includeShots?: boolean }): Promise<StoryBeat>
duplicateShot(id: Id): Promise<Shot>

interface StoryBeat {
  scriptRange?: { start: number; end: number; excerpt: string };
}
```

### 3. Contracts

- Script offsets use JavaScript UTF-16 textarea selection indices.
- Normalize a range only when bounds are valid and `script.slice(start, end) === excerpt`; otherwise retain beat content and drop the range.
- Reorder inputs must contain every current scoped ID exactly once. Cross-project or cross-episode IDs are rejected.
- Episode and shot orders become contiguous after mutation. Beat order is the `story.beats` array order.
- Moving a beat also moves its shots as one visible group; shot move controls operate within the current beat group.
- Duplication creates new entity IDs. Undo restores exact previous positions.
- Drag-and-drop reorder must call the same `reorderBeats` / `reorderShots` APIs as arrow moves. Shot drag stays within a beat group and must not change `beatId`. Selection mode disables drag activators.
- Shot editor document shortcuts (j/k/arrows, Space/x, Cmd/Ctrl+A, n, Backspace, Alt+↑/↓) must no-op when focus is in a form field, Radix overlay content, or checkbox/option/menu control (`isFormFieldTarget`).
- Cmd/Ctrl+A and toolbar「全选可见」select only the current filtered visible shot ids. When filters change, drop selected ids that are no longer visible before any bulk write.
- Bulk character edits replace the entire `characterIds` array; each bulk write registers the transaction-returned affected-field before/after inverse payload. Undo validates all targets before atomically restoring only those fields.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Range no longer matches script | Remove `scriptRange`; preserve beat content |
| Ordered IDs contain duplicates/missing/foreign IDs | Reject without partial writes |
| Duplicate beat with shots | Clone beat and its shots with new IDs under the same episode |
| Restore deleted shots | Restore captured media and exact orders, then normalize safely |
| Drag end yields an identical ordered ID list | Do not write or register undo |
| Focus inside input/select/overlay/checkbox | Shot shortcuts do not preventDefault or mutate selection |
| Select-all while filters are active | Hidden shots stay unselected; bulk patches cannot reach them |

### 5. Good/Base/Bad Cases

- Good: select an emoji-containing script span, create a beat, and resolve the exact same UTF-16 slice
- Base: edit the source script; the beat survives without stale highlighting
- Bad: reorder all episode shots from one beat-row control and interleave another beat's group

### 6. Tests Required

- UTF-16 selection and stale-range invalidation
- Missing, duplicate, and foreign owner IDs reject atomically
- Beat reorder carries its shot group; within-group shot reorder stays scoped
- Duplicate entities receive new IDs; delete undo restores exact order

### 7. Wrong vs Correct

#### Wrong

```ts
await Promise.all(orderedIds.map((id, order) => db.shots.update(id, { order })));
```

#### Correct

```ts
await assertExactEpisodeMembership(episodeId, orderedIds);
await db.transaction("rw", db.shots, async () => rewriteContiguousOrder(orderedIds));
```

---

## Scenario: Local draft and project package integrity

### 1. Scope / Trigger

Use this contract whenever durable form state is debounced or a project crosses the IndexedDB ↔ zip boundary.

### 2. Signatures

```ts
updateEpisode(id: Id, patch: Partial<Pick<Episode, "title" | "story" | "order">>): Promise<void>
flushPendingDrafts(projectId: Id): Promise<void> // rejects if any scoped draft fails
exportProjectZip(projectId: Id): Promise<Blob>
importProjectZip(file: Blob): Promise<Project>
useDebouncedDraft<T>(options: {
  initialValue: T;
  persist: (value: T) => Promise<void>;
  delay?: number;
  scope?: string;
  draftKey?: string;
}): {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  status: "saved" | "saving" | "error";
  flush(): Promise<void>;
  retry(): Promise<void>;
}
```

### 3. Contracts

- A dirty local draft must be flushed when its editor unmounts; navigation inside the SPA must not drop the last debounce window.
- Only the latest draft revision may mark an editor as saved.
- Save operations for one draft are serialized. If a new revision appears during an in-flight write, persist it only after the older write settles so completion order cannot overwrite newer data.
- Editors sharing a record must use field-level patch helpers. Aggregate story autosave must merge with the latest persisted beats instead of replacing them from stale local state.
- Package records preserve unknown keys in `extra`, including keys already nested under `extra`.
- Project packages include characters, scenes, props, styles, episodes, shots, and all referenced media. Studio-owned rows remain excluded.
- Beat IDs are remapped within their owning episode during import. Identical legacy beat IDs in different episodes must not cross-link shots.
- Imported media derives MIME from its filename when `Blob.type` is empty.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Navigate before debounce fires | Flush the latest draft once; keep failed keyed drafts recoverable on reopen |
| Backup while a draft save fails | Reject; show failure and do not download a stale backup |
| Concurrent independent fields/slots | Merge inside write transaction; retain both changes |
| Concurrent last-episode deletion | At least one episode survives |
| An older save resolves after a newer edit | Do not mark the newer draft saved |
| Optional package JSON is absent | Import an empty collection for that entity |
| Invalid manifest / JSON | Reject the whole package; no partial writes |
| Media blob has empty MIME | Infer known image/video MIME from extension; otherwise use `application/octet-stream` |

### 5. Good/Base/Bad Cases

- Good: type a story title, immediately return to the episode list, reopen it, and see the title
- Base: old packages without props/styles import with empty arrays
- Bad: flattening or discarding `record.extra` during an export/import round-trip

### 6. Tests Required

- Navigate/unmount with a dirty series logline, episode story, and world setting; assert the latest value persists
- Resolve two saves in reverse timing order; assert the persisted value is the newest revision
- Edit a beat from the shot page while a story draft is dirty; assert both changes survive
- Export/import records containing nested and top-level unknown keys; assert they merge into `extra`
- Export/import props/styles with slot media; assert IDs and MIME types are remapped and restored
- Import two episodes containing the same legacy beat ID; assert each shot maps to the beat in its own episode
- Force an import error; assert no project-owned table was partially written
- Concurrent field/slot patches, last-episode deletes, and slot cleanup failure rollback (`repoReliability.test.ts`)
- Immediate backup drains newer draft revisions; failures reject and retain latest value (`debouncedDraft.test.ts`)
- Legacy v5 filters migrate with own beat IDs; legacy/new ZIP remaps filters (`repoReliability.test.ts`, `projectPackage.test.ts`)
- Concurrent modification during ZIP export yields a coherent JSON + Blob snapshot (`projectPackage.test.ts`)

### 7. Wrong vs Correct

#### Wrong

```ts
return () => window.clearTimeout(handle);
```

#### Correct

```ts
return () => {
  window.clearTimeout(handle);
  if (!draftRef.current.saved) void persist(draftRef.current.value);
};
```

---

## Scenario: Short-lived destructive action undo

### 1. Scope / Trigger

Use for delete, reorder, and bulk operations where an immediate mistake should be recoverable without a persistent history system.

### 2. Signatures

```ts
interface UndoAction {
  label: string;
  restore: () => Promise<void>;
  expiresInMs?: number; // default 8000
}

UndoController.register(action: UndoAction): void
UndoController.undo(): Promise<boolean>
UndoController.clear(): void
```

### 3. Contracts

- Only the latest action is retained.
- Registration replaces and expires the previous action.
- Undo keeps the action while restoring and clears it only after success. Concurrent attempts for the same action share one in-flight operation. A failed restore remains retryable until its original expiry, with a visible error. Completion of an older operation must not change a newly registered action.
- Text input continues to use native editor undo; this controller is not an edit log.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Undo before expiry | Execute restore once; retain pending action; clear on success and return `true` |
| Restore fails | Reject to caller; show error; keep retry until original expiry |
| Concurrent undo of the same action | Share one operation; do not call restore twice |
| Register B while A restores | B keeps its action, timer and error; A settlement cannot clear B |
| Undo after expiry | Do nothing and return `false` |
| Register a second action | Replace the first action |
| Component outside provider calls `useUndo` | Throw a clear provider error |

### 5. Good/Base/Bad Cases

- Good: delete shots, see one “撤销” action, restore the captured records
- Base: let the action expire and continue without durable history
- Bad: register every keystroke or retain Blob-heavy snapshots indefinitely

### 6. Tests Required

- Register, undo once, and assert restore executes exactly once
- Advance fake timers past expiry and assert undo returns false
- Register A then B and assert only B can restore

### 7. Wrong vs Correct

#### Wrong

```ts
registerUndo({ label: "输入文字", restore: async () => restoreEveryKeystroke() });
```

#### Correct

```ts
registerUndo({ label: "已删除镜头", restore: async () => restoreDeletedShots(snapshot) });
```

---

## Design Decision: owner id reuses `projectId`

**Context**: Assets were born as project children. Studio libraries need the same tables without a snapshot/join table yet.

**Decision**: Keep the column name `projectId`. Studio rows use `STUDIO_LIBRARY_ID`. World/shot reference-join is out of scope until asked.

---

## Common Mistakes

### Treating `"studio"` as a project

**Symptom**: A fake project appears in the home list after creating a studio character.

**Cause**: `touchProject` upserted owner id `"studio"`.

**Fix**: Guard with `isStudioLibrary`.


## Reliability contract (2026-09-18)

- Read/merge/write operations must read the current entity inside a Dexie write transaction. Independent field and nested slot updates cannot overwrite one another. Asset update timestamps use field updates, not a stale project snapshot.
- Last-episode deletion count and delete share one transaction. Slot replacement and orphan checks operate on committed references across all owner types; cleanup never deletes shared media.
- `updateEpisodeShotFilters` writes only that episode. Prune deleted beats, preserve the unassigned sentinel, remap IDs on package import, and reveal a deep-linked shot by clearing obstructing filters with feedback.
- `useDebouncedDraft` accepts project `scope` and stable entity-field `draftKey`. Failed/unmounted drafts remain recoverable in the running app; reopening a key must resume it instead of creating an older competing writer. Active editors request browser beforeunload protection while dirty/in-flight/failed and attempt a best-effort flush; pagehide also flushes. Forced termination or confirming leave is not durable persistence. Detached failed drafts are protected by the in-app backup barrier, not a permanent browser unload handler.
- Backup must await `flushPendingDrafts(projectId)` and abort visibly on errors. `exportProjectZip` reads project rows, referenced media records and Blobs in a single readonly transaction before ZIP compression.
- Asset multi-copy removes each committed source from the retry selection immediately. Pending copy dialogs cannot close or change selection; failure retains only uncommitted items.

## Audit remediation: concurrent drafts and compatibility (2026-09)

- `useDebouncedDraft` accepts `persist(value, baseline)`. Flat text drafts rebase
  clean fields from live queries, while dirty fields retain their original baseline.
  Fingerprint external values so an unchanged, stale live-query render after a
  successful save cannot roll the editor back. Defer rebase during an in-flight
  write; serial writes advance their baseline only after acknowledgement.
- Story/world editors pass only `changedDraftFields(value, baseline)` into the
  repository. Episode, world, series-logline and asset text writes compare edited
  fields against current records **inside the write transaction**. Equal final
  values may converge; a differing current value raises `DraftConflictError` and
  rolls the entire patch back. Preserve dirty text and the backup/navigation retry
  barrier. Show the conflict and an explicit adopt-latest action; never silently
  overwrite a competing edit or discard a failed draft.
- Beat deletion undo restores captured shot assignments only when the shot still
  belongs to the original project/episode and remains unassigned. A newer beat
  assignment wins.
- Project ZIPs include additive `mediaMetadata.json` (original id, projectId,
  filename and MIME), exported in the same snapshot as media bytes. Validate owner,
  unique ID, MIME and one-to-one file mapping before any import write. Remap IDs
  while retaining filename/MIME and set imported Blob.type. Older ZIPs without the
  metadata remain readable using extension inference (including `.jfif`).
- Dexie 20 moves duplicate connector definitions into `connectorAliases`, choosing
  latest updatedAt then greatest ID deterministically for the active connector.
  Dexie 21 makes active `definitionId` unique. Atomic upsert includes lookup and
  write in one transaction. Aliases are recovery-only: selectors list only
  `connectors`; frozen runs/jobs use `resolveConnector(id)` without changing their
  IDs or fingerprints. Initial historical alias configs remain intact; an explicit
  config/key edit updates all aliases for that definition, and disconnect removes
  both active config and aliases. Transactions resolving historical IDs must include
  `connectorAliases`. Neither connector table belongs in project ZIPs.

Regression coverage: `draftConcurrency.test.ts`, `debouncedDraft.test.ts`,
`auditDataIntegrity.test.ts`, `connectorMigration.test.ts`, `mediaMetadata.test.ts`,
plus the existing repository/project-package/reference suites.

## Scenario: Atomic shot bulk inverse (A02 / PU-01, SS-05; 2026-09-30)

### 1. Scope / Trigger

All manual multi-shot field edits in ShotEditorPage. The forward transaction, rather than the page render, owns the inverse snapshot. The shared short-lived controller also handles retry for delete/reorder actions.

### 2. Signatures

```ts
type EpisodeShotBulkPatch = Partial<Pick<Shot,
  "beatId" | "durationSec" | "status" | "characterIds" |
  "sceneId" | "propIds" | "styleId" | "notes">>;
interface EpisodeShotBulkUndo {
  projectId: Id;
  episodeId: Id;
  shots: Array<{ id: Id; before: EpisodeShotBulkPatch; after: EpisodeShotBulkPatch }>;
}
patchEpisodeShots(episodeId: Id, ids: Id[], patch: EpisodeShotBulkPatch): Promise<EpisodeShotBulkUndo | undefined>;
undoEpisodeShotBulkPatch(inverse: EpisodeShotBulkUndo): Promise<void>;
```

### 3. Contracts

- Empty selection or an empty allowed patch returns no inverse and creates no undo action. Existing callers may ignore the new return value.
- `before` reads the latest committed rows inside the forward write transaction; `after` records actual normalized values. Both contain exactly the affected allowed fields, including explicit undefined for clearing optional references. Arrays are snapshot copies.
- Undo reads and validates every selected row, scope, current affected value and restored relationship inside one write transaction before writing. Current values must equal captured after or already equal before; compare ordered ID arrays by contents. Any third value rejects the entire inverse.
- Restore only before fields on top of current rows, preserving independent content, slot and other field edits. Status normalization and all existing owner/media/relationship checks remain active.
- `UndoController.getCurrent()` exposes pending and optional error. Provider disables the pending button, displays failure and offers retry. Programmatic callers receive the rejection; the button handles rejection without discarding the action.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Missing, duplicate, foreign or moved target | Reject; no row partially restored |
| One touched field changed again | Reject entire group; retain newer values |
| Independent field or other slot changed | Preserve it while restoring touched fields |
| Touched fields already restored | Permit convergence after scope/reference checks |
| Invalid inverse keys or mismatched before/after key sets | Reject before writes |
| Restore write fails | Transaction rolls back; undo remains retryable before expiry |
| Action expires or is cleared during restore | Settlement cannot resurrect it |
| New action registered during restore | Older settlement cannot clear or add error to it |

### 5. Good/Base/Bad Cases

Good: reverse duration and prop/style assignments together while preserving later content edits. Base: empty selection produces no action. Bad: capture stale rendered rows, then restore via independent Promise.all writes that overwrite later edits or partially succeed.

### 6. Tests Required

Actual repository tests must cover all eight fields, latest before values, normalized after values, copied arrays, optional clears, all-target conflicts, missing/foreign/duplicate targets, independent updates, already-before convergence and rollback on storage failure. Controller tests cover duplicate/reentrant invocation, failed retry, original expiry, clear and replacement while pending, plus synchronous restore failures.

### 7. Wrong vs Correct

```ts
// Wrong: stale page snapshot and several independently committed reverse writes.
registerUndo({label, restore: () => Promise.all(snapshot.map(s => patchShot(s.id, oldPatch(s)))).then(() => {})});

// Correct: actual transaction snapshot and one atomic guarded inverse.
const inverse = await patchEpisodeShots(episodeId, [...selected], patch);
if (inverse) registerUndo({label, restore: () => undoEpisodeShotBulkPatch(inverse)});
```

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

```ts
// Wrong: rendered snapshot and separate async media read precede actual deletion.
const oldRows = shots.filter(s => selected.has(s.id));
const oldMedia = await db.media.bulkGet(idsFrom(oldRows));
await deleteEpisodeShots(episodeId, oldRows.map(s => s.id));

// Correct: consume the recovery snapshot returned by the committed deletion.
const snapshot = await deleteEpisodeShots(episodeId, [...selected]);
if (snapshot) registerUndo({
  label: `已删除 ${snapshot.shots.length} 个镜头`,
  restore: () => restoreShots(snapshot.shots, snapshot.media),
});
```

## Scenario: Manual field/slot compare-and-save (A04 / PU-02, PU-03, SS-02; 2026-09-30)

### 1. Scope / Trigger

Hand-edited asset/shot slots, numeric shot duration, project text/style and explicitly saved output settings. A draft's target and baseline belong to one editor session; another page must not silently replace its content or save target.

### 2. Signatures

```ts
// Each set*Slot retains its existing ID/slot union; baseline is optional for
// compatibility with callers that already enforce independent atomic/CAS guards.
setCharacterSlot(id: Id, key: CharacterImageSlot, slot: GenerationSlot, baseline?: GenerationSlot): Promise<void>;
setSceneSlot(id: Id, key: SceneImageSlot, slot: GenerationSlot, baseline?: GenerationSlot): Promise<void>;
setPropSlot(id: Id, key: PropImageSlot, slot: GenerationSlot, baseline?: GenerationSlot): Promise<void>;
setStyleSlot(id: Id, key: StyleImageSlot, slot: GenerationSlot, baseline?: GenerationSlot): Promise<void>;
setShotSlot(id: Id, field: ShotPictureField, slot: GenerationSlot, baseline?: GenerationSlot): Promise<void>;
patchShot(id: Id, patch: Partial<Omit<Shot, "id" | "projectId" | "episodeId">>, baseline?: Partial<Shot>): Promise<void>;
patchProjectDetails(id: Id, patch: Partial<Pick<Project,
  "name" | "brief" | "genre" | "audience" | "tone" |
  "aspectPreset" | "defaultStyleId" | "generationDefaults">>, baseline?: Partial<Project>): Promise<void>;

// Every manual EditableGenerationSlot consumer supplies owner+entity+slot identity.
// Editor initialization freezes target, owner, title, allowed result kinds,
// cloned baseline and the persistence callback as one SlotEditSession.
onSave(draft: GenerationSlot, baseline: GenerationSlot): Promise<void>;
```

### 3. Contracts

- Baseline comparisons run against the latest row inside the actual write transaction. Compare only touched fields/target slot. Current equal to baseline permits writing; current already equal to requested normalized final value permits convergence; a third value raises `DraftConflictError` and leaves all rows/media unchanged.
- Slot equality uses prompt, ordered image/video reference IDs and result mediaId/kind. Undefined slot equals emptySlot. Independent slots and entity text never cause conflicts or get overwritten. All owner/Blob/MIME/reference checks and committed orphan collection still apply.
- Text uses the existing optional-empty normalization. Duration uses `durationSec ?? 0`, consistent with the numeric editor. Project name compares the trimmed final value; aspect uses normalized presets; generationDefaults uses plain JSON-shaped structural comparison independent of property insertion order and undefined optional keys. Missing defaults and empty object share the editor representation.
- `DurationInput` and all five project text callbacks pass the baseline delivered by `useDebouncedDraft`; immediate style selection passes the rendered field baseline. Optional repository parameters do not excuse dropping a baseline from a manual caller.
- `SlotEditSession` clones its baseline and freezes its save callback and owner. New live data cannot rebind this session. If current targetKey differs, reject before persistence and preserve the draft/owned media; uploads/pickers retain the original owner. An older save completion must not close a newer target's editor.
- CAS/storage failure keeps DraftMediaSession ownership and draft for retry. Success alone releases committed owned media. Explicit cancel cleans only session-owned orphan uploads, preserving shared references.
- ProjectOutputSettings keeps value, baseline and last observed live value. Clean fields follow changed live values; dirty fields keep original baselines. Submit only changed aspectPreset/generationDefaults; defer live rebase while saving, then read the current project once after the write succeeds and acknowledge saved fields from that authoritative snapshot. This distinguishes a genuinely later same-field commit (including a return to the old baseline) from stale live props. Ignore a repeated stale live fingerprint after acknowledgement. Failure keeps draft and original baseline and provides an explicit adopt-latest action. Keep explicit save and unload protection.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Same edited field or slot has a third value | Reject transaction; preserve latest committed value and local draft |
| Different field/slot changes | Save requested field; preserve independent change |
| Current equals normalized requested value | Allow convergence after existing validation |
| Same baseline contents in another target | Identity mismatch rejects; value equality never authorizes switching target |
| Invalid/deleted/foreign referenced media | Reject; no committed slot or cleanup change |
| Media cleanup or storage failure | Roll back row, project touch and media deletion together |
| Output field is clean when another page changes it | Rebase value and baseline; do not manufacture a dirty old value |
| Output field is dirty during external update | Preserve draft/baseline; compare inside txn at save |
| Save acknowledged before live query catches up | Confirm current storage once; repeated stale props cannot roll it back |
| Another writer commits the same field after this write, before acknowledgement | Adopt authoritative latest value for the saved field; do not remain stale and falsely clean |
| Save fails | Keep local values and expose retry/adopt-latest; do not silently reset |

### 5. Good/Base/Bad Cases

Good: save a character front image while another tab edits side image/name; all three updates survive. Base: absent empty slots/defaults compare as editor empties. Bad: pass a new slot without its original baseline, compare entire entity updatedAt, or retain A's text while rebinding onSave to B.

### 6. Tests Required

Actual DB regressions cover same-field conflict and all-or-nothing project patch; every set*Slot guard; ordered references, deleted/foreign media and cleanup rollback; independent slot/text fields; trimmed-name/equal-final convergence; missing duration/defaults normalization and property-order equality. Executable manual session/callback checks cover frozen baseline/owner/target, target switch, failed owned-media save and retry. Output draft tests cover clean live rebase, dirty baseline retention, partial saves, deferred/acknowledged save with stale props, later same-field writes including old-baseline return, and adopt-latest. Inspect every manual consumer's actual callback path in independent review; pure database tests alone do not prove UI wiring.

### 7. Wrong vs Correct

```ts
// Wrong: the draft component supplied a baseline but the persistence callback dropped it.
persist={(durationSec) => patchShot(shotId, {durationSec})}
onSave={(slot) => setCharacterSlot(character.id, key, slot)}

// Correct: transaction checks the exact field/slot seen by this editing session.
persist={(durationSec, baseline) => patchShot(shotId, {durationSec}, {durationSec: baseline})}
onSave={(slot, baseline) => setCharacterSlot(character.id, key, slot, baseline)}
```


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


## Scenario: Changed-field and membership intent (B03 / AU-03, PU-04; 2026-09-30)

`updateContextPolicy(threadId, patch: Partial<ContextPolicy>)` reads the current thread/general-agent policy inside the existing transaction, merges only explicit fields, then normalizes. UI passes the actual changed fields, not a spread of its rendered full policy. Independent fields survive stale renders/two callers; same-field ordinary settings follow last committed explicit intent. Explicit undefined customContextTokens clears the field. `resetThreadContextPolicy` and `saveContextPolicyAsDefault` read their source in the transaction and deliberately replace the whole normalized policy, including removing optional tokens absent from that source. They must not reuse merge semantics for a reset.

`setShotCharacterSelected(shotId, characterId, selected)` applies explicit add/remove membership intent to the latest shot within PRODUCTION_TABLES, validates current project/episode/beat and surviving asset references, then writes and touches project atomically. Repeated selected values are idempotent; keep existing order and append new members. Missing selected target rejects; removal of a deleted target may repair a stale reference only if all survivors validate. Existing foreign target rejects for either selected value. Checkbox callbacks pass checked===true and display mutation errors. Whole-array `patchShot`, explicit clear and A02 bulk assignment/undo remain deliberate exact replacement APIs, not checkbox-intent helpers.

`tests/b03IntentBoundaries.test.ts` executes actual ContextParameters and ShotRow callbacks plus production transactions: stale independent/same-field updates, optional clear and full reset/default copy, rapid add/add and add/remove, duplicate intent, missing/foreign scope, invalid survivors, rollback and unrelated fields/media. Its hook host and fake IndexedDB do not establish ReactDOM or native browser scheduling. Do not replace transaction tests with assertions on a copied merge or source text.

## C03 parent ownership and modern package identity contract (2026-09-30)

### 1. Scope / Trigger
Standalone asset/media creation and modern video project ZIP restore.

### 2. Signatures
`addCharacter/Scene/Prop/Style(projectId)` create only under an existing project or STUDIO_LIBRARY_ID. `putMedia(record)` verifies its parent in the existing media/projects transaction. `importProjectZip` validates modern raw episode/shot/beat identities before repair/remapping.

### 3. Contracts
Asset create opens a minimal projects + owning-asset rw transaction. Read nonstudio parent, create, touch project within that transaction; nested Agent transactions remain compatible. Studio system ownership needs no ordinary projects row. Late async results after project deletion reject without orphans. Failure touching the project rolls back the asset/media write.

A modern nonempty episodes array defines the authoritative original episode IDs. Every original shot episodeId is required and must resolve; optional beatId must be present in that same original episode. Reject duplicate episode/shot IDs and duplicate beat IDs within an episode. The same beat ID in distinct episode scopes is not inherently ambiguous. Validate before parsers supply fallback values or remapping mutates IDs. Also check normalized beat IDs before remapping so a synthesized identity cannot collide with an explicit identity; this ambiguity rejects atomically while unique unreferenced repaired beats remain compatible. Legacy missing/empty episode data retains synthesize-first-episode behavior. Preserve valid optional unknown data. Invalid imports create no project/entities/media or atomically roll back.

### 4. Validation / Error Matrix
| Input | Required result |
| --- | --- |
| Deleted/missing nonstudio project | Reject create/media; no row |
| Studio create/media | Valid without synthetic project |
| Parent touch fails | Full create rollback |
| Modern missing/foreign episode reference | Reject, no first-episode fallback |
| Modern cross-episode beat / duplicate identity | Reject atomically |
| Valid modern link | Preserve correct remapped relationship |
| Legacy absent/empty episodes | Existing first-episode compatibility |

### 5. Good / Base / Bad Cases
Good: a late upload is refused after its parent disappears. Base: a legacy single-document video still restores as its first episode. Bad: committing an orphan before touch fails, or silently binding a malformed modern shot to another episode.

### 6. Required Tests
Real repository delayed writes, studio and normal creation, touch fault rollback and nested transaction behavior. Real ZIP modern missing/foreign/cross-episode/duplicate rejection, unchanged database, valid modern and legacy roundtrips and extra preservation. Tests prove storage/parser behavior, not full browser upload latency.

### 7. Wrong vs Correct
Wrong: add asset, then touch parent separately. Correct: verify parent and commit both in one transaction. Wrong: use first-episode fallback for every unknown ID. Correct: confine fallback to the explicit legacy branch and diagnose malformed modern relationships.


## C05 generic patch and cover boundary

See [the seven-section generic patch and cover media contract](asset-output-foundation.md#c05-generic-patch-and-cover-media-contract-2026-09-30). Generic asset/shot media properties reject explicitly, including undefined own values. Dedicated setters and cover replacement validate ownership, nonempty media and target kind inside their write transaction, preserving reference/history recycling and CAS/undo.

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

## D08 shot and beat text draft ownership (2026-10-08)

## 1. Scope / Trigger

Maintain this contract when changing shot scalar text fields or beat title/content/time-of-day editing. Immediate local text, field-specific conflict checks, visible failed-save recovery and registered flush/retention belong to one existing draft protocol. Duration, relationship membership, media slots, reorder/bulk undo and main episode editor drafts remain distinct existing owners.

## 2. Signatures / Owners

- `components/drafts/TextDraftField.tsx` reuses `lib/debouncedDraft.ts` and existing `DraftStatus`, including project flush registration, retained entity-field keys, initial field baseline, retry/useLatest and unload/visibility policy. Its keyed control captures one persist callback for the project/draft-key lifetime; input marks parent retention pending before updating local draft. This is shared text presentation/lifecycle, not a replacement timer/store.
- `components/shots/ShotTextField.tsx` binds `ShotRow`/typed column mapping to `patchShot` text drafts for shot number/content/notes/category/sound/emotion/camera angle/gear/focal length/closeup. Existing duration and relationship editors keep their own contracts.
- `components/story/BeatTextField.tsx` binds ShotEditor beat titles and StoryPage beat title/content/time-of-day to `patchStoryBeat` using the same protocol. Main episode title/logline/script already use it; preserve their B06/CAS/import behavior.
- `lib/useTextDraftRetention.ts` owns readable row/beat pending-status retention only; existing debouncedDraft owns persistence/retry. Missing loaded rows can retain pending/error display without claiming the target still exists.
- Actual `db/shots.patchShot` supports field baselines. `db/episodes.patchStoryBeat(episodeId, beatId, patch, baseline?: Partial<Pick<StoryBeat, "title" | "content" | "timeOfDay">>)` validates the optional text baseline in the existing transaction; it is not a full-object autosave API.

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

## E04 PD07 fresh media retention and batch transaction ownership (2026-10-09)

### 1. Scope

Apply batching to media orphan cleanup and each changed production caller. Preserve collectMediaIds(projectId?) for global current retention and owner-scoped backup projection, plus scalar deleteMediaIfOrphan and injected DraftMediaSession compatibility. Keep PRODUCTION_TABLES at25.

### 2. Signatures / Owners

deleteMediaIfOrphans accepts readonly (Id | undefined)[] and owns or joins a production readwrite root. Deduplicate truthy candidates, bulkGet media rows once, derive each actual MediaRecord.projectId, snapshot global current references once and indexed history sets once per actual owner. The scalar API delegates one ID. Caller mutation, retention snapshot, deletes and durable receipt/event remain under the original transaction owner.

### 3. Contracts

Retain all18 source tables:14 current tables plus productionProposals, agentGenerationJobs, agentGenerationBatches and agentGenerationBatchItems. Current references are global, including archived/library/audio/reference/material-use cases. Historical references use the candidate record owner, including cancelled/deleted-target evidence; foreign-owner-only history retains original exclusion semantics. Do not persist/cache reference sets across calls. Await individual deletes to retain fault hooks. Release a material use only after other uses allow it, clear every copied libraryRetained flag before one snapshot, reject survivors, then emit the event. Roll back use/flags/real Blob deletes on any later failure.

### 4. Validation / Error Matrix

Undefined/missing/duplicate candidates -> safe skip/dedup. A reference added between independent calls -> fresh retention. Same-owner history after target deletion/cancellation -> retained. Foreign-owner-only history -> original parity. Later actual media deletion failure -> all prior current/history/Blob changes restored. Retained copied media or final event fault -> full release rollback. Real shot_delete receipt followed by ledger fault -> receipt and deletion roll back together; successful retry/replay stays idempotent. Orphan-only tools do not gain a business receipt.

### 5. Good / Base / Bad Cases

Good: mutate all relevant current rows first, snapshot once inside the existing production root, use per-candidate-owner history sets and sequential deletes. Base: DraftMediaSession continues per-ID scalar cleanup, retaining failed IDs for retry and releasing kept ownership only after persist succeeds. Bad: clear one flag, snapshot, then clear another; reuse an ambient retention cache; derive history ownership from the deleting caller; claim all uploads plus save are atomic.

### 6. Tests Required

Keep the full18-table retention and complete caller matrix, protected scalar cover/reference/backup paths and actual receipt/undo closure. Native proof must include fresh references, mixed owners, late actual deletes, flags/other uses/events and overlapping-writer commit visibility. Work fixture:30 unique existing library-retained candidates,3 owners,60 original duplicate scalar calls; final receives same duplicates plus undefined/missing,31 lookup keys. Report1080->26 DBCore retention requests and1800->30 returned-row/cursor-step sum separately from candidate reads/writes; formula14 +4*actualOwners applies to this retention scan shape.

### 7. Wrong vs Correct

Wrong: label these logical request/row totals exclusive physical disk IO, IDBCursor-only visits or latency savings. Correct: state the exact denominator, observers, excluded candidate reads/writes, mixed-owner/current-history semantics and finite isolated Chromium evidence limits. Preserve actual mutation fault producers, their failure history and raw source hashes.
