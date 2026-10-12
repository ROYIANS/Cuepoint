# Packaging-only delivery: complete local commit plan

## Source and authorization

Current branch: `codex/desktop-packaging-only`. Current HEAD and local main are both `c061e15c1684e5e0205869b431b9fd1bc38dfd77`.
The latest owner request authorizes removal of all tests, quality and runtime smoke from the desktop packaging workflow. This plan proposes two local work commits followed by a fast-forward-only integration into local main, if confirmed. No push, tag, Actions dispatch, Release mutation, task archive or completion journal is included.

## Verified behavior

- The desktop workflow only prepares exact context, builds four native targets, collects five installers and optionally creates an owned tag-only draft. No test/lint/types/quality/model/native/storage/launch/smoke/driver invocation remains.
- Packaging emits `packaged`, with strictly empty checks/evidence. Source/version/host/tools/target/path/file/hash closure and exact draft ownership/retry behavior remain. Notes do not claim owner or runtime validation has occurred.
- Independent GHCR YAML is byte-identical. Its cold-probe regression was updated for the current job shape without weakening the remaining strict GHCR assertions. Three genuinely unused driver exports lost only their export keywords; the standalone CLI remains.
- Final local verification: 79 release protocol tests and 8 probe tests pass with no skips; desktop types/lint/Knip, root TypeScript/full quality, actual YAML parse and diff-check pass. Frozen 31-entry contract and 34-entry review inputs match current source. Initial reached red assertions/quality failures are retained with subsequent green evidence.
- No actual new installer or remote draft was created. The known 64-turn Agent timeout remains unresolved; automated desktop runtime gates were waived by the owner. Actual package collection/tag draft delivery remain pending and the task stays active.

## Proposed commits, in order

### 1. `chore(ci): make desktop delivery packaging-only`

Remove automatic quality/test/smoke execution, accept truthful package-only receipts and retain exact collection/publication integrity. Synchronize the reached workflow regression and unused CLI exports.

- `.github/workflows/desktop-release.yml`
- `desktop/tauri/scripts/build-release.mjs`
- `desktop/tauri/scripts/release-artifacts.mjs`
- `desktop/tauri/scripts/release-pipeline.test.mjs`
- `desktop/tauri/scripts/logged-process.test.mjs`
- `scripts/prepare-native-test-probe.test.mjs`
- `scripts/setup-release-driver.mjs`

### 2. `docs(release): record packaging-only delivery and local review`

Synchronize user guidance, executable specs, task decision and bounded implementation/review evidence.

- `.trellis/spec/frontend/desktop-distribution.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/check.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/design.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/prd.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-contract/checks.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-contract/lint.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-contract/quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-contract/release-tests.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-contract/types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/final-checks.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/final-source-audit.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/mechanical-fix-checks.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/probe-contracts.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/probe-workflow-red.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/release-after-driver-fix.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/root-quality-after-driver-fix.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/root-quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-review/root-types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/packaging-only-workflow/workflow-source-check.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/packaging-only-boundary.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/packaging-only-commit-plan.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/packaging-only-contract.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/packaging-only-review.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/packaging-only-workflow.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/task.json`
- `desktop/tauri/README.md`
- `docs/desktop-distribution.md`

## Complete dirty-path accounting

Total: **38 paths**, allocated once: 7 implementation/regression paths plus 31 documentation/spec/task/evidence paths. All are root or explicitly assigned worker edits in this batch. Unrecognized dirty paths: **none**. No files are staged or committed yet.

## Integration after confirmation

Create the two commits in this order, verify the final worktree is clean, and fast-forward local main to the reviewed branch. If main changes unexpectedly, inspect before integration instead of replacing unrelated work. The owner pushes main and starts a new **Desktop test packages → Run workflow → main** run. An old run remains bound to its original source and workflow. Public publication remains owner-controlled.
