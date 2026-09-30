# B07 AU-10 implementation handoff — 2026-09-30

Implementation is ready for independent review. The implement agent has not closed the finding, advanced task/ledger state, edited specs, committed, pushed or archived anything. All earlier B/coordinator changes and B01 fixture/runner are preserved. The final whole-batch gate belongs to the coordinator; no full-suite run or full-gate PASS is claimed here.

## Scope and established behavior

Changed only two production files: `AgentChatPage.tsx` and `useReferenceDraft.ts`. New evidence consists of `tests/b07ComposeSessions.test.ts`, the independent `tests/fixtures/b07/` fixture, `scripts/b07-browser-regression.mjs` and this report. No dependency installation or provider request occurred.

The existing references scope, JSON.stringify([threadId ?? "home", projectId]), now owns text, a monotonically increasing edit revision, attachments and import jobs together. This is retention within this mounted page, not durable draft persistence across reload/unmount. Topic/project switches restore their sessions; new-topic creation never eagerly erases the old unsent payload. Every import success/progress/failure updater preserves text/revision and other fields, while File/reference/error resources stay in the initiating scope.

`setText` advances revision for every callback, including edit-then-revert. The hook keeps a synchronous latest-state ref and publishes its snapshots to React state so same-render changes cannot be lost before send/transfer. `capture` freezes scope/raw text/revision/reference revisions and active imports before any await. Sending checks that captured import list rather than the last painted list. Existing loaded/routedThreadPending gating remains intact. Text editing remains available while sending; attach/remove/import/cancel/retry and duplicate sends are locked.

First home send transfers only the captured payload into the created thread before navigation, and binds executionThreadRef to the destination before that navigation. Source edits during creation remain in home. An existing destination draft entry is rejected, including a session edited back to empty; it is never overwritten. The Web Lock/selection compatibility/route cancellation mechanisms remain in their existing modules.

Failure boundaries:

- Creation, lock or target-session rejection before transfer: origin keeps the payload, no begin/execute.
- Navigation rejection after transfer: restore only if the origin was still the submitted version at transfer and both origin/target versions remain unchanged afterward. Restoration moves captured references back and preserves other state. If the user has newer origin/target text, do not overwrite it; leave the captured payload in the created thread and report its title as the retry location. That thread remains accessible through the existing thread list.
- Failed begin after navigation: captured text/references remain visible in the created thread for explicit retry, without creating a second topic or automatic resubmission.
- Successful begin: acknowledge only that frozen owner and text revision, plus submitted reference revisions. It cannot erase edited/reverted text, later edits, or equal text in another owner. A late successful begin can acknowledge its original owner even after a route change; the old execution receives the aborted controller.
- Transport failure after successful begin: submitted draft stays acknowledged, with existing durable-run behavior; later compose text is preserved and no restore/autoretry occurs.

Compared against the coordinator's seven-section B07 addition to `agent-references.md`: implementation matches its scope, signatures, target-session rejection, navigation restoration, begin failure location and text-version semantics. The guard that disallows restoration when origin was already edited *before* transfer is necessary to satisfy its "newer home text remains there" contract. No spec edit is needed from implement.

## Genuine product red evidence

An initial fixture bootstrap attempt cleared resolved recovery mocks via `resetAllMocks`, producing `undefined.catch`. That was a fixture failure, not product evidence. It was fixed by clearing calls and resetting only the controlled I/O mocks. The corrected pre-fix run `/tmp/b07-red.log` then executed actual page/hook callbacks and produced four assertion failures, with no bootstrap failure:

1. A→B displayed `draft A` instead of an empty B draft.
2. New-topic creation failure displayed empty text instead of `unsent`.
3. Deferred begin erased text edited then reverted to `same`.
4. Deferred A begin erased B's equal `same` string.

