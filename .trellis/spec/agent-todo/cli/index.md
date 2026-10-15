# Independent durable Agent consumer

## Scope

`examples/agent-todo` is a private Node >=24.11 CLI with its own SQLite schema,
business tools, approvals and ownership adapter. It consumes the emitted public
Agent packages and demonstrates how another product binds the shared execution
implementation. Its storage does not import or reproduce Studio's ProductStore.

## Guidelines Index

| Guide | Description |
| --- | --- |
| [Durable host](./durable-host.md) | CLI, SQLite ownership, atomic effects, restart and isolated packed consumption. |

## Pre-Development Checklist

- Read [durable host](./durable-host.md),
  [core runtime](../../agent-core/library/runtime.md),
  [provider protocols](../../agent-providers/library/protocols.md) and
  [package boundaries](../../frontend/monorepo-boundaries.md).
- Read [type safety](../../frontend/type-safety.md),
  [quality](../../frontend/quality-guidelines.md) and
  [shared guides](../../guides/index.md).
- Inspect the actual CLI, host and process conformance tests before changing
  persistent states or process handshakes. Keep generic library tests usable on
  Node 22; this consumer's real SQLite tests run on Node >=24.11.

## Quality Check

- Call the shared core loop and public provider helpers; never copy a second
  model/tool loop or import Studio. Production and packed consumers resolve
  emitted public exports. Only the explicitly selected source-validation
  runner/type project may map the three existing exact public entries; that
  bounded evidence cannot establish packed runtime/declaration closure.
- Prove business mutation, evidence and completion share one actual transaction.
  Reopening a database must preserve completed results and unknown outcomes.
- Exercise an actual held owner and actual SIGKILL/reopen/explicit-resume paths.
  A timer, an in-memory lock or a fabricated recovered row cannot establish this.
- Run root `agent:example:check` to build/pack/install outside the workspace,
  compile emitted declarations and execute the real consumer conformance suite.
  Keep temporary databases, tarballs, logs and package stores outside the repo.
