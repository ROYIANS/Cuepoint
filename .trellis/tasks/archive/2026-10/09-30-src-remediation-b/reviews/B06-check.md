# B06 independent check — SS-07 / PU-07

2026-09-30. **Acceptance: PASS for B06 after a local checker correction and strengthened regressions. No outstanding material B06 blocker.** The coordinator owns finding closure and the next unit; this report does not alter task/ledger status or authorize a batch-wide completion claim.

## Scope and evidence provenance

Read check.jsonl, PRD, design, execution plan, research/B06-session-contract.md and research/B06-implementation.md in order, plus the relevant frontend specs. Read state-management.md directly from disk, including reliability/concurrent drafts, manual CAS and B01 lifecycle sections; do not rely on truncated injection. The later B06 section in hook-guidelines.md was also compared with the actual callbacks. Reviewed the two owned production files and focused regression file, and followed real useDebouncedDraft, DraftStatus, updateEpisodeDraft, connector repository and provider dispatch signatures read-only.

The three initial hashes match the final implementation handoff. Before/after snapshots contain exactly `{relativePath: sha256}` for ConnectorsPage.tsx, StoryPage.tsx and tests/b06EditorSessions.test.ts. The checker changed StoryPage's action alias and the focused tests. **ConnectorsPage is byte-for-byte unchanged from handoff.** No child agents, spec/ledger/task/status changes, commits, pushes, archives, installs or B07 work were performed. Other batches and coordinator changes were preserved.

Implementation-author pre-fix log was inspected and copied to B06-check-implementation-red.log, with provenance in B06-check-implementation-red-provenance.json. Its two failures demonstrate actual A probe success publishing into reopened B and File.text replacing script after edit-then-revert. This original red run was not independently repeated by the checker. The checker independently executed the unchanged handed-off implementation: 5 files / 171 tests passed, including 51 B06 cases, and TypeScript passed.

## Checker correction and regression additions

1. StoryEditor's wrapper called an ordinary action named `useLatest` after an early-return identity guard. Inspection of useDebouncedDraft shows that this returned callback delegates to controller.useLatest; it does not call React Hooks. Isolated ESLint nevertheless newly classified the name as a conditional Hook. Locally destructured it as `useLatest: adoptLatestDraft` and invoked that alias. This is a naming/tool diagnostic correction, not a demonstrated Hook ordering runtime defect. No rule suppression or global configuration change.
2. Added a same-render double-probe/cross-action test, editing both credentials and invoking the captured probe before rerender. The production callback acquires the lock once and uses the immediately updated frozen credentials; competing test/save do not begin.
3. Added base-URL and API-key probe invalidation cases. Retired A's failure neither publishes an error nor releases pending B; B alone publishes its directory.
4. Strengthened the candidate replacement regression: captured A adopt/discard callbacks execute again **after B's candidate is visible**. They cannot overwrite current text or retire B.
5. Added adopt/discard regressions that advance the production **400ms debounce timeout**, with actual useDebouncedDraft and actual updateEpisodeDraft/IndexedDB transactions. No Retry/flush callback is invoked. Local text/title save first; only explicit adoption causes a later imported-text write; discard causes no additional write. Existing beats remain empty. Only timeout/Date are controlled; IndexedDB async scheduling remains real within fake-indexeddb.

The final suite contains **56 B06 cases**, plus the 120 existing related regressions. No further runtime correction was needed in the handed-off B06 session implementation.

## Actual callback and persistence review

