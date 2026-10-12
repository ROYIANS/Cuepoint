# Independent check: desktop Knip real caller ownership

Date: 2026-10-12. Baseline: `db52aedb382f83bb49f24908131eeebf1eb3401d`.
Role: dispatched Trellis check. Root and peers are active in the shared checkout;
no peer edits were reverted. This report covers the configuration-only correction,
not the separate oversized native query optimization or final combined gate.

## Findings (fixed)

- File: `desktop/tauri/knip.json`.
- Issue: the first parent-workspace candidate eliminated the two false unused
  findings, but default Node/TypeScript/Tailwind/TanStack/Tauri discovery added
  unrelated root product and thousands of test entries, including historical and
  dependency tests. `debug-final.log` preserves that reached graph. Turning off
  only Vite/Vitest/ESLint/GitHub Actions was insufficient.
- Fix: reviewer traced actual installed Knip plugin/workspace behavior and asked
  the implementation peer to restrict the newly introduced parent workspace's
  remaining auto-discovery. The peer added those parent-only plugin settings;
  original desktop entry/project lists and issue categories remain unchanged.
  `debug-restricted.log` now shows no enabled parent plugins or test/archive
  wildcard expansion. Root package manifest CLI discovery still resolves the
  genuine native-storage entry; preparation is a precise explicit entry.
- Verification: actual import traces bind `nativeProbeOutputPath` to the real
  preparation CLI and `nativeProbeBuildArguments` to preparation and native
  storage CLIs. No fake call/import, export removal, tool-resolver entry exemption,
  global ignore, unused-contract/debt or manifest change was introduced.

## Findings (not fixed)

None for this configuration correction. The parent task's hosted run and the
separate native query optimization require their own actual outcomes; this
report does not mark either accepted.

## Verification

- Lint: pass. Reviewer independently ran root lint and desktop lint with the
  explicitly approved machine pnpm.
- TypeCheck: pass. Root lint is TypeScript project checking; desktop types also
  independently passed.
- Root formal quality: pass, actual independent current invocation, 12 reviewed
  allowances and584 review warnings with zero failures. Existing policy remains.
- Desktop quality: pass, actual independent current invocation, zero findings and
  zero configuration hints. This command was missing from the previous
  prerequisite correction's local review; root quality/types/lint must not stand
  in for this separate desktop Knip gate.
- Counterexamples: the peer's actual installed Knip CLI in a disposable source
  copy returns0 for the exact current config,1 after adding a genuinely unused
  `unusedKnipRegressionSentinel` export, and1 after removing the real caller
  workspace (the original two findings reappear). Reviewer checked exact current
  config SHA against the negative receipt and inspected raw diagnostics. This is
  exercised unused-export failure authority, not a mocked graph.
- Source integrity: all reviewed worker hashes match current files; original
  desktop entry/project arrays and report categories match HEAD exactly. The
  independent gate receipt has no changed inputs. No business/CLI source was
  edited for this config correction.
- Whitespace: `git diff --check` pass.
- Full3,955 root tests: not repeated for configuration-only changes. The separate
  native optimization will receive the coordinated final full frozen run.

Exact commands, exits and hashes are retained in
`logs/ci-probe-knip-check/quality-lint-types-receipt.json` and
`logs/ci-probe-knip-check/review-ledger.json`; relevant red/intermediate/final graph
and negative records remain under `logs/ci-probe-knip/`. Historical misleading
`desktop-quality-first-green.log` is explicitly an exit1 failed attempt, not
passing evidence. Superseded broad-workspace green is not the final proof.

## Limits / handoff

No source/config edits were made by this reviewer. This is actual local Mac
quality graph proof, not hosted GitHub or installer success. No full product
suite, Rust build, app/installer build, GUI, provider, user data, commit, push or
remote mutation was performed. Root owns specs/task/docs, combined native review,
concrete commit inventory and owner-controlled hosted rerun.
