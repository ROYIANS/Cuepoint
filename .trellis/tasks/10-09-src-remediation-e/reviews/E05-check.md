# E05 SS11 independent check

**Status: PASS. Blockers: none.** All eight owned root paths reviewed; no source/runner/fixture self-fix was necessary. This frozen return is ready for coordinator acceptance and subsequent spec/status/ledger synchronization. It closes this E05 check only.

## Scope and semantic assessment

ClickSpark now schedules from enabled clicks and queues the next frame only while live sparks remain. The nullable ID is reset at callback entry; one synchronous start gate prevents overlapping requests. Availability disable cancels and clears both drawing and burst timestamps. Reversal leaves idle state until a new click. Option-effect cleanup preserves timestamps while cancelling its owned ID; setup filters under the current duration and resumes drawing. Final resize cleanup retires burst references, observer and timeout. Original and current easing/drawing equations, width, colors, child event bubbling, coordinates, JSX, pointer-events and aria-hidden remain compatible. Explicit ease-out fixes the exhaustiveness diagnostic while preserving its original t*(2-t) result.

Native replay covers all nine scenarios: idle; real child pointer/default geometry/paint/expiration; overlapping bursts; controlled visibility; actual reduced-motion media event; all nine drawing-option updates/current duration; native resize/pending-timeout unmount; StrictMode/active unmount; disabled/zero-count/re-enable. Source early returns for unavailable canvas/context and unchanged equations were also inspected. No general registry or other product owner changed.

## Native executed callback evidence

Four final runs (writer original/current and independent original/current) each passed 9/9 with identical 12 producer hashes. Independent typecheck also passed. Native versions: Node v24.11.0, Vite 7.3.6, React 19.3.0, Chromium 151.0.7922.34. Each run loaded one main document, had zero page errors/response-body failures and saved 16 hashed responses. Isolated Vite caches were removed after browser/server cleanup. The before transform serves the exact original snapshot; decoded served source maps confirm effective before/after bytes. Recorded pre-transform source hash remains current by producer design, distinct from effective baseline bytes.

| Window | Writer original | Writer current | Independent original | Independent current |
| --- | ---: | ---: | ---: | ---: |
| Idle 180ms | 27 | 0 | 27 | 0 |
| Idle 140ms | 21 | 0 | 21 | 0 |
| Expired 180ms | 27 | 0 | 26 | 0 |
| Controlled hidden 180ms | 28 | 0 | 28 | 0 |
| Return visible 140ms | 22 | 0 | 22 | 0 |
| Reduced motion 180ms | 28 | 0 | 27 | 0 |
| Motion reversal 140ms | 22 | 0 | 22 | 0 |
| Props expired 140ms | 21 | 0 | 22 | 0 |
| StrictMode idle 140ms | 22 | 0 | 22 | 0 |
| After unmount 180ms | 0 | 0 | 0 | 0 |

Counts are callback entry executions, not request totals. Component request-stack filtering excludes Playwright RAF polling. One pending ID under overlap and same-task props/StrictMode/unmount observations establish ownership; cumulative maxOutstanding remains a whole-fixture maximum. Independent current visibility cancelled ID 154, and StrictMode unmount cancelled ID 220, each matching its instantaneous pending snapshot. Actual reduced-motion event captured its own pending/cancelled ID before/handler/after.

Original/current default samples painted 196/196 pixels in the writer run and 196/200 in the independent run; all expired samples cleared to exactly zero. These observations assert nonzero live paint and clearing, not image equality. The permanent runner checks all eight default stroke equations against forwarded clock/burst-time readings. Independent analysis additionally recomputed all eight radial strokes for each of nine live option changes (72 strokes per run), with zero observed coordinate error and bound 1e-8 for arithmetic roundoff. All retain the same burst start. Three five-spark clicks draw 15 strokes under one pending ID. Native resize reached 600x310 and preserved local click geometry; pending resize/active unmount left no RAF/listeners/observer/timer and no later callbacks/drawing in the finite windows.

The original before PASS verifies its original contract: idle/expired/hidden/reduced loops continue and controlled-hidden clicks are accepted; reduced clicks are suppressed by its existing click gate. It does not establish that baseline satisfies the new cancellation/no-replay contract. New handler guarantees are asserted only for current code.

## Input closure, current gates and static attribution

