# E06 independent Todo implementation

Status: **FREEZE**. Main owns canonical specs, discovery, integrated review and Git.

## Actual public-core consumer

The existing independent `examples/agent-todo` continues to call public `executeRun`; no second model/tool loop, Studio import, alternate business database or fake mutation was added. `createTodoToolset(identity)` calls public `createCapabilityRegistry<TodoContext, Preview>()`, registers only the existing `create_todo` definition and keeps other list/complete/loading/external tools static. The registry pairs the reviewed `todo.create` / version `1` implementation with a durable installation generation. Each host retains its definitions; the deterministic model adapter now receives and projects core's exact frozen fourth-argument definitions into its model tool schemas and checks generated tool names against that offer.

The typed resource port is the public `ResourceGrantPort<TodoResourceFact>` with `{kind:'todo-list', listId, action:'create'}` facts. The actual list ID and request subject come from the run/call owned by the host, never from model strings. Prepare reads existing authority only. Its immutable snapshot persists in the original call preview, is included in the unchanged exact approval/fingerprint mechanism, and reaches the actual SQLite mutation transaction.

## Trusted issuance and durable records

Two minimal tables belong to this example's existing SQLite owner:

- `todo_installations(id,data)`: reviewed binding identity and active installation status. Replacement creates a fresh generation and disposes only old local registrations; disposed identities do not become valid merely because their records survive. Reopening reattaches reviewed code only to the exact persisted binding/version; it does not install a new generation to repair old calls.
- `todo_authorities(id,run_id,data)`: exact root/child run, scope, binding, facts, revision, optional parent reference and revocation. Possessing/copying a reference does not grant authority.

Trusted APIs are `installCreateCapability`, `disposeCreateCapability`, `issueCreateAuthority`, `deriveCreateAuthority` and `revokeAuthority`. Lower-level `begin`, `permissionMode=full`, `prepare`, `createHost` and `execute` never issue permission.

The **CLI `begin` branch** explicitly acts as trusted setup: install the reviewed create implementation if no active one exists, begin the actual run, then issue root list/create authority for that run's real scope. `open`, approve/reject and resume never issue/install. Existing `node:test` conformance setup explicitly installs the reviewed implementation and uses `trustedBegin`, preserving the normal examples and original process tests without silently granting through the lower-level API.

Child issuance is a separate explicit trusted operation targeting one actual child run. It pins its parent's ID/revision, retains binding and the exact list/action subset, and cannot widen to another list or action. A parent and child can be different run subjects in the same list; this example does not introduce child-Agent execution or bypass its existing one-unfinished-run-per-list rule. Every live ancestor is checked; parent revocation/revision replacement invalidates descendants.

A stale child candidate cannot shadow a later **explicit new root issuance for a new call**. Prepare skips invalid ancestry while selecting current authority for that new call. An already prepared/approved call never resolves new authority: its exact old references continue to fail. This distinction has an actual subsequent-model-call regression.

## Approval, claim and actual effect boundary

`TodoStore.decide` rechecks installation, concrete subject/facts and ancestry inside its exact approval transaction. Rejection remains available after revocation. The host's actual running claim checks the original call fingerprint, offers, metadata, required approval and the same prepared authority in its transaction. The final `TodoStore.atomic` rechecks current run/call, original call identity, installation availability, exact prepared snapshot, active leaf/ancestors, arguments and approval before the real `INSERT INTO todos`. Mutation, evidence carrying binding/authority, serialized original result and completed call remain one transaction. A denied policy/grant check never reaches that SQL effect seam.

Typed unknown/lost completion semantics remain conservative. A confirmed durable completion wins over a late acknowledgement error; unreadable confirmation is not replay authority. The static deterministic external scenario retains its durable intent and unknown/no-replay behavior.

## Changed files

- `examples/agent-todo/src/types.ts`
- `examples/agent-todo/src/tools.ts`
- `examples/agent-todo/src/store.ts`
- `examples/agent-todo/src/host.ts`
- `examples/agent-todo/src/cli.ts`
- `examples/agent-todo/src/conformance.test.ts` (explicit trusted setup/table inventory only; all original process tests retained)
- `tests/agentTodoSource.test.ts` (root Vitest fixture, outside the example's production emit tree)

No core, provider, tooling, package manifest, schema owner outside the example, discovery, canonical spec or Git writes were performed by this worker.

## Focused evidence

Every command used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node` explicitly; no build/package/install lifecycle script was invoked.

1. `node node_modules/vitest/vitest.mjs run --config vitest.agent-source.config.ts tests/agentTodoSource.test.ts`: **1 suite / 31 tests passed**, final run 355 ms. Real temporary **file SQLite**, actual `TodoStore`, `createHost`, `execute` and public `executeRun` are used. The fixture counts actual Todo SQL effect admission and inspects business, evidence, calls, previews, bindings, request counts and external-intent rows.
2. `node node_modules/typescript/bin/tsc -p tests/typecheck/tsconfig.agent-source.json --noEmit --pretty false`: **passed**. This includes actual Todo production source and existing node:test conformance through exact public source entries. The final review owner will rerun combined source types after all scopes freeze.
3. Direct ESLint over the six changed example `src` files, `--parser-options '{"project":["./tests/typecheck/tsconfig.agent-source.json"]}' --no-inline-config`: **exit 0, zero errors / five visible warnings**. Warnings: CLI/request cognitive complexity, request/assertCreateAuthority complexity and retained result nested ternary. The initial unsafe JSON member diagnostic was fixed by narrowing unknown at the real effect boundary. The root fixture is outside typed source lint discovery, so it is not claimed as lint evidence.

The 31 source cases cover: exact allow preview→approval→claim→atomic/evidence; full-mode missing installation/grant/foreign grant default denial; same-process reopen preserving exact installation/approval and zero startup request; seven approval-denial variations (revocation, stale revision, subject/fact/reference drift, replacement and disposal); explicit child subsets, copied references, parent revocation and no widening; new explicit root/new call without repairing old snapshot; revocation/replacement immediately before claim and real SQL-transaction revocation/call-change at atomic admission; pending model/approval replacement; four unsupported resource-family policy negatives; mandatory confirmation under ask/assist/full using a coherent code-owned policy fixture through actual host/store validation; lost acknowledgement, unreadable confirmation, receipt rollback; static external unknown no-replay after same-process reopen.

## Explicit deferred boundaries

- Source imports resolve only in the explicitly selected neutral source profile. Production/public emitted exports, declarations, outside-workspace pack/install dependency identity and full isolated consumer conformance remain **unverified until the deferred batch-end gate**. Default freshness was not removed, forged or bypassed by a build.
- Same-process file close/reopen proves durable identity/data preservation and no startup work. It **does not prove SIGKILL, kernel lease release, actual CLI process restart or process-death handshakes**. Original emitted node:test process conformance remains in place and was typechecked, not executed here.
- The root fixture delays SQLite/host imports and declares an explicit Node24 capability suite so default Node22 discovery can skip that suite; the dedicated source configuration requires Node24.11+ and the reported 31 cases actually executed on that runtime. This worker did not run a Node22 skip check.
- Filesystem/process/network/server negatives are unsupported-policy fixtures at the actual Todo host validation seam. No such capability/backend, OS confinement, path/symlink, redirects, process tree, MCP connection or paid/live provider behavior was implemented or claimed.
- No historical database migration/backfill, permission dashboard, root/child runtime scheduler or automatic repair/replay of old approvals was added.
