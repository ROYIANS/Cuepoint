# Checkpoint/provider foundation execution plan

Status: implementation and independent corrected-source acceptance complete on 2026-10-10; product commit recorded in task.json; archive follows the approved batch. All ordered work passed within the declared partial protocol-fixture boundary; exact failed and accepted gate provenance is retained in research.

## Ordered work

1. Implement pure strict manifest/canonical revision validation and the declared partial protocol-fixture codec. Reuse stable IDs, canonical workspace paths and incremental SHA-256. Keep protocol code separate from Dexie/UI owners.
2. Add bounded immutable preparation/download validation with explicit cancellation, complete binary/reference closure and defensive snapshots. No generic raw-record export API.
3. Add internal provider registry, capabilities, lifecycle, typed outcomes and immutable object/manifest/head-CAS orchestration. Use only disposable in-memory transport fixtures; no live network/provider UI or dependencies.
4. Define the validated application port and implement disposable two-device tests using independent supplied roots and an applied-revision ledger. Preserve stable record/revision identity and full required fixture bytes. Distinguish publication acknowledgement from application receipt.
5. Test reordered/duplicate/corrupt/truncated/foreign/path-traversing/unknown-format/missing-binary delivery; concurrent head publication retaining both versions; retry/cancellation/failure with unchanged local prepared/state evidence; defensive object mutation and no secret/runtime raw-field escape hatch.
6. Run targeted protocol and workspace tests, strict application and extra test type checks, complete suite, build, serial quality, quality self-tests and model-bank verification. Independently review actual boundary and failure paths after source freeze.

## Ownership and rollback

Prefer new modules `src/lib/checkpoint.ts` and `src/lib/syncProvider.ts` plus focused tests/helpers. Avoid changing the accepted importer, hash, database schema, existing owners or UI; ask the root coordinator if a shared helper change is needed. Parent artifacts/spec/lifecycle/commits remain root-owned. Reversible rollback removes isolated protocol modules and tests without touching user content. Do not stop user-owned development servers.

## Acceptance evidence

Record exact supported format/coverage, source hashes, verification commands/results and remaining native/full-codec/service gates under this child's `research/`. No fixture result can be described as real workspace sync or native crash recovery. User-approved parent scope authorizes this protocol child; no live deployment or production migration is included.
