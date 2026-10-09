# E01 scoped canonical context: state-management.md

Source: `.trellis/spec/frontend/state-management.md`; SHA-256 `0fa7387041731978f6ffedb1bbdaf5187eaaffa8c55c96f74c179edc98e119af`. Extracted 2026-10-09 without changing canonical contracts. Planning context only; read additional canonical sections when expanding write scope.

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


## Canonical lines 309–399

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


## Canonical lines 486–530

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


## Canonical lines 653–774

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

