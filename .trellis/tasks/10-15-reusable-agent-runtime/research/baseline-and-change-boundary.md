# Reusable Agent implementation baseline

Baseline HEAD is `c3bec9e96916c963840081919135e62663426bca` on `codex/reusable-agent-runtime`; it includes the accepted child-2 source checkpoint `6a2927f0`. Before implementation, the only modified/untracked paths are the parent/child task documents and this child's authored research. No production input is modified. Machine Node is `v24.11.0`; the explicit approved `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` reports `10.15.0`, matching the repository pin. Installed dependencies and immutable fixtures are retained.

The child-2 archived verification is the accepted technical baseline. Its authoritative post-format quality receipt has 1209 inputs and SHA-256 `c3a6e9202cb75e9d7dea1eb8a7324b1f61cf8264db2824e97d0cc6e627391f2e`; native ALL has 1256 inputs and SHA-256 `9346556ffe1b5f0e163edf49c898f292521654ee1f33467024f1f38d645c436f`, with 120 permanent files/1918 tests plus 6+5 additional cases, all coverage arrays empty. The complete 1612-input freeze is consistent with those receipts; native separately covers 15 ignored generated permission files. No redundant full baseline run is needed before useful implementation. Historical comparator and actual packaged-host limitations remain those recorded in the predecessor.

## Scope and ownership

`research/extraction-inventory.md` is the complete preimplementation source classification and conformance matrix: 59 current files, 11 semantic port groups and 16 preserved semantic cases. It remains the source for individual extraction decisions rather than a plan to move every file wholesale.

- `packages/agent-core` will define neutral execution/wire/tool contracts, the actual serialized checkpoint writer, two-pass pending-tool execution, bounded request loop, capability loading and context compaction mechanisms. It must not import Studio, product/storage/provider implementations or Node/browser runtime globals. Explicit AbortSignal, clock and host ports are contracts, not ambient environment access.
- `packages/agent-providers` will own the existing Chat Completions and Responses request/parsing/continuation mechanisms. Transport, current credentials, reasoning-policy validation and materialized product input are supplied per request. It depends only on core, and never resolves a saved connector or reads media itself.
- Studio retains the existing ProductStore/schema, creative tools/instructions/memory/project policy, request-time connector resolution, held coordination and semantic persistence/atomic tool adapters. Business writes, receipt validation, result serialization and completed ledger stay in the same existing transaction.
- `examples/agent-todo` owns independent Node SQLite tables/tools and uses the same actual core loop. Its explicit process checkpoint handshake, termination/reopen/resume and live ownership competition supplement shared conformance tests.

The implementer is the only production writer for this child, including necessary root/tooling/config/consumer changes. Main owns lifecycle and canonical spec/registration changes; checker remains read-only. No commits, publication, dependency upgrades, schema migration or unrelated behavior work is authorized here.

## Critical semantic boundaries

Studio's AgentRun has neither durable revision nor ownerId. The adapter must use a genuinely held coordination capability and current transaction predicates for the run/message/call/step/status; an invented checkpoint-derived ownership token is invalid. Semantic ports express owned reads, checkpoint, step admission, round/claim, approval, atomic execution/result append, compaction and one terminal commit. They do not expose arbitrary table CRUD or a callback that runs the former host loop.

The core chooses transitions. Successful atomic tools have already saved their original completion inside their business transaction; core must not overwrite it independently. Confirmed completion wins after a late throw, known rollback permits failure, and failed acknowledgement/outcome reads retain unknown certainty. External intent precedes dispatch and unknown submission never permits automatic replay. Recovery is ownership-guarded and makes zero model requests; explicit resume retains frozen inputs and permissions.

Checkpoint failure aborts streaming, sequence is monotonic, output flush precedes the single terminal writer, and late errors preserve already terminal work. The entire provider round and exact opaque continuation are durable before tools. Two preflight/execution passes enforce the full approval barrier; every execution candidate is freshly read and claimed. Segment budget is checked before context or auxiliary requests. Product policy hooks are named inputs/commits; no product fields or encrypted continuation enter public core events.

## Ordered checks and input coverage

The first slice includes real public exports/build closure and immediate registration of new package/example sources in workspace, TypeScript, ESLint, Knip, Vitest, quality and native input discovery. Cross-package roots must be accepted only when explicitly exported; traversal/private exports/core-to-product/provider-to-Studio imports must fail the actual CLI. Emitted ESM uses `.js` imports; builds must be ready before application/test/native consumption without permanent source aliases that hide dependencies.

Each checked slice reports its actual APIs, tests and unresolved limits to main/checker. Final full root/app/package/protocol/isolated checks precede an explicit final source freeze and complete native ALL with `VITEST_MAX_WORKERS=1`, original timeouts and internal concurrency cases. Heavy gates do not run alongside final native. Raw logs/hashes remain outside the repository; authored verification maps AA1–AA5 and the 16 conformance cases to actual results. Final formatting checks must include staged new files.
