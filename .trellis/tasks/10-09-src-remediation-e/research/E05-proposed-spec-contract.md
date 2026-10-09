# Proposed E05 lifecycle spec synchronization — awaiting independent PASS

Preparation only. Append one English seven-section lifecycle contract to hook-guidelines.md after completedreview; refresh for independent findings. Counts and source proof remain separate from full-app performance.

## E05 demand-driven decorative canvas lifecycle (2026-10-09)

### 1. Scope / Trigger
Read before changing ClickSpark's click animation, idle scheduling, live availability, drawing options, resize or unmount.

### 2. Signatures / Owners
Keep existing ClickSpark props/JSX and canvas accessibility contract. Refs own the sparks and start callback. The draw effect owns one nullable pending RAF ID and visibility/motion listeners; the resize effect owns its observer/debounce timeout. Shared cleanup has explicit ownership and final unmount clears burst references.

### 3. Contracts
Schedule while enabled live bursts remain, with at most one pending component RAF. Empty/expired/hidden/reduced/unmounted states retain no loop. Disabling cancels/reset/clears; enabling does not replay old timestamps, while the next enabled click starts a new burst. Drawing-option changes preserve still-live original timestamps and apply current easing/geometry/duration. Preserve actual radial equations, counts, local pointer coordinates, child click bubbling, pointer-events none, aria-hidden and responsive resize semantics. StrictMode setup/cleanup replay leaves one owned lifecycle.

### 4. Validation / Error Matrix
Idle → zero executed callbacks and pending IDs. Enabled click → draw, expire, clear and stop. Availability disabled while active → contemporaneous pending ID cancelled and canvas cleared. Disabled click → no burst/work. Reversal → no stale replay; new click works. Current prop update → same original timestamp/current options and duration. Active or pending-resize unmount → no future component frames/listeners/observer/timeout/drawing. Missing canvas/context → no scheduling.

### 5. Good / Base / Bad Cases
Good: restart current-option drawing without losing live burst timestamps, and reset only for unavailable/final-owner states. Base: eight default radial strokes with ease-out t*(2-t) and two-pixel lines. Bad: unconditional RAF chaining when empty, replay of hidden bursts, or clearing spark refs on each color/easing cleanup.

### 6. Tests Required
Execute actual component in native browser with forwarding RAF/cancel/clock instrumentation and component-only attribution that excludes Playwright polling. Count executed callbacks, pending IDs and cancellation; verify actual drawing/zero-alpha clearing, pointer coordinates/click propagation/overlap, props and expiry, reduced-motion event/reversal, resize and StrictMode/unmount. Read pending→trigger event→read cancellation in the same browser task, or capture at actual media-event callback. Preserve original snapshot/provenance, exact producer/loaded-body/source hashes, failed attempts, one main document and isolated Vite dependency cache. Real finite windows are not infinite-trace or measured latency evidence.

### 7. Wrong vs Correct / Limits
Wrong: fake timer counts called native performance proof, whole-fixture historical max called current pending state, different RPC pending IDs assumed current, or new hidden behavior asserted against the original component. Correct: keep before/current branch expectations distinct and label controlled document.hidden/visibilityState/event seams as handler/cancellation proof. Local Chromium could not produce real document.hidden after tab/window/focus/lifecycle probes; do not equate lifecycle freeze with hidden or claim OS background throttling. Native reduced-motion/resize forwarding remains explicit. Distinguish component lifecycle behavior from whole-app performance/device/CI/formal quality acceptance; graph reports use total typed/value/dynamic edges separately from static-value SCCs.
