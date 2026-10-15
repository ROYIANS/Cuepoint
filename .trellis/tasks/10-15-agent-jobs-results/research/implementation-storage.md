# E07 storage implementation and evidence

Storage implementation is frozen for the combined E07 review. No Git changes, builds, installation, paid calls, native execution, emitted-package validation or full-suite runs were performed by this owner.

## Actual command owner

`packages/studio/src/features/agent/models/agentJob.ts` defines the finite job, selection, observation, retained output, page and reader envelopes. `commands/agentJobs.ts` exports the actual consumed commands:

- `AGENT_JOB_LIMITS`, `AgentJobContext`, and `AgentJobAdmissionError`.
- `admitAgentJob(context, selection)` returns `{job, admitted, result?}`. Only an acknowledged `admitted: true` permits the producer to start. The original call is unique; duplicate admission or uncertain-ack reconciliation never grants a second admission.
- `markAgentJobRunning(context, id, revision, options?)`, `stopAgentJob(context, id)` and `checkpointAgentJob(context, id, revision, progress)` maintain acknowledged revisions and progress. Checkpoints allow replacing an already observed media finding without increasing completed count, and allow the held operation to drain while stopping.
- `publishAgentJob(context, id, revision, publication)` commits the terminal descriptor, retained chunks and bounded original `call.result` in one ProductStore write transaction. `publication.text` is optional for the canonical media report, but is required to be a string for `web_read`. No HTTP, file read or binary availability await occurs in a write transaction.
- `readAgentJob(reader, id, store?)`, `readAgentJobPage(reader, id, offset?, limit?, store?)` and `clearAgentJobResult(reader, id, store?)` share the authorization owner. `recoverAgentJobs(threadId, ownership, store?)` additionally requires an actual branded, still-held `ThreadOwnership` capability.

`AgentJobAdmissionError.kind` is exactly `'byte_quota' | 'job_limit'`. It classifies only an established quota/count refusal before producer execution. Storage read failures and unknown commit outcomes are not converted into that error. Fixed byte-quota guidance offers clearing results; finite metadata-count guidance offers deleting unneeded owning conversations/projects, because a cleared record still counts toward the finite row limit.

`AgentJobReader.original` is the exact original run/call pair used by the UI row. `reader.caller` is the current durable, running model reader call, which may be in a later run/call than the original job. Thread ID or job ID alone does not authorize a read. Original run/call/job relation, unchanged project relation and frozen call envelope are checked; current execution also checks the actual current step and offered tool set. Actual store failures propagate; only the command's private ownership/unavailable error becomes an unavailable result.

## Storage and publication invariants

Admission reserves 2 MiB against 16 MiB/thread and 128 MiB/global limits before production. Per-thread and global job counts are bounded at 128/1024, including small cleared records. Final publication accounts for actual retained UTF-8 bytes and releases unused reservation.

Original serialized results are at most 16,000 UTF-16 units with preview at most 8,000 units. New previews shrink until their complete JSON envelope fits. Publication freezes the four finite metadata fields before awaiting storage, copies the URL array and omits optional undefined fields, including the top-level absent metadata key. Thus the persisted descriptor has the exact same canonical shape as the original JSON completion. Retained text is bounded to 2 MiB; chunk offsets and pages use UTF-16 units and avoid splitting surrogate pairs. Reader pages contain at most 6,000 units and are bounded as complete JSON envelopes. A limit too small to include the next surrogate pair explicitly fails rather than returning an empty page with an unchanged cursor. Readback verifies the original completion descriptor, chunk ordering/offsets, lengths and UTF-8 byte counts before exposing text.

Completed original call results win late publication/reconciliation. Clearing retained chunks does not regenerate or rewrite that immutable original result. Clearing releases bytes, removes textual selection details/observations and leaves a small explicit cleared descriptor. Thread deletion and project deletion remove both job rows and chunks within their existing lifecycle transactions; late callbacks cannot resurrect a missing owner.

Typed unknown admission/publication attempts inspect durable state. A committed completion is returned exactly; an unreadable or unestablished completion preserves the original typed unknown error and grants no producer replay. Known transaction failure rolls back chunks, descriptor and original completion together. Existing running-tool cleanup marks an admitted unfinished job and its call unknown rather than applying the generic read-tool not-started classification.

The media producer persists only frozen textual metadata, not binary references. Admission validates selected media against actual bound-project ownership and metadata. Publication re-reads observed media metadata in the final write snapshot and changes a stale finding to `changed`. The same storage owner then produces the canonical complete report from the resulting observations and frozen selection, including every selected filename/ID, unexamined entries, confirmed completed count and the browser availability limitation. Thus preview, chunks and original result all describe the same final facts.

## Lifecycle integration

`commands/agentTools.ts` includes the job table in its existing cleanup scope. The matching `runtime/runChat.ts` guard scope adds that same table, avoiding a nested transaction that widens its root. The existing generation, atomic and generic cleanup behavior is retained for calls without jobs.

`runtime/runOwnership.ts` invokes recovery only inside an existing successful exclusive Web Lock. The command is imported through a finite literal dynamic import to avoid a static value cycle with the capability validator. Abandoned-run recovery preserves the existing `ifAvailable` busy behavior and creates a registered real capability only while the lock is held; forged and released capabilities fail. Recovery never dispatches producer/model/provider work. A web job marked service-may-have-run becomes unknown, and local media recovery publishes only acknowledged observations as a stopped report. Original remote generation recovery remains in its existing order and owner.

## Current registry and native boundary

