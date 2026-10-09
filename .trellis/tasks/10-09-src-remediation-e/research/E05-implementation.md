# E05 implementation handoff — SS11

Implementation is complete and frozen for coordinator independent review. Only `src/components/ui/click-spark.tsx` changed among the **752 postE04 entry files**; seven permanent runner/fixture/snapshot files were added. The exact eight changed paths and before/after hashes are in `E05-implementation.json`. Final root closure has **759 files**, with no missing entry file or unrelated drift. Specs, task status, ledger, packages, other product owners and commits remain coordinator-owned.

ClickSpark now starts RAF on enabled clicks with live bursts, holds at most one component-owned pending ID, and stops after the final clear. Hidden/reduced-motion changes cancel and clear pending work and timestamps; returning to enabled does not replay old sparks. Existing resize debounce/observer cleanup now also retires burst references at unmount. Drawing-option cleanup cancels its own frame and clears canvas but retains live burst timestamps; setup resumes them under the current duration/options. Default ease-out remains `t * (2 - t)`, with an explicit ease-out switch case and unchanged runtime fallback. Children, click coordinates, counts, line width, pointer-events and aria-hidden remain intact.

## Native verification

Both frozen original/current runs passed **9/9 scenarios** on native Chromium 151.0.7922.34 with Node v24.11.0, Vite 7.3.6 and React 19.3.0. Every browser run forwards scheduling and clock calls to the native browser. RAF accounting selects the actual component request stack and owned cancel IDs, excluding Playwright's own RAF polling. `maxOutstanding` is cumulative for the whole fixture; instantaneous same-task pending IDs prove each current lifecycle. Both final runs have one main document, zero page errors and 16 hashed loaded responses, whose exact served bodies are saved.

| Executed callback observation | Original | Current |
| --- | ---: | ---: |
| Idle 180ms / 140ms | 27 / 21 | 0 / 0 |
| Post-expiration 180ms | 27 | 0 |
| Controlled hidden 180ms | 28 | 0 |
| Return visible 140ms | 22 | 0 |
| Reduced motion 180ms | 28 | 0 |
| StrictMode initial idle 140ms | 22 | 0 |
| After unmount 180ms | 0 | 0 |

Both original/current sampled default frames painted **196 canvas pixels**, then cleared to exact zero at expiration. All eight radial stroke coordinates, width and color are checked using the actual forwarded clock readings and the documented equations; the `1e-8` coordinate bound accommodates arithmetic roundoff, not a pixel-image tolerance. Real child pointer clicks bubble to both child and parent; canvas stays `aria-hidden=true`, `pointer-events:none`. Three overlapping five-spark clicks draw 15 strokes with one owned pending frame.

All nine drawing-option changes (color, size, radius, scale, four easing values and duration) retain the original burst timestamp. Updated travel and shrinking-line length are verified against current options using the real timestamp. Shortening duration expires and clears. Visibility cancellation and props/unmount cancellation match exact pending IDs captured in the same browser task. Reduced motion uses actual `page.emulateMedia`; the wrapper records the live media-event handler's before/after IDs and valid cancellations. Enabled reversal needs a new click. Native ResizeObserver resizes to 600×310, preserves local click geometry, and a pending resize timeout is cancelled on unmount. StrictMode leaves one observer, one current visibility listener and one media listener; active unmount leaves zero pending frames/listeners/observer/timers, zero executed callbacks and no further canvas operations.

**The original is tested against its original behavior.** It continuously schedules while idle, expired, controlled-hidden and reduced-motion, accepts controlled-hidden clicks, and keeps live bursts when availability reverses. PASS on a before case verifies these documented original expectations; it does not mean the original cancels hidden/reduced-motion work. Original/current share drawing/props/pointer/resize/unmount preservation assertions.

## Capability and measurement limits

Visibility uses the required labeled `document.hidden`/`visibilityState` property plus visibilitychange seam in the actual browser. This proves handler cancellation; it does **not** prove OS background-tab throttling. Previously recorded headless/headful tabs, minimize/freeze and disabled-focus observations all left hidden=false; the unavailable CDP override and all `E05-native-*` capability records are preserved. No broad capability reprobe was performed. No clock is faked and counts are executed callbacks, not just requests. Idle/negative observations are finite windows. Recent drawing snapshots are bounded to 12 frames with a total clear-operation counter; all owned RAF IDs/executions remain recorded. These are scheduling/work counts, not battery, latency, full-app or provider measurements.

