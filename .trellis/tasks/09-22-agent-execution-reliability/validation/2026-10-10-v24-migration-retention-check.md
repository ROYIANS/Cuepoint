# v24 migration and E04 retention regression follow-up

The first coordinated full Vitest run is retained in `2026-10-10-full-vitest.log`: 180 files, 3220 tests, six failures across three files. This follow-up fixes those six test expectations without changing product code or immutable historical fixtures.

## Exact changes

- `tests/materialIntegration.test.ts` and `tests/productionProposals.test.ts` expect the delivered Dexie version 24. Their old database setup explicitly omits `audioGenerationBatches`, `audioGenerationBatchItems` and `audioArrangementProposals`; upgrade must create all three empty. Existing project/shot comparisons remain. The media migration assertion now also compares metadata, Blob MIME and exact byte arrays, not just size.
- `tests/fixtures/e04-media/retention.ts` identifies exactly one additive global `audioGenerationBatchItems` reference scan in the current implementation and none in the original scalar implementation. Current work is exactly `14 + 1 + 4 * distinctOwners`, independent of duplicated candidate count. The original `18 * size * 2` expectation is retained.
- `tests/fixtures/e04-media/commands.ts` identifies exactly one batch reference scan for each actual command and exactly one additional unindexed `audioGenerationJobs` dormancy-history scan only for `deleteChatThread`. The previous 14-pass current-reference control, the release conflict-read delta and four indexed history reads per owner remain explicit. No loose inequality or per-candidate scan allowance was introduced.
- An additive cancelled-batch clone-reference seed exercises independent retention, final-reference removal and same-outer-transaction freshness. Original current/history source lists and mixed-owner historical control stay intact. This adds two meaningful cases, taking the three focused files from 164 to 166 tests.

Changed test files: `tests/e04MediaRetention.test.ts`, `tests/materialIntegration.test.ts`, `tests/productionProposals.test.ts`, and current `tests/fixtures/e04-media/{retention,commands,seeds}.ts`. `tests/fixtures/sourceSnapshots/e04-media` has no diff; original source/provenance bytes were not edited.

## Verification

All commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`. No install, provider request, browser action, commit or archive.

- `exec vitest run tests/e04MediaRetention.test.ts tests/materialIntegration.test.ts tests/productionProposals.test.ts --maxWorkers=4`: 3 files / 166 tests passed.
- `lint` (`tsc -b --pretty false`): passed.
- `exec tsc -p tests/fixtures/e04-media/tsconfig.json --noEmit`: passed after narrowing the additive fixture's three discriminant literals. The earlier explicit fixture compile exposed those three widenings, which the application-only typecheck did not include.
- `quality --only lint --report /tmp/aifenjing-v24-migration-independent-lint.json`: passed, zero unallowed failures, 13 retained allowances and 541 visible review warnings.
- `git diff --check`: passed.

The main session owns the final full-suite rerun, native acceptance and final integration gates.
