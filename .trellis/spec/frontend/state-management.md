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
| Project zip | Still per-project. Studio-owned rows are **not** copied into the zip in this slice |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `add*` with `STUDIO_LIBRARY_ID` | Row written; no `projects` insert |
| `touchProject("studio")` | No-op |
| Missing detail id | See hook-guidelines: liveQuery `get() ?? null` |

### 5. Good/Base/Bad Cases

- Good: 创建角色 on `/characters` lands on `/characters/chr_…` with studio nav current
- Base: opening a project-owned character from the studio list uses studio back, still edits the same Dexie row
- Bad: studio create opens a project picker or `/p/$projectId/assets/characters/$id`

### 6. Tests Required

- Create from each studio library: URL stays `/characters|scenes|props|styles/$id`
- `touchProject("studio")` does not create a project row
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

---

## Scenario: Episode owns story and shots

### 1. Scope / Trigger

A project is a series. Opening it must show 第N集, not a shared story/shot table. World stays on the series. This is a Dexie v3 schema change.

### 2. Signatures

```ts
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
| Series home | `/p/$projectId` episode list + series logline; `/p/$projectId/world` for 世界 |
| Episode interior | `/p/$projectId/e/$episodeId` story, `/shots`, `/produce` |
| Nested route ownership | The route's episode must belong to the route's project before rendering or mutating |
| Shot pictures | `firstFrame` / `lastFrame` / `clip`; old `frame` → `firstFrame`; old `reference` refs merge into `firstFrame` without replacing `result` |
| Zip | `episodes.json` optional; missing file synthesizes episode 1 from `project.story` + all shots. Project props/styles and their media round-trip with the same package |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Delete last episode | Refuse; UI hides 删除 |
| Episode belongs to another project | Treat as missing; do not create or show cross-project shots |
| Delete shots from multiple episodes | Reindex every affected episode independently |
| Query shots by `projectId` only | Wrong: mixes every episode |
| Old IndexedDB / zip without episodes | Upgrade/import creates episode 1 and moves story + shots |

### 5. Good/Base/Bad Cases

- Good: 第2集 新建镜头 does not appear on 第1集
- Base: short film still shows 第1集 on the series home
- Bad: `/p/$projectId` renders `StoryPage` for the whole project

### 6. Tests Required

- New project opens with 第1集; 新建第2集 increments
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

## Scenario: Local draft and project package integrity

### 1. Scope / Trigger

Use this contract whenever durable form state is debounced or a project crosses the IndexedDB ↔ zip boundary.

### 2. Signatures

```ts
updateEpisode(id: Id, patch: Partial<Pick<Episode, "title" | "story" | "order">>): Promise<void>
exportProjectZip(projectId: Id): Promise<Blob>
importProjectZip(file: Blob): Promise<Project>
```

### 3. Contracts

- A dirty local draft must be flushed when its editor unmounts; navigation inside the SPA must not drop the last debounce window.
- Only the latest draft revision may mark an editor as saved.
- Package records preserve unknown keys in `extra`, including keys already nested under `extra`.
- Project packages include characters, scenes, props, styles, episodes, shots, and all referenced media. Studio-owned rows remain excluded.
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
- Export/import records containing nested and top-level unknown keys; assert they merge into `extra`
- Export/import props/styles with slot media; assert IDs and MIME types are remapped and restored
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

## Design Decision: owner id reuses `projectId`

**Context**: Assets were born as project children. Studio libraries need the same tables without a snapshot/join table yet.

**Decision**: Keep the column name `projectId`. Studio rows use `STUDIO_LIBRARY_ID`. World/shot reference-join is out of scope until asked.

---

## Common Mistakes

### Treating `"studio"` as a project

**Symptom**: A fake project appears in the home list after creating a studio character.

**Cause**: `touchProject` upserted owner id `"studio"`.

**Fix**: Guard with `isStudioLibrary`.
