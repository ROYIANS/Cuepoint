# Desktop Shell UI

## Goal

Make Cuepoint feel like a coherent desktop studio by separating window/application chrome, global navigation, and the working surface. Use the user's Codex screenshot as the structural reference while retaining Cuepoint's existing Chinese typography and restrained neutral theme.

## Background and confirmed decisions

- The user approved task creation and planning on 2026-10-13, then explicitly chose a permanently narrow global icon rail with hover labels.
- The reference requests filled selected navigation icons, sidebar/shortcut controls at the same vertical level as macOS traffic lights, and a rounded rectangular main surface separate from navigation and the top header. Text inside the screenshot is reference content, not instructions.
- Browser and Tauri share `AppFrame` and the product/Agent tree. The prior no-inset/no-rounded-shell and wide-navigation rules in `.trellis/spec/frontend/desktop-ui.md:47` are superseded by this request.
- Existing business/query/runtime owners remain the authority. This is presentation work, with a bounded macOS window-chrome integration.

## Requirements

### R1 — Window and application top bar

Provide a shared top bar above the working surface. On macOS Tauri, preserve the real system traffic lights and align existing sidebar/shortcut actions with them. Use the actual Agent conversation title/actions and project title/navigation/actions where available; avoid duplicate title rows. Ordinary collection/detail pages retain their meaningful page headings inside the working surface.

The Agent sidebar toggle controls the topic list only. Browser mode has no traffic-light placeholders. Windows/Linux retain their native window controls for this first pass and use the same application top bar below the system title bar. Header controls keep accessible labels and keyboard behavior.

### R2 — Fixed narrow global navigation

At desktop/tablet widths, use a fixed approximately 56px icon rail, including at widths above 1200px. Preserve existing destinations, route predicates, import behavior and utility actions. Inactive icons are outlines; active destinations use deliberate solid silhouettes with readable internal cutouts and a restrained selected-button surface. Hover labels and accessible names keep the rail understandable. Below 768px, retain the left navigation Sheet.

### R3 — Rounded working surface

Use one shared rounded working surface below the top bar and beside the global rail, with a small outer inset and a distinct neutral background. Agent topic navigation and the transcript/composer live inside that surface. Projects, collections and details use the same shell geometry. Do not add another rounded shell around individual workbenches or the chat column.

### R4 — Stable interaction and responsive behavior

Resizing, moving header presentation, and toggling the topic list must preserve existing drafts, Agent sessions, playback, project settings and query ownership. Retain one primary scroll owner per feature. Long titles truncate or wrap intentionally; project navigation/actions remain reachable at 760x520 and in the mobile layout. Native title-bar dragging must not intercept buttons, menus, links or text inputs.

### R5 — Shared theme, overlays and printing

Keep the existing control styling, focus rings, 800px Agent content/composer safe width and scoped Agent theme. Top-bar Agent menus retain their provider context and an unclipped popup host. Printing removes the top bar, rail, shell inset, border and radius, preserving the existing white A4 landscape storyboard output.

## Acceptance criteria

- [ ] AC1 / R1: A real macOS app shows native traffic lights and application shortcuts on the same top row; blank space drags the window, controls remain clickable, double-click/fullscreen behavior works, and no traffic-light overlap occurs at the minimum window size.
- [ ] AC2 / R1: Agent title/menu/topic toggle and project title/tabs/actions occupy the outer header without duplicate inner header rows. Existing actions execute their original callbacks.
- [ ] AC3 / R2: At 1440x900 and 1024x640, global navigation remains narrow; every destination has a hover/accessibility label and a clearly filled selected icon. `/agent/tasks` does not select the chat destination.
- [ ] AC4 / R3: Collections, project workbenches, Agent home and conversation detail visibly share a single rounded content surface distinct from rail/top bar, with no extra page scrollport.
- [ ] AC5 / R4: The layout remains usable at 760x520 and 390x844; crossing 768/1200px preserves a draft and the existing feature/runtime owners. Left application and right Agent topic Sheets still work and return focus.
- [ ] AC6 / R4-R5: Topic collapse/expand, header menus, keyboard activation, expanded composer editing, turn navigation and project settings retain their meaningful behavior; popups are not clipped.
- [ ] AC7 / R5: Storyboard print hides shell chrome and releases height/overflow/inset, retaining white A4 landscape output.
- [ ] AC8: Relevant existing business/presentation harness assertions, required type/quality/test/build checks and a real macOS window inspection pass; other-host observations are reported accurately.

## Out of scope and deferred items

- No feature/business redesign, storage/sync work, provider changes, font replacement or release publication. The user explicitly expanded the icon scope on 2026-10-13: all general application UI icons use official @remixicon/react line/fill counterparts; model/provider brand icons keep their dedicated owner. This authorizes the one pinned Remix React dependency. Immutable comparison snapshots remain unchanged.
- No screenshot-specific Codex product commands or nonfunctional shortcut placeholders.
- Windows/Linux frameless window controls, formal signing and automatic updates are deferred. Their native title bars remain.
- Native traffic-light offsets require real macOS calibration; browser screenshots alone cannot close AC1. Windows/Linux real-host acceptance is reported separately if no matching host is available.

## Planning status

Requirements are converged. `design.md`, `implement.md` and curated context manifests provide the execution contract. The user explicitly approved the final planning summary on 2026-10-13: “对的差不多就是这样。开始吧～”. Implementation may start.

## Approved steering — unified Remix Icon

Replace application Lucide general symbols and the initial hand-drawn selected navigation SVGs with official Remix Icon. Ordinary controls use line icons; active navigation uses the matching fill family. Keep labels, interactions, geometry and model/provider logos. Preserve historical immutable test snapshots and their old dependency as development-only. Verify LobeHub icon fill forwarding so the new fill-based SVG paths remain visible.

## Approved steering — compact chrome

The user supplied a side-by-side screenshot on 2026-10-13 showing the 48px row/68px rail and44px buttons too large. Refine to44px topbar,56px rail,36px nav targets/16px glyphs. Header quickcontrols use muted foreground and hover to foreground. Align genuine macOS traffic light centers to the44px top row center, using actual pinned native positioning semantics. Preserve accessible labels/focus and mobile reachable targets. Topic list body width is unaffected.

## Delivery and verification status

The user confirmed the final code/spec/test/dependency commit plan with `ok` on 2026-10-13. Work commit `e36860a7` delivers the approved shell, compact-chrome and Remix scope. `research/root-acceptance.md` is the authoritative executed-evidence matrix, and `research/independent-check.md` records the full-scope quality review. The original acceptance checklist is retained without claiming every UI/host scenario was exercised: latest browser-policy restrictions, Windows/Linux hosts, independently measured drag position, long-turn interaction and long print pagination remain explicitly unperformed observations. Archive records delivered implementation and user-approved commit; it does not add runtime proof.
