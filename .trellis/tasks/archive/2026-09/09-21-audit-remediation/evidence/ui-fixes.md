# UI remediation evidence

The UI fixes cover the three confirmed editor findings and the measured shot-list bottleneck.

## F10: decimal duration editing

`DurationInput` keeps the focused text as a raw string and sends only parsed finite values through `useDebouncedDraft`. This allows `1.` and `.5` to remain editable, while empty input means zero and malformed input remains visible with an actionable error. Draft identity is scoped by project, shot, and field, so an in-flight or failed write is retained by the existing draft backup barrier. The focused unit cases live in `tests/durationInput.test.ts`; the browser check exercises typed decimals, zero, clear, and persistence.

## F11: shortcut priority

`isFormFieldTarget` now treats native buttons, links, summaries, and ARIA button/link controls as native interaction targets. The capture listener also respects `defaultPrevented` and only prevents Space/arrow events after it has confirmed a valid active shot. Browser coverage confirms Space on a copy button fires exactly once, keyboard drag continues to work, and pointer drag across a scroll boundary still reorders.

## F12: batch draft navigation

`AgentGenerationBatches` uses TanStack Router's blocker and an in-app `AlertDialog`. Continue keeps the local draft, save-and-leave writes the reviewed revision before proceeding, and discard leaves the durable draft untouched. Revision conflict keeps both the route and local text for recovery. Browser coverage is in `batch-browser.json`.

## PERF01: shot rendering

The shot list keeps one fixed-height anchor per shot for ordering, deep-linking, keyboard traversal, and DnD registration. A single `IntersectionObserver` over the scrollport mounts the expensive editor controls only within a 640px overscan region; the active, focused, and dragging rows are always mounted. In the production preview (Edge 153, 1440x900, same synthetic records and browser script shape as the audit baseline), observed results were:

| shots | ready (ms) | input → frame (ms) | DOM nodes | anchors | mounted control rows |
| ---: | ---: | --- | ---: | ---: | ---: |
| 10 | 116 | 20, 16, 17 | 675 | 10 | 9 |
| 200 | 127 | 26, 18, 20 | 865 | 200 | 9 |
| 1000 | 153 | 60, 38, 9 | 1665 | 1000 | 9 |

For comparison, the archived audit measured 10/200/1000 ready times of 106/419/3427 ms and input-to-frame samples of 28,19,15 / 171,214,212 / 495,2223,2418 ms, with DOM counts 735/11755/58155. The benchmark records are in `shot-production-browser.json`; the archived baseline remains unchanged. The new measurement waits for all fixed anchors and the first editable control, while offscreen controls are intentionally deferred, so the ready metric describes the usable shell rather than eagerly mounting every editor.

The UI browser check also validates an offscreen deep link to the last shot, Tab focus into an initially unmounted row, keyboard and pointer reordering, and an edit after location.

## Validation and limits

Focused Vitest: 3 files / 13 tests passed; TypeScript gate passed. Browser JSON records contain no page errors. The duration failure injection confirms raw numeric value survives blur and a failed write, then an explicit retry persists it. No providers were contacted.

The final duration draft integration is covered in the dev browser; the production measurements used the immediately preceding build with the same viewport observer implementation. Root will rebuild the full integrated tree. Rows now use the existing maximum 160px band as a fixed anchor height. Browser native find only sees mounted controls; application deep links, ordering, filters and exports operate on the full dataset. Anchors still scale linearly, so substantially larger datasets need renewed measurement. WebKit is unavailable on this machine.
