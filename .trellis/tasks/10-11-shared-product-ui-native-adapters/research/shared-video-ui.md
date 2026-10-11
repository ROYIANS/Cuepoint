# Research: Shared video UI and native adapters

- Query: Determine how to converge the browser Dexie video workspace and the Tauri/SQLite workspace onto one product UI and command surface, while keeping browser/native storage adapters separate; also determine the native icon change needed to make the existing logo sit on an opaque dark background.
- Scope: mixed (internal code/spec review with official Tauri references)
- Date: 2026-10-11

## Findings

### Current runtime boundary

The app is one Vite/React application with a runtime branch, not two independently built frontends. `src/routes/_studio.projects.tsx:1-5` mounts `ProjectGalleryPage`, and `ProjectGalleryPage` chooses `NativeProjectGalleryPage` only when `isNativeWorkspaceRuntime()` is true (`src/components/studio/ProjectGalleryPage.tsx:43-50`). The project route is likewise a single `WorkspaceChrome` entry (`src/routes/p.$projectId.tsx:1-10`). The browser branch owns Dexie queries and the existing workspace shell (`src/components/workspace/WorkspaceChrome.tsx:58-172`), while the native branch returns a separate native page immediately (`WorkspaceChrome.tsx:53-55`). This means React, routing, styles and primitives are shared at the application level, but the native project/editor screen is currently a parallel simplified page.

`WorkspaceChrome` is the key convergence seam. The browser branch supplies `AppFrame`, workspace header/navigation, import/backup/settings actions and the route `<Outlet />` (`src/components/workspace/WorkspaceChrome.tsx:172-344`). The native branch bypasses all of that and calls `NativeProjectWorkspacePage` directly (`WorkspaceChrome.tsx:53-55`). Native navigation is then inferred from `location.pathname` by `episodePath` (`src/components/workspace/NativeProjectWorkspacePage.tsx:12-15`) instead of letting the shared route tree render the corresponding feature page. The finished design should retain one `AppFrame`/workspace shell and one set of feature pages; only the repository/controller selected by runtime should differ.

### Browser feature owners and behavior to preserve

- `ProjectGalleryPage` has the complete project-library behavior: Dexie live queries for projects, IP profiles and links, search/sort/type/IP/archive filters, derived covers, create modes (video/audio/music), rename, delete, archive, IP binding and ZIP backup (`src/components/studio/ProjectGalleryPage.tsx:52-201`, `203-317`). `NativeProjectGalleryPage` only loads native workspace state, accepts a title, creates a project and renders a simple card list (`src/components/studio/NativeProjectGalleryPage.tsx:10-33`). Convergence cannot stop at styling these two cards: native needs the same view/controller behavior where the native data domain supports it, while unsupported commands need explicit availability states rather than a second permanent editor.
- `ProjectHomePage` is the browser project-kind/mode dispatcher. It repairs a missing film episode, redirects film projects to the story route, renders `EpisodeListPage` for series, and delegates audio/music (`src/components/workspace/ProjectHomePage.tsx:12-78`). The native page currently always renders a custom project home and defaults native project creation to a film project in Rust (`desktop/tauri/src-tauri/src/workspace.rs:291-315`). A shared controller must preserve the project-kind/mode decision; the native project DTO currently cannot represent the browser project metadata needed for it.
- `EpisodeListPage` owns series logline drafts, live episode/shots queries, add/delete/reorder with undo, last-episode deletion protection, cover derivation and navigation (`src/components/workspace/EpisodeListPage.tsx:37-222`, `224-250`). Native has no episode-list page; its custom `ProjectHome` only maps episodes and adds one (`src/components/workspace/NativeProjectWorkspacePage.tsx:52-60`).
- `StoryPage` owns two live records plus world references, retained text drafts, conflict-safe episode draft persistence, script file import with race-aware candidate confirmation, beat creation from selected UTF-16 script ranges, beat reorder/delete/duplicate with undo, character/scene selection and time-of-day edits (`src/components/story/StoryPage.tsx:42-87`, `93-248`, `250-462`). Native `StoryEditor` is a compact form with blur saves and no shared draft/conflict guard, import workflow, selection range, character/scene relationships, duplication, deletion, undo or reorder (`src/components/workspace/NativeProjectWorkspacePage.tsx:61-67`).
- `ShotEditorPage` is a full workbench, not just a list. Its read dependencies include project/episode/shots, characters/scenes, props/styles, media slots and unavailable/draft retention (`src/components/shots/ShotEditorPage.tsx:119-200`). Commands cover filters, visible columns, settings, beat and shot reorder, bulk patches with undo, selection, duplicate/delete, relation editing and keyboard activation (`ShotEditorPage.tsx:320-499`). The view includes the dense header/toolbars, DnD beat groups, row virtualization, media/design modes, filters, bulk controls and relation dialogs (`ShotEditorPage.tsx:501-1117`, `1123-1313`). Native `ShotsEditor` only renders simple cards with content, notes, duration and status (`NativeProjectWorkspacePage.tsx:68-74`); it cannot be the final product page if the requirement is one UI/behavior set.

