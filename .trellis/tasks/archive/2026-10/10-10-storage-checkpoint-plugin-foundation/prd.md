# Checkpoint and sync-provider foundation

## Goal

Implement immutable validated checkpoint manifests and an internally registered sync-provider boundary with isolated transports. This child depends on accepted `10-10-storage-workspace-foundation`; its implementation must not begin until that child's corrected-source independent check passes. It does not imply live hosting or a full-workspace database application before per-table codecs are verified.

## Requirements

- Describe a portable checkpoint with stable workspace/revision identity, ancestry, schema version, binary hashes/sizes and declared partial record-format coverage. Initially support only the exact `cuepoint.protocol-fixture.v1` record format; no production table codec is implied. A project-copy ZIP is not an identity-preserving checkpoint.
- Keep transport publication, provider acknowledgement and device application as distinct observable outcomes.
- Provide an internal provider capability/lifecycle boundary that supports test transports without granting arbitrary database, secret-store or filesystem access.
- Validate input and binary integrity before any application callback. Repeated delivery must be identifiable, and a conditional publication conflict must preserve both versions.
- Require explicit, format-specific portable projections; do not export raw credential-bearing connector rows, opaque job results, approvals or active runtime owners.
- Use disposable fixture roots and transport stores. Preserve all actual per-table coverage gaps as gates before real workspace synchronization.

## Acceptance Criteria

- [x] Two isolated fixture devices preserve the same checkpoint identity while using independent local roots.
- [x] Corrupt, truncated, foreign-workspace, path-traversal, unknown-schema and incomplete-binary checkpoints are rejected before application.
- [x] A provider acknowledgement is not reported as a device application receipt.
- [x] Conditional-head races retain both immutable versions and report a focused conflict.
- [x] Secret/runtime-bearing raw records cannot silently enter an allowed portable format.
- [x] Failure or cancellation preserves locally prepared work for the caller's retry/recovery policy.
- [x] The deliverable states the one supported partial protocol-fixture format, cannot claim full project/workspace coverage and lists the reviewed per-table codecs still required for actual full-workspace sync.

## Notes

Status: independently accepted on corrected and quality-repaired source on 2026-10-10; product commit recorded in task.json; archive follows the approved batch. The sole supported format is `cuepoint.protocol-fixture.v1`, schema 1, with partial single-project/media fixture coverage. No provider deployment, native packaging, real-user migration, marketplace or unrestricted plugin code belongs in this child.

Final evidence: 71 permanent protocol/provider cases, 127 affected regressions, 27 independent adversarial probes and strict application/test types passed. Full Vitest passed 188 files / 3,355 tests, with one existing skip; build, serial quality, 88 quality self-tests and model-bank verification passed. No quality allowance was added. See `research/independent-check.md`, `research/implementation-notes.md` and matching final source/gate manifests. Native durability, all 49 production table codecs, a real service and user-facing handoff/history/restore remain parent deliverables.