For an auditable final-test snapshot, reran the final fixture's same four tests against pristine original page/hook sources through a temporary Vite transform, without replacing shared working-tree files. Command:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config /tmp/b07-red-vitest.config.mjs tests/b07ComposeSessions.test.ts -t 'B07 actual compose callbacks'
```

Result `/tmp/b07-red-final-fixture.log`: **4 failed, 24 skipped (28 total)**, exit **1**. Every failure is one of the product assertions above. This is deliberately expected-red evidence, not a failed final implementation gate. Temporary config `/tmp/b07-red-vitest.config.mjs` selects only these four callbacks; new compose-hook API tests are not applied to the old hook.

Original production files copied from HEAD `20b0204c9fab43e1265b94761ee880649be2fca9` into `/tmp/b07-baseline-source/`:

| Original source | SHA-256 |
| --- | --- |
| AgentChatPage.tsx | `15df4e905c6e496bf87ce3829237d33b00fdf8d3a3fb67a2eee94ec7400e40a2` |
| useReferenceDraft.ts | `b559bb8351c53b13451443ae84733c88f620bcb0fb1a8142bcbe24dacf2b5687` |

Independent actual-browser red with those same sources, using the current browser runner's optional B07_BASELINE_ROOT override: `/tmp/b07-browser-red.log`, exit **1**, **0 passed / first scenario failed**. Actual page navigation from A to B retained `Browser A`, failing `Browser A !== ''` at the B composer. Screenshot and DOM were saved in `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/b07-browser-failure-9VSb4b/` (`failure.png`, `failure.html`). No source swap in the working tree and no B01 fixture was involved.

## Current green verification

Focused command, local pnpm explicit throughout:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b07ComposeSessions.test.ts tests/agentReferences.test.ts tests/agentRunReview.test.ts tests/references.test.ts
```

`/tmp/b07-focused.log`: **4 test files passed, 58 tests passed**, exit **0**. This consists of **28 B07 callbacks** and **30 existing reference/run tests**. The B07 callback host executes actual AgentChatPage/useReferenceDraft functions, effects and UI callbacks, but mocks create/begin/execute/lock/provider I/O. These 28 tests establish UI ownership and request arguments/counts, not actual DB saves or native ReactDOM/browser event scheduling.

B07 callback coverage includes A/B/back; independent home project sessions; deferred create/begin/navigation; newer home and destination edits; edit/revert and equal text in another scope; captured payload before navigation; failure/retry at all three first-send boundaries; no target overwrite including empty edited session; successful owner/revision clearing; route-aborted old controller; failure after committed begin; new-topic failure/success; same-render edits/send and import/send; active-import and attachment/duplicate-send locks; existing ownership loading gate; async import success/failure/retry/cancel/unmount with original File/reference/error and compose revision retention.

Actual browser command (installed tooling, no install; portable runner defaults to package discovery and Chromium discovery unless these environment overrides are supplied):

```sh
B07_PLAYWRIGHT_PATH='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' B07_CHROMIUM_PATH='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell' /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/b07-browser-regression.mjs
```

For browser red add `B07_BASELINE_ROOT='/tmp/b07-baseline-source'` to the same command. Browser green uses current sources without that override.

Final `/tmp/b07-browser.log`: **5 scenarios passed**, exit **0**, **0 external/provider requests**:

1. Actual browser history A/B/back/forward restores each text/reference session.
2. Real Web Lock, deferred thread creation and begin transfer the captured payload before navigation and preserve newer home text. The actual `beginAgentRun` saves the exact user message content/attachments and one run in the created topic. Mock execution marks completion; controller is not aborted by its own first navigation.
3. Begin rejection after navigation preserves the visible payload; explicit retry creates one actual run and does not create another topic.
4. Browser Back (POP) is the **first** thread change after the original send starts, aborts its execution controller and leaves equal text in the other owner. This was tightened after the first green run to ensure the POP itself, rather than an earlier programmatic navigation, causes cancellation. The final tightened run is the log cited here.
5. Failed new-topic creation preserves old unsent text/references and starts no execution.

Browser fixture uses actual ReactDOM, TanStack createBrowserHistory, page/hook, Dexie live queries, real repo createChatThread, real beginAgentRun and navigator.locks. It seeds a real imported text reference into a random-port origin's independent IndexedDB; it never accesses the user's application-origin database. It replaces only UI presentation leaves, model discovery and execution transport with isolated fixture functions/gates. It uses the unchanged production route/effect logic in the page, a simplified surrounding route tree, and no paid transport.

