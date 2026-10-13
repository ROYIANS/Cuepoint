# Research: Module Navigation and Context Panels

Date: 2026-10-13. Scope: current application and installed UI primitive source, read only.

## Shell and route boundaries

- `src/components/layout/AppFrame.tsx:33` owns outer chrome/rail/global mobile Sheet and the single rounded surface. `src/components/layout/AppHeaderPortal.tsx:6` preserves feature context while portaling header JSX.
- `src/routes/_studio.tsx:13` and `src/routes/p.$projectId.tsx:10` mount distinct frames. Project frames are keyed by project ID. Do not locate global history in one frame or create another ProductStore/runtime owner.
- `src/components/studio/StudioShell.tsx:13` adds a material-path breadcrumb for legacy setting routes. Replace duplicate parent arrows with meaningful persistent material navigation, retaining all current URLs.
- `src/styles.css:136,183,195-198` defines the 44px topbar and the project second-row rule. The latter is the actual cause of different content origins.

## Major module map

| Owner | Current behavior / source | Proposed presentation and constraints |
| --- | --- | --- |
| Agent | `AgentChatPage.tsx:56,588`; HomeWelcome/ChatWorkspace use `useAgentTopicNavigation`; `AgentTopicNavigation.tsx:42-48` keeps desktop navigation mounted/inert and opens a right mobile Sheet | Reuse topics/callbacks; move narrow navigation to the left and share its topbar toggle. Keep the Agent route host, reference draft and execution-session lifetimes. |
| IP | `studio/IpProfilesPage.tsx:50-98,133-147` owns active/archive/search, detail sections and editor. `_studio.ips.tsx:3` is an Outlet parent | Share left profile navigation across index/detail; publish detail's existing local section buttons without moving its editor/blocker into the shell. Loading, archived and missing ownership remain explicit. |
| Gallery | `studio/ProjectGalleryPage.tsx:197-234` owns kind, IP, status, search, sort and creation/import callbacks | Move existing kind/status navigation into the left pane; retain creation availability, IP scope and cards. Keep gallery query/write owners. |
| Project details | `workspace/WorkspaceChrome.tsx:35-44,78,147,185-346` owns project/episode identities, retained Outlet/settings, routes, backup and import | Put film/series/episode/audio/music/memory links inside the surface. Keep known parent collection entries, output draft guards and flush-before-backup. Missing/pending reads must not unmount protected settings/Outlet. Material link stays `/assets?project=...`; do not redirect to deprecated asset-index URLs. |
| Materials | `studio/MaterialLibraryPage.tsx:28-59,67-105` owns media/settings view, scope, kind, status, search and selected material | Left navigation contains existing view/settings destinations and scopes; center retains list/filter operations. Preserve search REPLACE and global/IP/project ownership. Legacy setting detail routes retain the same left navigation. |
| Tasks | `agent/TaskBoard.tsx:37-61,84-105,131` owns workbench/all/archive/project/search and routes selected tasks to their conversation | Supply its own left navigation; retain the state board and conversation destination. TaskInspector remains a conversation inspection view rather than changing task-click semantics. |
| Connections | `studio/ConnectorsPage.tsx:34,51-62,236-287` owns connector catalog, operation sessions and credential Dialog; SearchConnection has its own owner | Left entries select the existing model-connections or web-search section. Keep connector catalog and credential editing. Section visibility cannot cancel/recreate a pending configuration owner. |
| Audio | `audio/AudioWorkspacePage.tsx:45-49,72-89,156-220,239-270` owns chapter/segment/take/clip selection, ScriptDocument/Timeline, inspector and voice workflow | Promote existing chapter navigation into the left workspace pane with project-section access. Keep typed selection, SavedText, timeline/history/seek/playback owners; do not stack an extra chapter pane beside project navigation. |
| Music | `music/MusicWorkspacePage.tsx:57,121-151,189-205` owns creator/draft/works/selected details and separate AudioPlayer; `music-workspace.css:13-37` has 340/320px composer | Use existing composer as the substantive left working pane with compact project-section access. Preserve its wider form width and current create/works mode on small surfaces. Memory/detail routes use ordinary project navigation. Player remains outside breakpoint-dependent trees. |

About is informational and remains single-column. Route adapters stay thin; shared layout adds presentation slots, not a universal navigation/data/action registry.

## Complete Sheet inventory and classification

| Existing Sheet | Treatment | Important owner constraint |
| --- | --- | --- |
| AppFrame | Keep global navigation as a narrow left overlay | Route predicates/import callbacks and native controls remain separate. |
| AgentTopicNavigation | Narrow left navigation, desktop left pane | Sidebar collapse retains hidden/inert content; topic keyboard sibling actions remain accessible. |
| TaskInspector | Docked context panel / narrow right overlay | `TaskInspector.tsx:238-274`: aggregate current overview/records/wrapup dirty and pending state; use requestDeparture for close/owner replacement. Never key by width or tab. |
| MaterialDetailPanel | Docked context panel / narrow right overlay | `MaterialDetailPanel.tsx:48,161-169`: retain current material/editor while guard resolves, freeze identity and close only via existing guard. Keep nested delete/adoption confirmations. |
| MemoryContextDetails | Docked context panel / narrow right overlay | `MemoryContextDetails.tsx:34-43,114-128`: thread/run/project identity and historical read-only snapshots stay authoritative. `ContextUsagePanel.tsx:427` is a sibling of the Popover, so closing that Popover need not unmount the details. Multiple run triggers need guarded single-panel coordination. |
| Audio inspector | Shared responsive context-panel presentation | Existing conditional inline aside vs Sheet remounts the inspector branch; replace this boundary with one stable content host. Preserve selection and pending audition/upload. |
| Music detail | Shared responsive context-panel presentation | Existing conditional aside vs Sheet remounts details. Retain MusicDetails, lyrics/note edits, selected work and AudioPlayer on resizing. |

Dialogs are not blanket-converted: credential/configuration, creation/import, voice-library local editor workflows, reference selection and all confirmations retain their existing semantics.

## Stable responsive panel conclusion

Installed Radix Dialog renders different `DialogContentModal` / `DialogContentNonModal` component types when `modal` changes (`@radix-ui/react-dialog/dist/index.mjs:134-211`). Modal Content also applies hideOthers, a focus trap and outside pointer lock. A docked panel cannot retain those modal restrictions. Simply toggling Root.modal around an editor is therefore insufficient.

Use one stable panel DOM/React host across docked/overlay presentation, with independently controlled public focus/dismissal primitives and frame-owned narrow background isolation. The installed public FocusScope supports changing `trapped` and `loop`; DismissableLayer supports outside-pointer and dismissal controls. If imported directly, declare them as direct dependencies rather than relying on their transitive presence. Preserve `createOverlayFocusReturn` caller prevention/current-generation rules. Confirm nested AlertDialog, Select/Popover portals, Agent scoped theme and frame isolation before migrating business editors.

A shared presentation coordinator allows one active right context panel. It asks the outgoing feature's existing departure callback to authorize replacement; it does not own fields, discard policy, persistence or query results. Opening/closing registration cannot clear an editor before its guard succeeds. Docking decisions use actual surface width and the current left-pane allocation, not the old audio 1100px/music 1280px window checks.

## Validation implications

Exercise real editor instance retention and focus while crossing docking/navigation thresholds; inspect active descendants and media playheads, not only wrapper classes. Validate nested confirmations and menu portals in both modes. Preserve all existing unavailable/dirty navigation assertions and print overflow release. No tests, UI interactions or product changes were performed in this research.
