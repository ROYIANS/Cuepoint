# Frontend Shell Implementation — 2026-10-13

## Result and ownership

`AppFrame` now owns a 48px shared top bar, a fixed 68px desktop icon rail, the existing mobile application Sheet, and one inset/radius working surface. `getWindowChromeKind()` determines only presentation: macOS Overlay reserves native traffic-light space, while native dragging uses the pinned deep-region integration with explicit control exclusions. Seven local selected silhouettes preserve internal cutouts without filling open Lucide paths. Destination predicates, import callbacks and content-scroll ownership remain intact.

`AppHeaderPortal` moves only the actual feature header JSX into the stable frame target. Workspace title/navigation/actions preserve their original query guards and backup/settings callbacks. Project navigation occupies a second row below 1200px. Agent home and detail use a scoped `AgentHeader` outside the working surface. Its dedicated `[data-agent-header-popup]` host is outside surface clipping and explicitly excluded from native drag; the body remains the only ordinary `.agent-chat-root` popup authority.

Home and detail share topic-navigation presentation state. Collapse retains the mounted topic list at zero width with `inert`, so local search/folding state survives; below 768px the existing right Sheet provides the list. The external toggle is the single topic-panel control. Transcript/composer retain their feature owners and 800px safe width. Old absolute-header clearance, mobile-header reservation and turn-navigation offsets were removed; active-turn and jump calculations now share the actual 16px scroll padding. Print removes topbar/rail/insets/border/radius and releases frame overflow.

## Changed frontend files

- `src/components/layout/AppFrame.tsx`, new `AppHeaderPortal.tsx` and `SelectedNavIcon.tsx`; `src/styles.css`.
- `src/components/workspace/WorkspaceChrome.tsx`.
- Agent `AgentChatPage.tsx`, `ChatWorkspace.tsx`, `HomeWelcome.tsx`, `TopicSidebar.tsx`, `TurnNavigation.tsx`, `agentTheme.ts`, `agentChat.css`, `composerControls.css`, `turnNavigation.css`; new `AgentHeader.tsx`, `agentHeader.css`, `AgentTopicNavigation.tsx`.
- `tests/fixtures/e02/harness.tsx` and `scripts/e02-browser-regression.mjs` mount the actual frame and inspect the external header. The fixture's old Dexie-style transaction was repaired to use an explicit `chatMessages` scope and callback transaction. Immutable E02 source snapshots are untouched; the runner explicitly labels its snapshot comparison as topic-row/body CSS inside the current shared shell.

Native files, runtime helper, spec updates and task lifecycle are owned by the root/native collaborators. No database/provider/runtime-session implementation or dependency changed in this frontend subtask.

## Validation and failed attempts

- Explicit machine pnpm `lint` passed twice during implementation; subsequent final changes need the coordinated final gate.
- Focused six-suite run passed 83 tests: sharedVideoPageParity, b01QueryIdentity, b07ComposeSessions, chatScroll, chatTurns and overlayFocusReturn. Their existing query/guard/draft/session assertions remain unchanged; the header bridge accepts children, which existing node traversal already visits.
- `git diff --check` passed.
- An accidental `pnpm test -- filenames` invocation did not filter Vitest and ran the full suite. It produced 222 passing files, 95 failed tests: missing native probe (`ENOENT`) and the previously known bounded Agent-loop timeout. This is a failed attempt, not a passing full-suite claim. The root coordinates rebuilding the probe and the final full gate.
- Formal `quality` first failed its exact unused-evidence identity for the changed `src/styles.css`. The CSS package imports remain real; root will review and update the existing styles/runner evidence hashes after final source stabilization, without weakening policy. No quality pass is claimed here.
- Default E02 browser runner reached 16 passing scenarios: keyboard/pointer topic targeting and persistence, header rename/delete, 390/767/768/1440 transcript gutters/safe width/real scroll, and expanded composer. It then failed because the existing fixture used the obsolete transaction signature in `turns()`. That fixture is repaired; the complete runner and optional baseline/surrogate modes were not rerun in this subtask. Later dedicated popup-host and turn-offset refinements require final native/UI validation. Raw observations/screenshots stay in temporary output, outside Trellis.

## Final acceptance boundary

The root owns current browser CUA inspection, genuine macOS window calibration, final build and the independent check. Real traffic-light alignment, drag/double-click/fullscreen/minimum size, final popup-host activation, print, long-turn navigation and corresponding Windows/Linux runtime behavior must be reported from those actual inspections. Unit or build success does not replace native evidence.