All 300 original handoff hashes, 296 writer evidence hashes, four capability records, 12 producer inputs, 759 writer root files and 766 current gate inputs match at review entry and final rehash. The postE04 entry contained 752 root files: only ClickSpark changed and seven permanent files were added; none disappeared and E01-E04 inputs remain unchanged. The 759-file writer root closure covers src/tests/scripts. The 766-input type/full-test gate additionally includes package.json, pnpm-lock.yaml, tsconfig.app.json, tsconfig.json, tsconfig.node.json, vite.config.ts and vitest.config.ts. The current application typecheck and full 163-file/2,744-test results were read and adopted on this exact unchanged manifest; no redundant full-suite rerun. Fresh fixture typecheck used the explicit machine pnpm executable with Node24 PATH.

The source-consistent temporary typed scan uses 19 changed TS files within separate complete baseline/current programs; all 447 current source/parser/package/config inputs were rehashed. Raw diagnostics and producer/configuration were inspected, and normalized per-file/rule/severity/message count deltas recomputed. Baseline 5 errors/44 warnings becomes current 3 errors/41 warnings. ClickSpark has no current diagnostics and no new E05 metrics; its prior ease-out exhaustiveness error is removed. The three cumulative metric additions are inherited: AgentChatInner complexity 101 and cognitive complexity 58 from E01, plus ProjectGalleryPage complexity 31->32 from accepted E04. This is no formal QG01 debt acceptance. Versions: ESLint 9.39.5, typescript-eslint 8.71.1, react-hooks 7.1.1, SonarJS 3.0.7, TypeScript 5.9.2; baseline/current rule configs differ only in parser root.

Correct graph attribution: **420 TS files, 2,502 total edges, zero parse errors and zero static value cycles**. Classified totals: 2,088 value static imports, 390 type static imports, eight dynamic value imports, 13 value reexports and three type reexports. The count includes 393 type edges; it is not an all-value count. Independent Tarjan SCC recomputation on 1,643 internal static value edges confirmed zero cycles after source/hash alignment; no unnecessary source reparse was run. Original writer prose/JSON calling 2,502 “value edges” remains preserved and is corrected here for downstream specs.

Actual before path existence is taken from the postE04 entry: the seven added paths were absent. E05-review-input.json uses the original comparator hash in its before map for the newly added snapshot path; E05-check-snapshot.json records null for that before path and separately binds the effective original source hash. This is an attribution correction, not a product fix.

## Per-file coverage

| Path | Status | Review |
| --- | --- | --- |
| `scripts/e05-browser-regression.mjs` | reviewed | Reviewed complete permanent runner, assertions and before/current branches. Exact original transform, isolated cache and explicit installed React optimizer entries; native methods, owner stack selection, real mouse click, all nine scenarios, one main document/error authority, same-task cancellation and live media event snapshots, 12 copied producer inputs, saved loaded-response bodies, input rehash and cache/server/browser cleanup. Before PASS tests original continuous RAF/accepted hidden clicks, distinct from new availability contract. Task watch exclusion is not a mutable dependency. |
| `src/components/ui/click-spark.tsx` | reviewed | Reviewed complete component and baseline diff. Nullable RAF ownership; draw clears/filters/requeues only live sparks; availability cancels/resets synchronously; click-time availability gate; props retain timestamps, use current options/duration; resize effect clears its observer/timeout/burst refs on final cleanup. All easing equations, radial coordinates, line width/color, child bubbling and JSX aria-hidden/pointer-events unchanged. StrictMode lifecycle reviewed and natively executed. Missing canvas/parent/context early returns inspected; not injected as native scenarios. |
| `tests/fixtures/e05/harness.tsx` | reviewed | Reviewed complete isolated actual ClickSpark mount/update/unmount with flushSync, StrictMode mount path, child/parent counters, click coordinates, native host resize and full alpha occupancy reads. Permanent fixture imports actual product component and instrumentation only; no replacement renderer or fake clock. Fixture supplies minimal geometry and styles, not full app. |
| `tests/fixtures/e05/index.html` | reviewed | Reviewed complete static HTML and minimal fixed geometry/class styling. Canvas pointer-events none agrees with unchanged product class. HTML is isolated actual component host, not a screenshot comparison of the application stylesheet. |
| `tests/fixtures/e05/instrumentation.ts` | reviewed | Reviewed complete native-forwarding instrumentation. Component request stack filter excludes Playwright RAF polling; owned IDs capture executed callbacks/outstanding/cancel. Cumulative maxOutstanding is whole-fixture history. Visibility seam explicit; media callback wraps actual page.emulateMedia change to read before/event/after in one task. Actual ResizeObserver/debounce callback counts, native performance.now/handleClick burst timestamp and Canvas2D strokes/clear recording with recent 12-frame bound. Isolated fixture contains only actual renderer, so document/media/observer meters remain attributable here. |
| `tests/fixtures/e05/tsconfig.json` | reviewed | Reviewed complete config extending application strict compiler; browser-only vite/client type surface avoids Node timeout overload pollution. Fresh explicit machine pnpm fixture typecheck passed. No install/package change. |
| `tests/fixtures/sourceSnapshots/e05/click-spark.tsx` | reviewed | Reviewed complete immutable original module and checked exact bytes against accepted postE04 entry/before copy/provenance. No relative imports; alias cn and installed React intentionally shared and hashed. Original unconditional loop, no hidden gate or motion listener; original reduced clicks suppressed. Minimal permanent comparator remains independent of task/archive paths. |
| `tests/fixtures/sourceSnapshots/e05/provenance.json` | reviewed | Reviewed complete original-path/hash/baseline/shared-cn provenance. Exact snapshot hash verified; empty relative import closure matches actual module. Added path was absent at postE04 entry; comparator source hash is distinct from before path existence. |

