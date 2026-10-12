# Implementation activation and change boundary

Date: 2026-10-12. Final planning summary approved by the user's subsequent "开始吧". Branch codex/desktop-release-pipeline created from main92bb6d4120053453036fbdb1b3b8f23fb9c56385; task.py start changed planning to in_progress. Local pnpm was verified at the explicitly approved machine path, version10.15.0. No remote operation, secret access or Release publication is authorized by activation.

## Smallest behavior gap

The complete normal SQLite/files product currently builds through a Mac-only app harness and has confirmed Unix/origin assumptions. It must build and verify four native targets/five installers, then collect only their exact successful payloads into a draft release. Reuse existing UI/business/Agent and storage commands; no independent desktop implementation or legacy-data migration.

## Ownership

- release_native_files: paths/stat/identity/reparse/link/persistence and shared filesystem callers, Rust regression tests, narrowly pinned Windows dependency. Preserve Unix behavior; Windows follows the subsequently reviewed owner-approved process-recovery contract; unsupported identity/file-flush outcomes remain fail-closed and actual host proof is pending.
- release_runtime_smoke: desktop runtime exact origin/trusted profile directories and external production-UI/disk smoke runners. No embedded acceptance/backdoor in public product.
- release_tools_pipeline: tools/probe/build policy, bundle config, package/CI/artifact collector/draft publisher and meaningful failure tests. Coordinate smoke/policy interfaces with runtime worker.
- Root: task/spec/docs, integration review, final quality/actual local bundle checks, independent Trellis check, concrete commit plan and owner activation coordination.

Workers are concurrent in one checkout. Ownership excludes peers' files; shared edits require coordination. Each worker reads injected context or loads the curated manifests/artifacts before editing. No worker commits, pushes, starts paid calls or manipulates existing user data. Cargo/application full builds are coordinated to avoid competing final-source evidence.

## Boundaries and verification

Local source/helpers may be implemented as candidates before H1a. Actual Windows/Linux/API/installer outcome is never inferred from Mac tests, documented APIs, mocks or compile-only checks. No dummy file identity, silent barrier no-op, IndexedDB fallback or weakened certainty is permitted. If preserving the storage contract requires a design change, record the concrete alternative and request review while independent work continues.

Required local refactors are tool/native-stat boundary changes; compare retained Unix tests/receipts and source contracts. Full root/native gates run after edits stabilize. C0 approved work commits precede owner bootstrap push; H1a proves four-host packaging/runtime, H1b proves real tag/draft delivery. Archive/journal completion follows actual required criteria, not merely a local green batch.

## Subsequent owner-reviewed Windows decision

The owner selected “采用这项保证，继续 Windows 测试包（推荐）” after reading the concrete native-files-implementation.md alternative. Regular-file bytes/metadata flushing, NTFS no-overwrite publication and intent/SQLite process-termination recovery are approved. Sudden OS crash/power-loss namespace persistence is explicitly unpromised. Unix directory fsync is unchanged. This is a recorded product-contract choice, not corresponding-host evidence.

## Necessary scope follow-through

The reviewed Windows protocol needs mechanical namespace_checkpoint call updates
in all current Rust consumers (including full_product_store/mod.rs and retained
desktop/acceptance), writable verified backup file flushing, and retained export
post-publication messaging. The native owner handles filesystem/backups and
mechanical callers in coordination; runtime owner handles desktop publish_bytes,
the closed normal Save fileSync code, src/lib/nativeSystemServices.ts and
nativeWorkspace.ts error transport plus meaningful existing tests. No new
business/Agent recipes or reference DTO redesign is included.
