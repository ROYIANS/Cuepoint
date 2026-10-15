# E16 batch review implementation

## Change boundary

The two exact business-target anchors in `AgentGenerationBatches.tsx` currently navigate from a modal review. This owner changes only their presentation handoff and return. `BatchSurface` keeps its local revision/edits, expanded row, comparison group, pending lock/promise, acknowledgement/error, live reads and route blocker mounted. Existing save/confirm/start/select/apply command paths stay with their current owners.

Owned files are the existing batch UI, one focused actual ReactDOM regression under `tests/`, and this report. App/shot and Library workers own the shared facade, feature editors and guarded admission. Main owns specs, ownership/discovery and Git. No runtime, transcript query, scroll, command/schema, dependency, package, build or native changes are planned here.

## Presentation protocol

- Keep a source-session token and review scroll/item/control/selection bookmark. Close only the Radix Dialog presentation, suppressing ordinary trigger autofocus for this transition.
- The installed Radix FocusScope schedules its actual unmount autofocus event after removing the modal DOM. Its callback returns before removing the scope from its stack. Continue through a microtask after that callback so the modal focus/inert boundary has released before requesting detail; do not guess release with a product timeout.
- Consume the app facade only after its module/API exists. Validate the real href using its finite parser and compare every production target owner/entity field before intercepting an unmodified primary activation.
- Refused admission restores the retained source review. Admitted return/close restores only the matching source token after detail removal; replacement retires the token without reopening the source modal. Explicit reveal while away asks the facade to return through the same detail guard.
- Restored controlled inputs are new modal DOM nodes; preserve their value via retained controller state and restore only valid selection bounds. Do not claim input-node retention across modal unmount.

## Delivered files and concrete behavior

- `packages/studio/src/features/agent/ui/AgentGenerationBatches.tsx`: two typed target activations, source token/lifetime, separate presentation state, post-FocusScope-unmount opening, guarded activity reveal, origin retirement and bounded item/control/scroll/caret bookmarks. Control matching uses native tag/type and accessible/associated-label name inside the original item, so an unrelated inserted control does not shift the bookmark. Only valid native selection bounds are restored.
- `tests/e16BatchDetailHandoff.test.ts`: actual ReactDOM, Radix Dialog, BusinessDetailsProvider, ContextPanelHost, ShotDetailPanel/AssetDetailPanel and ProductStore. Router Link/blocker bindings are a typed fixture seam; it records ordinary fallback navigation and supplies local resolver state rather than claiming browser-history execution.
- Facade imports used by this owner: `readBusinessDetailTarget`, `useBusinessDetails`, type `BusinessDetailTarget` and type `DetailReturnOrigin`. Their module and actual dependencies existed before this consumer import was added. No new production module or feature command was introduced.

## Validation

Executed with the approved explicit machine pnpm:

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/e16BatchDetailHandoff.test.ts
```

Final result: **14 tests passed**, one suite, 5.26 seconds (2026-10-15 19:38 local). It verifies:

- Dirty ordinary close remains protected; merely inspecting never confirms, starts, navigates or calls global fetch.
- Both docked (1440 working-surface width) and full-width (760) return controls remove the actual modal overlay, release its pointer/focus/aria boundary and restore the controlled draft, inclusion, expanded row, scroll, focused control and valid caret direction/range. The returned input is explicitly a new DOM node.
- Modifier activation and canonical href/typed-target mismatch retain real-anchor fallback.
- Project-owned and Studio-owned asset targets open their actual Library editor; shots open their actual owned Video editor.
- An existing dirty detail can refuse admission while retaining its original input and restoring the same batch draft.
- Successful replacement retires the origin without reopening the old modal; the ordinary source opener can later expose its retained review.
- A held actual `saveGenerationBatchDraft` can acknowledge or reject while away. Return preserves its saved receipt/revision or failure/draft, with one original-target command call and no generation dispatch.
- Activity reveal returns through the original detail guard; Continue keeps detail/draft, explicit discard returns the exact source review.
- The second comparison-target anchor preserves group selection, scroll and focus.
- A forced retired-origin notification cannot reopen the modal during a later handoff. That test observes actual facade calls solely to retain and deliver an obsolete callback; all admission/return still use the real facade and host.

Earlier bounded runs passed the first 1/5 cases. An intermediate 11-case run had two fixture failures because its assertion checked the save spy before the existing Web Lock had granted the action; the fixture now waits for the actual command boundary and wraps its held settlement in `act`. The resulting 11-case run passed, followed by the final 14-case run above. No product timeout or lock behavior was changed.

This proves the executed jsdom DOM/controller/store assertions. Programmatic focus/click and numeric scroll restoration do not establish physical pointer/keyboard defaults, pixel geometry, native history, packaged WebView, active Agent transport retention or live provider behavior. Those unchanged-owner integration checks remain with the main stage/batch acceptance. Per main coordination, final direct types/scoped lint/architecture run once during independent whole-stage review; this worker did not repeat them. No build/native/install/paid or Git mutation was run.