## Evidence provenance and preserved attempts

Exact command arrays, environment paths, exits and timings are in e05-independent/commands.json. Full native reports retain exact source copies and served bodies. e05-independent/integrity-entry.json and integrity-final.json bind manifests and report closure; analysis.json binds four-run counts, all option geometry, served effective hashes, historical source/body verification, raw diagnostic deltas and classified SCC results. The check snapshot records exact before/reviewEntry/after maps, eight per-file coverage rows, evidence hashes and producer identities.

All ten historical native report sets and their saved producer/body hashes were checked; six failed native runs remain immutable. Failures include initial clock attribution, cross-RPC visibility ID observation, expired burst during expensive trace serialization, option cancellation observation, the incorrect original hidden-click expectation and Playwright-polling pollution of global outstanding counts. The initial log also records late jsx-dev-runtime optimization/reload; final runs use explicit optimizer includes and one-document assertions. No product bytes changed through these fixture corrections. Two failed fixture-type logs preserve overload/implicit-type failures; final browser-only types pass. Prior capability scripts/logs and generator-output attempt history remain intact. These failed traces are not current acceptance evidence.

Two independent analysis preflight failures are preserved with exact scripts/logs: the integrity verifier initially treated a Vite watch ignore as a task dependency, and the raw diagnostic comparison initially omitted documented line-reference normalization. Both checks were corrected within reviewer evidence scope; product/runner/fixtures remained unchanged, and final integrity/geometry/count assertions passed.

## Material limits

- Visibility is a controlled document.hidden/visibilityState plus visibilitychange property/event seam while native RAF executes. This proves handler cancellation/reset, not real OS background-tab throttling. Prior native tabs/headful/minimize/focus/lifecycle attempts remained hidden=false and CDP visibility override was unavailable; no capability reprobe.
- Idle/negative observations are finite 180ms/140ms windows. Counters cover executed callbacks from ClickSpark request stacks, not all browser/app RAF. Native wrappers forward scheduling and performance.now; no fake clock. Instrumentation and reads add overhead, so counts do not measure frame-rate improvement, battery, latency or device-general performance.
- Canvas assertions check actual nonzero alpha during a sampled frame and exact zero after clearing, plus radial equations at forwarded real-clock readings. Fresh before/current pixel occupancy is 196/200, both >0; writer samples are 196/196. No pixel equality, visual mask/tolerance or full-app visual claim. Coordinate tolerance 1e-8 covers arithmetic roundoff only.
- Permanent runner and fixture were reviewed and independently rerun unchanged; this is a fresh reviewer execution of the same producer/assertions, supplemented by independent 72-stroke recomputation per run and source-map/body verification, not a second different native test design.
- Whole-fixture maxOutstanding is cumulative. Current props/unmount cancellation matches pending IDs captured in the same page.evaluate task; reduced-motion cancellation is captured inside the real media event callback. Cross-RPC rotating IDs are not compared.
- Existing application type/full-test gate is adopted only after rehashing all 766 inputs and checking pre/post/log counts. No full suite rerun, new build/model verification, full-product browser execution or CI execution in this check. Whole-E integration and formal QG01 remain coordinator work.
- Temporary typed scan compares 19 changed TS files in separate complete baseline/current programs. Zero E05 additions does not mean zero cumulative diagnostics: 3 errors/41 warnings and three inherited metric additions remain; no formal quality-debt acceptance. Source-consistent 447 inputs rehashed; no unnecessary rescan. Saved classified graph SCC independently recomputed; source AST parse not rerun.
- Missing canvas/parent/context and unchanged ease-in-out second-half branch were inspected in source. Native option tests execute all four easing options on sampled current times; do not claim every timing value or runtime-invalid numeric prop is exhaustively tested.