Both job tables are registered in the actual ProductStore row types, TS/JSON schema, current browser declarations and native current registry. The existing `as const satisfies Record<TableName, TableDefinition>` schema inference is preserved; there is no registry-wide type widening. The job's original `callId` index is unique; chunk `[jobId+ordinal]` is unique. Browser current version is 26. Current native registry has 52 tables and SHA-256:

`867d327e86650f8df0464bef1e63975df895b0905afc703cb10932d6a2afc35e`

Fresh-development policy is applied. No historical 49/50-to-52 migration or backfill was added. The named 49-to-50 migration is pinned to its original target hash `3c897189ef6f71517c55c86b5d24b7f9cd0e1cfd88d1b916b46345662187eff0`; current 52 opening an old 49 workspace refuses before any migration write. The Rust source fixture now removes all three later tables to represent actual 49, and asserts rejection leaves its hash, table count and absence of `deviceSettings` unchanged. Those Rust tests were edited but were not executed or compiled in this phase.

Native acceptance manifests now list the three actual E07 suites and give each new table exactly one owner assertion pointing to the real publication/clear test. A read-only manifest check found 52 unique table anchors matching the current registry and all listed suite files present. This is discovery evidence, not native process execution.

## Focused source evidence

Final owner command:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/vitest/vitest.mjs run --config vitest.studio-source.config.ts tests/agentJobs.test.ts tests/storageRegistryHash.test.ts
```

Latest result at 2026-10-15 21:33:57 local: **2 suites, 15 tests passed** (14 actual ProductStore job tests plus current registry identity). This source profile used the ordinary browser ProductStore adapter with fake IndexedDB and the real command/transaction owner, not a Map replacement and not the native SQLite profile.

The focused cases cover duplicate admission/reservation; typed byte and count refusal; UTF-8 quota and UTF-16 page behavior; bounded output and exact full reconstruction; actual unique indexes; publication rollback; lost acknowledgement and failed reconciliation readback; original completed result after clear; foreign/current-reader ownership; parent deletion and late write rejection; forged/released recovery capabilities; media final metadata drift; and real read failure propagation. Two final regressions publish and page real reports with omitted metadata and with nested optional metadata fields set to undefined, and confirm descriptor tampering remains rejected by the exact integrity check.

Direct strict source noEmit also passed after the final descriptor fix and preserving the existing schema literal inference, using `node node_modules/typescript/bin/tsc -p tests/typecheck/tsconfig.studio-agent-source.json --pretty false`. During implementation, scoped ESLint over the 10 changed production TS sources passed with **0 errors / 4 existing-threshold complexity warnings**. Final combined source lint, finite regressions and architecture are assigned to the independent E07 checker, after all owners freeze, so these checks are not a claim that the latest whole-stage source has already passed every gate. One necessary loop integration failure (`Nested transaction cannot widen root`) was resolved by the exact guard-scope addition above; producer actual-loop regression is owned by the producer and combined checker. The final UI regression also found the own-undefined descriptor mismatch above; that was corrected at the production publication owner rather than weakening readback or changing UI fixtures.

## Frozen files

Owned production files:

- `packages/studio/src/features/agent/models/agentJob.ts`
- `packages/studio/src/features/agent/commands/agentJobs.ts`
- `packages/studio/src/features/agent/commands/agentTools.ts`
- `packages/studio/src/features/agent/commands/lifecycle.ts`
- `packages/studio/src/features/agent/runtime/runChat.ts` (one guard-scope addition)
- `packages/studio/src/features/agent/runtime/runOwnership.ts` (real held-ownership recovery integration)
- `packages/studio/src/features/projects/commands/lifecycle.ts`
- `packages/studio/src/platform/storage/tableTypes.ts`
- `packages/studio/src/platform/storage/schema.ts`
- `packages/studio/src/platform/storage/schema.json`
- `packages/studio/src/platform/storage/browserDatabase.ts`
- `apps/desktop/src-tauri/src/full_product_store/mod.rs`
- `apps/desktop/src-tauri/src/full_product_store/registry.rs`
- `apps/desktop/src-tauri/src/full_product_store/tests.rs`

Owned evidence/fixture files:

- `tests/agentJobs.test.ts`
- `tests/storageRegistryHash.test.ts`
- `tests/fixtures/shared-storage/nativeAcceptanceSuites.json`
- `tests/fixtures/shared-storage/nativeOwnerAssertions.json`
- This implementation note.

No additional `agentToolRecovery.ts` changes were needed. Other owners retain producer, UI, source-lane configuration, canonical specs, discovery, Git and final whole-stage review ownership.

Frozen key source hashes:

```text
22b2ae2cc462515f786c266a809722b5082e5f75fc2ac90ccee01434f2b27c31  packages/studio/src/features/agent/models/agentJob.ts
4578fe9b32072b90b94062e84095bc4df0b0b2ee1f14a17c83390da577a7f771  packages/studio/src/features/agent/commands/agentJobs.ts
9c387130ffdd1b92e6a0f732750f1fb9be8aa25794d449102dccb382f890fbb0  tests/agentJobs.test.ts
128799df32204b23c33e3e393d69e0206fa2dc658eb029029b74bfdb9d5b3d13  apps/desktop/src-tauri/src/full_product_store/mod.rs
c72b2be926a332fec7c1246f2a4e9d636ce11da9d0a41fbfa173a4ef2aa78479  apps/desktop/src-tauri/src/full_product_store/registry.rs
e9f99b6f5e8eaf6d00008e9a06ec79a0300b1b597f7a08c17a81ed73bd8a1aa3  apps/desktop/src-tauri/src/full_product_store/tests.rs
```
