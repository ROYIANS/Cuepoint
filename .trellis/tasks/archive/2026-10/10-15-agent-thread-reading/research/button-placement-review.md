# Return-to-latest screenshot correction: independent review

Reviewed only the frozen delta after E04 commit `982dece3`: `MessageList.tsx`, `turnNavigation.css`, `tests/e04ReadingNavigation.test.ts` and [button-placement.md](./button-placement.md), against the updated PRD, design and canonical [Agent topic reading contract](../../../spec/frontend/agent-thread-reading.md). Earlier E04 query/departure delivery and unrelated E05/E16 planning are outside this increment.

## Findings (fixed)

No issues found; no source or test changes were needed during independent review.

## Findings (not fixed)

No unresolved defects or design decisions found in this increment.

The button is absolutely positioned within `.agent-message-navigation-shell`, whose existing positioned/flex layout fills the transcript inside the chat column. `left: 50%` plus `translateX(-50%)` centers the circle against that shell rather than the app window or adjacent detail pane. Removing the narrow-screen right offset preserves the same relationship at narrow widths. The 36px equal width/height and 50% radius give the requested compact circular treatment.

The existing `bottom: calc(var(--agent-chat-composer-safe, 168px) + 8px)` remains tied to the chat column's composer measurement. The dock observer supplies its measured height plus the existing reserve; no second measurement mechanism was introduced. The button keeps z-index12 above the composer dock's z-index11 within the column's existing isolated stacking context. E01 full-width detail mode still hides the retained workspace through its ancestor; the button's z-index does not bypass that visibility/pointer boundary. Returning to the retained workspace restores the same local shell placement.

`ArrowDown` is an existing shared export in `packages/studio/src/ui/icons.tsx`, backed by the application's Phosphor wrapper. That wrapper forwards semantic and ARIA props, so the decorative `aria-hidden` reaches the SVG. The native button keeps `type="button"`, now exposes `aria-label="返回最新"`, and has no visible text. Focus-visible styling remains. The click handler, immediate snap, renewed following and `focus({preventScroll: true})` are unchanged, as are paused-state ownership, rail/activity behavior, canonical identity and execution/composer owners. No status line, toast or announcement was added.

## Verification

Commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly.

- **TypeCheck: pass.** Independent checker ran `exec tsc -p packages/studio/tsconfig.json --noEmit --pretty false`; exit0, no diagnostics. This verifies the existing shared icon import against current source types.
- **Lint: pass, unchanged worker evidence reused.** Direct scoped ESLint on `MessageList.tsx` reported **0 errors / 2 existing message-item/comparator complexity warnings**. No source changed during this review.
- **Tests: pass, unchanged worker evidence reused.** `exec vitest run tests/e04ReadingNavigation.test.ts`: **7/7 passed**. The changed assertion checks the accessible name, no visible caption and decorative SVG; existing cases retain snap, focus, paused growth, new-turn/topic reset and rail/activity/disclosure behavior. No source or test changed during this review.
- **Whitespace: pass.** Independent checker ran `git diff --check`; exit0.

No architecture rerun was necessary: the only new imported binding comes from the same existing shared icons module already statically imported by MessageList. No module, registry, dependency or source-boundary change was introduced. No broad test wrapper, build, package, native/live acceptance, install or Git write ran.

Source review establishes the containing block, safe-area and stacking relationships. Controlled ReactDOM does not prove browser pixels; root owns the separate isolated browser geometry check and its evidence. This increment is frozen and ready for root's final evidence and commit.
