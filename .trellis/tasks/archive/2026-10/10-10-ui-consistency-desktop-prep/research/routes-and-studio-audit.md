# Research: Route inventory and Studio presentation consistency

- Query: Account for every route and audit source-visible UI differences in StudioShell, Projects, Material Library, IP list/detail, character/scene/prop/style lists/details, Connectors and About before selecting a common visual baseline.
- Scope: internal; route and component source inspection only. No browser API, screenshot or user data access by this researcher.
- Date: 2026-10-10
- Task: `.trellis/tasks/10-10-ui-consistency-desktop-prep`; planning only.
- Coverage states: **source-reviewed** means the cited source was read; **native-pending** means rendered state, computed layout, keyboard behavior and screenshot evidence have not been verified here. These states must not be treated as equivalent.

## Findings

### 1. Complete route accounting

`research/route-inventory.json` accounts for all **47** current `src/routes/*.tsx` files, records their route ID, public URL, adapter and feature page source, classification, variant/ownership notes and separate source/native coverage. Counts are **25 page adapters**, **1 persistent Agent page host**, **3 null-rendering Agent view selectors**, **10 provider/shell/outlet layouts**, and **8 redirects**. Route file count is not screen count.

| Classification | Files / visible ownership |
| --- | --- |
| Root provider (1) | `__root.tsx` → `RootLayout` / TooltipProvider, UndoProvider, Outlet, Toaster (`src/routes/__root.tsx:11`). |
| Application shells (2) | `_studio.tsx` → StudioShell; `p.$projectId.tsx` → WorkspaceChrome. |
| Outlet-only layouts (7) | `_studio.characters.tsx`, `_studio.ips.tsx`, `_studio.props.tsx`, `_studio.scenes.tsx`, `_studio.styles.tsx`, `p.$projectId.assets.tsx`, `p.$projectId.e.$episodeId.tsx`. |
| Persistent Agent host (1) | `_studio.agent.tsx` → scoped LobeChatTheme + AgentChatPage. |
| Agent view selectors (3) | `_studio.agent.index.tsx`, `_studio.agent.$threadId.tsx`, `_studio.agent.tasks.tsx` render null. Visible home/conversation/tasks views belong to the persistent parent, preventing runtime remount (`src/routes/_studio.agent.tsx:9`, `src/routes/_studio.agent.$threadId.tsx:7`). |
| Studio direct pages (14) | About; Projects; Material Library; Connectors; IP list/detail; four setting libraries and four setting details. Exact file/component table follows. |
| Project page adapters (11) | Four shared setting details; episode Story/Produce/Shots/Storyboard; project home dispatch; ProjectMemory; World. Exact source and params in JSON. |
| Redirects (8) | `_studio.index.tsx` `/` → `/agent`; `_studio.settings.tsx` `/settings` → `/about`; `p.$projectId.assets.index.tsx` → world; `.plan`, `.produce`, `.report` → first-episode produce (or project home if none); `.shots` → first-episode shots (or home); `.storyboard` → project home. |

Studio page adapters all use StudioShell:

| Public path | Route file under `src/routes/` | Exact visible page component / source |
| --- | --- | --- |
| `/projects` | `_studio.projects.tsx` | ProjectGalleryPage — `src/components/studio/ProjectGalleryPage.tsx` |
| `/assets` | `_studio.assets.tsx` | MaterialLibraryPage — `src/components/studio/MaterialLibraryPage.tsx` |
| `/ips/` | `_studio.ips.index.tsx` | IpProfilesPage — `src/components/studio/IpProfilesPage.tsx` |
| `/ips/$ipId` | `_studio.ips.$ipId.tsx` | IpProfilePage — same source |
| `/characters/` | `_studio.characters.index.tsx` | CharacterLibraryPage → StudioLibrary — `src/components/studio/AssetLibraryPages.tsx` |
| `/scenes/` | `_studio.scenes.index.tsx` | SceneLibraryPage → StudioLibrary — same source |
| `/props/` | `_studio.props.index.tsx` | PropLibraryPage → StudioLibrary — same source |
| `/styles/` | `_studio.styles.index.tsx` | StyleLibraryPage → StudioLibrary — same source |
| `/characters/$characterId` | `_studio.characters.$characterId.tsx` | CharacterDetailPage — `src/components/assets/CharacterDetailPage.tsx` |
| `/scenes/$sceneId` | `_studio.scenes.$sceneId.tsx` | SceneDetailPage — `src/components/assets/SceneDetailPage.tsx` |
| `/props/$propId` | `_studio.props.$propId.tsx` | PropDetailPage — `src/components/assets/PropDetailPage.tsx` |
| `/styles/$styleId` | `_studio.styles.$styleId.tsx` | StyleDetailPage — `src/components/assets/StyleDetailPage.tsx` |
| `/connectors` | `_studio.connectors.tsx` | ConnectorsPage — `src/components/studio/ConnectorsPage.tsx`; also SearchConnection |
| `/about` | `_studio.about.tsx` | AboutPage — `src/components/studio/AboutPage.tsx` |

Project page adapters all use WorkspaceChrome:

| Public path after `/p/$projectId` | Route file suffix | Exact visible page source / important variant |
| --- | --- | --- |
| `/` | `.index.tsx` | ProjectHomePage — `src/components/workspace/ProjectHomePage.tsx` (dispatch below) |
| `/memory` | `.memory.tsx` | ProjectMemoryPage — `src/components/memory/ProjectMemoryPage.tsx`; optional `memory` search deep link |
| `/world` | `.world.tsx` | AssetLibraryPage — `src/components/assets/AssetLibraryPage.tsx`; `setting/characters/scenes/props/styles` tabs |
| `/assets/characters/$characterId` | `.assets.characters.$characterId.tsx` | CharacterDetailPage (same Studio editor, project ownership and back path) |
| `/assets/scenes/$sceneId` | `.assets.scenes.$sceneId.tsx` | SceneDetailPage (same Studio editor, project ownership and back path) |
| `/assets/props/$propId` | `.assets.props.$propId.tsx` | PropDetailPage (same Studio editor, project ownership and back path) |
| `/assets/styles/$styleId` | `.assets.styles.$styleId.tsx` | StyleDetailPage (same Studio editor, project ownership and back path) |
| `/e/$episodeId/` | `.e.$episodeId.index.tsx` | StoryPage — `src/components/story/StoryPage.tsx` |
| `/e/$episodeId/produce` | `.e.$episodeId.produce.tsx` | ProducePage — `src/components/produce/ProducePage.tsx` |
| `/e/$episodeId/shots` | `.e.$episodeId.shots.tsx` | ShotEditorPage — `src/components/shots/ShotEditorPage.tsx`; optional `shot` focus deep link |
| `/e/$episodeId/storyboard` | `.e.$episodeId.storyboard.tsx` | StoryboardPrintPage — `src/components/produce/StoryboardPrintPage.tsx`; print must remain a separate output contract |

Project home is a **project-kind dispatch**, not one screen (`src/components/workspace/ProjectHomePage.tsx:46`): audio → AudioWorkspacePage; music → MusicWorkspacePage; video/legacy film → first-episode StoryPage via Navigate with guarded first-episode repair; video series → EpisodeListPage. Its loading/missing/unsupported/repair-error/retry branches are additional states. Audio/music paths other than home and `/memory` redirect to home in WorkspaceChrome (`src/components/workspace/WorkspaceChrome.tsx:114`, `src/lib/audio/workspaceRoute.ts:2`). Do not create fake asset or episode editors for those project kinds during a presentation refactor.

### 2. Current Studio style matrix — facts, not a chosen baseline

All cells below are **source-reviewed / native-pending**. Values describe declarations and markup; rendered font metrics and layout still need browser verification.