| Boundary | Observed production protection and executable validation |
| --- | --- |
| Connector operation identity | mounted + editor object + operation object required after awaits, in catch and in finally. Same-render actions acquire operationRef before awaiting. Reopened editor and credential edits retire old ownership synchronously. A finally cannot release B. Both completion orders are exercised. |
| Credentials and nested read | Each request freezes definitionId/baseUrl/effective key; blank key preserves the saved key. First test and nested directory call share the frozen request. First-stage ownership check prevents an obsolete nested request; second-stage check prevents obsolete models/success. Deferred tests include credential mutation, close/reopen and nested rejection. |
| Save/disconnect | One synchronous lock guards writes, reads, input callbacks, close and card-open callbacks. Actual successful repository transactions and delayed write/deletion are exercised. Inputs/card opens/actions are disabled; close button suppressed; Escape/outside handlers prevent dismissal and onOpenChange rejects it. Failure retains form, redacts frozen credentials before bounding diagnostics, releases only current operation and permits retry. |
| Unmount and effect replay | Unmounted success/failure/finally/action callbacks publish no state/toast. Both mounted effects restore true on setup; tests execute actual setup→cleanup→setup and then real writes/imports. These are deterministic effect-body replay tests, **not ReactDOM StrictMode**. |
| File request + script revision | Latest supported request owns completion. Every manual edit increments revision, including edit→revert. Unchanged revision accepts the read; changed revision keeps current text and presents frozen filename/text for explicit adopt/discard. A/B success/failure orders, read retry and superseding reads are exercised. |
| Candidate identity | Replacement retires candidate synchronously. Captured old choices, duplicate/opposite choices, choices after newer candidate publication, and choices after unmount cannot act on current ownership. Further local edits preserve the visible candidate until explicit choice. |
| Explicit latest adoption | Actual DraftStatus conflict action retires pending request/candidate before delegating to the existing draft-controller baseline adoption. Real repository CAS conflict precedes these regressions; delayed resolution/rejection and captured old adoption remain harmless. Existing controller in-flight semantics are preserved. |
| Draft path and unrelated fields | Functional draft updates merge current fields, with event values captured before updating title/logline. changedDraftFields and transaction-local baseline comparison remain the write path. Real DB assertions cover title/logline preservation, accepted script persistence, CAS failure/retry/latest, automatic debounce and no automatic scene splitting. |
| File/lifetime compatibility | Existing filename and MIME acceptance stays intact; unsupported files do not cancel a supported pending read. Episode-editor unmount invalidates late read/error/drop/script/adopt callbacks. No provider API or global draft/session registry was added. |

listConnectorModels(connector, usage?, fetchImpl?) and testConnectorConnection(connector, fetchImpl?) have no AbortSignal argument. Closing/editing cancels **publication ownership**, while the underlying request may still finish. This is the existing API contract, not a transport-abort claim. SearchConnection is outside B06.

## Verification and exact artifacts

