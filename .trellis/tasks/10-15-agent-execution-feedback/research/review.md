# E03 independent final review

2026-10-15. Reviewer role: `trellis-check`. Product review began read-only; fixes and final inventory followed the root's explicit complete freeze. No implementation/check subagents were spawned. E04 planning artifacts are outside this delivery.

Result: **ready for the root's spec/task completion and commit** under the owner's necessary-checks-only cadence. No unresolved E03 correctness finding remains. The source scope and SHA-256 identities are in [review-scope.md](./review-scope.md); the final architecture inventory matches all 20 listed production/test/discovery paths. This is a changed-scope review, not a new full-repository source audit.

## Findings fixed

1. **Same invocation's retained running query could restore a transient status after release.** `AgentChatPage.tsx` previously used `!feedbackOwned` as permission for the generic running fallback. The original flow can release before its final store observation reaches the page, so that same run could briefly show `正在执行` again. The fallback now recognizes the retained invocation's exact thread/run identity even after release. A held page-query regression verifies preparation, receiving and completed/released states remain quiet while the query still says running. This does not implement E04's cross-topic query envelopes.

2. **Transport return manufactured a working phase during ordinary answer persistence.** `runChat.ts` emitted `working` unconditionally after every model transport result, before the core finished flush/metrics/settlement. That exposed `正在执行` while a plain answer was merely finishing its existing persistence path, including after a run with historical tool calls. Removed this synthetic notification at its source. Actual `tool_round`, `tool_completed` and tool-round reads still project working. Actual runtime tests assert the receiving phase through a held terminal acknowledgement and after a resumed tool run's new answer; the page test retains true tool-round feedback. No historical `hasToolCalls` flag is used as evidence of present work.

3. **Stopping text appeared twice in the same status strip.** `AgentChatPage.tsx` repeated `正在停止…` in both status and button. The status has the one visible acknowledgement; the existing `停止` button is disabled and receives the pending accessible label. The existing icon-only composer Stop control keeps its pending accessible label. The held-compatibility page test checks a single visible occurrence and repeat exclusion.

4. **Historical activity could manufacture an early first-display mark.** `AgentRunDetails.tsx` originally attached the current run/message probe to every saved narrative/reasoning step. On resume, an older activity step could repeat a newly confirmed answer while the current message observation still held different old text; that historical node could then satisfy the signature check. Historical steps now render through their original plain Markdown/ThinkingPanel owners without timing identity. Only the actual current output/current reasoning or final answer owner samples. An actual AgentRunDetails DOM regression shows the matching historical prose alongside the old partial answer without a mark, then records the mark only when the current answer arrives. The root approved this conservative sampling scope; an omitted sample is preferable to a fabricated early sample.

5. **Permanent native discovery was missing the new actual runtime suite.** The root added `tests/e03RuntimeFeedback.test.ts` to the existing business suite list in `nativeAcceptanceSuites.json`. Vitest's existing glob already discovers all new tests. This is discovery configuration only; no native execution is claimed here.

The first held-page negative failed on the ordinary `working` status before the fixes. The additional historical DOM case first failed because the existing Markdown test double does not forward `className`; its assertion was corrected to inspect actual timeline text instead of requiring that mock to implement styling. Product rendering was not altered to satisfy the fixture. The runtime worker separately records its corrected, initially invalid resume fixture in [implementation-runtime.md](./implementation-runtime.md).

## Full changed-scope checks

