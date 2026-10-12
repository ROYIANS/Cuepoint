# CI probe correction: complete local commit plan

Status: owner approved this exact local commit and main merge with “提交合并main”.
User-supplied hosted failure was
reproduced and fixed; local cold builds, full Node22 root suite and independent
review pass. Actual next hosted run remains pending.

Branch: `codex/desktop-release-pipeline`. Baseline:
`f4d02530744e2c74db6769a67baba08b9a32d318`.

## Proposed commit

`fix(ci): prepare native SQLite probe before root tests`

Complete current scope: **49 paths**, **0 unrecognized**.
Seven implementation files, three spec/public-document files, and task/evidence
records are included. No ignored binaries, dependency targets, profiles or
user data are staged. Raw reached failure and corrected evidence remain intact.

Changes prepare and verify the pinned real Rust SQLite probe before root tests
in both GHCR and desktop quality jobs. Shared arguments/path retain the native
acceptance runner. No native test/assertion, skip/owner boundary, shipping
feature, trigger or publication permission is weakened.

Validation: [implementation](ci-probe-readiness.md), [independent check](ci-probe-check.md).
Node22 full suite passes 228 files/3,955 cases; original one-file/seven-case skip
is unchanged. All1,021 inputs match before/after. Node22/24 actual cold builds
and eight readiness contracts pass; release contracts35, types/lint/quality pass.

## Exact file list

- `.github/workflows/desktop-release.yml`
- `.github/workflows/ghcr.yml`
- `.trellis/spec/frontend/desktop-distribution.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/ci-probe-change-boundary.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/ci-probe-check.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/ci-probe-commit-files.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/ci-probe-commit-plan.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/ci-probe-readiness.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/local-checks.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/desktop-lint.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/desktop-release-missing-rust-install-negative.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/desktop-types.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/ghcr-missing-rust-install-negative.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/lint-types.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/node22-readiness-contract.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/node22-real-probe-readiness.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/node22-verification.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/review-ledger.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/root-lint.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-check/workflow-negative-verification.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/cold-build-node22.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/cold-build-node22/probe-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/cold-build-node22/probe-ready.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/cold-build-run.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/cold-build/probe-build.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/cold-build/probe-ready.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/cold-lane.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/cold-missing-red.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/frozen-before-full-test.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/frozen-full-test.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/full-root-green-node22.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/implementation-receipt.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/owner-hosted-failure.txt`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/readiness-contract-final.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/readiness-contract-first.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/readiness-contract-node22.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/release-protocol.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/root-lint.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/root-quality.log`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-probe-readiness/source-before.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/task.json`
- `desktop/tauri/scripts/tool-resolver.mjs`
- `docs/desktop-distribution.md`
- `knip.json`
- `scripts/native-storage-regression.mjs`
- `scripts/prepare-native-test-probe.mjs`
- `scripts/prepare-native-test-probe.test.mjs`

## Unrecognized changes

None.

## Execution and remaining gates

Following the recorded owner approval, stage this exact group and create the local commit without
amending. Fast-forward local main to the reviewed commit, following the owner's
requested main/push handoff. Owner performs the remote push and new workflow
run; this plan includes no push, tag, dispatch or Release mutation. Do not
archive the parent task: actual hosted H1a/H1b remain required. Retrying the old
failed workflow SHA does not include this source correction.
