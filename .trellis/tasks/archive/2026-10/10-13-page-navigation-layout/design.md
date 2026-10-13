# Design: Split Navigation, Context Panels and Phosphor

## Visual contract

Keep the restrained shared dark palette, typography, compact control targets and single rounded working surface. Outside the surface, the fixed 44px row contains genuine native traffic-light space where applicable, Back/Forward, internal-navigation toggle, actual title and compact feature actions. Below it, a 56px desktop global rail sits beside the surface. Inside the surface, left navigation, flexible main content and optional right context panel are separated by subtle vertical borders; do not wrap them in additional rounded frames.

The bottom-left utility entry is Settings with a Gear glyph, linked to the existing `/settings` route; its current About redirect remains until a future dedicated Settings task. Keep the connection destination accessible separately.

- Ordinary secondary navigation: 260px initial width; music's existing creation pane may retain 320-340px because it contains a form. Selected rows use the elevated neutral surface, readable text and a Phosphor Fill glyph where applicable.
- Context panel: initial 400px width for task/material/memory, 320px audio and 300px music. Give each its own title/close and scrollable body. These are internal layout values, not persisted preferences or user resize controls.
- Dock only if the measured working surface can allocate the current left pane, panel and at least 480px readable center. Timeline/table horizontal scrolling stays local. Opening a panel must not automatically collapse navigation.
- Below 768px, internal navigation opens as a left overlay. Global navigation remains a separately labeled control. On narrow native/browser widths, shorten title/actions and use an overflow menu without changing the exterior row height.

## Presentation architecture

### Shared frame and module navigation

Extend the existing layout components with presentation-only navigation/toggle/context-panel slots. Use one shared navigation-row treatment and independent column scrollports. Stable slots may portal feature JSX to a frame host while preserving its React context and original callbacks. Header/main/navigation targets are created once per frame lifetime and remain present across resizing and collapse. Do not reconstruct feature subtrees according to breakpoints or introduce data providers in the frame.

Module owners publish their actual navigation. The frame owns only slot geometry, collapse/open state and narrow presentation. Studio family navigation stays mounted across its list/detail routes, with the detail owner's existing section callbacks published into the navigation area. Collection filter/query/write ownership remains in its existing feature; derive entries from current data instead of a second persistence owner. Preserve route adapters and current URLs.

Project navigation keeps WorkspaceChrome's project/episode availability, first-episode repairs and retained Outlet/settings rules. Film sections are story/world/shots/produce/memory; series includes episode collection/world and the selected episode's sections. Audio exposes chapter navigation and music reuses its creator pane, each with compact project/memory/collection access. This avoids adding another 260px column beside the existing music creation form. Other project routes use the ordinary shared left pane.

Collection/details' semantic h1 and descriptive text stay inside main content where useful. Moving navigation does not remove feature descriptions or actions. Duplicate page-level parent arrows move into named left entries; local editor back buttons and missing-owner recovery retain their specific behavior.

### Right context panel

Add a shared context-panel primitive and a frame-scoped presentation coordinator. Features retain `open`, selected IDs, queries, draft state, revision baselines, mutation locks, confirmation JSX and departure callbacks. The coordinator contains only the currently presented panel identity and asks the outgoing owner to authorize replacement through its existing callback before activating the next one.

Keep one panel host element attached beside the frame's main area. Portaled panel content always targets that same element; docking changes CSS position/width and accessibility behavior, not its React ancestry or target. Multiple triggers such as memory run snapshots register distinct owner identities. A canceled/pending outgoing departure leaves the current panel and draft intact. Closing frees the layout allocation only after the owning callback accepts. A route transition uses existing router blockers; the coordinator must not resolve drafts on their behalf.

Use a stable public FocusScope + DismissableLayer composition for the panel body so `trapped`, looping, outside pointer handling and semantic role can change without replacing Content component types. Declare any directly imported primitives as explicit dependencies. Reuse `createOverlayFocusReturn` rules for opening/closing and caller prevention. Do not toggle Radix Dialog's modal branch around an editor: installed source proves that branch remounts.

