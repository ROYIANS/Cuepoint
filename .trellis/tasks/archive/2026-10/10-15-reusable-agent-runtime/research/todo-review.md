# Independent Todo consumer review

Status: **accepted as an incremental slice**. The independent host, real-process
recovery and isolated packed-consumer evidence satisfy this slice's contracts.
This is not whole-child acceptance: the final frozen root/application gates,
ordinary browser/Agent UI checks and complete native lane are separate evidence.

Final-freeze note: the successful 19-case report below is the accepted
**pre-format incremental receipt**. Three core files subsequently received
whitespace-only repairs before the whole-child freeze. Their source hashes and
build receipts changed; the old 384-input map is not a current-final-byte claim.
The final isolated-consumer run will supersede this byte binding. Its semantic
and process findings remain the accurately bounded slice evidence described here.

The checker reviewed product/tooling read-only. The implementer made the fixes
below; the checker did not modify product, tests, configuration or specifications.

## Actual implementation and ownership

- `examples/agent-todo/src/store.ts` owns seven independent SQLite tables and
  the sidecar ownership database. The lifetime `BEGIN IMMEDIATE` lease uses a
  separate connection from short business transactions. An actual live process
  excludes a second process, and SIGKILL releases the kernel-held lease.
- Run writes use an SQL predicate on both the expected owner and revision.
  `attach` explicitly compares the previous owner. Execution rejects concurrent
  entry; `close` rejects an active execution and therefore retains its lease.
- `host.ts` calls the emitted public core `executeRun`. It supplies semantic
  persistence/claim operations and a deterministic model, not another copy of
  the generic loop. The current transaction revalidates expected call bytes,
  status, metadata, permissions and recorded offered tools before execution.
- Concrete Todo services use the host's run scope. The real foreign-scope
  negative has an eligible running `complete_todo` call and reaches the scoped
  SQL update; it is no longer rejected merely because its call is missing.
- Local business mutation, evidence, serialized result and completed-call state
  share one SQLite transaction. Abort and serialization/evidence failure roll
  back all of them. A post-COMMIT exception reads the durable completed result
  instead of repeating the mutation.
- External intent precedes deterministic dispatch. An unknown external outcome
  remains unresolved after recovery, with one persisted dispatch and no replay.
- Summary jobs precede dispatch. Activation rereads the saved job/status/body,
  expected run revision/base and actual history prefix in the transaction.
  Completed summary records cannot subsequently be overwritten as failed.
- The host reuses core parser/factory, approval, loading, 32-request segment,
  checkpoint, compaction and terminal decisions, and public provider
  continuation helpers. Its business schema does not import Studio.

## Findings closed by the implementer

| Initial finding | Final implementation / meaningful evidence |
| --- | --- |
| A revision increment alone did not reject stale clones. | `saveRun` now includes expected owner/revision in SQL and rejects a zero-row update; the stale-clone negative preserves the newer value. |
| Closing a store could release ownership during execution. | Active execution rejects `close` and concurrent entry; the live owner remains excluded until the original execution drains. |
| A pending Promise alone did not keep the ownership CLI alive. | The hold command keeps stdin active; the real second-process rejection and SIGKILL/reacquire test now exercises a genuinely live owner. |
| Reconstructed parsed arguments changed original wire formatting. | Envelope projection retains the saved argument string exactly; a spaced-wire case also completes a later run with distinct call IDs. |
| Fixed call IDs collided across successive runs. | IDs include the run identity; two completed runs in one scope have three distinct calls and the expected business rows. |
| Summary activation did not verify the current durable job. | It rereads running status and exact saved job/body plus revision/history/base, and a changed-job negative cannot activate. |
| The first process-death test stopped before a business tool. | A separate real SIGKILL test now stops after a completed mutation and a durable output checkpoint, then verifies reuse on explicit resume. |
| The scope negative failed before reaching business scope enforcement. | It now supplies an eligible real call, attempts the foreign scoped update, and verifies the foreign row and running call remain unchanged after rollback. |
| The isolated gate omitted consumed config/compiler identities and fixed one test filename. | Its before/after capture now includes own manifests/configuration, checker/producer/compiler/types, and it discovers all example `*.test.ts` files and corresponding emitted test outputs. |
| Dependency declarations did not alone prove one actual core instance. | A Node resolve hook records the provider's real core import; it equals the consumer's direct core realpath. |

## Isolated packed-consumer proof

Authoritative successful report for this slice:

`/private/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-agent-example-WADg0X/report.json`

- Report SHA-256:
  `390f2751c248907de4935c79bc420cb25b6bfd6c10b539511949669e2b2e1043`.
- Node `24.11.0`, pnpm `10.15.0`; all 13 recorded commands exited zero.
- The actual local tarballs install offline into an outside-workspace consumer
  with an independent empty package store. Packed manifests are validated
  before the local core override: providers require the packed core version
  `0.1.3`; core has no runtime dependency.
- Core archive SHA:
  `3af5bf3beb4112b899cac741b53dcae4085e24edef9c869c20556113fb660d83`.
  Providers archive SHA:
  `d54e112c780523732ab0cfd25c4addd5d1eeaf521872ed14571738df721aaab1`.
- Strict NodeNext compilation uses `skipLibCheck=false`, copied compiler/types
  and installed emitted declarations. The 186 listed compiler input paths are
  within the outside-workspace evidence directory. Public type negatives reject
  incompatible callback/preview/wire values and private source imports.
- Runtime imports resolve public ESM inside the installed tarballs. Private
  package paths and Studio/React/Dexie/Tauri imports fail. The provider-to-core
  realpath and direct-consumer core realpath are identical.