## English canonical spec suggestions

Suggested primary home: hook-guidelines.md; component-guidelines.md and quality-guidelines.md may link it. Coordinator applies this proposal after acceptance.

### 1. Scope / Trigger

Apply to decorative ClickSpark scheduling during idle, clicks, overlap, live drawing-option changes, visibility or reduced-motion changes, resize, StrictMode replay and unmount. Keep the existing component; no animation registry.

### 2. Signatures / Owners

Keep existing ClickSpark props and JSX. Refs own live sparks/current start callback. The draw effect owns one nullable RAF ID plus visibilitychange and motion-query change listeners; the resize effect owns its native ResizeObserver and debounce timeout. Final resize cleanup retires burst refs; drawing-option cleanup cancels/clears while preserving live original timestamps.

### 3. Contracts / Invariants

Enabled live bursts hold at most one pending component frame. Idle/expired/disabled/unmounted states maintain no loop. Disabled transitions cancel, reset timestamps and clear; enable alone never replays old bursts, next click restarts. Update drawing props from original live timestamps under current duration/options. Preserve eight default radial strokes, local click geometry, line width/color, easing, child bubbling, aria-hidden and pointer-events none. StrictMode restores one owned lifecycle.

### 4. Validation / Error Matrix

Idle: zero executed callbacks/pending IDs. Click: native draw, expiration clear, then zero work. Active hide/reduce: exact owned cancellation/reset, disabled clicks add no bursts. Reversal: no stale replay, next click draws. Props: same timestamp/current equations and shortening-duration expiry. Native resize: expected backing dimensions/local coordinates; active pending-resize unmount: zero pending RAF/timer/listeners/observers, zero later draw/timeout callbacks. Canvas/context unavailable: no draw scheduling.

### 5. Good / Base / Bad Cases

Good: cancel/reset when unavailable and preserve timestamps through drawing-option cleanup. Base: ease-out t*(2-t); distance=eased*radius*scale; length=size*(1-eased); eight evenly spaced angles and width=2. Bad: unconditional empty RAF chain, retaining disabled bursts for replay, clearing active timestamps on every color/easing change, or treating an original before PASS as proof of the new availability behavior.

### 6. Required Tests

Execute the actual component in an isolated native browser; count executed component callbacks and pending/cancel IDs, excluding Playwright polling. Forward real clock/scheduling. Verify actual drawing/clear alpha and exact equations, real child click/bubbling, overlap, actual emulateMedia change/reversal, labeled visibility seam, prop updates/expiry, actual ResizeObserver and StrictMode/unmount. Read pending/event/after in one browser task or live event. Keep minimal permanent original snapshot/provenance, fixture browser types, fresh cache/explicit optimizer entry, one main document, zero page errors, producer/source-map/loaded-body hashes and failures.

### 7. Wrong vs Correct / Attribution and Limits

Wrong: request-only/fake-clock native performance claims; lifecycle freeze equals document.hidden; cross-RPC pending ID matching; whole-history max treated as current ownership; 2502 edges described as all value edges. Correct: finite executed-callback evidence and contemporaneous cancellation; explicit handler seam vs OS throttle; original/current contracts distinct. Current AST attribution is 420 TS files, 2502 total edges, zero parse errors and zero static value cycles. Writer root closure is 759 files (src/tests/scripts), current full gate is 766 inputs including seven configs. Typed additions remain separate from QG01 debt acceptance; full-app/device/CI/battery/latency claims require their own evidence.