| Surface | Heading / description | Content bounds / spacing | Actions / structure |
| --- | --- | --- | --- |
| Projects | LibraryHeader: display serif, 28px, line-height 1; description 14px / 24px (`LibraryHeader.tsx:25`, `ProjectGalleryPage.tsx:203`) | No page max-width; 16px/24px mobile padding, 40px/32px at `sm` (`ProjectGalleryPage.tsx:196`) | Search, sort and small create button in title row; custom type-filter group then IP/archive row (`:197`, `:204`, `:218`) |
| Material Library | Eyebrow + sans h1 30px/600 (26px narrow); description 12px / 1.8 (`MaterialLibraryPage.tsx:65`, `materials/materialLibrary.css:1` selectors `.material-page-heading h1`, `.material-eyebrow`) | Centered max-width 1320px; 36px 40px 72px; ≤640px: 24px 16px 48px | Default 36px import button in title row; media/settings Tabs, then search/scope/type/status toolbar, then section heading (`MaterialLibraryPage.tsx:67`, `:68`, `:80`, `:102`) |
| IP list | Eyebrow + display serif h1 30px/1.3 (26px narrow); description 14px/1.8 (`IpProfilesPage.tsx:66`, `ipProfiles.css:16`, `:25`, `:33`) | Centered max-width 1120px; 40px 40px 64px; ≤640px: 24px 20px 48px (`ipProfiles.css:1`, `:620`) | Create in heading; state filter and search in next toolbar; header becomes column below 640px (`IpProfilesPage.tsx:68`, `:69`, `ipProfiles.css:629`) |
| IP detail | Same display h1, monogram, eyebrow, positioning; 12px back link (`IpProfilesPage.tsx:135`, `ipProfiles.css:242`) | Same max-width as list; 32px back-link bottom gap, 36px tabs top gap, two-column divided fields (`ipProfiles.css:248`, `:301`, `:315`) | Edit/archive in heading; button-group tabs via `aria-pressed`; associated project and material entries (`IpProfilesPage.tsx:142`, `:148`) |
| Four legacy setting lists | LibraryHeader 28px display title; description 13px (`AssetLibraryPages.tsx:230`) | No page max-width; 16px horizontal / 32px vertical, 40px horizontal at `sm`; list top 32px | Search + sort in heading; CreateTile inside same grid rather than a heading primary action (`:229`, `:234`) |
| Four setting details | Back link + generic 18px/600 sans title; editable record name remains a form field (`CharacterDetailPage.tsx:57`, `:74`; Scene/Prop/Style `:86`) | Centered max-w-5xl (1024px); 16px/24px with 32px horizontal at `sm`; two-column editor at `lg`; outer `h-full overflow-auto` (`CharacterDetailPage.tsx:54`) | Generation slots left / editable fields right; optional details panel is rounded-xl border bg-card; same detail components used in project context (`:75`, `:128`) |
| Connectors | Display serif 28px line-height 1; description 14px/24px (`ConnectorsPage.tsx:234`) | Left-aligned max-w-3xl (768px), parent 16px/24px or 40px/32px at `md`, different breakpoint from Projects (`:232`) | Card-based list with state badges and small footer action; Tavily below as a border-separated section (`:245`, `SearchConnection.tsx:47`) |
| About | h1 is screen-reader-only; visible branding image, then descriptive paragraph; display 18px section headings (`AboutPage.tsx:17`, `:21`, `:38`, `:75`) | Left-aligned max-w-3xl; 20px/32px mobile or 40px/40px at `sm` (`AboutPage.tsx:15`) | External source/sponsorship links and shared QR-code Dialog; brand surface is currently a distinct page pattern |

The user's example is explained by concrete source differences: Projects shares LibraryHeader with legacy libraries, while Material Library and IP have their own headers and CSS. The two reference pages differ in title family/weight/size, optional eyebrow, content cap/centering, action height, toolbar order, card shape and description scale. No new aesthetic or font choice is approved by this audit.

