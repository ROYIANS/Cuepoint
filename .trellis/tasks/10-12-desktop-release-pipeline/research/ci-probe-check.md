# Independent check: cold native probe prerequisite

Date: 2026-10-12. Baseline: `f4d02530744e2c74db6769a67baba08b9a32d318`.
Role: dispatched Trellis reviewer. Source review and verification only; no source,
workflow, package, spec, profile, installer, Git or remote mutation by this reviewer.
The implementation peer and root were active in the same checkout; all changes
were coordinated and no peer edits were reverted.

## Findings (fixed)

- File: `scripts/prepare-native-test-probe.test.mjs`.
- Issue: the initial workflow-order check compared `indexOf(installation)` with
  preparation without requiring the installation match to exist. Removing the
  install command produced `-1`, which could pass that comparison.
- Fix: reported during read-only review; the implementation peer added explicit
  `installation >= 0 && preparation > installation` before freezing the complete
  root run. The reviewer made no additional source edit. The permanent CLI was
  then exercised against disposable copies with the Rust install command removed
  independently from GHCR and desktop workflows: both correctly failed (exit1).
  Raw expected-negative logs and `workflow-negative-verification.json` retain the
  actual failures; tracked workflows were never mutated for this check.

## Findings (not fixed)

None. No unresolved behavior, interface, module-boundary or scope finding remains
in this correction. Actual hosted Linux execution and the parent four-host/tag
acceptance remain pending and are not relabeled as local passing evidence.

## Changed-flow review

Reviewed all seven changed authored code/configuration files and three changed
spec/public-document files in full; exact hashes, per-file notes and findings
are in `logs/ci-probe-check/review-ledger.json`. Native hook output, all check.jsonl
references, PRD, design, implementation plan and applicable package index/quality
contracts were loaded before review.

Both quality jobs now independently install pinned Rust1.99.0 before the full
root suite. Preparation receives actual absolute Cargo/rustc paths, verifies
versions, rejects wrappers, fixes RUSTC, builds into a new target with locked
`--no-default-features --features test-hooks --bin product_store_probe`, and
exports only after a real temporary SQLite workspace reports ready, closed and
successful process exit. The shared build/output helpers preserve explicit
triple and Windows suffix handling in the existing native acceptance runner.

GHCR retains Node22 and existing triggers/Docker publication dependency and
permissions. Desktop retains pinned Node24.11.0, release hosted-tool checks,
four targets, receipt/payload checks and tag-only owned draft permissions. The
normal product feature remains product-sqlite; this no-GUI test entry neither
ships test hooks nor adds a second data owner. Ordinary root tests retain the
browser default with the six real-native suites. No owner/acceptance flags,
assertions, skips, schema or business/Agent runtime behavior changed. The two
exact Knip entries represent real CI/test CLI usage, with no broad exemption.

## Verification

- Lint: pass. Reviewer ran explicit approved-pnpm root lint and desktop lint.
- TypeCheck: pass. Root lint is the TypeScript project build; reviewer also ran
  the explicit desktop `types` command. Exact commands/exits are in
  `logs/ci-probe-check/lint-types.json` and raw logs.
- Formal quality: pass, independently inspected the worker's actual current log:
  zero unallowed failures, 12 reviewed allowances and 584 review warnings;
  architecture and unused gates pass. This is not a zero-warning claim.
- Tests: pass. The worker's frozen complete root run used actual installed
  Node22.21.1 and explicit approved pnpm10.15.0 with the newly built probe:
  **228 files / 3,955 tests pass; 1 file / 7 tests retain their existing skip**.
  All **1,021** before/after hashes match, and the reviewer independently
  recomputed all 1,021 against the final checkout without changes. No duplicate
  full-suite run was performed.
- Readiness failure contracts: 8 pass under Node22 and Node24 in worker final
  logs; reviewer independently ran all8 under installed Node22 plus actual
  newly built probe ready/close/exit. These overlap and are not added together.
- Reached red proof: original hosted92 ENOENT failures and a local explicit
  missing-probe run remain preserved. Fixed real cold target builds under both
  Node24 and Node22 pass; the reviewer checked actual produced bytes/hash and
  closed/exited protocol. Crate download cache reuse is explicit; target output
  and compiled dependencies were fresh.
- Release protocol: worker's current35 tests pass, including real malformed
  artifacts, collector and controlled fake-API ownership/retry cases. Logs were
  inspected; these are not actual GitHub Release delivery.
- Permanent workflow negative controls: two removed-install mutations in
  disposable source copies correctly fail the actual test CLI.
- `git diff --check`: pass.

## Limits and handoff

This correction proves local Mac no-GUI tool/SQLite readiness, Node22 CLI
compatibility and unchanged root tests against the actual binary. It does not
prove GitHub runner environment, Windows/Linux installers, media/hardware or
actual tag/draft delivery. The parent task remains active for owner-controlled
hosted rerun. Root owns final task/spec/docs reconciliation, commit inventory
and user confirmation. No installer build, paid provider, GUI, user data,
commit, push, tag, hosted dispatch or Release mutation was performed here.
