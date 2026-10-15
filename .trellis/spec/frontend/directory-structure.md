# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Application entries live in `apps/web`, `apps/desktop` and `apps/site`. Browser and desktop import the same `@cuepoint/studio/bootstrap`; the site consumes only lightweight `@cuepoint/distribution` exports. The repository uses pnpm workspaces, declared dependencies and explicit export maps.

Shared product routes, components, domain types and business commands currently remain under `packages/studio/src/{routes,components,domain,db,lib}`. This is the application-boundary phase; the subsequent feature-organization task owns their vertical restructuring. Browser/native persistence already uses the shared ProductStore, rather than an IndexedDB-only db layer.

Canonical product contracts remain in `.trellis/spec/frontend`. Package-specific indexes select them under `.trellis/spec/{web,desktop,site,studio,distribution}`; `get_context.py --mode packages` lists actual owners. Unqualified module names below refer to studio unless another owner is stated.

See [Monorepo Boundaries](./monorepo-boundaries.md) for package exports, source coverage, build assembly and acceptance contracts.

---

## Directory Layout

```
packages/studio/src/
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
│   ├── studio/StudioShell.tsx       # guarded Studio owner + shared AppFrame
│   ├── layout/                      # AppFrame, ModuleLayout, ContextPanelHost and PageLayout
│   ├── agent/                       # /agent chat (LobeHub-inspired, chat-only @lobehub/ui)
│   │                                #   topicGrouping.ts, useThreadDeparture.tsx, startPrompt.ts; db/agentRunTerminalState.ts owns settleRun
│   ├── errors/                      # ErrorFallback, RootErrorFallback, ErrorDetailsDialog, showError (see quality-guidelines "Error diagnostics")
│   ├── ui/sheet.tsx                 # shadcn Sheet (global mobile navigation)
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

- Studio create: `packages/studio/src/components/studio/AssetLibraryPages.tsx` → `/characters/$characterId`
- Studio detail: `packages/studio/src/routes/_studio.characters.$characterId.tsx` passes `back={{ kind: "studio" }}`
- Project detail: `packages/studio/src/routes/p.$projectId.assets.characters.$characterId.tsx` passes `back={{ kind: "project", projectId }}`

## Studio navigation and project kinds (2026-10-10)

- `/` redirects to `/agent`; `/settings` renders the settings page; `/connectors` redirects to `/settings?section=connections`. Shared `layout/AppFrame.tsx` owns navigation for both Studio and project shells. Chat, IP, projects, materials and tasks remain separate destinations, with Settings last; connections are embedded inside settings. `/agent/tasks` must not activate chat.
- `/ips` and `/ips/$ipId` are implemented persisted profile surfaces. Membership/context rules belong to [IP / Material Library](./ip-material-library.md); IP is not a project kind.
- `/assets` owns the materials hub while retaining legacy Studio character/scene/prop/style list/detail URLs. Shared editors keep `STUDIO_LIBRARY_ID` versus project ownership checks.
- `projectKinds.tsx` is the presentation availability catalog. Film/series, audio and music dispatch through `ProjectHomePage`; unavailable options are blocked both in the UI and submit handler. Project kind migrations belong to their database contracts.
- Frame/page/overlay presentation lives in `components/layout/` and `components/ui/`; feature data/runtime ownership remains in the original feature modules. See [Shared Desktop UI](./desktop-ui.md).

### Production database owners (D02)

`packages/studio/src/db/` keeps a flat business responsibility structure. Use projects, episodes/beats, shots, creative assets, media retention, studio asset reuse, connectors and chat owners directly; complete cross-domain project/thread lifecycle commands live in `cascadeCommands.ts`. Pure constructors are in `productionRecords.ts`; shared persistence guards and `PRODUCTION_TABLES` are in `productionShared.ts`. Neither support owner imports command owners. Schema/migrations remain in `database.ts`; audio tables remain in `audioShared.ts`. The old omnibus `repo.ts` is removed, with no replacement aggregate facade. See the executable D02 contract in state-management for signatures, rollback/retention and test rules.


## Feature command, session and codec owners

Shot pages consume named commands, a keyboard adapter, typed text-column mapping and separate row/relationship owners. Audio/music pages consume pure selection, shared buffer loading, export and variant commands. Chat uses separate execution-session, three named flow and selection owners; reference drafts remain separate. The project home route delegates to `components/workspace/ProjectHomePage.tsx`; shell/gallery share `components/studio/importStudioProject.ts`. Pure package parsing/remapping lives in `lib/packages/`; root package modules retain ZIP/media IO and one whole import transaction. See [the D03 contract](./component-guidelines.md#d03-feature-responsibility-contract-2026-10-08) for exact owners, signatures, lifecycle/error rules and migration limits.

## Shared navigation presentation (2026-10-13)

`layout/ModuleLayout.tsx` owns internal left navigation presentation; `layout/ContextPanelHost.tsx` coordinates feature-owned panels rendered by `ui/context-panel.tsx`. `ui/icons.tsx` adapts static Phosphor glyphs. `lib/historyNavigation.ts` tracks accepted app history capabilities beside product history; frame arrows never infer a parent route. These owners do not fetch or mutate business records.

## Models.dev catalog (2026-10-14)

`lib/ai/modelCatalog/` owns the Models.dev catalog (baseline, store, matching, price snapshot, sync, `fetchCatalogIndex`, `format.ts`); it replaced the removed LobeHub `lib/ai/modelBank/`. `components/connectors/` holds the "模型目录" subsection of `/settings?section=connections`: `ModelCatalogSection` (sync card, restore), `ModelCatalogPicker` (selection dialog), `ModelPriceTable`, `PriceCells`, `VirtualRows` plus the pure `virtualWindow.ts` / `catalogRows.ts`. Device-local state lives in the `deviceSettings` table through `db/deviceSettings.ts`.

## Settings and shared desktop releases (2026-10-14)

`components/settings/` owns settings navigation, a common visible-section header, neutral rounded groups with divided rows, local preference reads/writes and update interaction hooks. `components/studio/ConnectorsPage.tsx` exports the embedded `ConnectorsSection`. `packages/distribution/src/{releases,platform,version}.ts` owns shared release listing, platform selection and version comparison. Studio's `lib/desktopRelease/download.ts` retains bounded installer verification and runtime Save integration. The site never acquires runtime/download/storage/settings dependencies. See [settings-update](./settings-update.md).

## Landing page entry (2026-10-14)

`apps/site/landing.html` plus `apps/site/src/` form the standalone Vite site; `apps/web/index.html` owns the browser application. Each app builds independently. Root `build` builds both and assembles their outputs with merged manifest/module reports under `dist/.vite/`; nginx still serves `landing.html` at `/` and the app fallback elsewhere, and denies `/.vite/`. Use root `dev:site` for the site and `dev` for the browser app. Desktop uses its own isolated frontend config and excludes the site. Studio's root-route redirect (`/` -> `/agent`) and native hash history remain unchanged. Site robots/sitemap live under `apps/site/public`; shared public brand assets belong to distribution. See [the landing section](./component-guidelines.md#landing-page-standalone-entry-2026-10-14).
