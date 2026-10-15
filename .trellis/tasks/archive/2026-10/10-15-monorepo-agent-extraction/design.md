# Monorepo and Reusable Agent Design

## 1. Decision and architecture

Use pnpm workspaces with explicit applications and a small initial library set. Keep one shared studio; extract the Agent runtime as a real library rather than an alternate product implementation. No task runner framework is required initially.

```text
apps/
  web/                  Browser entry/config and web build
  desktop/              Tauri entry/config, Rust, native and installer scripts
  site/                 Independent site entry/assets/build
packages/
  studio/               Shared Cuepoint product, organized by feature
  distribution/         Lightweight release/platform/version/brand exports
  agent-core/           Headless Agent contracts and execution implementation
  agent-providers/      Chat Completions/Responses protocol adapters
examples/
  agent-todo/           Independent Node consumer, own durable SQLite schema
tooling/                Repository-level quality and test orchestration
tests/integration/      Cross-package/real-store fixtures and immutable comparators
```

Agent packages are introduced by child 3; child 1 introduces only packages with current consumers. The distribution package is justified by the existing site and settings consumers. Installer download verification/save stays in the studio runtime rather than expanding the site's closure.

## 2. Package and dependency contracts

| Consumer | Allowed internal dependencies | Prohibited dependencies |
| --- | --- | --- |
| web/desktop JS entry | studio, relevant application tooling | Sibling application source |
| site | distribution | studio, Agent, product storage/runtime/theme |
| studio | agent-core, agent-providers, distribution | Application packages |
| agent-providers | agent-core | studio, product tables, React/Tauri |
| agent-core | Narrow declared schema/runtime-neutral dependencies | studio, providers, application packages, React/Dexie/Tauri/Node-only modules |
| agent-todo | Public built Agent package exports | studio source, Cuepoint ProductStore, root source aliases |

Declared `workspace:*` dependencies and explicit export maps define package boundaries. App packages are leaves. No cross-package `@/` alias, relative traversal into sibling sources or all-source root barrel. Per-package private aliases may remain inside that package only.

Studio may use source exports compiled by its Vite consumers. Reusable Agent packages emit ESM JavaScript and declarations, with explicit `.js` resolution for built imports and no unresolved source alias. Build and local-pack validation must include the export/type closure. Private workspace status does not weaken the independent-consumer gate; public publication/version guarantees are deferred.

## 3. Studio organization

`packages/studio/src/app` owns application construction, routes, common frame, cross-feature workflows and service composition. Each business feature owns its models, commands, queries, UI, tests and domain-specific Agent adapters. Platform folders own storage/transport/binary/system mechanisms; neutral UI primitives remain separate.

Features: projects, video, audio, music, library, references, memory, settings and agent. Audio is the first vertical pilot. Preserve current command owners within a feature and avoid creating an aggregate repository facade. Existing large files can move intact when splitting them would mix behavioral refactoring with relocation.

Ownership rules follow the research map. Every current file must have one owner, backed by an enumerated implementation inventory and a source-discovery check. Model types shared by several features have one named owner and type-only consumers; do not copy entity interfaces. Central product schema/table registration remains singular and explicitly typed. Type-only model relationships are distinguished from forbidden runtime edges.

App composition constructs the fixed ProductStore and feature services before rendering. Storage mechanisms must not import the app bootstrap; query hooks receive the configured store through a typed integration. Feature services receive the explicit store/transaction context, including nested readers and commands. Cross-feature lifecycle/import/export commands keep one root transaction and named ownership; splitting directories never splits the commit.

Move browser/native reference adapters without changing normal-path selection. No new native page tree, second Agent, database mirror, fallback owner or synchronization path.

## 4. Reusable Agent boundary

The core owns runtime-neutral execution snapshots/status transitions, monotonic checkpoints, tool definitions and validation, approval protocol, serialized output writing, context-budget mechanisms, capability group loading, cancellation semantics and typed execution events.

Host ports provide:

| Port | Required behavior |
| --- | --- |
| Model | Normalized streaming text/tool results, usage and validated serializable continuation state; independent request/compaction operations; AbortSignal honored. |
| Execution persistence | Atomic begin/claim/checkpoint/settle operations, expected revision/owner checks, durable calls/results and effect certainty. Contracts describe semantics rather than table CRUD. |
| Tool execution/commit | Typed host services; optional transaction capability that commits local effects and call completion together; external operation IDs/reconciliation for nonlocal effects. |
| Coordination | Exclusive session/thread ownership across recovery and execution. Tokens/claims are checked by persistence where applicable; a timeout cannot prove a former owner died. |
| Context sources | Bounded source blocks and provenance from host-selected project/knowledge sources; refreshed at defined dispatch boundaries, with current policy/scope validation. |
| Policies | Frozen permission decisions, step/context budgets and completion-check hooks; Cuepoint retains its exact paid-generation and finishing-check policies. |

These are semantic boundaries, not a commitment to six classes or one generic middleware system. Implement the minimum typed interfaces required by the existing product and independent example. Do not add `any`, unvalidated extension dictionaries or a generic service locator to hide product types.

