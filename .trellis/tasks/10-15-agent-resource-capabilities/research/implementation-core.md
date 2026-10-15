# E06 core implementation

Date: 2026-10-15. Owner: `/root/e04_reading`. Scope frozen for integration review; no Git writes.

## Change boundary

The missing behavior was an exact implementation/authority identity across a
model wait, preparation and approval. The neutral owner is agent-core's existing
tool factory, metadata and single execution loop. This change adds lifecycle and
resource-port contracts there; Todo owns real durable authority, transactional
claim and effects. Studio keeps its static tools and existing product owners.

Production files:

- `packages/agent-core/src/capabilityRegistry.ts`: bounded registration identity,
  unique active capability IDs/tool names, never-reused registration generation,
  idempotent generation-owned disposal, copied/frozen schema/envelope/binding.
  Its `snapshotToolDefinitions` export is internal to the package and actually
  used by runtime; it is not a root public export.
- `packages/agent-core/src/resourceGrants.ts`: neutral typed request, snapshot,
  subject, reference and port contracts. No concrete grant issuance or backend.
- `packages/agent-core/src/tools.ts`: optional exact binding on definitions and
  metadata, strict presence/three-field matching, captured parser function.
- `packages/agent-core/src/runtime.ts`: frozen definitions passed to the actual
  request before awaiting; round metadata and execution use that offer. Fresh
  current checks may refuse changed work but cannot select a new same-name
  callback. Scope checks cover admission, post-prepare, approval and fresh
  preclaim. Invalid awaiting-approval admission can now record failed. The
  existing save-failure rethrow retains its original cause for scoped ESLint.
- `packages/agent-core/src/index.ts`: explicit public-root exports below.

Test/type files:

- `packages/agent-core/src/resourceCapabilities.test.ts`: registration/disposal,
  invalid identity, duplicate/no-consumed-failed-generation, immutable offer,
  exact metadata binding and mandatory-confirmation ordering.
- `packages/agent-core/src/runtime.test.ts`: actual loop with held model request
  and actual advertised schema, replacement during model/approval/preparation,
  fresh preclaim scope, retained zero replacement effects. Original atomic,
  unknown, approval barrier, cleanup and output tests remain.
- `packages/agent-core/src/compaction.test.ts`: extend the existing capability
  test with two-group admission/three-group refusal and exact 36-tool boundary,
  preserving original unsettled-call pinning and settled-name release.
- `tests/typecheck/agentResourceContracts.ts`: public-root positive/negative
  witnesses for parser arguments, callback result/name inference, host preview,
  prepare output, generic concrete facts and readonly snapshot identity.

## Final reusable API

New root value: `createCapabilityRegistry<Context, Preview>()` with
`register({identity, tools}) -> {dispose()}`, `snapshot()` and
`assertCurrent(expected)`.

New root types: `ToolBindingIdentity`, `CapabilityRegistration`,
`CapabilityRegistry`, `ResourceGrantRef`, `ResourceGrantSubject`,
`ResourceGrantRequest<Fact>`, `ResourceGrantSnapshot<Fact>`,
`ResourceGrantPort<Fact>`.

Identity fields are `capabilityId`, `version`, `registrationId`, each 1–128
characters in an ASCII identifier namespace. A generation is never reused
within its live registry, including after disposal. Trusted host installation
owns the reviewed-code/version relationship.

`ToolDefinition.binding` and `ToolMetadata.binding` are optional. Static
definitions remain compatible. Bound metadata must match all three fields and
bound/unbound presence. `RuntimeHost.request` receives the fourth argument
`offeredDefinitions: readonly ToolDefinition<unknown, Context, Preview, unknown>[]`.
Existing three-argument hosts remain assignable; the dynamic Todo host must
actually advertise the supplied schemas. This was coordinated with its owner
before consumption; every new imported module existed first.

