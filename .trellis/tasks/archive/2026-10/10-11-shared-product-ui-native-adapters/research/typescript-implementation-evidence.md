# Shared renderer implementation evidence

Implemented by the TypeScript adapter owner on 2026-10-11. No commits, archival, or pushes performed by this sub-agent.

## Contract

- `src/domain/videoWorkspace.ts`: canonical shared Project/Episode/StoryBeat/Shot projection and capability/undo action contracts.
- `src/lib/videoWorkspaceRepository.tsx`: one runtime-selected repository; browser commands delegate to existing Dexie transaction owners, native commands delegate to closed SQLite actions. Existing shared page consumers now request the same domain rows and command names.
- `src/lib/nativeWorkspaceContract.ts`: closed schema 4 Zod schemas for all native rows and outcomes. Both product adapter and acceptance bridge import these schemas. Invalid replies are rejected before updating generation.
- `src/lib/nativeWorkspace.ts`: native request serialization and opening singleflight. Native state/video reads wait for the opening barrier, conflicting mutations become the shared `DraftConflictError`, without automatic retry of writes.
- Native create-project and add-shots use single atomic backend actions. Native partial patches carry field baselines only for edited fields. Derived aspect dimension baselines use the original preset.
- Native delete/reorder/bulk/duplicate operations use backend-issued inverse receipts. UI closures capture distinct receipts; snapshot adapter inverses bind receipts by object identity through a WeakMap, avoiding selection-key overwrite.
- Native internal shot order is zero-based; canonical product shot order is one-based. Projection and insertion adapter conversion are covered.
- Present optional clear keys are translated to explicit null before IPC. Omitted fields remain omitted.
- Native queries bind values to dependency identities, discard stale async completions, retain last same-owner values, and report errors per query token. One successful query cannot erase another reader's error.
- `useShotMedia`/`useMedia` retain browser query semantics and gate native callbacks before Dexie access. Native media capability is currently unavailable, so no browser media lookup occurs in the native runtime.
- Root `knip.json` now declares the actual acceptance bridge consumer so shared contract exports are checked across the package boundary.

## Verification

- Root TypeScript lint: passed after adapter completion.
- Root quality: passed with 0 new failures, 0 architecture cycles, 0 unused failures.
- Desktop types/lint/quality: passed.
- Targeted native adapter, shared page consumer, and concurrency tests: passed.
- Added real repository tests for browser command and conflict preservation, native snapshots with no Dexie reads, edited-field baselines, conflict error conversion, distinct inverse receipts, atomic shot insertion with order conversion, derived aspect baseline, native capability reads without stores, and strict malformed response rejection.

Final aggregate command results and packaged app validation are owned by the parent session after backend and independent review complete.

## Final renderer gate (14:04 UTC+8)

- `pnpm exec vitest run`: 193 test files passed; 3384 tests passed, 1 skipped.
- `pnpm quality`: PASS (all); 13 reviewed lint allowances, 563 review warnings, 0 failures; 451 architecture files, 1823 static edges, 0 cycles; 0 unused failures.
- Root lint and desktop types/lint/quality passed after final wire schema 4 alignment.
- Targeted adapter/page/concurrency tests passed after the final aspect baseline, nullable clear, duplicate receipt, and order conversion fixes.

## Final review repairs (14:18 UTC+8)

- The product adapter now validates each action's expected outcome kind before advancing generation. Recognized but wrong kinds and canceled writes reject instead of reporting successful persistence; ensure/import retain explicit cancellation behavior.
- Native rejection codes map to safe Chinese UI errors. Arbitrary backend messages (including paths) are not exposed in renderer error notices.
- Shot settings and episode filter mutations serialize their entire read/modify/write sequence by owner, retaining concurrent edits to different fields. A failed owner mutation releases the queue for the next operation.
- Added real async adapter/repository tests for wrong-kind/canceled-write generation behavior, safe errors, settings and filter interleaving, and mutation queue recovery.
- Targeted native adapter/repository suites passed after these repairs, and their source ESLint gate has 0 errors. The independent checker owns the final aggregate re-run after these changes.
