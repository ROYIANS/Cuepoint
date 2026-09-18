# Verification — context management

## Automated checks
- Full Vitest suite: **46 files / 576 tests passed**.
- Final focused rerun after strengthening atomic no-progress rejection:
  **2 files / 21 tests passed** (`contextManagement`, `contextUsage`).
- TypeScript project check: `pnpm lint` passed using the machine pnpm 9 path.
- Production build passed. Vite still reports its existing large-chunk advisory
  (the Agent bundle includes the full local Model Bank and UI/editor dependencies).
- `git diff --check` passed.

All commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.
No package install, dependency change, real provider call or credential access.

## Browser verification
Isolated headless Microsoft Edge, local dev port 5185; fresh temporary browser data.
Scripts outside repo: `/tmp/context-ui-qa.cjs`, `/tmp/context-flow-qa.cjs`.

- 1440×960 desktop and 390×844 narrow screen; no horizontal document overflow.
- Home parameters read “new conversation defaults”; detail reads “current conversation”.
- Editing home to history limit 24 did not mutate an existing thread (preset 20).
- Both home/detail parameter submenus dismiss with Escape; context details dismiss on
  outside click. Added capture-phase close handlers because nested controls can consume
  Escape before a normal document listener receives it.
- Narrow parameters retain side margins; flat rows, no nested card borders.
- Fixture HTTP: eight old messages → Send → visible compaction progress → Stop →
  interrupted job and preserved originals → explicit Regenerate → completed summary →
  final reply. Three POSTs total: stopped summary, retried summary, answer.
- Reload preserved all eleven messages (eight original + current user + stopped attempt
  + final answer), summary provenance and separate metrics. POST count remained three.
- Context popover showed the active summary allocation, history source count, output
  reserve, independent compaction usage and readable summary/source disclosure.
- Browser page-error listener reported no errors.

Screenshots inspected:
`/tmp/context-home-desktop.png`, `/tmp/context-detail-desktop.png`,
`/tmp/context-detail-mobile.png`, `/tmp/context-usage-desktop.png`,
`/tmp/context-summary-desktop.png`.

## Review findings and corrections
- Share real history selection/build/budget functions; removed the superseded legacy
  request builder to prevent preview/runtime drift.
- Freeze effective policy/capacity/source/base snapshot; legacy thread behavior stays
  deterministic and retries reuse saved working base after successful compaction.
- Preserve all live tool calls/results and opaque Responses continuation. A real tool
  fixture grows input, triggers compaction between steps, and proves one tool execution.
- Verify summary shorter AND resulting envelope smaller before atomic activation;
  storage failures roll back both job activation and run checkpoint.
- Explicit guards for pending/unknown calls, deleted threads, protocol prefix mismatch,
  and stale summary coverage. Failed/partial outputs never become active summaries.
- Settings instructions clarify changes apply to new sends, not frozen retries.

Review was performed locally against specs and tests. Agent delegation was attempted
but unavailable due to the session's thread limit; no independent agent review claimed.

## Practical boundaries
- Token lengths are character estimates, not provider tokenization; margin/reserve are
  conservative policies, not a guaranteed overflow prevention mechanism.
- No invented capacity for unknown models. Auto compaction needs provider/Model Bank
  capacity or an explicitly configured local budget.
- Very large indivisible historical turns, current questions or live tool chains can
  still block; the UI offers actionable errors without dropping context or retry loops.
- Summaries preserve requested factual structure through prompting; semantic faithfulness
  cannot be guaranteed by a structural validator. Raw source remains inspectable.
- This is working-context continuity. It does not implement cross-task long-term memory.
- Paid/live supplier behavior was not tested; both protocol paths used HTTP fixtures.

## Delivery state
Implementation and verification complete. User approved the workflow Phase 3.4 commit
batch and task closure. Commit/archive/journal are finalized in that order; no push.