- Docked mode: named complementary region, normal Tab movement, no outside-click dismissal, no background pointer lock/hideOthers/backdrop; close remains explicit and guarded.
- Narrow mode: named dialog with modal semantics, backdrop, focus containment and isolated background. Frame header/global navigation/main content are siblings of the panel host and can be isolated without inerting the panel itself. Account for currently active nested confirmations and popup portals; never inert every body child blindly.
- Mode change: retain editor nodes and focused input/caret if they are already inside. Entering overlay moves focus into it only when needed; returning to docked mode removes isolation without reopening or resetting content. Closing restores a connected opener when appropriate and does not steal newer focus.
- Agent scope: retain feature context and scoped LobeHub/antd theme for panel/menu hosts. Popup lookups must resolve the actual panel/feature host rather than an unrelated first `.agent-chat-root` or an inert center column.

First verify this boundary with a real controlled input and nested controls, then migrate TaskInspector, MaterialDetailPanel, MemoryContextDetails, AudioInspector and MusicDetails. Preserve identity keys based on actual task/material/thread/run/work IDs, never on width, open layout mode or selected panel tab. Do not duplicate players or query subscriptions across two conditional presentations.

## Router history

Create a small external navigation capability store beside the single `createProductRouterHistory()`/router instance; AppFrame subscribes to it. Native hash and browser path routing stay unchanged. Maintain a bounded volatile ledger of proved application entry keys and accepted locations; initial reload/direct entry knows only itself. Enable arrows only for known actual adjacent entries.

Call the installed `router.history.back()`/`forward()` without `ignoreBlocker`. Reconcile accepted notifications by key/location; canceled POP reports the old accepted location and must not advance/prune the ledger. Installed coalesced optimistic PUSH can skip logical indices while creating one physical entry, making blocked POP rollback overshoot. The product history boundary therefore serializes public PUSH/REPLACE calls, flushes each accepted write notification and releases denied calls through the original delegated blocker result. This prevents concurrent async blockers from assigning the same premature index, while retaining the original owner resolvers. Rapid accepted pushes create real distinct entries; REPLACE updates the current entry. The capability store still reconciles notifications by accepted location and preserves explicit public flush boundaries. New PUSH after Back truncates the known forward branch; unknown POP/index/key resets the range conservatively. Serialize titlebar traversal while the accepted/canceled notification is pending; do not use a timeout as proof of success. See `research/navigation-history.md` for installed-version evidence and cases.

Known parent links in internal navigation remain ordinary router links and trigger existing guards. Preserve local owner switches such as VoiceLibrary and ProjectMemoryPage selection clearing. The application does not infer a parent as a substitute for chronological Back.

## Phosphor boundary

Install the official React package, initially pinning the verified 2.1.10 candidate after registry availability is checked. Rename the semantic adapter to `components/ui/icons.tsx` and migrate all current production/test consumers. Statically import only used official glyphs; prefer supported individual CSR paths for dev performance if required. Same-component Regular/Fill supplies navigation states; House represents Creation Assistant.

The adapter retains size/color/style/class/aria/ref and explicit semantic Fill cases while removing SVG geometry overrides injected by LobeHub. Phosphor geometry uses 256x256, so update current integration assertions accordingly. Preserve native ActionIcon/button interaction and existing sizes. Remove `@remixicon/react` and its lockfile closure after all direct/current adapter consumers are replaced. Inspect the local pnpm diff for unrelated churn. Provider/model brands, raw measurement SVG and immutable Lucide fixture imports remain with their owners.

## Compatibility and ownership

No schema, persisted model, ProductStore activation, native IPC/navigation or paid execution change. Existing native traffic-light/drag configuration stays authoritative. Agent unsent drafts and execution retain their existing route lifetimes; this task does not add cross-route durability or promise uninterrupted execution after unmount. Presentation changes must not clear failed/pending editors, break backup flush barriers or show stale owners as editable.

Current specs permit wrapping project tabs, Remix and a right mobile topic Sheet; those specific rules are superseded by the approved design. Preserve all other ownership, accessibility, font/theme, native and print contracts and update their authoritative spec paragraphs after implementation.

## Validation and rollback

Test history state transitions against actual installed browser/hash history, not only memory history. Validate panel mode changes against editor DOM identity, draft/caret, nested modal/menu access and actual playback. Check all module list/detail navigation, unknown/missing owners and draft Continue/Discard on local close, replacement and POP. Visually inspect long/short/minimum/mobile dimensions and print.

Root/native frontend quality gates are listed in implement.md. Unit/build evidence does not establish native traffic-light alignment, drag/control behavior or Windows/Linux runtime acceptance. Record performed checks and limitations separately. Keep rollback units coherent: icon adapter+dependencies+consumers; layout/slots+owner integrations; history store+controls. Rollback must not alter user data or undo unrelated changes.
