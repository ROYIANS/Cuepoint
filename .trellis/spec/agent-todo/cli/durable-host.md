# Durable Todo host

## 1. Scope / Trigger

Read when changing `examples/agent-todo`, its SQLite coordination, host adapter,
CLI or the root isolated-consumer gate. This example owns its business model and
Node >=24.11 requirement; neither belongs in the neutral libraries or Studio.

## 2. Signatures

The executable is `node dist/cli.js <command> <sqlite-file> [run-id|scenario]
[detail]`. Commands are `begin`, `open`, `resume`, `approve`, `reject` and `hold`.
`begin` accepts `todo`, `update`, `pair`, `restart`, `stream`, `budget`, `external`, `load`
or `summary`; `committed` holds a later checkpoint after a completed write for
process-death conformance. `approve`/`reject` use the tool-call ID as `detail`; `resume` accepts
`next-segment` as an explicit new model-segment grant.

`TodoStore` owns `todo_runs`, `todo_calls`, `todo_outputs`, `todos`,
`todo_evidence`, `todo_intents` and `todo_summaries`. `TodoRun` extends the core
run with `ownerId`, `revision`, `scope`, frozen tools, offered-round names,
response continuation, history and request counts. `TodoCall` adds its `runId`,
result, append state and persisted approval decision. `TodoContext.services`
provides concrete `list`, `mutate`, `load` and `external` functions.

The host calls public `executeRun`; `compactContext` owns its compaction loop.
`main(args?: string[]): Promise<void>` wires signals and closes the store only
after execution has drained. Root `agent:example:check` is the isolated pack,
install, emitted-type and durable-conformance entry.

## 3. Contracts

- The business database uses short SQLite transactions. A separate
  `<sqlite-file>.ownership` connection holds an actual `BEGIN IMMEDIATE` lease
  for the process lifetime, with `busy_timeout=0`. A live competing process
  fails immediately. Do not guess death from timestamps or heartbeat expiry.
- Run ownership and revision are durable predicates. Conditional writes reject
  a stale revision or owner; a revision increment without a matching write
  predicate cannot protect against stale clones. Claim revalidates the current
  run/call, frozen metadata, scope, permissions and current offered tools inside
  the actual transaction. Only one execution may use a held store at a time.
- Local writes commit business mutation, evidence, serialized result and
  completed call together. Result JSON must be defined and at most 65,536
  characters. Serialization/evidence failure or abort before commit rolls back
  the entire operation. A lost acknowledgement must read durable completion
  first; unreadable confirmation remains unknown.
- External intent is durable before the example's deterministic external
  dispatch. An uncertain effect remains unknown and cannot be replayed by
  recovery, approval or explicit resume. No paid provider is needed.
- `open` recovers persisted state with zero model requests. Running work from a
  terminated process becomes interrupted or unknown according to its durable
  certainty. `resume` is explicit; a reopened application does not dispatch.
  Completed calls and their exact opaque arguments/results are reused once.
- Approval is a persisted decision against the exact expected call. Rejecting
  a write never invokes its business mutation. Terminal settlement preserves
  already saved output and obeys the shared core's terminal transition rules.
- Summary jobs are durable before dispatch. Activation checks the current run
  revision, summary still running, current base and covered history prefix.
  Recovery interrupts unfinished jobs; stale or failed jobs cannot activate.
- `TODO_PERMISSION=full` opts into full permission; default is `ask`.
  `TODO_HOLD=checkpoint|summary` enables deterministic process-test handshakes.
  CLI stdout emits JSON readiness/results; `SIGINT`/`SIGTERM` abort execution.
  Process-death conformance uses actual SIGKILL and waits for process exit.
- Packed consumption installs local tarballs offline into an outside-workspace
  consumer with an independent empty package store. Validate packed dependency
  versions before any local override. Compile with strict NodeNext resolution,
  no source alias and `skipLibCheck=false`; run the emitted CLI and tests using
  installed public package identities, with no Studio/source fallback.

## 4. Validation and Error Matrix

| Condition | Required outcome |
| --- | --- |
| Another process holds the ownership transaction | Fail closed with no model request or business mutation. |
| Stale owner/revision/call approval/offer or expired execution | Reject before effect; never overwrite newer durable state. |
| Reentrant execution or close while execution is active | Reject; retain the actual lease until execution drains. |
| Serialization, evidence write or abort fails before COMMIT | No business row, evidence or completed result survives. |
| COMMIT succeeded but acknowledgement failed | Preserve the durable completed result; do not execute again. |
| Confirmation unreadable or external outcome uncertain | Preserve unknown; refuse automatic replay. |
| Duplicate continuation append | Reuse an identical result once; reject a conflicting result. |
| Open after process death | Recover from actual SQLite with zero model requests. |
| Failed/interrupted/stale summary attempts activation | Reject; retain the current context base. |
| Missing/private export, source fallback or incorrect packed dependency | Fail isolated-consumer gate. |

## 5. Good, Base and Bad Cases

Good: kill a process after a tool's committed result and a saved output
checkpoint, reopen its actual database, observe zero requests, then explicitly
resume without repeating the write. Base: a write waits for approval and runs
once after approval; rejection performs no write. Bad: reconstruct an apparent
restart in memory, or let an uncertain external effect return to pending.

## 6. Tests Required

- Node >=24.11 conformance covers live-owner exclusion, execution lifetime,
  stale revision/claim/approval/scope/offer, cross-run tool IDs and exact argument
  bytes. Assert real row counts and persisted outcomes, not only returned text.
- Inject serialization, receipt, pre-commit abort, post-commit acknowledgement
  and confirmation-read failures; inspect business, evidence and result rows.
- Spawn actual CLI processes, wait for checkpoint/summary readiness, SIGKILL,
  await exit, reopen and explicitly resume. Assert zero startup requests,
  completed-result reuse, retained output and interrupted summary behavior.
- Exercise cancellation, loading, the 32-request segment boundary, continuation
  append, summary-prefix/base/status rejection and unknown external replay.
- The isolated gate executes every example conformance test against installed
  emitted exports and separately checks emitted declaration/runtime closure,
  package identity and forbidden private imports.

## 7. Wrong Versus Correct

Wrong: `UPDATE todo_runs SET data=? WHERE id=?` while merely incrementing the
revision in JavaScript. Correct: include the expected durable owner and revision
in the conditional update and reject a zero-row result.

Wrong: hold a write transaction on the business database throughout a model
request, or release ownership while execution remains active. Correct: hold the
separate ownership transaction while using short atomic business transactions,
drain the execution and then close the lease.
