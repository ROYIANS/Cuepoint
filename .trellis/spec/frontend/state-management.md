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
| Shot pictures | `firstFrame` / `lastFrame` / `clip`; old `frame` → `firstFrame`; old `reference` refs merge into `firstFrame` without replacing `result` |
| Zip | `episodes.json` optional; missing file synthesizes episode 1 from `project.story` + all shots |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Delete last episode | Refuse; UI hides 删除 |
| Query shots by `projectId` only | Wrong: mixes every episode |
| Old IndexedDB / zip without episodes | Upgrade/import creates episode 1 and moves story + shots |

### 5. Good/Base/Bad Cases

- Good: 第2集 新建镜头 does not appear on 第1集
- Base: short film still shows 第1集 on the series home
- Bad: `/p/$projectId` renders `StoryPage` for the whole project

### 6. Tests Required

- New project opens with 第1集; 新建第2集 increments
- Shot isolation per `episodeId`
- `parseShotPictureSlots`: `frame.result` kept on `firstFrame`; `reference` ids appended to first-frame refs

### 7. Wrong vs Correct

#### Wrong

```ts
db.shots.where("projectId").equals(projectId).sortBy("order")
```

#### Correct

```ts
db.shots.where("episodeId").equals(episodeId).sortBy("order")
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
