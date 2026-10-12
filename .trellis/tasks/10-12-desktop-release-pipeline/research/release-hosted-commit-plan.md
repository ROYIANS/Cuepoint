# Hosted native correction: complete local work-commit plan

Status: owner approved this exact five-group plan with “提交吧，我试试”. The first four source groups are committed below; the fifth documentation group records the checkpoint. No push, merge or remote mutation occurred.

Branch: `codex/release-hosted-native-failures`. Baseline: `946664ab235e0996da138796bd7d364381dab6ab`.

## Concrete scope and verification

The complete dirty inventory is **492 paths**, **0 unrecognized**. All source edits are assigned to named implementers; root owns task/spec/evidence grouping, and the independent check has frozen its result. No preexisting/user edit is silently included. The current fourteen source paths are reviewed; final gates preserve 1,016 source hashes.

[Final validation](release-hosted-final-validation.md) records all eleven passing sequential gates: ordinary3,965 tests; actualSQLite1,910 tests plus6native/5browser;95tool outcomes and49table/business assertion anchors; types/quality/release64 and normal/acceptance frontend builds. Unchanged Rust fmt/Clippy/both-feature full tests/portable and self-test/model evidence are reconciled by source hash. [Independent review](release-hosted-native-check.md) confirms those outcomes and the original fixture/deadline invariants. Original failures remain in separate finite evidence directories.

Four oversized original JSON receipts are retained in byte-exact deterministic gzip, with raw/compressed SHA256 and verified restoration in the evidence compression manifest. No event is removed or final result substituted for an original failure. Generated local bundles, tools, binary probe, saved fixtures, profiles and installers under ignored directories are excluded. All included paths are ordinary files.

This plan authorizes only the five listed local work commits after owner confirmation. It does not push, merge main, tag, dispatch Actions, mutate/publish a Release or archive the active task. Actual corresponding-host Windows/macOS Intel/Linux checks, installers and H1a/H1b remain pending. Re-running the old workflow uses its original source; verification of this correction requires a new owner-activated run at the new source.

## Proposed commits (in order)

### 1. `fix(desktop): bound frontend build heap in the actual Node child`

3 paths. Ownership: release_frontend_heap_implement.

- `desktop/tauri/scripts/build-frontend.mjs`
- `desktop/tauri/scripts/build-frontend-worker.mjs`
- `desktop/tauri/scripts/build-frontend.test.mjs`

### 2. `fix(native): pin Windows directories and close test resource owners`

4 paths. Ownership: release_windows_native_implement.

- `desktop/tauri/src-tauri/src/paths.rs`
- `desktop/tauri/src-tauri/src/paths/windows.rs`
- `desktop/tauri/src-tauri/src/product_binary/tests.rs`
- `desktop/tauri/src-tauri/src/product_media/tests.rs`

### 3. `fix(ci): preserve live native failures and cancellation evidence`

5 paths. Ownership: release_native_diagnostics_implement.

- `.github/workflows/desktop-release.yml`
- `desktop/tauri/scripts/release-native-checks.mjs`
- `desktop/tauri/scripts/logged-process.mjs`
- `desktop/tauri/scripts/logged-process.test.mjs`
- `scripts/native-storage-regression.mjs`

### 4. `fix(agent): avoid rereading terminal tool history`

2 paths. Ownership: release_agent_loop_cost_implement.

- `src/lib/agent/runChat.ts`
- `tests/agentTools.test.ts`

### 5. `docs(release): record hosted corrections and frozen local verification`

478 paths. Ownership: root task/spec/review evidence plus named implement/research/check workers.

