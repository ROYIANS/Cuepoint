# State Management

> How state is managed in this project.

---

## Overview

There is no backend. Durable state lives in IndexedDB (`src/db/database.ts` + `src/db/repo.ts`). UI reads with `useLiveQuery`. Ephemeral UI (search, sort, dialog open) stays in React `useState`.

---

## State Categories

| Kind | Where | Examples |
| --- | --- | --- |
| Durable | Dexie tables via `repo.ts` | Project, Episode, Character, Scene, Prop, VisualStyle, Shot, Media |
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

`Project.story` is only the series logline. Script and beats live on `Episode.story`. Shots must have `episodeId`.

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
| Zip | `episodes.json` optional; missing file synthesizes episode 1 from `project.story` + all shots. Project props/styles and their media round-trip with the same package |

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

### 5. Good/Base/Bad Cases

- Good: 第2集 新建镜头 does not appear on 第1集
- Base: a film owns one episode but opens directly on its story
- Bad: `/p/$projectId` renders `StoryPage` for the whole project

### 6. Tests Required

- New project opens with 第1集; 新建第2集 increments
- New default film skips the episode list; an explicitly created series opens the episode list
- Missing mode remains series, while package round-trip preserves an explicit mode
- Workspace view and existing shot settings survive partial updates and package round-trip
- Shot isolation per `episodeId`
- Route and repo reject a mismatched `projectId` + `episodeId`
- Deleting a mixed set reindexes every affected episode
- `parseShotPictureSlots`: `frame.result` kept on `firstFrame`; `reference` ids appended to first-frame refs
- Zip round-trip preserves nested `extra`, props, styles, and imported media MIME types

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

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Range no longer matches script | Remove `scriptRange`; preserve beat content |
| Ordered IDs contain duplicates/missing/foreign IDs | Reject without partial writes |
| Duplicate beat with shots | Clone beat and its shots with new IDs under the same episode |
| Restore deleted shots | Restore captured media and exact orders, then normalize safely |

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
exportProjectZip(projectId: Id): Promise<Blob>
importProjectZip(file: Blob): Promise<Project>
useDebouncedDraft<T>(options: {
  initialValue: T;
  persist: (value: T) => Promise<void>;
  delay?: number;
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
| Navigate before debounce fires | Flush the latest draft once |
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
- Undo clears the action before awaiting restore, preventing duplicate execution.
- Text input continues to use native editor undo; this controller is not an edit log.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Undo before expiry | Execute restore once and return `true` |
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