## Checks, failures and immutable evidence

The application typecheck and final browser-only fixture typecheck passed through the explicitly authorized machine pnpm path; fixture types are restricted to `vite/client`, avoiding Node timeout pollution. No new unit-test framework or mirror test was added: this single canvas owner requires the focused native proof. Exact commands/exit codes/logs are in JSON. Coordinator source-consistent static attribution matches the unchanged product hash and reports zero new E05 non-complexity diagnostics and zero new E05 metrics. Coordinator also reports 420 AST files, 2502 value edges, zero parse errors and zero cycles on the same stable source. Full checks and independent integration acceptance remain coordinator work.

All failed native attempts, raw logs, screenshots and their exact producer snapshots are retained. Corrections were fixture typing; burst-time selection (direct ClickSpark handleClick clock reading); synchronous cancellation observation; bounded recent-frame serialization so observation overhead did not consume burst lifetime; explicit original hidden-click expectations; and exclusion of Playwright-owned RAF polling. Late jsx-dev-runtime optimization was corrected by explicit installed React optimizer includes, while preserving one-document/page-error assertions. No product code changed during those native refinements. `e05/final-inputs.json` hashes the 759 root inputs, owned producers, evidence and prior capability records; native reports save producer bytes and loaded response bodies. Permanent inputs import no mutable task/archive data. The before Vite transform substitutes the immutable original snapshot; its effective hash is listed separately from the current product input hash.

## Suggested canonical contract (English; coordinator applies)

Suggested primary home: `hook-guidelines.md`; `component-guidelines.md` and `quality-guidelines.md` can link the lifecycle and native proof contract.

### 1. Scope / Trigger

Decorative ClickSpark canvas scheduling during idle, clicks, availability changes, drawing-option changes, resize and unmount.

### 2. Signatures / Owners

Keep the existing ClickSpark props and JSX contract. Component refs own live sparks and the current start callback. The draw effect owns one nullable RAF ID, visibility listener and motion-query listener. The resize effect owns its ResizeObserver and debounce timeout, and clears burst references at final cleanup.

### 3. Contracts / Invariants

Enabled live bursts may schedule one pending frame. Idle/expired/hidden/reduced/unmounted states do not maintain a loop. Disable cancels/reset/clears; enable alone never replays old timestamps. Props restart drawing from still-live original timestamps under current options. Preserve equations, counts, local coordinates, child bubbling, pointer-events none, aria-hidden and resize semantics. StrictMode setup replay restores exactly one owned lifecycle.

### 4. Validation / Error Matrix

Idle → zero executed callbacks/pending frames. Click → drawing until expiration, then clear and zero work. Hide/reduce while active → cancel owned pending ID/reset; disabled clicks add no burst. Enable → no stale replay; next click draws. Props update → retain original timestamp and use updated geometry/easing/current duration. Active/pending-resize unmount → no callback/listener/observer/timeout or later drawing. Missing canvas/context → no animation scheduling.

### 5. Good / Base / Bad Cases

Good: cancel and clear availability-disabled work; preserve active timestamps across drawing-option cleanup. Base: eight radial strokes with ease-out `t*(2-t)` and two-pixel line width. Bad: unconditional RAF chaining while empty, retaining hidden bursts for replay, or clearing live burst refs on every color/easing prop cleanup.

### 6. Required Tests

Execute the actual component in an isolated native browser. Count executed component callbacks plus outstanding/cancel IDs; exclude browser-test polling. Observe native drawing/clear, real click propagation/coordinates, overlap, availability reversal, current-option geometry and duration, StrictMode, native ResizeObserver and pending timeout cleanup. Capture cancellation in one browser task or within the actual live event callback. Original comparison uses minimal immutable snapshot/provenance; keep isolated dependency cache, one main document and zero page errors. Preserve failed producers and exact input/loaded-body hashes.

### 7. Wrong vs Correct / Limits

Wrong: use fake timers to claim native work counts, treat lifecycle freeze as document.hidden, compare pending IDs across browser RPCs, or assert the new disable behavior against the old component. Correct: forward native methods, explicitly label any controlled visibility seam, capture contemporaneous pending/cancel IDs, and keep original/current expectations distinct. Bound negative observations and distinguish component lifecycle proof from OS throttling, full-app performance, CI and formal quality-gate acceptance.