### 3. Traceable findings and proposed priorities

| ID / priority | Observed source difference or risk | Why it matters / next verification |
| --- | --- | --- |
| S01 / high | Page heading implementations are duplicated across LibraryHeader, material CSS, IP CSS, detail editors and About. See style matrix. | First establish common title/description/actions slots and approved dimensions, then migrate all library pages. Decide whether About branding and editing headers are explicit variants. |
| S02 / high | Page widths vary among uncapped Projects/libraries, 1320px centered Materials, 1120px centered IP, 1024px centered details, 768px left-aligned settings/about. | Source proves inconsistent bounds; browser must assess desired readable width and alignment at 1440, 1280, 1024 and 768px windows. Dense editors may reasonably use a different width contract. |
| S03 / high | Padding/breakpoints differ (`sm` vs `md` vs 640px), so neighboring pages change geometry at different window widths. Source citations in matrix. | Standardize a page padding/toolbar wrapping contract; verify 640–768px transition rather than checking only a phone and a large desktop. |
| S04 / high | `.material-notice` has `border-left:2px solid var(--foreground)` and padding-left 10px (`materials/materialLibrary.css:1`); it renders as status after successful actions (`MaterialDetailPanel.tsx:287`). | Direct mismatch with recorded user preference against decorative left accent strips. Preserve status/notice meaning while replacing its presentation under the agreed system. |
| S05 / medium | Project filters are native buttons with bespoke rounded-lg classes (`ProjectGalleryPage.tsx:204`); IP uses styled ghost Button groups (`IpProfilesPage.tsx:70`, `:148`); Materials uses shared Tabs with CSS radius/background overrides (`MaterialLibraryPage.tsx:68`, `materialLibrary.css:9`). | These represent different semantics (filter group vs tab panel), so unify visual treatment where appropriate without replacing their ARIA model blindly. |
| S06 / medium | LibraryHeader packs 32px sort/search/create controls; Materials/IP mostly use default 36px controls. MaterialSelect CSS sets 12px text / 6px radius (`MaterialControls.tsx:55`, `materialLibrary.css:1`) despite shared Select implementation. | Consolidate control size/radius choices using existing shadcn defaults; avoid a feature-specific radius reset. Do not replace MaterialSelect with native select; it already correctly uses Radix/shared Select. |
| S07 / medium | SearchConnection uses native `<input type="checkbox">` (`SearchConnection.tsx:75`) while ProjectGallery uses shared Checkbox (`ProjectGalleryPage.tsx:227`). | Clear control-family inconsistency. A presentation-only change must keep controlled boolean value, busy disable and label association. |
| S08 / medium | CoverCard caption uses 13.5px/11px, legacy hints 13px; Materials 14px/12px, IP 18px/14px/12px (`CoverCard.tsx:50`, `AssetLibraryPages.tsx:231`, `materialLibrary.css:1`, `ipProfiles.css:147`). | Establish named heading/body/meta scale; do not impose Agent's scoped 12/14/16 restriction on every existing page without an explicit whole-app decision. |
| S09 / medium | Card systems differ: poster/wide CoverCard has 16px image radius with caption outside; Material card has 10px border, 4:3 preview and enclosed caption; IP has 14px full-card border and monogram; connector Card adds another surface (`CoverCard.tsx:11`, `:19`; `materialLibrary.css:1`; `ipProfiles.css:107`; `ConnectorsPage.tsx:245`). | Content-specific aspect ratios can stay. Unify borders, focus, metadata and interaction affordances; excessive inner wrappers should not be added to force all data into one card. |
| S10 / medium | CoverCard operations are opacity 0 until hover or focus-within (`CoverCard.tsx:55`); card opening buttons have no local focus-visible class (`:39`); IP has its own page-wide focus outline with radius 4px (`ipProfiles.css:600`). | Verify keyboard focus and touch discovery. Hover-only visibility is a source risk, not a confirmed browser failure. Retain separate open and menu actions without nested interactive elements. |
| S11 / medium | Projects empty uses dashed rounded-2xl panel and 16px heading (`ProjectGalleryPage.tsx:235`); Materials 10px dashed 220px panel with 16px/12px text; IP unframed 72px padding and 22px/14px; legacy libraries show CreateTile immediately and only a filtered-empty paragraph (`AssetLibraryPages.tsx:155`, `:228`, `:257`). | Unify empty/loading/error presentation and distinguish initial loading, zero records and zero matches. Legacy source currently derives empty rows during unresolved query; deciding an explicit loading component is presentation work, not evidence of a DB failure. |
| S12 / high | StudioShell owns `.app-scroll overflow-auto` (`StudioShell.tsx:219`), yet shared asset details add `h-full overflow-auto` (`CharacterDetailPage.tsx:54`, other details `:66`). | Possible nested scrolling when embedded in Studio; verify wheel/Tab/scroll-to-focus in both Studio and project shell before choosing one owner. Do not remove editor-specific scroll regions without checking WorkspaceChrome. |
| S13 / medium | Project create has max-height 85dvh with vertical scroll (`ProjectGalleryPage.tsx:320`); IP editor has max-height and internally scrolling fields (`ipProfiles.css:516`, `:533`); Materials Sheet has internal body scroll and import Dialog uses 90dvh (`materialLibrary.css:1`); connector DialogContent has no local max-height (`ConnectorsPage.tsx:311`, `SearchConnection.tsx:68`). | Shared Dialog currently provides width but no height limit (`ui/dialog.tsx:50`). Short desktop windows and long errors/model lists require native checks; a common bounded overlay contract should preserve fixed actions and dirty-draft guards. |
| S14 / medium | LibraryHeader search uses placeholder only, with no explicit label/aria-label (`LibraryHeader.tsx:41`); Materials and IP provide explicit search aria-labels (`MaterialLibraryPage.tsx:81`, `IpProfilesPage.tsx:76`). | Name shared search and sorting controls consistently; inspect accessible names and focus restoration after overlays. |
| S15 / informational | StudioShell uses a 76px rail and inset #111 surface; WorkspaceChrome uses a full-page workspace header and separate scroll contract (`StudioShell.tsx:75`, `:83`, `:133`; `WorkspaceChrome.tsx:174`, `:181`). | The separate shells are existing architecture. Agree typography/control/surface rules across both; a desktop title bar/window integration redesign is outside this task. |
| S16 / informational | About's h1 is visually hidden and the brand illustration leads the page (`AboutPage.tsx:17`). | Decide explicitly whether About retains a brand-layout exception or receives a common visible page header. This is a product design choice, not automatically a defect. |