- Traced the existing user gesture → E02 attempt/token → compatibility/admission → held Studio/core execution → selected transport → public delta → confirmed checkpoint → actual DOM → authoritative settlement → final release path. No second submission owner, second store, schema change, paid replay or core/provider loop was added.
- Checked current credential resolution and original explicit-fetch fallback policy. The observation wrapper preserves the selected transport arguments and signal; auxiliary summary requests remain separate. Optional observers and diagnostic sinks contain their failures.
- Checked synchronous duplicate/Stop refs, original controller ownership, late token rejection, effect replay/unmount cleanup, bound home-to-thread handoff and retained E02 exact payload/canonical IDs/recovery behavior. A stop does not release the Web Lock or rewrite terminal status.
- Checked sparse monotonic private timing, exact-name cleanup, eight traces/136-entry actual maximum, absence of text/credentials/URLs/errors in timing payloads and no automatic transmission. The controller retains only compact diagnostic signatures and identities until replacement/disposal.
- Checked run/message/sequence/confirmed lineage, saved-baseline exclusion, late publication after release, folded/inert/hidden visibility and completion of expensive sampling after the first eligible commit. The context/probe module imports no rich Markdown value and preserves the eager submission/lazy transcript boundary.
- Checked the rejected model-confirmation hint is absent from pending composer feedback, while final compatibility errors and send guards remain. Normal user bubbles retain no status caption. The user-opened capability panel remains its own requested information surface.
- Checked ownership discovery for both new private Agent modules, existing test discovery, final architecture dependencies and the canonical spec/API correspondence, including boolean `publicCommitted` and optional eighth observation argument. The root owns final spec/task/Git bookkeeping.

## Verification

All package commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`. Direct commands avoid the root wrappers that rebuild agent packages. Final quality inventory used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node` (v24.11.0; TypeScript5.9.3; ESLint10.12.0).

| Check | Evidence |
| --- | --- |
| Reviewer final `exec vitest run tests/b07ComposeSessions.test.ts tests/e03RuntimeFeedback.test.ts --reporter=dot` | **2 suites / 55 tests passed** after status/source/Stop fixes |
| Reviewer final `exec vitest run tests/agentToolTimeline.test.ts tests/e03ExecutionPresentation.test.ts --reporter=dot` | **2 suites / 19 tests passed** after conservative historical sampling |
| Runtime worker `e03ExecutionFeedback`, `e03RuntimeFeedback`, existing ownership and credentials | **4 suites / 26 tests passed**; reuse unchanged controller/ownership/credential evidence, with runtime suite rerun above after source correction |
| UI worker B07, E02 presentation, E03 presentation, message presentation | **4 suites / 63 tests passed** before reviewer-added cases; affected B07/DOM/timeline cases rerun above. No combined final full-suite count is inferred. |
| Reviewer `exec tsc -p tsconfig.app.json --noEmit --pretty false` | **Passed**, including after final functional source changes |
| Reviewer scoped ESLint on all 13 changed production files | **0 errors / 35 visible warnings**; reviewed complexity/cognitive complexity/depth/nested ternaries, no suppressions. Final touched runtime/page and details owners rerun with **0 errors**; 12 and 7 warnings respectively. |
| Final `node tooling/quality-check.mjs --only architecture --report /tmp/e03-review-architecture.json` | **Passed**: 644 files, 2560 static value edges, 11 literal dynamic edges, 0 cycles, 0 failures, 0 computed imports. JSON exit/failures and frozen input hashes checked. |
| Task manifests | Both have **15 entries**, all paths exist. |
| `git diff --check` | **Passed**; root still checks the final staged set, including new documents. |

## Findings not fixed and limits

- No unresolved in-scope product defect remains. Visible complexity/depth/ternary warnings were reviewed; restructuring those larger pre-existing UI owners is outside this bounded stage and was not mixed into the interaction fix.
- Existing retained-query loading/departure ownership work remains assigned to E04; this review does not claim that separate issue is fixed.
- DOM tests use actual ReactDOM with deterministic geometry because jsdom has no layout engine; selected HTTP uses controlled fixtures and browser-adapter transactions. Neither establishes compositor paint, a live latency improvement, network wire/server receipt, a paid provider, WebView behavior or native packaging.
- Timing is intentionally conservative and sparse: identical-to-baseline text, a skipped checkpoint or output available only as historical activity can omit the first-display mark. An absent mark is not zero latency. Lightweight signatures are diagnostic guards, not authorization/security identities.
- Full regression, complete lint/unused quality, builds, model gates, packaging, native acceptance and live paid tests remain deferred to batch completion by the owner's instruction. This review ran no install/build/root test wrapper, commit, archive or push.
