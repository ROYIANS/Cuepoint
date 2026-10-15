# E04 query and departure implementation

## Changed owners

- `packages/studio/src/features/agent/ui/AgentChatPage.tsx`: inline messages, runs and compactions queries capture the requested thread ID inside their actual read invocation, returning `{forThreadId, messages}`, `{forThreadId, runs}` and `{forThreadId, compactions}`. Home uses explicit null. Matching empty results remain empty; an unmatched retained envelope derives undefined. Row-level thread filtering remains after the envelope check. Every existing parent consumer receives these owned derivatives, including departure, retry eligibility, composer lock/attention, current execution status, task state/goal and inspector/workspace props. No new dependency or generic query change was needed.
- `packages/studio/src/features/agent/ui/useThreadDeparture.tsx`: both blocking and executing predicates filter the explicit current thread. Topic changes clear old confirmation/bypass/local callback ownership. This also fixes an existing adjacent leak: confirm could leave `armed` set while `leaving` bypassed the old navigation, allowing one later navigation under another thread. Clearing on thread change preserves same-thread confirmed departure and one-use bypass while refusing to inherit another topic's permission.
- `tests/b07ComposeSessions.test.ts`: existing callback harness now supplies explicit query envelopes; all existing E02/E03 callback expectations remain intact.
- `tests/e04AgentQueryDeparture.test.ts`: actual ReactDOM page and departure hook coverage, with the production ProductStore query hook and real readonly query transactions. UI leaves, router and background startup recovery are controlled fixtures; actual query ownership/retention/lifecycle logic is not mocked.

## Necessary evidence

Commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly.

- `exec vitest run tests/e04AgentQueryDeparture.test.ts tests/b07ComposeSessions.test.ts tests/e02SubmissionPresentation.test.ts tests/e03ExecutionPresentation.test.ts` — **4 suites / 65 tests passed** after the query/departure and topic-bound bypass changes.
- After adding a real running A compaction and asserting its label cannot enter B, `exec vitest run tests/e04AgentQueryDeparture.test.ts` — **9 tests passed**.
- `exec tsc -p tsconfig.app.json --noEmit --pretty false` — **passed** with concurrent reading-owner changes present.
- ESLint on `AgentChatPage.tsx` and `useThreadDeparture.tsx` — **0 errors / 12 visible warnings** (complexity, cognitive complexity, depth and nested ternaries in AgentChatPage). The departure hook has no lint findings.
- `git diff --check` — **passed** on the integrated worktree before this evidence file.

## Assertions and limits

Observer tests capture each actual `db.observe` query, execute it in a real readonly `StoreTx`, and delay only notification delivery outside the transaction. They cover empty A → pending B → observed empty B, independent message/run readiness, stale retired A callbacks, explicit home/null identity, foreign rows in a matching envelope, no A text/run actions/attention/project lock/departure predicate in B, and no A compaction caption while B compactions are pending. B's actual running/approval observation restores its own guard.

Actual hook tests cover foreign/home runs, owned running/approval/resumable interrupted/failed tool runs, request deduplication, cancel, confirm, one-use bypass, blocked browser-route resolution, no bypass inherited by the next active topic and no pending callback carried into another topic.

These are bounded observer/callback/ReactDOM assertions. They do not claim browser pixels, native transport/storage acceptance or real provider behavior. The reading owner's separate MessageList tests cover scrolling and the return control. Full suites, builds, packaging and native/live validation remain deferred under the owner's explicit batch cadence. No package install, build, paid request or Git mutation was performed by this worker.

Query/departure product files and focused tests are frozen for independent review.