### 4. Existing visual contracts and reasonable shared primitives

These are recommendations for design review, **not approved visual choices**:

1. A presentation-only `PageHeader` with optional breadcrumb/eyebrow, one heading, optional description and action slots. Record title family/size/weight and the rule for optional eyebrow once. Do not include query or repo writes in it. Existing LibraryHeader is coupled to sort/search and cannot currently cover detail/settings headers without extension or composition.
2. A `PageContainer` with named content widths/density variants and responsive padding. Ordinary library/settings surfaces share a default; editing canvas and print can have documented variants. Base the variants on functional requirements, not independent page-local values.
3. A `PageToolbar` / shared search presentation that composes existing Input/Select/Button/Checkbox. Keep filter groups distinct from true Tabs, but share height, spacing, focus and wrapping contracts.
4. A `PageState` presentation for loading, missing record, error with retry, initial empty and filtered empty. Keep status vs alert roles and action semantics explicit; avoid wrapping every small message in a card.
5. Shared `SectionHeading`, metadata text and notice/error treatment. Replace the material left strip with a neutral surface/separator or text treatment consistent with the approved direction.
6. Shared bounded Dialog/Sheet layout rules (height, body scrolling, action placement, overflow wrapping). Preserve Radix focus/portal behavior and per-feature close/pending guards; no new overlay framework.
7. An accessible shared card-open/menu pattern can improve CoverCard and Material/IP cards without a universal domain card factory. Content preview aspect ratio is a separate concern from border/radius/focus/title/meta styles.