Tools bind the argument parser to callbacks and carry typed, validated preview/result extensions. Core execution context contains execution/call identity, signal and typed host services; it has no built-in project/shot/music fields. Cuepoint validates and stores its current project binding, generation overrides, preview payloads and receipts in its adapter. Skills registration/loading is generic; creative tool groups and instruction content remain product-owned.

The event contract covers text/available reasoning deltas, tool state, approval required, checkpoints and terminal state. Events represent confirmed state or explicitly provisional deltas, include stable ordering identity, and never replace durable truth. UI renderers are downstream consumers. Raw encrypted continuation is persisted for the provider and never emitted as public chat activity.

## 5. Persistence and failure semantics

Core defines execution records and repository operations; it does not force a schema or database. Cuepoint implements these ports using the existing ProductStore and the same business-root transaction. The Node example implements them with its own SQLite tables.

Local atomic tools bind a host transaction context to business writes, evidence and final call result. Serialization/receipt failure rolls back the entire operation. Commit acknowledgement has explicit `committed`, `rolled_back` or `unknown` certainty. Reading an absent result after a read failure cannot prove rollback. A result already committed before a later failure remains complete.

External effects are not advertised as atomically committed with local DB records. Persist intent/operation identity before dispatch, retain supplier IDs and reconcile existing work; use remote idempotency only when supported. Unknown submission never authorizes replay. Cancellation stops local work/waiting and does not assert remote cancellation.

Preserve the current sole terminal writer: run, public message and relevant ledger settle consistently, with optimistic checks and no resurrection/late terminal overwrite. Successful checkpoints remain monotonic; final state awaits output flush. Startup recovery acquires ownership, marks abandoned work and makes zero network submissions. Explicit retry/resume follows frozen inputs and confirmed results.

Do not require the Agent to use a physically separate DB. Package separation is a code boundary; Cuepoint's atomicity requires shared transaction capability with its product writes.

## 6. Provider extraction

Providers normalize current chat protocols; their dependency points toward core-owned contracts. Resolve credentials at request time, without copying keys into snapshots. Preserve request-count limits, bounded reads/SSE completion, redaction, abort cleanup, tool identifiers and error reporting. Keep validated opaque Responses envelopes exact through checkpoints/compaction; visible display messages cannot reconstruct them.

Cuepoint resolves connector identity/capabilities, reference/image bytes and runtime HTTP policy before/through the provider port. Known connector-specific request behavior is represented by typed adapter options and preserved tests. Model catalog persistence, device settings, managed media access, Tavily product configuration and image/video/audio generation workflows do not move into generic chat providers.

## 7. Independent consumer

Provide `examples/agent-todo` as a Node >=24.11 CLI using `node:sqlite`, with its own schema and read/create/update todo tools. This runtime is supported for the example only; core imports stay runtime-neutral. A deterministic fake model drives exact approval, execution and interruption cases without paid requests. An optional live-provider command can accept runtime credentials but is not a required acceptance action.

Validate compiled packages in a new temporary consumer outside the workspace, with no studio/root alias. The gate builds and locally packs required dependencies, installs the local artifacts without registry publication, compiles and executes the example, terminates/reopens its process and verifies durable state. Cover reject/approve, cancellation, continued runs, duplicate claims, serialization rollback and unknown-result refusal. A memory-only adapter can help unit tests but cannot satisfy durable restart acceptance.

## 8. Application/tooling migration

- Preserve public app routes and production `/` site plus SPA fallback. Compose separate web/site outputs deliberately; desktop bundles only the studio entry.
- Retain one app version source and current release identity/naming. Update root/desktop/Cargo/Tauri integrity readers and source hashes together.
- Move Rust schema inclusion, generated route/model/icon paths, media/PDF/DOCX workers, assets, fixtures and native probes with their consumers.
- Replace relative root-node_modules imports with declared dependencies/resolution; use the approved local pnpm, retain existing versions and avoid unrelated lockfile churn.
- Update TypeScript project references, ESLint, full/production Knip, the source graph, self-tests and test resolver seams in the same change as each source move. Test actual rejected cross-package imports and nonempty discovery.
- Keep immutable source snapshot bytes. Source diagnostic allowances are reviewed per finding with updated path/evidence identity; never bulk-accept new lint findings or weaken assertions.
- Retain GHCR quality and packaging-only desktop CI. Account for Docker build contexts, command working directories and source receipt closure without initiating a release.
- Update Trellis package discovery/spec indexes when the new layout exists, preserving the current executable contracts rather than rewriting workflow runtime or copying all specs per package.

## 9. Compatibility, sequencing and rollback

This is a behavior-preserving source reorganization/extraction. No schema/storage identity, package-format, public-route or IPC version change is needed. Current compatibility readers remain while used by current contracts; no additional legacy migration is authorized. Public Agent API stability starts only with a future publication decision.

Execute application boundaries -> feature organization -> Agent extraction. Each child integrates and checks its final scope before moving to the next. Temporary import bridges are allowed only within the current child, enumerated and removed before its acceptance; they are not a permanent parallel implementation. Revert a failing uncommitted slice while retaining other contributors' changes; do not modify production user data. Record verified child commits as rollback points without claiming Git reverts can undo external side effects.

The parent performs a final complete graph/build/browser/native/example review after all children, and records platform-specific acceptance limits. Parent completion cannot be inferred from child status alone.
