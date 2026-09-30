# B07 AU-10 independent check — 2026-09-30

Milestone: **B07 independent check PASS; ready for coordinator integration review**. No new B07 product defect remains from this review. The demonstrated AU-10 mismatch is repaired at this snapshot. This is a unit milestone, not finding closure, task advancement or the later whole-batch gate.

I reviewed/fixed directly as the dispatched checker; no child agent was dispatched. I changed only `tests/b07ComposeSessions.test.ts` within the seven authorized product/test/runner/fixture files and wrote `reviews/B07-check*` evidence. Product sources, runner and fixtures are unchanged from handoff. Earlier B/coordinator work and the separate read-only final review were preserved. No specs, ledgers, task state, commits, push, archive, installs or execution refactor were performed.

## Findings (fixed)

The implementation passed the original **4 files / 58 tests** independently. Review identified two worthwhile gaps in explicit boundary coverage; I added real page callback regressions, bringing the focused gate to **4 files / 60 tests**, consisting of **30 B07 cases + 30 existing reference/run cases**:

- Web Lock acquisition rejection after creation must retain exact origin text/references, release sending state and perform zero navigation/begin/execute calls.
- Navigation rejection after the destination is edited and then reverted to the submitted string must preserve that destination payload, leave home cleared and identify the created topic as the retry location. Equal text must not bypass the target revision guard.

These are missing-test corrections, not newly discovered product defects. Both use the actual page/hook callbacks; no production fix was needed.

## Findings (not fixed)

No new correctness finding was left unresolved in B07. Isolated ESLint reports **0 errors / 13 warnings**: page 12, hook 1. Normalized rule/severity/message/occurrence signatures are identical to the relevant audit baseline, including unchanged page complexity 133 and cognitive complexity 64. The latest A integration scan was checked first and contains neither of these two files; the original source-audit scan is the applicable comparison. `B07-check-eslint-summary.json` preserves that selection and all diagnostic signatures. Existing dependency/style/complexity warnings were not broadened into the deferred D03 refactor. ESLint exit was 0; warnings are disclosed rather than described as a clean diagnostic scan.

## Independent code trace

| Boundary | Reviewed behavior and evidence |
| --- | --- |
| Scope and capture | `useReferenceDraft` owns text, monotonic edit revision, attachments and imports under JSON `[threadId ?? "home", projectId]`. `publish` updates the latest map ref synchronously before React state; `setText` always increments revision. `capture` takes owner/raw text/revision and array snapshots before awaits. Page send checks captured imports, so same-render import → send is blocked. Same-render text/reference edits → send use the latest capture. |
| Import origins | Invocation closures keep the originating scope/project. Job creation, progress, returned-reference allocation, success and failure all spread the previous compose fields. Ready/partial success attaches only in origin; failure retains original File/error/reference ID. Cancel aborts/removes its job; retry retains the project/reference resource. Unmount aborts controllers and blocks late publication. Scope changes and edit/revert do not change async origin or erase text/revision. |
| A/B/home projects/new topic | The page stays mounted while compose owners change. A/B/back and home project selection restore coherent text/references. New topic starts creation without clearing old unsent payload; creation success and failure retain that old owner. Loading and routed-thread identity still gate rendering of the composer. |
| Compatibility/create/lock | Frozen content, connector/model/project/selection and controller originate before the first await. Compatibility and selection guard precede execution. Creation failure/route abort retain origin. Lock failure precedes transfer/navigation/begin. The execution thread is set to the new target before detail navigation, so the first home send does not cancel itself. Existing Web Lock ownership stays in `runOwnership`. |
| Transfer | `moveTo` inspects transaction-free latest scoped UI state, rejects every existing destination entry (including edited-back-to-empty), and transfers only the frozen submitted text/reference revisions. Source revision comparison preserves newer home edits. Active imports prevent sending, so their File resources are not transferred. Source/target revisions advance for ownership changes. |
| Navigation failure | Restoration requires source still equal to the captured revision at transfer, origin still equal to retained revision, and target still equal to moved revision afterward. Pre-transfer home edits, post-transfer home edits and target edit/revert therefore block restoration. Failed restoration retains the created-thread payload and displays its title as explicit retry location; unchanged navigation failure restores origin without begin. |
| Begin failure/success | Failure after navigation leaves raw submitted text/references visible in the created thread. Explicit retry uses the same topic and does not automatically resubmit. Successful actual begin acknowledges the frozen owner/revision and only matching submitted reference revisions. Later edits, edited/reverted text and equal text in another thread survive. No acknowledgement occurs on rejected begin. |
| Execution/route changes | Transport failure after begin keeps submitted payload retired and preserves later compose text; no rollback/resubmit. Route effect covers browser Back/Forward; openThread also aborts changed execution ownership. A late begin still acknowledges only its original owner and passes an aborted controller to the old execution. First target navigation and an actual POP cancellation are independently browser exercised. |
| Mutation locks | All five attach/remove/import/cancel/retry callbacks check the synchronous send lock; duplicate send and active imports block submission. Text onChange stays editable. Callback tests directly invoke all five mutation actions during send and retain the payload. |
| Other async page actions | Retry/run actions keep their captured execution thread/controller; setting/rename/delete/task/recovery/model discovery callbacks were inspected for interactions with compose ownership. They do not acknowledge or replace compose text. No D03 module extraction or broader query consolidation was introduced. |

