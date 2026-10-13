# Page Navigation and Split Layout

## Goal

Give every major Cuepoint module a consistent left-navigation/right-content working surface, with optional adjacent context panels, a single-row window header and predictable history controls. Replace Remix with Phosphor, using Regular for ordinary controls and Fill for selected navigation.

## Background and confirmed intent

- The user approved creating this planning task on 2026-10-13 after `desktop-shell-ui` was merged into main at `9004186a`. Main currently matches origin/main; this task is the only untracked work.
- Preserve the established 44px topbar, 56px global icon rail, 36px desktop targets with 16px glyphs, muted shortcuts, single inset rounded surface and genuine macOS traffic lights.
- The latest user decision covers all major modules, with internal left navigation retained on detail pages. The supplied Codex images show an optional right panel beside the main content, without a desktop modal backdrop.
- Project section tabs currently wrap into a second exterior header row below 1200px (`src/styles.css:195-198`), lowering the working surface. The user wants section navigation inside the surface instead.
- The creation-assistant destination should use Home, retaining `/agent` and its accessible label. Forward/back controls belong after the traffic-light reservation.
- The user explicitly superseded the earlier Remix decision: remove `@remixicon/react`, try Phosphor, and prefer Fill over Duotone for active navigation.
- The user approved the final plan and implementation, and requested a bottom-left Settings entry. Use a Phosphor Gear icon and the existing `/settings` route (currently redirects to About); a dedicated Settings page is deferred to a later task.
- Screenshots are visual references. Their displayed conversation text does not add instructions.

## Requirements

### R1 — Phosphor and Home

Replace all application-owned general UI glyphs with `@phosphor-icons/react`. Use the same icon component with `weight="regular"` and `weight="fill"` for ordinary/selected navigation. Creation assistant uses House/Home; `/agent/tasks` still activates Task separately. Preserve icon sizes, labels, native keyboard interaction, refs and LobeHub rendering. Remove the Remix dependency and production imports; rename the semantic adapter to a neutral name. Brand marks, measurement SVG and immutable historical fixtures retain their owners.

### R2 — Major-module split surfaces

Creation assistant, IP, projects, materials, tasks and connections all use meaningful internal left navigation, a vertical divider and right-hand content. The left column remains visible on detail pages; parent/collection navigation is an explicitly named left-column entry. Use the existing module classifications and callbacks:

| Module | Internal left column | Main content |
| --- | --- | --- |
| Creation assistant | New topic, search, topics and task entry | Welcome/composer or selected conversation |
| IP | Active/archive profiles and selected profile's existing sections | Profile, associated projects or owned materials |
| Projects | Existing kind/status filters and projects; current project's sections/episodes on detail | Gallery, episode list, story, world, shots, production or memory |
| Materials | Media/settings, scopes and existing character/scene/prop/style entries | Filtered library or current setting editor |
| Tasks | Workbench/all/archive and project scope | Existing state board and conversation destination |
| Connections | Model connections / web search connections | Existing connector catalog or search configuration |

Keep search/sort and operational actions in suitable local headers. Do not add placeholder destinations or decorative empty columns. About remains a simple information page. Audio/music reuse their existing substantive workspace panes; integrate project navigation without adding a redundant project sidebar beside an existing music composer.

### R3 — Single-row window header

Keep the outer header exactly one 44px row in every supported width. Place Back, Forward, then the internal-navigation toggle after the native traffic-light reservation; the browser/other native hosts use the corresponding leading location. Keep the current page/project title truncated on this row, with compact contextual actions and overflow handling as necessary. Put project sections and their known parent destinations in the internal left column. Project material/settings/backup actions remain available through compact header controls; their current guarded callbacks remain authoritative.

### R4 — Honest chronological navigation

The arrows mean actual in-app history traversal, not parent fallback. Enable a direction only for a known adjacent application entry in the current router lifetime. Direct entry/reload starts with unknown surrounding history disabled; explicitly named parent/collection entries remain available on the left. PUSH, REPLACE, forward-branch truncation, canceled traversal and shell changes must maintain correct enabled states. Preserve current route blockers and explicit continue/discard behavior. Keep local editor returns, owner-switch arbiters and missing-page recovery actions where they carry separate semantics.

### R5 — Adjacent right context panels