- `.trellis/spec/frontend/agent-tools.md`
- `.trellis/spec/frontend/desktop-distribution.md`
- `.trellis/spec/frontend/shared-product-storage.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/check.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/agentToolsProfile.test.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/coverage/83200-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/coverage/tables-83200-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/instrumented-result.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/instrumented.config.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/metrics.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/nativeDatabaseProfile.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/provenance.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/baseline/vitest.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/browser-agent-corrected.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/browser-agent-final.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/browser-agent.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/agentToolsProfile.test.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/coverage/83371-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/coverage/tables-83371-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/instrumented-result.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/instrumented.config.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/metrics.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/nativeDatabaseProfile.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/provenance.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/vitest.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/original-loop-regression-red.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/original-loop.config.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/original-runChat.ts`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/sqlite-agent-coverage/84532-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/sqlite-agent-coverage/tables-84532-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/sqlite-agent-coverage/tables-84700-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/sqlite-agent-final.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/sqlite-agent-final.provenance.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/summary.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-research/provenance.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-cold-research/entry-load.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-cold-research/entry-load.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-cold-research/spawn-budget-probe.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-cold-research/spawn-budget-probe.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/acceptance-build.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/acceptance-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/acceptance-inputs-after.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/acceptance-inputs-before.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/acceptance-outputs.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/desktop-lint-recheck.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/desktop-lint-recheck.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/desktop-lint.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/desktop-lint.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/desktop-quality.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/desktop-quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/desktop-types.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/desktop-types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/launcher-tests-final.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/launcher-tests-final.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/launcher-tests-recheck.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/launcher-tests-recheck.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/launcher-tests.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/launcher-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/normal-build.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/normal-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/normal-inputs-after.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/normal-inputs-before.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/normal-outputs.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-frontend-heap-implementation/worker-extraction.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-evidence-compression.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/desktop-acceptance-build.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/desktop-acceptance-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/desktop-lint.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/desktop-normal-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/desktop-quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/desktop-release-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/desktop-types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/diff-check.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/receipt.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/retained-gates-current-source.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/root-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/root-quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/root-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/root-types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/run-final-checks.py`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/source-before.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/EVIDENCE.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/acceptance.json.gz`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/browserOnly-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/85540-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/85720-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/86019-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/86032-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/86367-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/86673-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/86694-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/86885-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/86981-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/87258-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/87342-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/87517-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/87523-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/87904-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/87997-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/88023-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/88103-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/88283-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/88285-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/88693-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/88715-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/88858-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/88881-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89045-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89155-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89173-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89510-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89627-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89753-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89759-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89827-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/89841-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90042-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90054-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90302-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90440-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90512-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90734-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90877-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90923-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/90978-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91017-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91047-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91215-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91304-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91354-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91374-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91433-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91737-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/91851-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-85539-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-85540-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-85720-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86019-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86032-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86248-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86367-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86622-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86673-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86694-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86885-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-86981-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87081-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87258-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87342-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87517-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87523-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87709-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87838-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87904-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-87997-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88023-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88103-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88213-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88283-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88559-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88693-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88715-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88858-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-88881-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89029-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89045-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89051-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89104-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89155-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89173-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89224-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89242-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89404-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89510-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89627-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89642-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89753-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89759-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89827-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-89841-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90042-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90054-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90102-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90132-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90160-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90236-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90273-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90302-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90343-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90385-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90440-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90474-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90512-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90565-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90636-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90638-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90683-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90734-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90788-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90790-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90877-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90923-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-90978-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91017-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91047-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91066-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91074-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91207-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91215-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91304-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91316-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91336-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91354-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91374-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91390-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91433-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91490-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91601-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91609-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91639-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91649-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91671-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91673-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91705-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91709-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91735-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91737-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91761-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91763-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91779-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91806-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91823-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-91918-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/coverage/tables-92119-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/native-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/probe-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/selfHostedNative-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent/sqlite-all/tool-and-table-coverage.json.gz`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/clippy-product-sqlite-test-hooks.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/clippy-test-hooks.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/desktop-lint.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/desktop-quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/desktop-release-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/desktop-types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/final-source-after.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/final-source-before.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/fmt-harness-path-attempt1.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/fmt.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/followup-checks.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/model-verify.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/portable.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/product-checks.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/quality-selftest.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/recheck-source-after.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/root-agent-focused.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/root-agent-focused.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/root-quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/root-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/root-types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/rust-checks.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/rust-harness-path-attempt1.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/rust-product-sqlite-test-hooks.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/rust-test-hooks.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-agent-focused.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-agent-focused.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/EVIDENCE.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/acceptance.json.gz`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/browserOnly-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/73583-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/74132-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/74192-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/74215-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/74862-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/75198-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/75587-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/75617-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/75903-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/75930-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/76310-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/76381-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/76499-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/76819-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/77147-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/77324-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/77470-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/77506-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/77629-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/77910-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78004-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78014-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78368-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78377-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78460-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78509-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78573-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78638-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78794-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78838-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/78980-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79112-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79145-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79233-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79306-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79344-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79390-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79525-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79672-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79834-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79909-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79941-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/79991-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/80087-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/80271-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/80329-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/80390-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/80629-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/80660-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/80782-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-73582-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-73583-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-74132-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-74192-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-74215-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-74533-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-74862-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-75198-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-75556-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-75587-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-75617-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-75903-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-75930-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-76091-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-76310-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-76381-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-76499-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-76726-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-76819-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-76921-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77082-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77147-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77324-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77326-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77470-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77506-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77579-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77629-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77656-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77910-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-77924-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78004-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78339-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78368-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78377-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78460-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78509-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78573-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78591-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78638-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78658-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78747-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78794-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78838-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78902-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-78980-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79046-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79112-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79145-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79233-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79235-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79306-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79344-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79390-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79421-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79518-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79525-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79571-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79606-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79613-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79639-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79672-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79698-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79768-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79773-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79834-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79858-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79898-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79909-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79941-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-79991-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80024-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80056-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80087-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80148-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80259-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80271-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80308-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80329-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80336-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80390-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80408-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80514-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80532-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80544-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80562-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80594-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80629-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80640-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80656-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80660-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80688-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80690-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80713-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80732-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80743-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80745-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80771-2.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-80819-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/coverage/tables-81003-1.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/native-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/probe-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/selfHostedNative-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/sqlite-all/tool-and-table-coverage.json.gz`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-native-check/agent-prior-comparison.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-native-check/final-readback.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-native-check/review-checkpoint.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/artifacts.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-macos-arm64-38208372156-1.zip`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-macos-arm64-38208372156-1/_temp/native-checks/normal-frontend.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-macos-x64-38208372156-1.zip`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-macos-x64-38208372156-1/_temp/native-checks/normal-frontend.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-windows-x64-38208372156-1.zip`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-windows-x64-38208372156-1/_temp/native-checks/native-0.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-windows-x64-38208372156-1/_temp/native-checks/native-1.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-windows-x64-38208372156-1/_temp/native-checks/native-2.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-windows-x64-38208372156-1/_temp/native-checks/native-3.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/desktop-diagnostics-windows-x64-38208372156-1/_temp/native-checks/normal-frontend.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/jobs.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/linux-check-run.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/logs_103516083991.zip`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/provenance.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/run.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-original/workflow-logs-103516083991/build (linux-x64, ubuntu-22.04, x86_64-unknown-linux-gnu)/10_Required corresponding-host native and shared SQLite suites.txt`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/desktop-lint-final.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/desktop-lint.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/desktop-quality-final.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/desktop-quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/desktop-types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/process-tests-attempt-1-tool-output.txt`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/process-tests-attempt-2.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/process-tests-attempt-3.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/release-probe-contracts.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-native-diagnostics/verification.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-windows-native-implementation/installed-targets.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-windows-native-implementation/paths.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-windows-native-implementation/product_binary.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-windows-native-implementation/product_media.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-windows-native-implementation/scoped-rustfmt.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-windows-native-implementation/verification.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-windows-native-research/native-3-original.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-windows-native-research/observed-failures.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-agent-loop-cost-implementation.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-agent-loop-cost-research.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-frontend-cold-research.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-frontend-heap-implementation.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-hosted-commit-files.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-hosted-commit-plan.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-hosted-final-validation.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-hosted-native-check.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-hosted-native-followup.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-hosted-native-retrospective.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-native-diagnostics-implementation.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-windows-native-implementation.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-windows-native-research.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/task.json`