### Existing browser command boundaries

The browser commands are already close to a repository port boundary, but pages currently call them and Dexie directly. Episode commands in `src/db/episodes.ts` include list/first/ensure/add/update draft/delete/restore/reorder, beat add/patch/reorder/duplicate/restore/delete and episode-local shot-filter updates (`episodes.ts:28-101`, `109-171`, `174-279`, `281-395`). They enforce project ownership, complete order, draft baselines, asset references, atomic transactions and touch timestamps. Shot commands in `src/db/shots.ts` include single/batch add, patch with field-level baseline checks, relationship membership, bulk patch/undo, reorder, duplicate, restore and media-slot operations (`shots.ts:65-152`, `154-287`, `290-367`, `369-443`). Project commands in `src/db/projects.ts` cover create, rename, detail/output/settings/world updates and series logline (`projects.ts:27-220`). These command functions should remain the browser adapter implementation rather than be duplicated in native-specific components.

The shared contract should expose a typed `VideoWorkspaceRepository`/controller with the browser command semantics, including command result/undo receipts instead of rebuilding undo state from rendered rows. A minimal useful surface is:

- query/read: project summary/details, video mode/logline, ordered episodes, episode story/beats, ordered shots, world relation summaries, shot settings/columns/filters, media-slot availability;
- project: create (kind/mode/aspect), rename, archive/delete, project details/output/settings and backup/import where supported;
- episode: ensure/add/update draft/delete/restore/reorder;
- beat: add from script range, patch text/relations, reorder, duplicate with optional shots, delete/restore;
- shot: add/batch add, patch text/relations/status/metadata, bulk patch with undo, delete/restore, duplicate, reorder, filters/settings/columns and media-slot commands;
- lifecycle: unavailable/missing owner, retained draft/pending, conflict/retry and explicit unsupported-capability state.

The UI should depend on this contract and a hook/controller that subscribes to it. The browser implementation can continue using Dexie `useLiveQuery` internally. The native implementation should invoke SQLite actions and return the same canonical view/command results. Avoid making a fake compatibility mapper that silently drops fields: native schema and DTOs must grow to the shared contract first.

### Native DTO/schema gap

The native renderer types are intentionally a small prototype (`src/lib/nativeWorkspace.ts:3-48`), and the Rust DTOs match that reduced shape (`desktop/tauri/src-tauri/src/contracts.rs:20-80`, `112-125`). Compared with `src/domain/types.ts`, the missing fields are material:

