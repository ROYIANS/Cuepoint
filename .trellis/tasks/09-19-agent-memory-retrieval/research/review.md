# Independent retrieval review

Reviewer: `trellis-check` (`agent_run_review`). Date: 2026-09-19.

## Scope and method

Read the task PRD/design/implementation/check context, frontend Quality Check, and
memory, project ownership, context/compaction, execution, tool and cross-layer specs.
Traced the working diff through memory domain/schema/backup, pure selection,
repository eligibility/exclusions, run creation/refresh/dispatch, both provider
envelopes, compaction, read tools and preview/history UI. No paid API calls.

## Findings fixed by reviewer

1. `tests/agentSettings.test.ts`: three existing assertions still expected the six
   original default skills. Added the explicitly approved `project-memory` default
   and renamed the new-installation test. Kept opt-out and frozen-run permission
   assertions intact; no settings migration or permission expansion was introduced.
2. `src/lib/agent/projectContext.ts`: the system facts envelope still claimed long-term
   memory had not been retrieved. Replaced that stale statement with the actual
   boundary: current facts outrank separately supplied historical memory, which does
   not prove current outcomes or grant authorization.

## Finding fixed in coordination with main session

`ContextUsagePanel.tsx`: `useLiveQuery` can retain the previous result when thread,
project or query dependencies change. Untagged context/memory results could briefly
show project A's selected entries as project B's next-send preview. Repository scope
checks still prevented a cross-project exclusion write. Main session fixed this with
`contextKey` and serialized full `MemoryQueryOptions` identity; loaded results are
consumed only on matching keys. Thread reads, message history, active runs and summary
selection also check the current thread. Reviewer re-read the final code and closed
the original memory-preview finding. One adjacent display needs the same filter:
the returned `lastRecord` must filter compaction rows by current thread before `at(-1)`.

## Verified contracts

- Project identity is loaded from durable thread/run rows; active plus reviewedAt is
  required, and disabled/superseded/pending-review/foreign/excluded rows are ineligible.
- Automatic planner is shared with preview and dispatch, uses deterministic local
  lexical ranking, requires positive relevance unless explicitly project-wide, and
  fits whole serialized entries within eight entries / 4096 estimated tokens / 10%
  of known safe input capacity. Source evidence is not silently added to the envelope.
- Inclusion policy is strict and optional absence does not opt into project-wide use;
  existing memory versions and ZIP machinery preserve explicit policy and import review.
- Exclusions are thread-owned and reversible, including clearing IDs after deletion.
- Each settled model boundary reselects memory; original requests and previous audit
  snapshots stay unchanged. Dispatch persistence precedes HTTP; failed checkpoints
  cannot send a request. Retry revalidates memory without replaying completed effects.
- Chat and Responses replace only verified base prefixes and retain the exact suffix,
  including opaque reasoning. Compaction rebuilds with the independent memory layer;
  memory is revalidated again after potentially asynchronous compaction.
- Read tools require bound smart-mode runs, frozen enabled tool names and a genuine
  running ledger call. Source task/thread/run ownership is checked; complete public
  messages and settled result payloads do not expose hidden reasoning or tool arguments.
  Read slices, search counts, revisions and unavailable/stale states are bounded.
- UI distinguishes next-send preview, prepared selection and saved request-step audit;
  historical bodies use frozen versions and exclusion copy states its future boundary.
  These boundaries do not claim to erase prior dialogue/provider knowledge.

## Verification evidence

- Reviewer initial lint/typecheck: passed.
- Reviewer initial full tests: 784 passed / three stale-default expectation failures.
- After expectation correction: **64 files / 787 tests passed**. The package-script
  invocation with `-- tests/agentSettings.test.ts` executed the complete suite, so the
  result is full-suite evidence rather than only a targeted result.
- Additional lint/typecheck after facts-copy correction: passed.
- Explicit `pnpm exec vitest run` for project-context, settings, retrieval, memory tools
  and inclusion after both fixes: **five files / 38 tests passed**.
- `git diff --check`: passed again after reviewer fixes.
- Build and interactive browser validation: main-session responsibility; this document
  does not substitute static review for its actual mocked-provider/browser evidence.
- Main session reports browser coverage for task A confirmation/promotion to task B's
  actual mocked HTTP request, foreign project exclusion, immutable audit, reversible
  preview exclusion, reload/version changes/source links/inclusion policy and mobile
  overflow. Reviewer verified the query-identity fix statically, not through a second
  independent browser session.

No other confirmed correctness issue was found in the reviewed paths. This review
made only the two coordinated local fixes above; no commits or unrelated file edits.

## Main-session closure

The adjacent `lastRecord` display now also filters compaction rows by current thread.
Final lint, all 787 tests and the mocked browser fixture passed after this change.
The original and adjacent query-scope findings are resolved; no open review findings.