## Unrecognized paths

None. The complete ordered path lists and all non-self file hashes are in `release-hosted-commit-files.json`.

## Execution boundary

Project workflow Phase3.4 requires: “Present the plan once, ask for one-shot confirmation.” After confirmation, stage each exact complete group and commit with its listed message in order; do not amend or push. Keep the task active because corresponding-host installer and real draft-delivery criteria are still unpassed.

## Approved execution checkpoint

- Group 1: `31427a1d74da051c32a7cff7d6c76c522debd8b6` — `fix(desktop): bound frontend build heap in the actual Node child`.
- Group 2: `6fd7045198c0d665d3446b3419d82821c50110f4` — `fix(native): pin Windows directories and close test resource owners`.
- Group 3: `23e357114022973b86bdc8e3587079e98ce7e5f4` — `fix(ci): preserve live native failures and cancellation evidence`.
- Group 4: `9f6711c1e90673b4a7ef00a31f7ab96d10302a85` — `fix(agent): avoid rereading terminal tool history`.

The documentation group follows these four commits. Its own final commit identity is available in Git history; it cannot recursively embed its own hash. Approved task/plan bookkeeping updates are confined to already listed files, and all validated product/test hashes remain frozen.

Original captured log whitespace is preserved; the final staged source/spec/authored-report check excludes only raw `research/logs/`. This preserves evidence bytes and is recorded in final validation. The independent report has only its extra final blank line normalized; no source/test/hash outcome changed.