- Browser `Project` contains kind/archive/defaults/brief/genre/audience/tone/id/name/mode/aspect/cover/timestamps/columnSettings/shotSettings/story/setting (`src/domain/types.ts:243-264`); native `Project` only has `id` and `title` (`contracts.rs:20-24`), with mode/logline split into `VideoProject` (`contracts.rs:28-33`).
- Browser `Episode` stores `story.logline`, `story.script`, `story.beats`, episode-local shot filters and timestamps (`src/domain/types.ts:164-181`); native `Episode` stores flat title/logline/script and timestamps (`contracts.rs:37-46`).
- Browser `StoryBeat` has character IDs, optional scene ID and a range carrying `{start,end,excerpt}` (`src/domain/types.ts:146-158`); native `Beat` only carries title/content/time-of-day and numeric start/end (`contracts.rs:50-59`).
- Browser `Shot` has string shot number, status, three generation slots, category, duration, text fields, character/scene/beat/prop/style relationships and extra metadata (`src/domain/types.ts:331-360`); native `Shot` has a numeric shot number, text subset and beat relationship but no slots, category, character/scene/prop/style relationships or metadata (`contracts.rs:63-80`).
- Browser settings and filters are project/episode-owned (`src/domain/types.ts:90-140`); native state has no equivalent settings/column/filter DTOs. Native state only exposes `referencedAssetIds` in the video projection (`src/lib/nativeWorkspace.ts:19-30`; the projection is assembled in `desktop/tauri/src-tauri/src/database.rs:84-130`).
- Native actions are only ensure/state/availability/project/video state/video project/episode/reorder episode/beat/reorder beat/shot/reorder shot/import (`src/lib/nativeWorkspace.ts:37-48`). There are no delete/restore/duplicate/bulk/filter/settings/column/media-slot/relation commands.

Native validation is stronger than the renderer page in some ownership/order areas (fresh schema 3, strict state closure and orphan rejection in `desktop/tauri/src-tauri/src/workspace.rs:221-280` and `database.rs`), but renderer update methods currently ignore baselines (`src/lib/nativeWorkspace.ts:131-137`, `153-157`, `176-180`). The shared UI's draft/conflict contract must either be implemented natively or the adapter must return an explicit capability and retain the existing browser owner guard; silently saving the last blur value would diverge from the product behavior.

### Native routes and shell limitations

Browser nested routes mount actual feature components (`src/routes/p.$projectId.e.$episodeId.shots.tsx:1-14`; story route is under the episode outlet), while native bypasses `<Outlet />` and parses only the pathname. Native page branches only between project home, story form and shots cards (`src/components/workspace/NativeProjectWorkspacePage.tsx:27-54`). Links for world, produce, memory, project settings and project assets still exist in the browser shell (`src/components/workspace/WorkspaceChrome.tsx:209-340`) but have no native implementation through this branch. The shared route/shell batch should therefore:

1. keep the same `AppFrame`, workspace header, import/backup/settings affordances and route `<Outlet>` in both runtimes;
2. render shared project/episode/story/shot pages from route components;
3. select the repository/controller with `isNativeWorkspaceRuntime()` at the data boundary, not by replacing the page tree;
4. mark native-only unsupported areas as explicit capability-gated pages until their data domain exists, instead of showing a different editor that users could mistake for the complete feature.

### Native icon evidence and required treatment

`desktop/tauri/src-tauri/tauri.conf.json:16-17` bundles `icons/icon.png` and `icons/icon.icns`. The tracked `desktop/tauri/src-tauri/icons/icon.png` is a 128×128 RGBA PNG whose corners are alpha zero; the generated `icon.icns` also retains alpha (exporting it with `sips` reports a 1024×1024 RGBA PNG). This explains why an operating-system icon surface can appear with a light/default tile even though the logo artwork itself renders dark: the native source has no opaque background.

The web brand contract explicitly says to preserve the supplied alpha channel and artwork (`public/brand/README.md:1-12`) and the About page puts the lockup on black. Do not modify `public/brand/logo*.png|webp`; create a native-only opaque icon source by compositing the existing logo pixels over the chosen shared dark token, then regenerate the full Tauri icon set and ICNS. Current design tokens define `--surface-navigation: #0c0c0c` and `--surface-app: #101010` (`src/styles.css:51-70`). `#0c0c0c` is the better native icon background default because it is the shared navigation/brand surface and is visually black; if the product owner intends the app canvas token instead, use `#101010` consistently for every generated icon. The source asset's alpha must be flattened, not merely previewed against black, and the generated `32x32`, `128x128`, `128x128@2x`, `icon.png` and `icon.icns` outputs should be checked for opaque corners and visual centering.

