# Hosted quality follow-up: desktop Knip and oversized read identities

Status: implementation and local verification in progress. Baseline
`db52aedb382f83bb49f24908131eeebf1eb3401d`; work is confined to the existing
desktop release task. The owner supplied both failures after the cold native
probe prerequisite correction. No remote workflow was dispatched by this agent.

## Reached hosted failures

The desktop quality job reached a successful root production build, desktop
TypeScript and desktop ESLint, then desktop Knip reported two unused exports:

```text
nativeProbeOutputPath      function scripts/tool-resolver.mjs:63:17
nativeProbeBuildArguments  function scripts/tool-resolver.mjs:67:17
```

These exports have real callers in root scripts. The prior correction's local
root quality and desktop TypeScript/ESLint checks did not include the desktop
Knip command. That coverage gap must be corrected explicitly, rather than
describing the earlier root quality result as a desktop quality pass.

The GHCR quality job subsequently reached the actual shared SQLite adapter but
one regression exceeded its existing deadline:

```text
FAIL tests/sharedNativeStorageContract.test.ts
actual shared TypeScript/Rust SQLite adapter
transfers arbitrary oversized read identities within the IPC envelope budget
Error: Test timed out in 30000ms. (observed 30019ms)
Test Files 1 failed | 227 passed | 1 skipped (229)
Tests 1 failed | 3954 passed | 7 skipped (3962)
Duration 122.19s
```

These are bounded excerpts from the owner's pasted diagnostics, not a downloaded
complete hosted log. The other six test cases in that describe block passed.
The probe ENOENT issue is no longer the reached failure in this supplied run.

## Scope and validation

1. Repair the desktop Knip graph using the actual external caller ownership,
   preserving unused-export detection. No fake imports, blanket ignores or
   export removals.
2. Measure the unchanged oversized-key workload through the real cold-built
   Rust probe. If repeated selector transmission is confirmed, repair query
   grouping while retaining all authored identities, input sizes, assertions,
   deadlines, IPC limits and transaction guarantees.
3. Independently check both corrections, run root and desktop quality explicitly,
   and run the complete frozen root suite after source changes. Preserve failed
   attempts and distinguish local macOS measurements from hosted Linux outcomes.
4. Present a concrete local commit/integration inventory. No push, Release
   mutation, task archival or hosted acceptance claim is included.

Detailed evidence belongs to `ci-probe-knip.md`, `ci-probe-knip-check.md` and
`ci-large-identity-timeout.md` plus their task-owned finite log directories.

## Local implementation and frozen validation

The precise Knip workspace correction passed actual root and desktop quality,
including unused-export and missing-caller negative controls. Query-only byte
groups are implemented; the complete original oversized workload now passes
with a 4 MiB affected-phase request bound that failed against the old code.
The original 30-second deadline and every historical assertion remain intact.
The focused actual native contract file has 71 passing cases.

The first final ordinary Node22 root run passed 228 files / 3957 tests, with the
existing one file / seven tests skipped. Its 1058 recorded inputs did not change.
The first complete native SQLite lane passed 107 files / 1904 tests and reached
one existing Agent 64-turn-loop timeout at its unchanged 20-second deadline.
All tool/table assertion coverage and the two additional capability lanes
passed; the overall native receipt correctly remains failed.

That Agent case passed unchanged in a focused run. Bounded research preserving
all 64 turns and original assertions recorded 553 actual equals queries and zero
anyOf queries, so it did not enter the modified grouping branch. This does not
establish a CPU/disk cause or replace the complete gate. See
`ci-native-loop-timeout.md`. One justified full native recheck was run with
unchanged source, timeout and worker settings; the first failure remains
retained. That complete recheck passed 108 files / 1905 tests, all 95 registered
tool coverage requirements, every table/business-owner assertion and both
additional capability lanes. Native input hashes remained unchanged. Final
root/desktop type/lint/quality checks, 88 quality self-test cases, model snapshot
verification and the production build all passed. The final verification records
1058 unchanged inputs and ties the ordinary Node22 root pass to the same source.

Primary final receipts:

- `logs/ci-quality-followup/verification.json`: ordinary full-root pass and the
  preserved first native failure, with no changed inputs.
- `logs/ci-quality-followup-recheck/verification.json`: justified complete native
  recheck and every remaining final gate, all exit zero, no changed inputs.
- `logs/ci-quality-followup-recheck/native-all/acceptance.json`: actual locked
  probe, all tool/table/business-owner coverage and capability outcomes.

Actual subsequent GitHub/Linux quality, the four-host installer gate H1a and
tag/draft gate H1b remain pending. No remote activation or archive is included.