The two existing broad directions available for discussion are the current Project/legacy-library display heading with compact inline tools, and the current IP/Material heading with a separate toolbar/optional eyebrow. Neither reference page is the approved baseline. A hybrid must be documented as a choice, not inferred from a single screenshot.

### 5. High-risk behavior to preserve during presentation changes

| Owner | Preserve contract / source evidence |
| --- | --- |
| Shared detail editors | Studio ID vs route project ID ownership; keyed owner/entity query results; keep opened slot draft and last record when the entity disappears. `CharacterDetailPage.tsx:12`, `:25`, `:31`, `:35`, `:40`; analogous Scene/Prop/Style owners. A visual refactor must not remove `key` or change `back` defaults. |
| Asset fields | `AssetTextField.tsx:17` owns debounced field drafts, saving/error/retry/use-latest feedback and scoped draft keys. Do not bind inputs directly to fresh live-query rows or lose failure recovery. |
| Generation slots | Keep EditableGenerationSlot upload/cancel/commit lifetime, ownership and existing approval flow. Repositioning dialogs must not trigger provider work. See component spec Forms and Generation Slots. |
| Studio libraries | STUDIO_LIBRARY_ID reads (`AssetLibraryPages.tsx:66`), creation navigates to Studio detail (`:158`), guarded create/delete and repo-only mutations. Keep content search (including authored fields), sorting and preserved URLs. |
| Projects | Kind availability + handler guard (`ProjectGalleryPage.tsx:107`), actual audio/music/video dispatch, IP filtering, archive vs delete, explicit backup flush (`:291`) and scoped current cover-result guard (`:97`). New toolbar composition cannot coerce an unavailable kind into video or remove pending guards. |
| Material Library | Route search scope/view adapters (`MaterialLibraryPage.tsx:24`, `:45`); versioned payloads, explicit adoption/new-version action, owner access, archive/reference constraints. MaterialSelect already uses shared Select. MaterialDetailPanel uses captured revision (`:127`, `:199`), `useMaterialDraftGuard` (`:96`) and `operationsDisabled` (`:157`). |
| IP editing | Frozen revision baseline and dirty/pending blocker (`IpProfileEditor.tsx:72`, `:86`, `:109`); failed drafts survive; close/discard prompt and archive semantics. IP is persisted today. Older directory spec's “coming soon” description is stale (see caveats), not authority to remove these pages. |
| Connectors | Credentials masked/password input and local-only storage; save/test/probe/disconnect have distinct business effects and pending/session identity guards (`ConnectorsPage.tsx:68`, `:72`, `:310`, `:342`). Audit evidence must not expose API key values or click paid/network actions just to capture a style. |
| Search connection | Existing test only checks auth; enabled checkbox is controlled; saved credentials do not enter AI context/project backups (`SearchConnection.tsx:26`, `:69`, `:75`). Replace presentation without changing these effects. |
| Shells/navigation | Exclusive Agent/task active navigation, all destinations including legacy asset lists, mobile Sheet, keyboard focus, import behavior, scoped Agent theme and persistent conversation runtime (`StudioShell.tsx:32`, `:164`, `src/routes/_studio.agent.tsx:9`). |
| Audio/music/video workspaces | Domain-specific editing density, bounded scroll, pointer capture, keyboard shortcuts, Stop/approval/budget, batch confirmation/retry and CAS/undo are functional contracts. Their route adapters were reviewed here; feature audits belong to the parallel workspace/Agent research. |
| Print | Keep A4 landscape, printed storyboard layout, hidden workspace header and print light colors (`src/styles.css:201`). Do not make global container tokens alter print output accidentally. |