### Concrete implementation batches

1. **Contract and browser adapter (behavior-preserving).** Add canonical video view/command types and a repository/controller boundary under `src/lib/` (or the existing domain/repository layer). Wrap current `db/projects.ts`, `db/episodes.ts`, `db/shots.ts`, `useDebouncedDraft`, retained-draft guards and `useUndo` without changing browser behavior. Add adapter tests for ownership, order, draft baseline, undo receipt and unsupported capabilities. Keep browser `ProjectGalleryPage`, `ProjectHomePage`, `EpisodeListPage`, `StoryPage` and `ShotEditorPage` as the behavior oracle during this batch.
2. **Native data-domain completion.** Expand fresh SQLite schema/DTOs/actions to represent the shared video model (project metadata, episode story/filters, full beat relationships/ranges, full shot metadata/slots/settings/columns, required asset/reference summaries). Add native implementations for all repository commands needed by the shared pages, including atomic undo-friendly results and baseline/conflict checks. Extend native tests for reopen closure, ordering, ownership and command parity. No migration or legacy reader is needed under the project policy.
3. **Shared feature pages and shell.** Extract shared page/view components from browser feature owners and make them consume the repository/controller. Replace the runtime replacement in `WorkspaceChrome` with the same `AppFrame`/workspace header/Outlet and select only the data adapter. Reuse one `ProjectGallery` view with capability-backed commands; reuse `ProjectHome`, `EpisodeList`, `StoryPage` and `ShotEditorPage` views. Native should no longer keep `NativeProjectWorkspacePage`/`NativeProjectGalleryPage` as the final editor; they can be retired after parity or kept only as a short-lived migration aid during the same task.
4. **Native icon resource.** Generate an opaque native-only icon over `#0c0c0c` (or one explicitly selected shared token), regenerate Tauri outputs via the pinned Tauri CLI/tooling, update only native icon resources/config as needed, and verify RGBA alpha is opaque at corners plus packaged macOS app rendering. Keep web favicon/logo alpha and versioning unchanged unless the artwork itself changes.
5. **Parity and packaged checks.** Run browser type/lint/tests/quality/build, native TypeScript/lint/quality, Rust tests/clippy, and a packaged app smoke path for project creation → episode → story/beat → shots. At matched route states, compare browser and native screenshots/interaction traces at the desktop-ui widths. Verify that missing/unsupported native domains are explicit and that no Dexie reads/writes occur in the native adapter.

## Files found

- `src/components/studio/ProjectGalleryPage.tsx` — complete browser project library, filters, creation, archive, rename, delete and backup; runtime branch at lines 43-50.
- `src/components/studio/NativeProjectGalleryPage.tsx` — reduced native project list/create page.
- `src/components/workspace/WorkspaceChrome.tsx` — browser workspace shell and native runtime replacement branch.
- `src/components/workspace/ProjectHomePage.tsx` — project kind/mode dispatch and film episode repair.
- `src/components/workspace/EpisodeListPage.tsx` — series episode collection, drafts and undoable commands.
- `src/components/story/StoryPage.tsx` — script/beat editor, import, draft/conflict ownership, world relationships and undo.
- `src/components/shots/ShotEditorPage.tsx` — full shot workbench, filters, bulk actions, DnD, media and relations.
- `src/components/workspace/NativeProjectWorkspacePage.tsx` — reduced native project/story/shot editor.
- `src/lib/nativeWorkspace.ts` — native invoke adapter, DTOs and currently supported action/result surface.
- `src/domain/types.ts` — canonical browser Project/Episode/StoryBeat/Shot/filters/settings/slot model.
- `src/db/projects.ts` — browser project create/detail/settings/output/series-logline commands.
- `src/db/episodes.ts` — browser episode and beat commands plus filters.
- `src/db/shots.ts` — browser shot, bulk, reorder, duplicate, restore and media commands.
- `src/components/layout/AppFrame.tsx` — shared desktop navigation and frame.
- `src/components/layout/PageLayout.tsx` — shared headers, toolbars, content and states.
- `src/components/studio/LibraryHeader.tsx` — shared collection title/search/sort presentation.
- `src/styles.css` — shared dark surface tokens (`#0c0c0c`, `#101010`) and desktop layout rules.
- `desktop/tauri/src-tauri/contracts.rs` — native schema 3 DTOs/actions.
- `desktop/tauri/src-tauri/database.rs` — native SQLite schema/state/validation/projection.
- `desktop/tauri/src-tauri/workspace.rs` — native workspace open/run and video command dispatch.
- `desktop/tauri/src-tauri/tauri.conf.json` — native bundle icon paths.
- `desktop/tauri/src-tauri/icons/icon.png` and `icon.icns` — current transparent native icon assets.
- `public/brand/README.md`, `public/brand/logo*.png|webp` — web brand artwork and alpha-channel contract.

