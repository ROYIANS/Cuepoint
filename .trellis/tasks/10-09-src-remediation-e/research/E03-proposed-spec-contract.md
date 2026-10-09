# Proposed E03 spec synchronization — awaiting independent PASS

Append to frontend/audio-music.md after final returned independent E03 PASS; no canonical change at preparation.

## E03 audio/music stylesheet ownership and cleanup (2026-10-09)

### 1. Scope / Trigger
Read before changing shared audioMusic/workspace.css, audio/story-workspace.css, current timeline/music layout classes or retiring old workbench CSS.

### 2. Signatures / Owners
AudioWorkspacePage owns current `as-*` script/inspector/sheet chrome, AudioTimeline owns `at-*` styles in timeline.css, MusicWorkspacePage owns `mw-*` layout and keeps `aw-root`. Shared `audioMusic/shared.tsx` imports workspace.css and shared controls/players/source/voice interfaces still produce live `aw-*`. Generic UI components forward className and portal content outside the page root; stylesheet import position is not a DOM ownership boundary.

### 3. Contracts
Retire only selectors whose current source/import/caller/string/dynamic/forwarding closure proves them obsolete. CSS class text absence is evidence, not execution of arbitrary JavaScript. Responsive/state/descendant rules and portaled controls are conservatively retained when any live interpretation remains. For mixed selector lists remove only a proven unused branch and preserve live branch declarations/order/ancestor media context. Surviving declarations retain exact semantics; avoid reformatting/restructuring live CSS as part of dead-rule cleanup. Current `.aw-muted` and `.as-script-input` mixed branches remain; `.as-paragraph-gutter > span` and `.as-role-popover .aw-select` are retained structural caveats until separately proven unused. Empty media containers/whitespace may be removed only as an attributable result of deleted rules.

### 4. Validation / Error Matrix
Missing class with no dynamic/forwarded/current producer → candidate until code and browser evidence complete. Shared control or portal → keep its global selector even when parent layout changed. Mixed rule → live branch and all declaration bytes/context unchanged. Narrow/desktop breakpoint → actual workspaces/menus/sheets/players retain geometry/appearance. Browser cold outline repaint noise → same-source control and identical warmup, never unexplained tolerance or masking. Any actual computed/layout/text/color difference → block equivalence until explained/corrected.

### 5. Good / Base / Bad Cases
Good: a complete rule inventory maps each removed branch to absent producers and pairs actual current UI at relevant breakpoints with preserved original CSS. Base: keep an uncertain old descendant/state rule rather than declare it dead from independent class tokens. Bad: erase all `aw-*` because the main audio page now uses `as-*`, delete portaled popup styles, or call reduced line count proof of correctness.

### 6. Tests Required
Maintain native actual AudioWorkspacePage/MusicWorkspacePage fixture and immutable test-owned original stylesheet snapshots/provenance. Desktop/narrow script/timeline/voice/source/export controls, responsive inspectors, music compose/works/details, selects/popovers and players must retain computed style/state/geometry and visual appearance. Ordinary Vite-delivered stylesheet bytes and same-page raw original/current swaps must be verified equivalent before using that seam. Current local raster requires controlled same-original warmup for selected timeline outline; preserve failed noise/control reports and exact final pixel comparison without tolerance/masks. Local generated media/disabled animation/reduced-motion are finite test conditions, not physical-device/media-permission/paid-provider proof. Tests/runners must never read mutable task/archive files; source/evidence hashes and single-document/cache isolation make results reviewable.

### 7. Wrong vs Correct
Wrong: infer obsolete CSS from folder redesign or screenshot absence, or relax an arbitrary global pixel threshold. Correct: inspect every rule and consumer, preserve mixed/portal/dynamic contracts, use controlled same-source browser comparison and document practical limits.
