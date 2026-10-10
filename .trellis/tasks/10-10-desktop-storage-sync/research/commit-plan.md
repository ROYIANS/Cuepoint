# Storage foundation commit and archive plan

Status: one-shot commit/archive confirmation received on 2026-10-11; executing the approved sequence. The simultaneous original-tool-history decision is recorded in the already listed parent PRD/design/implementation/research files as a follow-on production-codec requirement; accepted product source is unchanged.

## Scope and acceptance

Commit only the accepted browser managed-copy foundation and explicitly partial `cuepoint.protocol-fixture.v1` checkpoint/provider protocol, their permanent tests, specifications and recorded planning/review evidence. Native SQLite/filesystem migration, all 49 production codecs, real service integration and user-facing synchronization remain parent gates.

Final verification: 188 test files / 3,355 passing tests / one existing skip; 127 affected regressions, 71 permanent protocol/provider cases, 27 independent adversarial probes; application and extra strict test types, build, serial quality, 88 quality self-tests and model-bank verification passed. No new quality allowance was added. Existing large-chunk and visible review warnings remain. Earlier failed sources/logs are intentionally retained as provenance; accepted evidence is named `quality-repaired-final-*` and `independent-quality-repaired-*`.

## Branch and file classification

- Branch: `codex/desktop-storage-sync`.
- Base and current HEAD: `8b8b709e85b390e2c4f68cc8e931487703ab9144`.
- Included: 6 product files, 11 test/fixture/config files, 3 specification files and 120 task/research/evidence files (140 total).
- All included paths were authored by this session coordinator or its explicitly assigned implement/research/check agents. No unrecognized change is included.

## Work commits in order

### 1. feat(storage): add managed workspace import foundation

- `src/lib/media.ts`
- `src/lib/productionRevision.ts`
- `src/lib/sha256.ts`
- `src/lib/workspace.ts`
- `tests/fixtures/workspace/originalProductionRevision.ts`
- `tests/helpers/workspaceBinaryFixture.ts`
- `tests/workspace.test.ts`
- `tests/workspaceArrangementFixture.test.ts`
- `tests/workspaceBinaryFixture.test.ts`
- `tests/workspaceChunkCopy.test.ts`
- `tests/workspaceHashCompatibility.test.ts`

### 2. feat(sync): add immutable checkpoint provider contracts

- `src/lib/checkpoint.ts`
- `src/lib/syncProvider.ts`
- `tests/checkpointProtocol.test.ts`
- `tests/helpers/checkpointProtocolFixture.ts`
- `tests/syncProvider.test.ts`
- `tests/typecheck/tsconfig.checkpoint.json`

### 3. docs(storage): record sync design and verification