## External references

- Tauri 2 configuration reference: https://v2.tauri.app/reference/config/ — confirms `tauri.conf.json` owns `bundle.icon` and supports platform-specific configuration.
- Tauri 2 app-icon guide: https://v2.tauri.app/develop/icons/ — documents the `src-tauri/icons` output location and recommends the complete desktop set (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.icns`, plus Windows ICO where applicable).
- Tauri 2 architecture: https://v2.tauri.app/concept/architecture/ — confirms the app is HTML/CSS/JS rendered in the OS WebView with an optional Rust backend, supporting the shared React UI/native storage-adapter split.
- Tauri 2 IPC: https://v2.tauri.app/concept/inter-process-communication/ — confirms `invoke` is JSON-serializable message passing, so the repository boundary must use closed serializable DTOs rather than Dexie objects/Blobs.
- Local pinned versions: `desktop/tauri/package.json` uses `@tauri-apps/api 2.12.2` and CLI `2.12.1`; `desktop/tauri/src-tauri/Cargo.toml` pins `tauri 2.12.2`.

## Related specs

- `.trellis/spec/frontend/desktop-ui.md` — one AppFrame/PageLayout/Tabs/scroll/overlay/print contract; presentation helpers do not own feature data.
- `.trellis/spec/frontend/native-workspace.md` — browser Dexie and native SQLite are separate owners, schema 3 is fresh development, and native routes must not mirror rows into Dexie.
- `.trellis/spec/frontend/state-management.md` — browser IndexedDB owner and native SQLite video-slice boundary.
- `.trellis/spec/frontend/workspace-storage.md` — managed workspace/file ownership and media-reference semantics.
- `.trellis/spec/frontend/component-guidelines.md` — thin routes, feature pages and shared UI primitives.
- `.trellis/spec/guides/code-reuse-thinking-guide.md` — search for existing behavior and extract shared complex logic instead of duplicating it.

## Caveats / Not Found

- No completed `VideoWorkspaceRepository` or equivalent cross-runtime interface exists yet; `src/lib/nativeWorkspace.ts` is the closest native adapter, and browser feature pages still call Dexie/DB command modules directly.
- Native route behavior for world, project assets, memory, produce, import/backup and project settings is not implemented in the current runtime branch. This is a capability/domain gap, not a styling mismatch.
- The current native `createProject` flow seeds film mode and a first episode in Rust (`workspace.rs:291-315`); a shared project creation UI needs explicit mode/kind metadata before it can match browser behavior.
- The exact requested icon background hex is not encoded in the supplied logo: web logo files preserve alpha and their corners are transparent. The repository provides two dark tokens (`#0c0c0c` and `#101010`), so implementation should record the selected token and use it for all generated native icon sizes. Do not alter the web logo alpha unless the user explicitly requests a brand-artwork change.
- Current native adapter methods accept optional baselines but discard them (`nativeWorkspace.ts:131-137`, `153-157`, `176-180`); shared draft/conflict parity will require a deliberate native contract, not a type-only refactor.
- The current `nativeWorkspace.ts` response assertion checks only the outer `result` envelope (`nativeWorkspace.ts:60-63`); full Zod closure validation is stronger in the separate bridge/acceptance path. Hardening can be included with the adapter contract batch if scope permits, but it is not solved by UI extraction alone.
