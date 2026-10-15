# E04 independent final review

Full changed E04 product/test/discovery scope reviewed after both workers and root declared FREEZE. Read `check.jsonl`, PRD, design, implementation instructions, the query/reading design investigation, implementation evidence and concrete canonical specs. The review includes all five changed production files, both changed existing tests, both new regression suites and the native acceptance discovery entry. E05/E16 future planning artifacts are excluded. Source hashes and architecture input identity are captured in [review-scope.md](./review-scope.md).

## Findings (fixed)

- File: `packages/studio/src/features/agent/ui/useThreadDeparture.tsx`
  - Issue: after confirming a departure that remains local (for example failed create/delete/navigation), `leaving` bypasses router callbacks without consuming `armed`. When the owned topic stops and starts executing again, the existing executing effect cleared only `leaving`; the old `armed` value silently allowed the first new route departure. This was reproduced through the real hook with a failing assertion before the source change (`expected false to be true` for the newly running topic's `shouldBlock()`).
  - Fix: the existing owned-executing reset now clears both `leaving` and `armed`. No interface, router architecture or topic ownership was changed. `tests/e04AgentQueryDeparture.test.ts` now covers confirmed local departure, repeated callbacks for that same confirmation, interrupted-to-running transition in the same topic, and the required new confirmation. Root synchronized the corresponding canonical spec contract.

## Findings (not fixed)

No unresolved scoped defects or additional design decisions were found. Existing complexity/depth/nested-ternary lint warnings remain in the unchanged portions of the page and message rendering; these do not justify widening this task into a refactor.

The new query regression uses actual ProductStore readonly transactions and production query ownership/cleanup, so its permanent native discovery matches existing store-backed business tests. Root added `tests/e04AgentQueryDeparture.test.ts` to the native `business` manifest. This is discovery configuration only; native acceptance was not executed. The reading suite controls DOM geometry and does not require a new native entry.

## Scope conclusions

- Query identities are captured inside each inline readonly querier, including explicit home/null and successful empty reads. Unmatched retained envelopes derive loading, then matching rows are filtered again by thread. Existing parent consumers all use the owned derivatives, including departure, current execution, compaction feedback, retry, attention/project locks and inspector/workspace data. Query errors retain the existing error path, and no generic retention policy changed.
- The departure hook independently filters both blocking and executing predicates, drops local pending callbacks and bypass state on actual topic changes, and retains genuine running/approval/resumable-tool confirmation. The same-topic new-execution fix closes the demonstrated residual permission leak without changing repeated callbacks for one confirmed navigation.
- MessageList receives explicit topic identity; local synchronous refs remain authoritative for following, and React stores only paused-state transitions. Same canonical optimistic acknowledgement preserves a reader's pause, while new user identity or actual topic entry resumes following. Resize and the deferred initial frame both respect the current intent ref. The return control is a native button in the existing navigation shell above the measured composer-safe area; activation snaps immediately and deliberately focuses the named viewport with `preventScroll` before removing the button. Ordinary growth does not focus it.
- Existing E01 mounted workspace/detail ownership, E02 canonical identity/eager fallback, lazy rich transcript boundary, execution/composer keys and E03 timing/Stop probe owners are unchanged. No preparation narration, normal-success status line, toast, unread counter, new source module or ownership-ledger entry was introduced.

## Verification

All pnpm commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly.

- **Lint: pass.** Direct scoped ESLint on `AgentChatPage.tsx`, `useThreadDeparture.tsx`, `ChatWorkspace.tsx` and `MessageList.tsx`: exit 0, **0 errors / 15 warnings**. The departure hook has no warnings. Test files are ignored by the current ESLint configuration and are not claimed as linted.
- **TypeCheck: pass.** `exec tsc -p tsconfig.app.json --noEmit --pretty false`: exit 0 with no diagnostics after the checker source fix.
- **Tests: pass.** Checker ran `exec vitest run tests/e04AgentQueryDeparture.test.ts tests/b07ComposeSessions.test.ts tests/e02SubmissionPresentation.test.ts tests/e03ExecutionPresentation.test.ts`: **4 suites / 66 tests passed** after the source fix. After adding the explicit second same-confirmation router callback assertion, reran `exec vitest run tests/e04AgentQueryDeparture.test.ts`: **10 tests passed** on the final test contents.
- **Reading tests: reused unchanged final worker evidence.** `e04ReadingNavigation`, `agentMessagePresentation`, `chatScroll`, `e02SubmissionPresentation`: **4 suites / 25 tests passed** after the final reading test addition. Neither reading source nor its tests changed during review. See [implementation-reading.md](./implementation-reading.md).
- **Architecture: pass, executed once after final product/test/discovery freeze.** `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node tooling/quality-check.mjs --only architecture --report /tmp/e04-review-architecture.json`: **644 source files, 2560 static value edges, 11 literal dynamic edges, 0 cycles, 0 failures**; exit 0. No new source registration or module boundary change was needed. This is architecture-only evidence, not a full quality wrapper.
- **Whitespace: pass.** `git diff --check` returned exit 0.

## Evidence limits and final freeze

Controlled observer delivery happens outside actual readonly transactions. ReactDOM/controlled geometry proves the exercised callback, ownership, scrolling and focus behavior; it does not prove physical browser layout, compositor paint, native transport/storage or device keyboard/touch defaults. No full suite, root test/lint/quality wrapper, build, package, native/live-paid acceptance, install, Git commit, archive or push was performed. These broader checks remain deferred under the user's batch cadence.

All E04 scoped product/test/discovery inputs are now frozen and ready for root's task/documentation and commit step. Root retains task/spec/ledger/Git ownership.