Final focused command, exit **0**:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b06EditorSessions.test.ts tests/debouncedDraft.test.ts tests/draftConcurrency.test.ts tests/connectors.test.ts tests/connectorMigration.test.ts --reporter=default --reporter=json --outputFile=/Users/xiaomengdao/WebstormProjects/aifenjing/.trellis/tasks/09-30-src-remediation-b/reviews/B06-check-self-fix-tests.json
```

**5 test files / 176 passed / 0 failed / 0 pending**, JSON success true.

| File | Passed |
| --- | ---: |
| b06EditorSessions.test.ts | 56 |
| debouncedDraft.test.ts | 13 |
| draftConcurrency.test.ts | 7 |
| connectors.test.ts | 99 |
| connectorMigration.test.ts | 1 |

Exact command/timing/exit records and raw output are B06-check-self-fix-tests-run.json/.log, B06-check-self-fix-lint-run.json/.log, B06-check-self-fix-eslint-run.json/.log and B06-check-diff-check-run.json/.log. Test assertions/report are B06-check-self-fix-tests.json. The unchanged-code initial runs remain under B06-check-initial-*.

- Explicit local pnpm `lint` (`tsc -b --pretty false`): exit **0**, no diagnostics.
- Final `git diff --check`: exit **0**, no diagnostics, across current tracked changes.
- `git diff --no-index --check /dev/null tests/b06EditorSessions.test.ts`: exit **1**, empty diagnostic output; no-index reports differing content against /dev/null. Record: B06-check-untracked-test-diff-check-run.json/.log.
- Existing isolated audit ESLint configuration and tool installation, **two owned sources only**: final exit **1**, **2 errors / 8 warnings**. The checker does not claim a clean ESLint gate. Baseline comparison is recorded in B06-check-eslint-summary.json; raw initial/final diagnostics are B06-check-initial-eslint.json and B06-check-self-fix-eslint.json.

The first runner bootstrap omitted the local Node PATH, so three commands exited 127 with `env: node: No such file or directory`. These logs/records are preserved under B06-check-bootstrap-initial-*. The runner was corrected to prepend the local nvm bin directory and reran all three checks. This was a runner environment failure, not a product/test failure; no dependencies were changed.

## ESLint baseline comparison and effects

Compared with .trellis/tasks/09-30-src-quality-architecture-audit/research/tools/eslint-results.json. Rule/severity/message/count comparisons normalize relocated line references, including embedded `(at line N)`. Duplicate counts are retained.

| Diagnostic | Original audit | Final B06 | Assessment |
| --- | --- | --- | --- |
| Story no-unnecessary-type-assertion | 2 errors at the existing beat reorder swap | Same 2 errors, relocated to line 186 | Inherited; outside the B06 file-read change |
| Story rules-of-hooks | Absent | Absent after local alias | Initial new naming diagnostic eliminated |
| Connector useMemo exhaustive-deps | 1 warning for `useLiveQuery(...) ?? []` at line 33 | Same warning at line 37 | Inherited expression/dependency; not introduced by a B06 effect |
| Connector nested ternary | 5 warnings | 5 warnings | Inherited signatures/count |
| Connector component complexity | 32 > 20 | 34 > 20 | Existing complexity diagnostic with changed metric |
| Connector handleTest cognitive complexity | Absent | 26 > 20 | New complexity warning from required guarded nested operation; retained rather than weakening session checks or widening structural work |

The warnings are **not all inherited**: `handleTest` cognitive complexity 26 is newly introduced. Its added ownership checks before/after the nested read, and guarded error/finally publication, increase the branching required by this B06 correction. The component complexity metric also rises from 32 to 34. Record the new cognitive warning as follow-up structural debt: any later simplification must preserve frozen credentials, both stage identity checks, synchronous locking and current-operation-only cleanup, with the B06 regressions retained. It is not a material B06 behavior blocker and was not suppressed or folded into an “all inherited” claim.

**No new non-complexity diagnostic signatures remain.** Both new lifetime effects were reviewed: ConnectorsPage's `[]` effect uses stable mounted/operation refs; StoryEditor's `[session]` effect captures the session it invalidates and the stable mounted ref. No new exhaustive-deps diagnostic appears for either effect. The existing useDebouncedDraft effects are unchanged. The checker did not add ignores, change the isolated/global ESLint config or install/configure a project ESLint gate.

## Snapshots, specification fit and limits

Before: B06-check-before-sha256.json. After: B06-check-after-sha256.json. Combined comparison: B06-check-snapshot.json.

| Relative path | Final SHA-256 |
| --- | --- |
| src/components/studio/ConnectorsPage.tsx | 98df061541d783f27e0942c28a8a8424f26dd2ff61212ca655b284f7dee09313 |
| src/components/story/StoryPage.tsx | d4393a2fc0890d747cc71449de29a5327b06b1ed7b0e865491576781126b8abc |
| tests/b06EditorSessions.test.ts | cc0995a69fca18bcd9e63b556cc242b6479a2722ecec300a5b9876cdca92ed34 |

No remaining drift found against the B06 session contract or coordinator's executable hook section. A local callback alias does not change the public draft hook API. Existing B01 navigation/key and A04 CAS semantics remain intact. The coordinator may document the callback-naming lesson or use the strengthened auto-save tests in later spec integration; this checker did not edit specs.

The JSX/hook host executes actual component callbacks/effect bodies and the real draft/repository path over fake-indexeddb. Deferred provider and File.text calls are mocks. Dexie live queries are supplied deterministic values, not subscribed with browser scheduling. No ReactDOM/Radix event delivery, DOM StrictMode, browser drag/drop/File decoding, browser-native IndexedDB, real provider call or paid request was tested. The effect replay tests do not simulate arbitrary browser reconnect/scheduling. Separate episode-editor unmount and fresh-editor tests establish the assigned file session lifetime, not a new universal cross-page draft policy.

No full-suite/build/model-bank/batch integration claim is made. The final focused tests, typecheck, whitespace checks and explicit ESLint baseline comparison support **B06 SS-07/PU-07 acceptance**, with inherited lint debt and the stated execution limits recorded. Coordinator review/ledger closure and B07 remain pending outside this checker.
