# Directory Structure

> How frontend code is organized in this project.

---

## Overview

File routes under `src/routes/`. Feature UI under `src/components/`. Domain types in `src/domain/types.ts`. IndexedDB in `src/db/`.

---

## Directory Layout

```
src/
├── routes/
│   ├── _studio.tsx                  # StudioShell
│   ├── _studio.index.tsx            # 项目 library
│   ├── _studio.characters.tsx       # layout Outlet
│   ├── _studio.characters.index.tsx
│   ├── _studio.characters.$characterId.tsx
│   ├── _studio.scenes.*             # same layout + index + $id
│   ├── _studio.props.*
│   ├── _studio.styles.*
│   └── p.$projectId.*               # 一部戏：系列集列表/世界，集内故事/分镜/制作
├── components/
│   ├── studio/AssetLibraryPages.tsx # studio 角色/场景/道具/风格 grids
│   ├── assets/*DetailPage.tsx       # shared detail editors
│   └── workspace/                   # in-project chrome
├── db/
├── domain/
└── lib/
```

---

## Module Organization

Studio libraries are layout + index + `$id`. Do not put the library grid and the detail editor in the same route file.

Creating a studio asset must navigate to the **studio** `$id` route, not `p.$projectId.assets.*`.

Series shell owns `/p/$projectId` (episode list) and `/p/$projectId/world`. Episode shell owns `/p/$projectId/e/$episodeId` (story), `/shots`, `/produce`. Old `/p/$projectId/shots` redirects to the first episode.

Project world owns project-scoped character, scene, prop, and style detail routes under `/p/$projectId/assets/*/$id`. Every shared detail editor must verify that the loaded asset belongs to the route project before rendering mutations.

---

## Naming Conventions

- Route files follow TanStack Router: `_studio.characters.$characterId.tsx`
- Shared editors: `CharacterDetailPage`, `SceneDetailPage`, `PropDetailPage`, `StyleDetailPage`
- Studio grids live in `AssetLibraryPages.tsx`; `PropLibraryPage.tsx` / `StyleLibraryPage.tsx` re-export only

---

## Examples

- Studio create: `src/components/studio/AssetLibraryPages.tsx` → `/characters/$characterId`
- Studio detail: `src/routes/_studio.characters.$characterId.tsx` passes `back={{ kind: "studio" }}`
- Project detail: `src/routes/p.$projectId.assets.characters.$characterId.tsx` passes `back={{ kind: "project", projectId }}`
