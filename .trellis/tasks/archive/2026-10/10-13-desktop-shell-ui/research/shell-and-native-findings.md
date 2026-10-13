# Shell and Native Research — 2026-10-13

## Existing owners

- `src/components/layout/AppFrame.tsx:26` owns global NAV, mobile Sheet and contentScroll. `src/styles.css:131` currently defines a 64/176px navigation and edge-to-edge body.
- `src/components/agent/ChatWorkspace.tsx:105` owns topic-collapse state, header, transcript and composer. `TopicSidebar.tsx:52` duplicates topic toggles. A stable portal preserves the surrounding Agent React context when moving header DOM.
- `src/components/workspace/WorkspaceChrome.tsx:184` already owns the complete guarded title/tabs/actions header; move presentation intact rather than copying commands/data.
- Agent header styles at `agentChat.css:603`, transcript inset at `:647`, mobile reservation at `:708` and turnNavigation header offsets must be reconciled. A header theme wrapper must not accidentally change `.agent-chat-root` popupRoot selection.
- `.trellis/spec/frontend/desktop-ui.md:47` and component-guidelines' shell/header clauses need updating for the user's new requested geometry. Preserve one scroll owner, responsive lifecycle and white print output.

## Icon boundary

Only Lucide is the existing global navigation icon source. LobeHub icons are model/provider brands, and Ant Design icons are not a declared direct dependency. Library/ListChecks contain open paths, Info needs an internal cutout, and Cable does not have a useful generic fill. A seven-item local selected-silhouette mapping avoids new dependencies and global fill mistakes.

## Native evidence

- `desktop/tauri/src-tauri/tauri.conf.json:11` marks main create:false. `src/desktop.rs:1693` is the real builder; configure native macOS Overlay there without touching storage identity.
- Root already has `@tauri-apps/api` 2.12.2. Current capabilities have no window actions.
- Official [trafficLightPosition config](https://v2.tauri.app/reference/config/#trafficlightposition) requires Overlay and native decorations. Official [window customization](https://tauri.app/learn/window-customization/) documents drag-region window permissions.
- Pinned Tauri 2.12.2 drag.js additionally supports deep descendants with interactive-element blocking and explicit false exclusions. Verify against the installed pinned source when implementing; online examples alone may show only direct drag regions.
- Minimal window permissions are allow-start-dragging and allow-internal-toggle-maximize. Native traffic lights need no HTML replicas or frontend close/minimize grants.
- Initial macOS 16x17 traffic-light placement with a 48px application topbar is a visual calibration proposal, requiring a real app. Windows/Linux retain their native window chrome for this phase.

## Resolved UX

The user explicitly chose a fixed narrow global icon rail. The Agent toggle consequently operates on topic navigation only. A single outer topbar and rounded working surface realize the screenshot hierarchy without introducing another feature scroll owner or rebuilding the Agent runtime.