## Genuine red → green evidence

The temporary baseline files were byte-compared with Git revision `20b0204c9fab43e1265b94761ee880649be2fca9`; their SHA-256 values match the implement handoff. `B07-check-red-baseline.json` records both sources. The Vite baseline override transforms reads without changing shared working-tree sources.

Independent original-source callback run selected `B07 actual compose callbacks`: **1 file failed, 4 assertion failures / 26 skipped (30 total), exit 1**. Failures are A text leaking into B; new-topic failure erasing unsent text; edited/reverted text cleared by late begin; another owner's equal text cleared by late begin. They reached actual page/hook callbacks and assertion sites. No bootstrap error or `undefined.catch` was reported. The implementer's first bootstrap attempt is explicitly excluded from product evidence.

Independent original-source browser run: **0 scenarios passed; first A→B scenario failed, exit 1**, with actual `Browser A !== ''` assertion at B. It reached browser UI and history navigation. Failure artifacts are under `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/b07-browser-failure-DCTZDl/`. These expected-red runs demonstrate the original failure and are not final gate failures.

Current-source green browser run: **5 scenarios passed, exit 0; external/provider requests 0**:

1. A/B plus browser Back/Forward restores each text/reference session.
2. Real Web Lock and deferred create/begin transfer the captured payload before navigation, preserve newer home text, persist the exact user-message content/reference revisions and one actual run, and avoid aborting the first send's controller.
3. Rejected begin after navigation retains visible payload; explicit retry creates one actual run in the same created topic.
4. Browser Back/POP is the first thread change after send starts; it aborts the old controller while equal text in another owner remains. Returning to origin shows successful owner acknowledgement.
5. Failed new-topic creation preserves unsent old payload and starts no additional execution.

The browser harness uses real ReactDOM, TanStack browser history, Dexie live queries, repository `createChatThread`, `beginAgentRun`, imported reference records and native `navigator.locks`. Wrappers delay/fail creation and begin but delegate successful calls to production persistence. Presentation leaves and discovery/execution transport are replaced. Browser checks read actual messages/runs; the mock execution's terminal status is not a production-transport completion claim. Network interception aborts/counts non-local requests. Its random-port origin owns a separate IndexedDB from the user's application.

## Commands, exits and tools