Final typecheck:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
```

`/tmp/b07-lint.log`: **passed**, `tsc -b --pretty false`, exit **0**. Final `git diff --check`: **passed**, exit **0**. No product/test/fixture mutation followed these recorded final checks (this handoff is documentation only).

## Limits and review scope

- Callback host is deterministic synchronous hook storage plus explicit microtask draining. It does not prove ReactDOM rendering/scheduling, and mock create/begin calls do not establish persistence. Browser evidence above separately verifies representative real persistence and native history events.
- Browser test simplifies HomeWelcome/ChatWorkspace and other presentation leaves, so it does not establish full production composer styling, focus, preview/modal keyboard behavior, mobile layout or the entire application's route tree.
- Native browser creation/navigation failures, edit/revert, same-render imports and all async import resource races are covered by actual callbacks with controlled I/O; those are not all separately browser-driven. Native browser begin-failure retry and POP cancellation are separately exercised.
- Browser paid/model execution is stubbed and all non-local requests are blocked/counted. It proves ownership/controller handoff and DB begin payload, not provider protocol, paid POST count, generation output or full executeChatRun transport behavior. Existing focused repo/reference tests cover their own established boundaries.
- No reload/unmount persistence, global draft registry, execution-hook split (D03), loading/query consolidation (D04), broad integration/full-suite result or risk-closure claim is introduced.
- Coordinator's eventual checker snapshot should include **all seven code/test/fixture files** in the SHA table below. The B01 files were not edited. This implement handoff does not update coordinator verification scripts.

## Exact final code/test/fixture snapshot

SHA-256 at handoff (the report is excluded from its own recursive hash):

| File | SHA-256 |
| --- | --- |
| `src/components/agent/AgentChatPage.tsx` | `e59b75a283eeaf80084d7b8769ca842003a21460ad3e9347c288fdfa8a5d6487` |
| `src/components/agent/useReferenceDraft.ts` | `c2649c23d53889a4d6bdacbaa533858001746cba4400ab4b8e1baf60ad3cf48f` |
| `tests/b07ComposeSessions.test.ts` | `cf771c2ed2ba5bdc49cf8be8b82a18db3e89f48add6ab436e84cb6a3e93c22e7` |
| `scripts/b07-browser-regression.mjs` | `4e288edb5535310937a98667690ddcdddce0cec176619fcb5e5bf506fe422077` |
| `tests/fixtures/b07/index.html` | `f3d13595619adc85cd86846ae1d28badd918a956f58a9ce0d3e222caa0623b20` |
| `tests/fixtures/b07/harness.tsx` | `1e7d5485ba34753d20f2c06e375cf7ce27a8c3928e222f10f4b2e6711e58ef53` |
| `tests/fixtures/b07/surface.tsx` | `a733f584d25d7a7ee9fd52716bf8ba1976f377b6dd9f73086698bf5aeb1aad08` |

## Evidence log snapshot

Logs and temporary baseline/config/screenshots live on this host under the exact paths above; they are not committed artifacts.

| Log | SHA-256 |
| --- | --- |
| `/tmp/b07-red.log` | `e0e57c4178060914d0c121cf6b965b010d1afaa57e9ac24e7b1cac9e8786125d` |
| `/tmp/b07-red-final-fixture.log` | `9dad2ba01875c7524206f86708c79b2dc1346d66907f3d6f59207204f6f8cd35` |
| `/tmp/b07-browser-red.log` | `3e4f868306514f67184d5ead52ed2431969694de166881be6b77d2f3d4c887f9` |
| `/tmp/b07-focused.log` | `ad3a17129dcdde06b6ba7b3cf7286500d5a5e37f3f5f6f374e3f263acd19f9b4` |
| `/tmp/b07-browser.log` | `e802dfe666407ecef53a4d1380d70d4b28e1e91edc3c1935b96f2711e31a76d2` |
| `/tmp/b07-lint.log` | `456ef41909486f747d978e83eff3fb3817dc8138f02f4e380f8884ecddb011aa` |