- Actual discovery currently finds one source test file,
  `examples/agent-todo/src/conformance.test.ts`, and maps it to
  `dist/conformance.test.js`. The runner derives this set from current files,
  rather than hardcoding this filename for future runs.
- The emitted outside-workspace suite passed **19/19 cases, zero skipped**.
  The checker read every current case and the real command log.
- At the incremental review, the report's **384 captured input hashes
  independently matched all current files**, with zero missing/changed inputs.
  Its before/after comparison also passed. The final-freeze note above explains
  the later formatting change and required final receipt replacement.

The committed-tool process case observes an actual completed call, one Todo and
a saved checkpoint before sending SIGKILL and awaiting process exit. Reopening
retains the exact result and partial output with the same request count. Only
explicit resume adds one request; it completes with one Todo and one persisted
function-call output. The independent summary process case likewise records a
running summary before death, opens with zero added requests, marks that job
interrupted and activates exactly one later summary after explicit resume.

## Type / quality cross-binding

The implementer executed root TypeScript successfully; its log is
`/tmp/cuepoint-todo-types-final.log`. The empty file is consistent with successful
`tsc`, but is not by itself an independent exit-code receipt. The isolated strict
compiler command above separately records an actual zero exit status.

The completed full-quality report is
`/tmp/cuepoint-todo-quality-second.json`, finished
`2026-10-15T05:55:03.198Z`, exit zero, SHA-256
`592581bc357539f9f5b589107850949f3fe934bf26045954969ad5e5a12d3be0`.
It records 633 architecture files, 2,508 static value edges, 10 literal dynamic
edges, zero cycles/failures; lint has 12 existing reviewed allowances and no
unreviewed failures; all 15 unused contracts match.

The checker independently compared both input maps: **135 shared entries have
identical hashes**. At that review the isolated report's full 384-entry map was current.
The 1,342-entry quality report predates two subsequently edited tooling tests,
`tooling/workspace.test.mjs` and `tooling/prepare-native-test-probe.test.mjs`.
Those two differences are explicit whole-child closure work; this earlier report
must not be described as a zero-drift receipt for the final whole workspace.

The checker subsequently reviewed the final synthetic-fixture fix: the quality
entry invokes artifact freshness only when the existing `workspacePolicy`
actually registers reusable public packages. The underlying freshness validator
was not relaxed. A real workspace missing its policy still throws; a registered
package missing an emitted output still fails. Node 22 prefreeze self-tests
passed 88 cases plus seven CLI/tooling tests; the four targeted fallback tests
also passed. The formal final freeze is
`/tmp/cuepoint-agent-final-scope/frozen-inputs.json`, captured
`2026-10-15T06:03:48.471868Z`: 1,667 hashes independently matched current files
with zero drift when the final pipeline started. These prefreeze checks do not
replace that pipeline's pending final quality/native/packed receipts.

## Current whole-child isolated closure

The slice report above is retained as historical evidence. The later current
Node 24.11.0 / pnpm 10.15.0 report is
`/private/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-agent-example-Y4XStB/report.json`,
SHA-256 `7dcecbb235f7887c17790ae1762c77dc9c95c0cf826d4dc31f37cda482235971`.
It runs all 13 recorded commands successfully and passes **19/19** actual cases,
zero skips. The checker read the real conformance output, including completed-tool
checkpoint SIGKILL/reopen/reuse, live-owner process exclusion, summary restart,
atomic rollback/late acknowledgement, expected-call authority and unknown external
non-replay. The actual runtime-export report observes identical direct and
provider core realpaths in the isolated installed tree. All dynamically discovered
example test sources are emitted and executed; currently this is one file.

The checker independently rehashed the report's **384 current inputs**, zero
mismatch, and compared its **135 common entries** with the latest whole-quality
report: every hash matches. Current whole-quality is
`/tmp/cuepoint-agent-native-repair-checks/quality.json`, SHA-256
`81c820b45edbf66dbc19e6ab791390c2ab0a22ee4f67cf05eb35c539c59dcac7`,
1,343 current inputs / zero drift, exit zero. The current core/provider archives
independently hash to `a03f19dfb982584f88d32794172a37eb8c02b6bcf6bf590970d9b671c65c5091`
and `8c1a384bafa6704d0e984db1dc848d3d44df72b620593d9a962615975983e810`.
These replace the earlier preformat/repair raw byte identities; they do not
relabel the original slice receipts as current. The separate complete real-native lane now passes 123 files / 1,932 tests plus
six self-hosted native and five browser-only cases; its final 1,394-entry
before/after/current identities are independently verified in
[independent whole-child review](independent-review.md).

## Finite acceptance boundaries

- The unreadable-confirmation case proves that an already committed effect is
  not automatically repeated. It ends in a non-resumable failure; it does not
  prove successful later resume after a confirmation-read fault clears. The
  separate completed-tool SIGKILL case proves successful known-result reuse.
- The monotonic-checkpoint/sole-terminal single-process case does not itself
  reopen SQLite, despite its current title. Actual reopen/output retention is
  asserted by the separate process-death cases described above.
- The model and external dispatch in this example are deterministic. Public
  HTTP protocol fixtures execute real provider entry points without paid calls.
- The pack proof uses local version-validated tarballs and a local override. It
  is not a registry publication/install claim or a complete clean-machine
  dependency installation of the original workspace.
- Docker/CI closure, all root/application checks, normal built UI behavior and
  the complete real native lane belong to the final frozen whole-child review.