Resource contracts retain an explicit version-1 snapshot with exact
`subject: {runId, callId, scopeId}`, binding, concrete facts and grant id/revision
references. `prepare(request)` resolves authority; `assertCurrent(snapshot,
signal)` revalidates it. These generic contracts do not themselves mint grants
or enforce OS access. Context/preview/fact relationships remain typed until the
existing heterogeneous tool-dispatch erasure.

## Executed checks

All commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node`.
No package script, build, install, full/native, live/paid request or Git command.

- Final source Vitest at 20:31:16:
  `node_modules/vitest/vitest.mjs run --config vitest.agent-source.config.ts`
  with the four exact core suites above: **4 files / 36 tests passed**. This
  includes original 32-step/unknown/confirmed-absence-vs-read-failure behavior,
  mandatory confirmation and the existing loading/pinning suite. Node's
  experimental SQLite warning is expected from source-profile capability
  admission; the core tests themselves do not import SQLite.
- `node_modules/typescript/bin/tsc -p packages/agent-core/tsconfig.json --noEmit
  --pretty false`: **passed**, preserving core's `types: []` ambient boundary.
- `node_modules/eslint/bin/eslint.js` on the five changed production files,
  `--parser-options '{"project":["./tests/typecheck/tsconfig.agent-source.json"]}'`:
  **exit 0; 0 errors, 10 runtime complexity/nesting warnings**. No inline
  suppression, threshold change or lint exclusion. Root tests/type witnesses
  are outside the repository's typed source lint matcher and are not claimed
  as lint evidence.
- Latest combined source noEmit was **not yet green** while Todo tests were
  being written: only `tests/agentTodoSource.test.ts:5` unused `RuntimeEvent`
  and `:200` unsupported-family fixture's direct incompatible cast remained.
  No errors were reported in the core/type witness. Exact failures were sent
  to the Todo owner; final combined source type evidence belongs to the frozen
  integration check, rather than claiming this intermediate run passed.

## Frozen SHA-256

```text
6c790a362cb541bfd2030207052a66b93bfd13c45901e78219f1cedac49ba3d8  packages/agent-core/src/capabilityRegistry.ts
dba0f1fa768449f93fc30b386ebc3e37bb4afac90b551ddcc9f3bb5705dd8db0  packages/agent-core/src/resourceGrants.ts
851a0f0c2729b4e42854ff26d9254527aa5c68312edf255ebe9c4491dfa9faa1  packages/agent-core/src/runtime.ts
b13ba96064255cc8d70190a386cd16e7ed4656fbe4a0ac0ff336fb5aa4d464ac  packages/agent-core/src/tools.ts
e8ed4220bba720df09f264ab97b4602aef87b17f18dc2b7d3e9e216b48cd7513  packages/agent-core/src/index.ts
03e7eda32b24cb4fcb54c4f13cfb71357ee0ac7fd382c5b95e915b6d4024e5a1  packages/agent-core/src/resourceCapabilities.test.ts
4ffdeadd89de4aa54ab05d1c208b4e7d15041e80f40cc9842920480c596af4b0  packages/agent-core/src/runtime.test.ts
5240dbb02df4b200ab7fc561cab0f2091dabab6af993bdb541671a614d6a1e78  packages/agent-core/src/compaction.test.ts
863b48f318de6637c49dd1ff56ae2f1ceb7fc99935b2f51c9f2febbe64e1778c  tests/typecheck/agentResourceContracts.ts
```

## Boundaries and follow-up

Host transactions still own authoritative installation/authority/approval/claim
checks and mutation/evidence/original completion. Core preflight does not make
an unchecked effect safe. Retained completions and unknown no-replay semantics
remain in the original loop. Parsers/callbacks are trusted host code; copied
schemas do not sandbox closures. No parallel scheduler, process/file/network/MCP
backend, Studio dynamic projection or second store/loop was added.

Architecture is delegated to the final whole-scope checker. Emitted declaration
closure, outside-workspace packed install, CLI/SIGKILL/lease recovery, broad
Studio/native/package and live-service acceptance remain deferred to the user's
batch-end cadence. Same-process SQLite evidence from the other owner cannot
replace those gates.