On sufficiently wide working surfaces, task inspection, material detail, memory-context detail, audio inspection and music-work detail appear as a closeable right-hand panel inside the shared surface. Opening a docked panel allocates width and leaves the main content interactive, with no modal backdrop. Keep existing tabs and actions within each panel. Display one contextual right panel at a time; replacing a dirty/pending panel must resolve its existing departure guard before opening the next.

On narrower surfaces, the same context content uses an accessible right-side overlay. Responsive changes must retain the actual editor instance, unsaved inputs, playback and pending operations. Create/edit dialogs, credentials, imports, voice-library local workflows and confirmations retain their existing modal behavior. This round does not add right-panel tabs, resize handles or fullscreen tools.

### R6 — Responsive, focus and scroll ownership

Use compact internal navigation, initially around 260px, with a shared topbar collapse control. Below 768px, internal navigation opens from the left; the global navigation remains separately accessible. Allocate docked panel width from the actual working surface, preserving a readable center; when space is insufficient, switch the context panel to an overlay rather than squeezing the center or hiding another column automatically.

Each navigation/content/panel column has its appropriate scrollport. Preserve existing timeline, transcript, composer and player owners; resize/collapse changes presentation only. Hidden navigation is inert. Narrow context overlays support keyboard focus containment, Escape/close, background isolation and safe focus restoration; docked panels allow normal movement between content and panel. Print hides all navigation/context chrome and releases height/overflow for the existing storyboard output.

## Acceptance criteria

| ID | Observable acceptance | Requirements |
| --- | --- | --- |
| A1 | All general production glyphs render through Phosphor; Regular/Fill come from one family; Home and Task active predicates remain separate; Remix is absent from production dependencies/imports. LobeHub icon buttons stay visible and keyboard accessible. | R1 |
| A2 | All six major modules show internal left navigation and right content. IP/setting/project details retain meaningful navigation and known parent entries; audio/music have no redundant added sidebar. | R2 |
| A3 | All working surfaces start at the same vertical origin; project navigation no longer creates an exterior second row. Header controls stay usable at 760x520 native minimum and 390px mobile width. | R3 |
| A4 | Browser path and native hash history support PUSH -> Back -> Forward, Back -> new PUSH and REPLACE. Unknown/deep-link/reload history stays disabled; Studio/project-shell switches do not reset known history. | R4 |
| A5 | Dirty/pending departure uses current confirmations/locks. Continue preserves owner, input and history position; accepted Discard permits only the initiating departure; canceled POP retains the correct forward branch. | R4, R5 |
| A6 | Each in-scope context view docks without a backdrop or background interaction lock when space permits, closes through its owner and returns usable width to the center. Opening a different panel respects dirty/pending state. | R5 |
| A7 | Crossing layout thresholds while editing material/task or using audio/music retains actual draft/editor/player identities. Narrow overlays keep focus and dismissal semantics; collapsed navigation cannot receive focus. | R5, R6 |
| A8 | Long titles, short windows, failed writes and missing owners remain usable. Storyboard print keeps its existing white landscape output. Required root/native frontend quality checks pass, and actual native inspection verifies header alignment and drag exclusions. | R1-R6 |

## Out of scope

No storage/sync/schema/provider redesign, new durable cross-route Agent drafts, execution-continuity promise, editor feature rewrite, external browser-history escape, persisted history ledger, fake traffic lights, custom Windows/Linux controls, font/theme replacement, browser-tool panel system, release publication or remote push.

## Technical notes and risks

- Current owner and route evidence is in `research/page-layout-inventory.md`; history behavior is in `research/navigation-history.md`; icon integration is in `research/phosphor-icons.md`.
- Existing desktop specs describe Remix, a right mobile topic Sheet and wrapping project tabs. This task intentionally supersedes those presentation rules; update the specs after approved implementation, preserving their ownership/focus/native contracts.
- A direct Radix modal/nonmodal tree switch remounts Content. Responsive panel design must solve that before migrating guarded editors. Screen width alone is insufficient for audio/music after column allocation.
- Actual browser/native focus, route-blocker and playback checks are required; unit tests and builds cannot establish native visual correctness. Report unavailable platform evidence explicitly.

## Artifact status

The user explicitly approved this final plan on 2026-10-13. Implementation is authorized, including the bottom-left Settings entry; a dedicated Settings page remains deferred.