### 6. Native audit coverage still required

This researcher has inspected **no screenshots or browser-rendered states**. All native evidence remains pending here; the main session can merge its own observations separately. Source evidence should guide a representative safe fixture audit:

| Family | Native states / interactions to inspect |
| --- | --- |
| Projects | Populated, no projects, search no matches, archived filter, unavailable kind, create/rename/IP-binding/delete dialogs; inspect without committing deletion or modifying user projects. |
| Materials | Media and settings Tabs; shared/global/IP/project scopes; populated/empty/no matches/loading; import dialog; detail/history Sheet; dirty close prompt; long names/tags; notice/error layout; preview image/audio/document controls. |
| IP | List populated/empty/no matches/archived/loading/error; detail three views; long profile data; editor dirty close/save error; archive confirmation without execution. |
| Four Studio setting libraries | All four populated/empty/no matches; create tile; operation menu and delete confirmation; keyboard focus and touch visibility. Source is shared but exact copy/content differs. |
| Four setting details | Each Studio and project context, long form and media slot layout, missing ownership / loading, optional details, slot dialogs and preserving an in-progress draft when record disappears. |
| Connectors | Connected/unconnected list; safe blank edit/install shell; long validation/probe result; Tavily checkbox; focus return; short-height dialog scroll. Do not display credentials in artifacts. |
| About | Brand/header decision, support links/QR Dialog and download action layout, narrow width, focus return. |
| Shared Studio shell | All active navigation destinations, mobile Sheet, breadcrumb combined with detail return link, rail at short height, page vs nested scroll. |

Recommended viewport sample for review: desktop 1440×900, compact 1024×720, breakpoint transition 768/640 widths, narrow 390×844, and a short desktop window (e.g. 1280×600). These are proposed coverage points, not a promised minimum application size. Check browser zoom/text enlargement, Tab/Shift+Tab, Escape/focus restore, reduced motion, long-content wrapping and `scrollWidth` vs visible width. Final acceptance should state any intentional horizontal canvas scrolling separately from accidental page overflow.

### 7. Theme and desktop preparation boundary

The current app has a dark-only interactive theme: `index.html:2` sets `class="dark"`; `src/styles.css:45` defines dark root colors; `src/styles.css:90` sets `color-scheme:dark`; Agent ThemeProvider explicitly pins dark (`src/components/agent/LobeChatTheme.tsx:30`). The only source `color-scheme:light` is inside print (`src/styles.css:206`). No interactive theme switch or separate light palette was found. Do not claim light/dark acceptance or expand this work to build a light theme without a user decision.

The app presently loads Noto Serif SC from Google Fonts (`index.html:14`) with local Chinese serif fallbacks (`src/styles.css:11`). Cross-platform visual parity can differ when offline or when fallback fonts resolve differently. This task can document the chosen font stack and verify fallbacks; desktop font packaging/licensing/network policy is a later packaging decision unless explicitly added.

Current Studio frame dimensions and rounded surface are already documented. Resizable desktop readiness here means stable padding/width variants, flexible toolbars, bounded body scroll, keyboard focus and safe overlays inside the existing web viewport. OS title bars, draggable regions, native window controls and application framework choice are future work.

## Files found

