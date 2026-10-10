# Independent R1/R2 review handoff — 2026-10-10

## Scope and known integration work

Review all current R1/R2 owner/recovery, per-output provenance, bounded finishing and read-only claim review changes against their artifacts, preserving in-flight R3/R4 ownership. Finish known runtime catch integration: preflight validation/preparation `toolFailureResult(cause,"not_started")`; execution after persisted-completed/pending paths uses `rolled_back` for proven `AtomicToolRollbackError`, `not_started` for reads, otherwise `unknown`. Keep uncertain write/network status unknown and no serialized success-like result. UI decoder must expose typed recovery using the normal process-details surface, without automatic retry or extra approval bypass. Original tool arguments/envelopes stay unchanged.

## Fixture repair requirements

Use [terminal fixture inventory](2026-10-10-terminal-fixture-followup.md). Update each fixture to its actual intent and real protocol envelopes, including the one optional execution self-check and one zero-tools read-only review. Never disable all new behavior simply to recover old request counts. Assert original opaque Responses artifact identity/order, immutable approvals, zero paid replay, same segment budget and aggregation of actual new metrics. Final reviewer answer never enters public prose or tool continuation. Advice-only still has no business writes.

D05 original catalog/source snapshots are immutable historical artifacts. Register only explicit intended deltas for optional owner/project resolution, resultKey source schema/descriptions, and later newly registered R3/R4 tools; assert unaffected advertisements/parsers/diagnostics strictly. Never overwrite snapshots or allow all differences.

## Existing generated-file mismatch

E06 data matches installed publisher metadata exactly (101 model and 131 provider mappings, pinned package 5.18.0 and rendering hashes pass), but `cfead49f 更新trellis` reformatted the generated file from generator 2-space output to 4-space output. The byte assertion fails solely on formatting. Verify full AST/data and generator contracts; restoring generator output is a justified local fix, no dependency or provider mapping change. Keep strict stale detection.

The dev server regenerated `src/routeTree.gen.ts` formatting only. Root verified both original/current have identical 3995 TypeScript scanner tokens. Root will stop the server and restore canonical HEAD generation after browser acceptance; no route change is required.

## Evidence and constraints

Use explicit local pnpm 9 path and `exec vitest run FILES --maxWorkers=4`. Coordinate shared source changes with R3/R4 workers; do not run overlapping full suites/gates while they implement. Full scope lint/quality/test/build gates follow once implementation settles. Record meaningful review findings and fixes; native browser/model/vendor/mic acceptance remains separate and must not be certified from mocks.
