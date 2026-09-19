# Quality evidence — 2026-09-19

Implementation approved by user with “可以”. No external model request or paid generation
was used in verification. All repository and browser fixtures used disposable data.

- Local pnpm lint (`tsc -b`): passed after final UI query-scope fix.
- Local pnpm test: **64 files, 787 tests passed** (21 additions over 766 baseline).
- Local pnpm build: passed; agent bundle 8.18 MB uncompressed. Existing large-chunk
  warning persists (prior baseline 8.16 MB); no new build error.
- Independent whole-diff review: see `research/review.md`. Corrected old default-skill
  expectations, obsolete facts-envelope copy and stale preview/compaction query scope.
- `git diff --check`: passed.

## Browser fixture

`browser-regression.cjs` launches isolated headless Edge against Vite on port 5185;
it imports real repositories, executes real run orchestration with a mocked transport,
and exercises actual page components. Final run passed with no page errors.

Verified confirmed task A lesson -> user-reviewed memory -> same-project new conversation
B's actual HTTP payload. Foreign project C's rule did not appear. Historical dispatch
snapshot retained two original entries after thread exclusion. Next-send preview dropped
the excluded entry, restoration brought it back. Editing kept historical version 1 while
preview/reload showed version 2. Source link opened project memory; inclusion selector
saved project-wide opt-in. Escape closed sheets, 390px layout had no horizontal overflow.
Screenshots inspected at `/tmp/memory-retrieval-{history,preview,mobile}.png` (local QA
outputs, not committed; rerun fixture to regenerate).

## Repository / transport coverage

- Pure lexical Chinese/Latin selection, explicit project-wide priority, same-project
  lifecycle/review filtering, stable ties, whole entry budgets and long evidence omission.
- Per-thread exclusions persisted through DB reopen and remained globally non-destructive.
- Both protocol base prefixes retained original requests, tool suffix and opaque Responses
  reasoning while replacing current memory. Actual two-round transport changed revision
  1 to 2; settled tool ran once. Failed audit persistence caused no HTTP request.
- Retry revalidated current lifecycle. Compaction preserved exactly one corrected layer.
- Strict read tools checked frozen skill/mode/scope, source task/thread/run proof, stale
  versions, pagination and excluded recursive/private tool results.
- Inclusion survived revision and ZIP import with pending-review lifecycle intact.

## Limits

Selection is deterministic local lexical matching, not embedding-based semantic retrieval.
Token counts are estimates. “Request started” is recorded before transport and is not a
receipt or proof the model followed memory. Exclusion cannot erase old conversation text.
Existing explicit user skill preferences are preserved; new configurations include the
memory/history skill by default. No migrations or legacy-data backfill were added.

## Follow-up task-inspector fix

User reported `Transaction committed too early` when opening a populated running task.
Native Edge reproduced it for 150/500 repeated entity locators and immediate invalid
locators, while distinct real-DB lookups passed. Shared evidence traversal now adopts
both entity awaits through the global transaction Promise. All 15 cases (1, 10, 50,
150, 500 rows × repeated/invalid/distinct) pass after the fix. No consistency check was
removed and no partial evidence is returned.

`task-transaction-regression.cjs` also opened a running task with 180 repeated sources,
retained the running state across live checkpoints, injected a summary-read failure,
verified local error display and preserved unsaved text/disabled saving, then restored
reads and saved the original draft. Zero page errors. Screenshots inspected at
`/tmp/task-inspector-transaction-fixed.png` and `/tmp/task-wrapup-read-error.png`.

Final lint and full suite: **64 files / 788 tests passed**. An existing generation test
had a false failure because a random UUID contained `b64`; changed its assertion to
check the actual `b64_json` key and full fixture payload, preserving the intended data
retention guarantee. No generation production code changed. Independent reviewer
accepted the transaction/UI/test fixes. See `research/task-transaction-bug.md`.