Focused command:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b07ComposeSessions.test.ts tests/agentReferences.test.ts tests/agentRunReview.test.ts tests/references.test.ts
```

Browser command:

```sh
B07_PLAYWRIGHT_PATH='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' B07_CHROMIUM_PATH='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell' /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/b07-browser-regression.mjs
```

Browser red adds `B07_BASELINE_ROOT='/tmp/b07-baseline-source'`. Callback red adds `--config /tmp/b07-red-vitest.config.mjs` and `-t 'B07 actual compose callbacks'` to the single B07 test run. An evidence copy of that config is `B07-check-red.config.mjs`.

| Verification | Result | Raw evidence |
| --- | --- | --- |
| Independent original focused run | 4 files / 58 tests passed, exit 0 | Observed before the two checker additions; handoff hashes matched |
| Final focused run | 4 files / 60 tests passed, exit 0 | `B07-check-focused.log`, `B07-check-focused-run.json` |
| Current-source browser | 5 passed, 0 external requests, exit 0 | `B07-check-browser.log`, `B07-check-browser-run.json` |
| Original-source callbacks | Expected 4 failed / 26 skipped, exit 1 | `B07-check-red.log`, `B07-check-red-run.json` |
| Original-source browser | Expected 0 passed / first assertion failed, exit 1 | `B07-check-browser-red.log`, `B07-check-browser-red-run.json` |
| Local pnpm lint / typecheck | Passed: `tsc -b --pretty false`, exit 0 | `B07-check-lint.log`, `B07-check-lint-run.json` |
| Isolated ESLint, two sources | 0 errors / 13 inherited warnings, exit 0 | `B07-check-eslint.json`, `B07-check-eslint-run.json`, `B07-check-eslint-summary.json` |
| Diff whitespace check | `git diff --check`, exit 0 | `B07-check-diff.log`, `B07-check-diff-run.json` |

No package install was run. All pnpm commands used the explicit local-machine path. Actual version readback is Node **24.11.0**, local pnpm **10.15.0**, Vitest **5.0.1**, isolated ESLint **9.39.5**, Playwright **1.62.1**. The supplied local pnpm path currently reports 10.15.0 rather than the instruction's historical 9.12.0 note; Codex Runtime pnpm was not invoked. Versions are recorded in `B07-check-tools.json`.

The browser run preceded callback-only test additions. Sources, runner and all three fixture hashes stayed identical afterward; no redundant browser rerun was needed. Focused tests/typecheck/diff were run after those additions. Full-suite, production build and B01 browser checks are reserved for coordinator integration.

## Final spec drift and coverage

Immediately before this report I reread the current `agent-references.md` B07 section. Capture includes active imports and send checks the frozen list; navigation restoration requires unchanged submission at transfer plus unchanged origin/target afterward. These match `capture`, the page send gate and all three `restore` revision comparisons. The remaining scope, transfer, failure/retry, acknowledgement, lock, loading and cancellation contracts also match. No spec edit is requested. `B07-check-spec-readback.md` records the exact section, read time and source hash.

All **seven** authorized files have explicit reviewed coverage and before/after hashes: `B07-check-coverage.json`, `B07-check-before.json` and `B07-check-after.json`. Only the test hash changed. No generated-file exception or blocked coverage entry is present. The coordinator must use the after snapshot for the later full-batch verification.

## Limits

The callback host provides deterministic synchronous hooks/effects/microtask execution, not ReactDOM scheduling or real callback-test DB persistence. The separate browser harness supplies representative scheduling/history/native-lock/persistence evidence; it simplifies presentation leaves and surrounding routes and does not establish full production composer styling, keyboard/focus/preview behavior, mobile layout or every route in the application. Navigation failure, all import-resource races and edit/revert boundaries are mainly controlled callback cases rather than all separately browser-driven.

Provider/model execution is mocked and external requests are blocked. This check does not claim paid protocol correctness, actual generated outputs, production `executeChatRun` completion or new provider POST-count coverage. Draft retention is within a mounted Agent page, not reload/unmount persistence. No global draft registry, execution refactor, full-batch PASS, ledger closure or commit permission is implied.
