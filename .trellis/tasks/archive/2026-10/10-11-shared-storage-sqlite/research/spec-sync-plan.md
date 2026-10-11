# Specification synchronization plan

This is a documentation change plan, not evidence that implementation or normal activation is already complete. Root owns the changes after current source contracts pass; workers retain product implementation ownership.

## Required owning documents

1. Add `frontend/shared-product-storage.md` with the complete seven-section executable contract: ProductStore / explicit StoreTx / table registry and local tagged codec; browser versus sole native owner; guarded unit of work / bounded prepare / durable operation certainty; precise observation and fresh startup; managed BinaryContent and verified byte/playback lifetimes; device classification and no raw database synchronization; actual required fixtures and limits.
2. Update `frontend/index.md` to point to the new contract and describe the current accepted owner only after normal SQLite activation. Retain all existing domain-specific business guidelines.
3. Update `frontend/native-product-runtime.md` storage selection, bootstrap, trusted profile, namespace and business transaction paragraphs/signatures/error matrix/tests. Preserve its accepted native HTTP, Save/publication-warning, external link and printing contracts. Keep the schema4 prototype an explicit reference lane, not a normal product fallback.
4. Update `frontend/workspace-storage.md` for browser Blobs versus native managed references, all3 carriers, local copy/hash stage and native atomic claim; distinguish existing lexical reference helpers from actual native containment. Preserve source independence, cancellation winner and incremental hashing.
5. Update `frontend/video-workspace.md` for the shared complete product repository on either adapter; remove normal owner-dependent reduced capabilities while preserving isolated prototype evidence and existing draft/undo/CAS contracts.
6. Update `frontend/hook-guidelines.md` current `useProductQuery(tx => ...)` and detail null/loading/error semantics, scope envelopes and exact query invalidation. Preserve E04 SS09 selected-owner/current-kind precision and existing editor/draft lifetimes.
7. Update `frontend/state-management.md` current persistence overview and explicit nested context rule, linking the new complete contract. Preserve its detailed business command ownership, project/episode scope, field baselines, immutable snapshots, cascades and undo invariants. Historical browser migration descriptions remain historical adapter context, not a requirement for native migration.
8. Update `frontend/quality-guidelines.md` current test lifecycle, real-native business lane and fixed-owner tests. E07 policy remains authoritative; no blanket lint exceptions or source-snapshot rewrites are authorized.

## Knowledge that must survive this task

- A native acknowledgement parser failure happens after a possible COMMIT; it is uncertain until durable status confirms the outcome. Only a confirmed rollback may become AtomicToolRollbackError. Unknown confirmation never permits mutation or paid replay.
- Optional StoreTx must be passed through callback contexts, previews, nested commands and receipt reads. Merely appending a parameter to exported functions does not join a transaction.
- Metadata size, a binary reference, an object URL or a decoded audio cache does not establish current byte availability. Preserve logical records while missing/corrupt bytes fail actual consuming operations.
- Immutable original/current comparison fixtures stay byte-identical and use their explicit raw browser comparator adapter; new shared production interfaces must not silently alter original comparator semantics.
- Old root-table spies do not necessarily intercept new transaction-bound table handles. Fault tests must target the actual adapter mutation or explicitly raw browser hook and retain rollback assertions.
- Business music variant/draft associations belong in durable product records and package ID remapping. Old localStorage association data is not imported; session-only UI preferences may stay local.
- Test inventory counts, source anchors and previously accepted native/provider logs are not proof of this new SQLite build. Consolidated table/domain/tool/binary matrices must link actual current-source runs.
