# Parent integration review

Status: **cumulative R1–R7 / AC1–AC6 integration review accepted within the explicit limits below.** All three implementation children satisfy their recorded source and behavioral contracts. Current root/application/package, independent SQLite/process, normal browser and complete real-native checks pass with independently rechecked current identities. The owner approved the exact work-commit and child/parent Trellis closure batch with “可以提交了”. Child-3 source/spec checkpoint is `928d723149b2f1bd7720edc8ee7becce74ef6f72`; task-document commit and bookkeeping follow. The parent remains a coordination task and performs no extra product implementation.

## Cumulative result

The repository now uses eight declared pnpm workspaces. `apps/web`,
`apps/desktop` and `apps/site` own their entries and builds. Browser and desktop
consume one shared `packages/studio` product. Studio groups nine business
features beside named app/platform/ui owners; quality enforces complete source
ownership and concrete cross-feature APIs. `packages/distribution` supplies
lightweight public identity/release metadata and assets without pulling the
product into the site.

`packages/agent-core` owns the actual reusable execution loop, tools, approvals,
checkpoints, capability loading, budgets and bounded compaction. Providers own
current Chat Completions/Responses and the single neutral HTTP mechanism
implementation. Studio supplies typed product policies, tools, current
credentials, authorized transport and its existing storage/transaction bindings.
The independent Todo CLI supplies a separate own-schema SQLite host and business
tools while using those same emitted public packages. This is private workspace
reuse; public package release and API stability are outside scope.

Accepted child-1 source checkpoint is `bb3a9580`; child-2 is `6a2927f0`.
Their archived authored verification records source/body/provenance evidence,
complete source consumer closure and finite historical/manual limits. Child 3
records its actual current contracts, findings and final execution in
`../10-15-reusable-agent-runtime/verification.md` and the independent whole-child
review. Earlier checkpoint hashes provide provenance; their input maps cannot
be relabeled as matching the later extraction.

## R1–R7 and AC1–AC6 mapping

| Requirement / acceptance | Current implementation and retained evidence | Integration state |
| --- | --- | --- |
| R1 / AC1: explicit applications | Child 1 app boundaries and shared Studio/Distribution; actual root and per-app commands, separate site and desktop assets. Child 3 prepares emitted Agent dependencies before real product consumers. | Accepted; final actual root/Web/Site/Desktop builds pass. |
| R2 / AC2: predictable business ownership | Child 2 complete original/current ownership map, nine named features, exact value/type APIs, app/platform/ui rules and no old lib/db replacement bucket. | Accepted; final current architecture covers 633 files, zero static cycles/failures. |
| R3 / AC3: neutral reusable Agent | One actual core loop and compaction algorithm, typed host ports/factory, explicit public ESM/declaration exports, no Studio/UI/storage/runtime dependency. | Accepted; actual Node 22 package scripts and strict outside-workspace packed ESM/types pass. |
| R4 / AC3: reusable protocols | One Chat/Responses implementation with exact opaque continuation, one bounded HTTP/SSE/error owner; product materialization/credentials/native policy stay Studio-owned. | Accepted; actual provider scripts and complete root tests pass with retained protocol/privacy assertions. |
| R5 / AC4: preserved product behavior | Existing ProductStore/schema and domain/evidence/result transaction, actual held execution capability, conditional claim and sole terminal writer. Original current product regressions retained. | Accepted; normal built browser, complete root and fresh complete real-native ALL pass; schema/protected inputs match. |
| R6 / AC5: independent durable consumer | Own Todo schema/services, real SQLite lease/CAS, actual processes/SIGKILL/reopen/zero-request recovery/explicit resume and unknown non-replay. Public packed runtime/declarations with no source aliases. | Accepted; final offline installed consumer passes all 19 SQLite/process cases, zero skips; unchanged 384 inputs are independently checked. |
| R7 / AC6: complete discovery/delivery/docs | Eight-workspace inventory, precise compiler/lint/architecture/Knip/test/native inputs, source/provenance/release paths, Docker manifest closure, Node22 shared/Node24 example CI, packaging-only desktop delivery and actual package/spec/README documentation. | Accepted; complete quality/build/docs/native discovery and all-receipt/current-input binding pass. |

## Final execution and input identity

Child-3 current freeze captures 1665 nonignored inputs at
`2026-10-15T06:31:04.519244Z`, SHA-256
`bfaec0d3abd97312f077be275cdb467d421142b3e5a3c3a60c4550a3b78d86fe`.
Final Node 22 quality binds 1343 inputs, SHA-256
`81c820b45edbf66dbc19e6ab791390c2ab0a22ee4f67cf05eb35c539c59dcac7`.
The complete root rerun after the final native-test seam repair passes
292 files / 4693 tests (one existing skipped file/seven existing skipped tests).
Actual package/app builds, site budgets, 120 Rust cases, two parity cases and
99 release cases pass. The outside-workspace packed consumer passes 19/19
SQLite/process cases. Normal built browser acceptance passes six normal and
four Agent scenarios, using eleven local model POSTs; all 1343 source and 625
Web output hashes match before/after/current.

The first full root, Desktop launcher-test and native transaction-spy failures
are retained separately with their narrow repairs in the child verification.
They are not passing evidence or predecessor baseline failures. The fresh full-native terminal result, complete tool/table/owner
assertion coverage and independent current-input binding now pass. Unchanged earlier
successful commands are retained only when their actual captured inputs and
emitted artifacts remain identical.


Complete real-native ALL passes **123 files / 1932 tests**, with six self-hosted native and five browser-only additional cases, zero failures/skips. Coverage has all **95 tools / 50 tables / 31 command/assertion groups** and six empty missing arrays. The actual current probe and **1394 before/after native inputs** match. Main's final binding `/tmp/cuepoint-agent-final-input-binding.json`, SHA-256 `81d7529d9df1020e1879f60e11dcbaf63a8d44b1ffa08b4f89b88e560433c889`, confirms all source/config/package maps, all 625 browser outputs, 99 protected files and the sole product schema without drift; the independent checker confirms the same final scope. Detailed receipt paths, exact failed-attempt repairs and AA1–AA5 witnesses are in the child verification. No raw log or temporary executable is retained in the repository.

## Finite boundaries

Accepted historical E03/B01/E04 comparator failures and default two-worker
native deadline limits remain explicit in the child records. Current semantic
acceptance uses real SQLite and existing original deadlines/instrumentation;
any one-worker scheduling override does not claim default-two-worker success.
Normal browser UI and real SQLite process acceptance do not prove packaged
WebView/manual OS Save/reopen, every host/platform, microphone/decoded playback
or paid-provider availability. Docker/CI source closure is not a remote CI or
image/deployment run. No push, publication, hosted dispatch, tag or deployment
is part of this work.
