# Implementation Plan

## Preconditions

- Task stays `planning` until the user explicitly approves the latest final summary covering all-module splits, right panels, Phosphor Regular/Fill and chronological history.
- Recheck working tree and current session binding; reuse this task, not a duplicate. Preserve unrelated user work. Base is main. Create an isolated implementation branch after approval; do not merge/push/release as part of planning.
- Load relevant before-dev context, this PRD/design and curated manifests. Trellis's main-session implement/check dispatch protocol applies after activation; dispatched workers own explicit files and must preserve other contributors' edits.
- Context validation passes but injection truncates large state-management/audio-music files at 32KiB. Implement/check agents must explicitly pull state-management's B01 ownership/departure and D08 text-draft sections (around lines 735-746 and 870-921), plus audio-music's workspace orchestration, E01/E03 and numeric clip sections (around lines 458-573); the injected prefix is not complete evidence.
- Use local Node/Pnpm. Prefix command PATH with `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin`; invoke `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly. Do not use the Codex Runtime package manager or add approval overrides.

## Ordered checklist

1. **Phosphor boundary (R1/A1).** Verify pinned candidate availability. Add official React package with exact version and remove Remix using local pnpm. Replace direct navigation imports, rename neutral adapter, migrate all current consumers and actual LobeHub rendering test. Inspect semantics, refs, sizes, Regular/Fill and dependency diff. Keep historical fixtures and brand glyphs intact.
2. **Stable presentation foundations (R2/R3/R5/R6).** Extend AppFrame with stable navigation/toggle/context-panel hosts. Keep one 44px row, actual native reservation and drag exclusions. Remove the project exterior second-row rule only alongside its internal navigation replacement. Implement the stable responsive panel composition and coordinator before migrating editors; add direct public primitive dependencies only when used.
3. **Prove responsive ownership (A6/A7).** Verify one live input retains DOM/caret/value through dock/overlay switches; nested Select/Popover/AlertDialog remain usable, pending close is rejected, docking allows main interactions, overlay traps/isolation/return are correct. Fix the primitive before integrating business editors.
4. **Module navigation (R2/R3/A2/A3).** Migrate project and material list/detail navigation, then IP, tasks and connections. Reuse Agent topic navigation and move its narrow mode left. Audio chapters and music creator integrate compact project access without another redundant sidebar. Keep query, route/search, selection, draft, playback, unavailable/retained Outlet and command owners in their existing features.
5. **Context consumers (R5/A5-A7).** Migrate task, material, live/historical memory, audio and music detail into the same stable host. Preserve owner-specific guards/tabs/open callbacks and scoped themes. Route multiple panel triggers through guarded replacement; do not bypass local or nested departure arbitration. Keep unrelated dialogs/modal workflows.
6. **History store and controls (R4/A4/A5).** Attach one store at router lifetime, render arrows after traffic lights, and replace duplicate page parent arrows with named left navigation. Implement accepted-entry reconciliation, serialized accepted PUSH/REPLACE writes and coalescing reconciliation, forward truncation, canceled POP, safe direct/reload/unknown disablement and serialized traversal. Retain real TanStack blockers and local returns/recovery.
7. **Focused behavior checks.** Add meaningful history unit/integration cases, actual adapter rendering/ref coverage and responsive panel/editor retention coverage. Update existing B01/E01/E02/B07 harness targets only where presentation changed; preserve their assertions and timeouts. Do not rewrite immutable source comparisons or write path snapshots/class-only tests.
8. **Visual/native pass.** Inspect all six modules, project film/series/audio/music and setting/IP details; collapse/expand; dock/overlay/close/replacement; actual Continue/Discard/pending/error; playback across resizing; long title/header overflow; Agent expanded composer; print. Required sizes: 1440x900, 1280x720, 1024x640, 1280x600, native 760x520, 390x844, and both sides of navigation/docking thresholds. Use permitted UI tools; do not retry rejected browser attachment via hidden CDP/shell workarounds.
9. **Independent check and specs.** Run required gates, fix findings and recheck affected cases. Update current desktop-ui/component/directory guidelines to actual Phosphor, single-row header, internal navigation, stable panel and history contracts. Keep authored Markdown conclusions and curated references; raw logs/screenshots stay temporary outside the task.
10. **Completion.** Record actual results, limits and remaining platform evidence; commit coherent authorized implementation and finish/journal/archive through Trellis only after required work is complete. User's earlier main merge authorization applied to the completed shell task; no new remote push/release is implied.

## Validation commands

Run with the local Node directory first in PATH; replace `<focused tests>` with actual implemented test names after source changes. These are planned commands, not completed checks.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run <focused tests>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality:self-test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:verify
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
```

Use the existing supported fixture runner where UI execution is permitted; never bypass an automatic approval rejection. Actual POP/owner/resize checks remain required beyond unit tests. Native frontend/app smoke should use the established local build/isolated test profile and must not overwrite normal user data. Full Rust/storage/package/provider suites are not required for a presentation-only change unless its diff touches those boundaries.

## Risk files and checkpoints

- Shell/header/slots/styles: AppFrame, AppHeaderPortal, StudioShell, WorkspaceChrome and styles.css. Keep native 44px content origin and controls verified before broad migration.
- Responsive panel and ui primitives: trap/isolation/portal stacking can break nested forms. Gate editor migrations on stable-instance/focus proof.
- TaskInspector, MaterialDetailPanel and MemoryContextDetails: synchronous dirty/pending identity, guarded replacement, historical snapshots and themes remain authoritative.
- AudioWorkspacePage/MusicWorkspacePage: actual available width, selection, timeline/player and drafts; no breakpoint keys or conditional copies.
- main.tsx/productRouterHistory and new capability store: one lifetime and actual installed POP/coalescing semantics. Keep tracker tests independent of shell presentation.
- package/lockfile/icons/current consumers: remove only intended dependency closure and update integration geometry; do not churn unrelated dependency versions or fixtures.

Rollback at coherent checkpoints before further integration if required. Never reset/revert unrelated user edits. A material deviation from approved product behavior requires revised planning review before continuing that deviation.
