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
│   ├── _studio.index.tsx            # redirect → /agent
│   ├── _studio.agent.tsx            # 对话 layout (owns AgentChatPage + LobeChatTheme)
│   ├── _studio.agent.index.tsx      # /agent URL match (no remount)
│   ├── _studio.agent.$threadId.tsx  # /agent/$threadId URL match (no remount)
│   ├── _studio.projects.tsx         # 项目 library
│   ├── _studio.characters.tsx       # layout Outlet
│   ├── _studio.characters.index.tsx
│   ├── _studio.characters.$characterId.tsx
│   ├── _studio.scenes.*             # same layout + index + $id
│   ├── _studio.props.*
│   ├── _studio.styles.*
│   └── p.$projectId.*               # 一部戏：系列集列表/世界，集内故事/分镜/制作
├── components/
│   ├── studio/AssetLibraryPages.tsx # studio 角色/场景/道具/风格 grids
│   ├── studio/StudioShell.tsx       # md+ icon rail; <md hamburger + Sheet nav
│   ├── agent/                       # /agent chat (LobeHub-inspired, chat-only @lobehub/ui)
│   ├── ui/sheet.tsx                 # shadcn Sheet (studio + agent mobile drawers)
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

## IP studio navigation foundation (2026-09-21)

- `/` still redirects to `/agent`. StudioShell groups global destinations as chat, `/ips`, projects, `/assets`, and `/agent/tasks`, with connectors/settings below. Task navigation must be exclusive from chat, including ARIA current state (TanStack Link has its own prefix-active behavior).
- `/ips` is a coming-soon surface, not a persisted project kind. Independent projects remain supported; IP records/context binding are not implemented in this increment.
- `/assets` groups the existing studio character/scene/prop/style libraries. Preserve their old list/detail URLs and ownership contracts. Shell provides their return-to-hub breadcrumb.
- `projectKinds.tsx` is a presentation-only availability catalog: video/image/copy/podcast/music. Video uses existing film/series repository behavior. Unavailable kinds may be inspected, but both UI and submit handler must prevent creating a video record on their behalf. Do not treat this catalog as a database migration or infer persisted IP membership.
- `/settings` links actual existing connections, project backup and about capabilities; do not fabricate preferences or functioning IP forms.

### Production database owners (D02)

`src/db/` keeps a flat business responsibility structure. Use projects, episodes/beats, shots, creative assets, media retention, studio asset reuse, connectors and chat owners directly; complete cross-domain project/thread lifecycle commands live in `cascadeCommands.ts`. Pure constructors are in `productionRecords.ts`; shared persistence guards and `PRODUCTION_TABLES` are in `productionShared.ts`. Neither support owner imports command owners. Schema/migrations remain in `database.ts`; audio tables remain in `audioShared.ts`. The old omnibus `repo.ts` is removed, with no replacement aggregate facade. See the executable D02 contract in state-management for signatures, rollback/retention and test rules.


## Feature command, session and codec owners

Shot pages consume named commands, a keyboard adapter, typed text-column mapping and separate row/relationship owners. Audio/music pages consume pure selection, shared buffer loading, export and variant commands. Chat uses separate execution-session, three named flow and selection owners; reference drafts remain separate. The project home route delegates to `components/workspace/ProjectHomePage.tsx`; shell/gallery share `components/studio/importStudioProject.ts`. Pure package parsing/remapping lives in `lib/packages/`; root package modules retain ZIP/media IO and one whole import transaction. See [the D03 contract](./component-guidelines.md#d03-feature-responsibility-contract-2026-10-08) for exact owners, signatures, lifecycle/error rules and migration limits.