- `src/routes/*.tsx` — all 47 adapters; exact per-file metadata in `route-inventory.json`.
- `src/components/studio/StudioShell.tsx` — global rail, mobile navigation Sheet, shared inset surface and Studio scroll region.
- `src/components/studio/ProjectGalleryPage.tsx` — project listing, filters and create/rename/binding/delete overlays.
- `src/components/studio/LibraryHeader.tsx` — shared display title + search/sort header for Projects and legacy settings libraries.
- `src/components/studio/CoverCard.tsx` — poster/wide card, CreateTile and responsive library grid.
- `src/components/studio/AssetLibraryPages.tsx` — four Studio-owned setting libraries with shared lifecycle.
- `src/components/studio/MaterialLibraryPage.tsx`, `materials/materialLibrary.css` — independent material page, card, filter, notice and overlay styling.
- `src/components/studio/materials/MaterialControls.tsx` — shared Select adapters and dirty-draft guard.
- `src/components/studio/materials/MaterialDetailPanel.tsx`, `MaterialImportDialog.tsx` — version details Sheet/import Dialog and guarded operations.
- `src/components/studio/IpProfilesPage.tsx`, `IpProfileEditor.tsx`, `ipProfiles.css` — IP list/detail/editor and independent presentation system.
- `src/components/assets/{Character,Scene,Prop,Style}DetailPage.tsx`, `AssetTextField.tsx` — shared scoped asset editors and debounced field feedback.
- `src/components/studio/ConnectorsPage.tsx`, `SearchConnection.tsx` — connection list/configuration and search provider controls.
- `src/components/studio/AboutPage.tsx` — brand/support/privacy page and appreciation-code Dialog.
- `src/components/workspace/ProjectHomePage.tsx`, `WorkspaceChrome.tsx`, `src/lib/audio/workspaceRoute.ts` — project-kind dispatch and contextual layout/redirect boundaries.
- `src/styles.css`, `index.html`, `src/components/agent/LobeChatTheme.tsx` — current fonts, shared tokens, dark theme and print exception.
- `src/components/ui/{button,input,select,dialog,tabs,card}.tsx`, `components.json` — current shadcn/Radix primitives and configuration.

## Related specs

- `.trellis/workflow.md` — read; current work is Phase 1.2 research and does not authorize implementation.
- `.trellis/spec/frontend/component-guidelines.md` — thin routes, scoped editor drafts, existing shadcn controls, no decorative left accent strips, no excessive nested cards, separate Agent theme and existing StudioShell geometry.
- `.trellis/spec/frontend/directory-structure.md` — route/component owners and contextual asset detail contracts; some IP/settings/project-kind descriptive paragraphs are stale.
- `.trellis/spec/frontend/ip-material-library.md` — current persisted IP/library model, versioning/adoption/scope guards, shared primitives and dirty form contracts; more current than the older directory prose.
- `.trellis/tasks/10-10-ui-consistency-desktop-prep/prd.md` — all-route audit, agreed style baseline, resize/scroll/accessibility and preservation requirements; no implementation approval yet.

## External references (docs, versions)

No external research was necessary for this source-only audit and no external source was consulted. Local `components.json` declares shadcn `new-york`, CSS variables, neutral base, Lucide. Local `package.json` declares React `^19.1.1`, TanStack Router `^1.131.50`, Tailwind `^4.1.13`, Radix Dialog `^1.1.23`, LobeHub UI `^5.47.1`, antd `^6.6.4`. These are manifest ranges, not independently verified installed versions. Existing component defaults and source contracts are the authority for this task; no dependency upgrade is proposed.

## Caveats / Not Found

- This audit does not certify native appearance, actual overflow, touch menus, keyboard behavior, loading timing or screenshots; all remain native-pending in this report and JSON. Screenshots already created by other agents were not inspected here.
- Route adapters for Agent/project workspaces were read for complete coverage; their feature implementation audits are delegated separately. Do not represent those feature screens as fully audited by this Studio report.
- The current directory spec still calls `/ips` “coming soon” and settings a functioning page, and has earlier non-video availability prose. Actual routes and newer IP/audio/music code show persisted IP pages, `/settings` redirect to About and available audio/music editors. Treat this as documentation drift for main-session reconciliation, not product removal instructions.
- Material CSS is largely one physical line; citations to `materialLibrary.css:1` include precise selector names so findings remain traceable.
- No new Trellis task, product/spec/task metadata changes, tests, paid calls, Git actions or user-data writes were performed. Only the two assigned research artifacts were written.
