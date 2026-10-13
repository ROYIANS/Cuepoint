# Shell scale refinement — 2026-10-13

## Approved boundary

The user's follow-up screenshot found the global rail/buttons/glyphs too large and header shortcuts too bright. This refinement changes only presentation in `src/styles.css`, `src/components/agent/agentHeader.css` and the existing AppFrame SVG size classes. Root coordinates native traffic-light positioning separately.

## Final presentation

- Shared topbar, stable header target, fallback and feature header minimum height: 44px.
- Global desktop rail: 56px with 10px horizontal padding, giving each icon button a 36px width. Button minimum height: 36px; Remix glyph: 16px. Mobile navigation rows and import retain 44px minimum height, and the application navigation trigger retains its 36px button.
- Agent header shortcuts use 16px glyphs, muted foreground by default, foreground on enabled hover/active. A scoped selector targets native buttons in the topic/actions/title-control groups, overriding LobeHub's doubled-class color rules. Minimum dimensions retain 36px targets even for the 24px inline More button.
- Workspace header back/action controls use 16px glyphs and muted default/foreground hover, with at least 36px targets. Existing disabled behavior, focus rules, callbacks and title/tab semantics remain intact.
- Topic navigation remains 260px; desktop working-surface radius/inset remain 16px/8px. Popup-host menus are outside the shortcut selectors, preserving their danger and label colors.

## Verification and limits

`git diff --check` passes for the three source files. Installed PostCSS parsed both CSS sources successfully. Search found no obsolete 48px header minima, 68px rail token or AppFrame 20px glyph classes in this scope. Installed LobeHub source confirms ActionIcon uses native buttons and SVG attribute dimensions, so the scoped color and glyph-size rules address the actual controls.

No browser automation, full tests, native checks or build was performed by this worker. Root owns visual acceptance and final quality gates after source freeze. No behavior, dependency, test-policy or native source change is part of this refinement.
