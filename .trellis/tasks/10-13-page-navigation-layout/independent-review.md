# Independent review: navigation and context presentation

Date: 2026-10-13. Scope: the new shared frame, module/context primitives and history tracker; their Agent, material, project, audio/music integrations; Phosphor forwarding boundary. This is a focused review, not a full-source audit or native acceptance report. Other contributors' edits were preserved.

## Findings and coordinated repairs

- **Canceled POP after rapid writes:** installed TanStack optimistically increments entry indices while coalescing physical writes. With a remaining forward entry, its index-based canceled-POP rollback can overshoot the accepted URL. The browser/hash reproduction failed before correction. The foundation owner serialized public PUSH/REPLACE, flushed accepted notifications and delegated original blocker outcomes to release denied requests. Final tests cover concurrent async acceptance, denied-first/accepted-next, physical URL rollback and the preserved forward branch. Rapid accepted PUSH now creates real separate entries; current design/research records this necessary correction.
- **Overlay opening focus:** a parent passive autofocus can run before FocusScope's container effect. Radix skips its mount autofocus event if focus is already inside, so the original helper never captures the opener. The foundation owner moved capture to the controlled root before activation and background isolation; initial focus now belongs to FocusScope.
- **Caller autofocus prevention:** the explicit initial focus effect ignored `onOpenAutoFocus` prevention. The foundation owner restricted explicit focus to entering overlay mode and retained the primitive delegate.
- **Reopen presentation:** a lifetime `initialOverlay` ref could retain the closed component's earlier desktop mode and suppress focus on a later narrow reopen. The foundation owner removed it and uses current presentation at the actual FocusScope mount.
- **Module-navigation opener:** capturing focus after AppFrame applies `inert` can lose the topbar toggle. The foundation owner captures the opener before opening the narrow navigation.
- **Typed blocker result:** the new product-history wrapper inherited `any` from upstream `blockerFn`, causing two blocking ESLint findings. This reviewer assigned the awaited result to `unknown` and explicitly converted its original truthiness to a boolean. Final ESLint, type-check and history regressions pass.

## Source conclusions

The keyed FocusScope/DismissableLayer subtree and stable portal target avoid the previous modal/nonmodal or breakpoint branch replacement. Audio/music retain a single editor/player owner. The coordinator leaves the outgoing owner active until its existing departure callback approves, closes rejected incoming requests, and invalidates stale completion generations. Narrow frame isolation excludes nested body-portal confirmations; known Radix child portals remain in the React capture tree.

Workspace backup still flushes registered drafts before exporting. Existing local settings, material identity and task/manual departure guards remain with their feature owners. Phosphor uses static official imports, a forwarded SVG ref and semantic size/weight; the adapter strips incompatible raw SVG geometry. Immutable comparison sources were not changed by this review.

## Performed checks and limits

- Local machine pnpm `lint` (`tsc -b --pretty false`): passed.
- Focused ESLint on AppFrame, ContextPanelHost, ModuleLayout, context-panel, historyNavigation and productRouterHistory: final pass after repairing the two typed-result errors.
- Six focused test files: 42 tests passed in the final iteration. The earlier 34-test run preceded the reproduced history defect and final corrections; it is not the final proof.
- Hook harnesses verify actual coordinator/owner callback logic; the executable fake window runs installed browser/hash POP and blocker code. Neither establishes real DOM/caret, popup access, native traffic-light geometry or media playback.
- Root owns full quality/test/build gates, current spec synchronization and CUA native inspection. Actual editor/ref identity, focus return, nested popup behavior, resize/playback and print remain native acceptance requirements; no UI automation was performed by this reviewer.

## Final verification

Final source checks: `pnpm lint` passes; the six-file ESLint subset passes; the six-file Vitest subset passes all42 tests; `git diff --check` passes. Commands used the authorized local Node/pnpm directory. Source-level findings above are closed. Native UI requirements and full root gates remain with the main session; this review alone does not close A3/A6/A7/A8 or claim full task acceptance.
