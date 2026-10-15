# Actual core loop and Studio host slice

The primitive/discovery slice is followed by a real execution transfer. The public `executeRun` in `packages/agent-core/src/runtime.ts` owns both pending-tool passes and the entire request loop. Studio's `runtime/runChat.ts` supplies named storage/policy ports and thin execute/resume wrappers. There is no second host model/tool loop. Providers and the independent SQLite application remain subsequent acceptance work.

## Ownership and durable commitment

Studio has no durable owner/revision column. Its actual Web Lock issues a private branded capability registered by identity; forged, expired, wrong-thread and concurrent reuse fail before writes or dispatch. Direct callers acquire execution-only exclusion without recovering their newly created run. Existing UI flows reuse their already-held token. Closing a callback prevents new executions and drains an already-started execution before releasing the real lock; a callback exception is not replaced by a drain failure.

Only the pending/approved-to-running claim revalidates the exact call fingerprint and current offers, parser, metadata, permission and project scope inside the existing transition transaction. A new parser invocation is deliberate: D05 retains an exact count of four, comprising round metadata, first-pass preflight, second-pass validation and transactional claim. Settled historical snapshot entries still skip point reads and execution. Post-execution updates do not apply an unrelated strict fingerprint to legitimate recovery/job changes.

Atomic tools still serialize/validate receipts/results and commit their original completed ledger inside the business transaction. Core confirms that completion and never adds an independent successful completion. Completed-after-throw wins; failed confirmation or missing atomic completion stays unknown. Nonatomic completion must also be acknowledged or durably confirmed. The original Studio terminal writer remains the only writer for finish, pause, cancellation and recovery; shared predicates choose permissible states and segment limits without adding schema.

Checkpoint now returns whether its existing transaction actually applied the write. Stale/terminal no-ops do not produce confirmed checkpoint events. Events carry run identity, one invocation execution ID and an invocation-local sequence; public output is provisional, persistence notices follow confirmation, and opaque continuation/credentials remain private.

## Shared mechanisms and retained policy

Core owns generic approval, registry lookup/offered enforcement/raw-size/JSON dispatch, metadata comparison, capability selection/pinning, the 36-tool ceiling, policy defaults/token estimates/budget arithmetic, whole-turn history selection and verified prefix/base operations. Studio retains creative registry content, safe Zod/domain diagnostics, paid-generation confirmation, project/memory/reference projection and materialization.

`compactContext` owns the actual eight-pass summary loop. Studio supplies existing summary-job begin/activation/failure transactions and prompts; jobs precede auxiliary HTTP, invalid prefixes and oversized protected turns fail safely, and completed summaries remain durable when a ninth request would be required. Main and auxiliary dispatch independently reread the current connector credential and validate frozen identity/base URL. Injected transport fixtures retain their explicit compatibility path; production does not depend on the UI's initial key for later requests.

The two existing privacy allowances moved to the core catches that now perform the same safe-message replacement. Their reasons remain unchanged: adding raw provider/parse exceptions as causes would retain unredacted state. Allowance count remains twelve; no new blanket exemption was introduced.

## Current verification

Root TypeScript build passes. The final focused run has 16 files / 199 passing tests, including the real Studio binding, transactional claim races, main/auxiliary credential rotation, core atomic certainty/events/parser/compaction/loading, D05, context, finishing and E07 contracts. Formal quality passes with 616 files, 2468 static value edges, ten literal dynamic edges, zero cycles, twelve existing lint allowances and fifteen matched unused contracts. Raw logs and exact source-bound receipt are `/tmp/cuepoint-agent-loop-{types.log,focused-final.log,quality-final.json}`.

The real Rust/SQLite 64-tool/32-request pause/reopen/resume fixture passes separately with full coverage, one worker and its original twenty-second deadline: one selected case, 26 explicitly skipped cases, total run 15.94 seconds and 1056 coverage records. The existing locked Rust probe has SHA-256 `bb7a0bb154dc60a41dc56082bc37cb651298c8b6359930bc3c393ae95c2c3f54`. Raw log and environment/identity receipt are `/tmp/cuepoint-agent-loop-native-critical/{native-tests.log,result.json}`. This is an incremental performance/semantics check, not whole-file or whole-child native acceptance. Final full root, packages, applications, protocols, isolated artifacts and native ALL remain required after all slices.