- `.trellis/spec/frontend/checkpoint-protocol.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/workspace-storage.md`
- `.trellis/tasks/10-10-desktop-storage-sync/check.jsonl`
- `.trellis/tasks/10-10-desktop-storage-sync/design.md`
- `.trellis/tasks/10-10-desktop-storage-sync/implement.jsonl`
- `.trellis/tasks/10-10-desktop-storage-sync/implement.md`
- `.trellis/tasks/10-10-desktop-storage-sync/prd.md`
- `.trellis/tasks/10-10-desktop-storage-sync/research/checkpoint-contract-research.md`
- `.trellis/tasks/10-10-desktop-storage-sync/research/commit-plan.json`
- `.trellis/tasks/10-10-desktop-storage-sync/research/commit-plan.md`
- `.trellis/tasks/10-10-desktop-storage-sync/research/coordinator-verification.json`
- `.trellis/tasks/10-10-desktop-storage-sync/research/data-inventory.md`
- `.trellis/tasks/10-10-desktop-storage-sync/research/file-authority-and-media-availability.md`
- `.trellis/tasks/10-10-desktop-storage-sync/research/local-workspace-and-plugins.md`
- `.trellis/tasks/10-10-desktop-storage-sync/research/native-runtime-candidates.md`
- `.trellis/tasks/10-10-desktop-storage-sync/research/provider-comparison.md`
- `.trellis/tasks/10-10-desktop-storage-sync/task.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/check.jsonl`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/design.md`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/implement.jsonl`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/implement.md`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/prd.md`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/async-boundary-retrospective.md`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/final-build.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/final-full-tests.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/final-model-bank.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/final-quality-self-test.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/final-quality.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/final-targeted-tests.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/first-freeze-source/checkpoint.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/first-freeze-source/checkpointProtocol.test.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/first-freeze-source/checkpointProtocolFixture.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/first-freeze-source/independent-probes.test.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/first-freeze-source/independent-vitest.config.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/first-freeze-source/syncProvider.test.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/first-freeze-source/syncProvider.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/first-freeze-source/tsconfig.checkpoint.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/full-tests.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/implementation-notes.md`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/implementation-source-manifest.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-check.md`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-final-after.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-final-before.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-final-lint.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-final-probes.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-final-regressions.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-final-source-manifest.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-final-strict-types.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-first-freeze-after.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-first-freeze-before.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-first-freeze-cas-shape.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-first-freeze-probes.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-first-freeze-vitest.config.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-probes-frozen-draft-source.ts.snapshot`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-probes-frozen-draft.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-probes-provisional-2.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-probes-provisional.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-probes.test.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-provisional-frozen-run-after.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-provisional-frozen-run-before.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-provisional-source-manifest.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-provisional-vitest.config.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-quality-repaired-after.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-quality-repaired-before.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-quality-repaired-lint.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-quality-repaired-probes.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-quality-repaired-regressions.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-quality-repaired-strict-types.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-review-ledger.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-second-freeze-source-manifest.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-tsconfig.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-vitest.config.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/initial-implementation-source-manifest.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/post-gate-source-verification.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/pre-quality-repair-source-manifest.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/provisional-checkpoint.ts.snapshot`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/provisional-source/checkpoint.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/provisional-source/syncProvider.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/provisional-syncProvider.ts.snapshot`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repair-lint-after.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repair-lint-diagnostics.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-build.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-full-tests.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-gates.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-lint.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-model-bank.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-quality-self-test.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-quality.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-strict-test-types.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/quality-repaired-final-targeted-tests.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/review-plan.md`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/second-freeze-source/checkpoint.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/second-freeze-source/checkpointProtocol.test.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/second-freeze-source/checkpointProtocolFixture.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/second-freeze-source/syncProvider.test.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/second-freeze-source/syncProvider.ts`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/second-freeze-source/tsconfig.checkpoint.json`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/targeted-tests.log`
- `.trellis/tasks/10-10-storage-checkpoint-plugin-foundation/task.json`
- `.trellis/tasks/10-10-storage-workspace-foundation/check.jsonl`
- `.trellis/tasks/10-10-storage-workspace-foundation/design.md`
- `.trellis/tasks/10-10-storage-workspace-foundation/implement.jsonl`
- `.trellis/tasks/10-10-storage-workspace-foundation/implement.md`
- `.trellis/tasks/10-10-storage-workspace-foundation/prd.md`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/implementation-notes.md`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-check.md`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-final-lint.log`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-final-manifest.json`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-final-targeted.log`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-final-test-types.log`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-generated-route.json`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-probes/post-fix-observations.json`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-probes/post-fix-probe-output.txt`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-probes/post-fix-review-probe.test.ts`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-probes/pre-fix-observations.json`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/independent-probes/pre-fix-review-probe.test.ts`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/repair-model-bank.log`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/repair-quality-self-test.log`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/repair-quality.log`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/repair-source-manifest.json`
- `.trellis/tasks/10-10-storage-workspace-foundation/research/retained-owner-contracts.md`
- `.trellis/tasks/10-10-storage-workspace-foundation/task.json`

## Excluded change

- `src/routeTree.gen.ts`: external user-owned WebStorm Vite/TanStack generation reapplied formatting. The current SHA-256 matches the independently reviewed 3,995-token-equivalent file. Keep it outside all work commits and preserve the user development server. Exact proof is in the workspace child `research/independent-generated-route.json` and parent `research/coordinator-verification.json`.

Unrecognized paths: none.

## Bookkeeping after work commits

1. Archive only the accepted `10-10-storage-workspace-foundation` child, creating its archive commit.
2. Archive only the accepted `10-10-storage-checkpoint-plugin-foundation` child, creating its archive commit.
3. Retain `10-10-desktop-storage-sync` as in progress and restore it as the active task.
4. Record the session journal using the three work-commit hashes; create the journal commit.

This is a local commit/archive plan; remote push remains with the user. Do not amend. Task acceptance/commit/archive notes may be updated as bookkeeping; no additional product scope is approved by this plan.

## Confirmation gate

Project `.trellis/workflow.md`, Phase 3.4, explicitly requires: "Present the plan once, ask for one-shot confirmation". A single approval covers the three work commits and this child-only archive/journal sequence. The exact machine-readable path groups are in `commit-plan.json`.
