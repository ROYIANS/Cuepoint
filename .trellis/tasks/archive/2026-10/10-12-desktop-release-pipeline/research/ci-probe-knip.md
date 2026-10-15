# Desktop Knip cross-package caller correction

Date: 2026-10-12. Baseline `db52aedb`. Owned authored source change:
`desktop/tauri/knip.json` only. Root owns specifications, docs and task state.

## Reached defect

The actual desktop quality command reports two unused exports in the shared
`tool-resolver.mjs`: `nativeProbeOutputPath` and `nativeProbeBuildArguments`.
They are genuinely imported by root `prepare-native-test-probe.mjs` and
`native-storage-regression.mjs`. Desktop Knip had a single desktop workspace;
those callers live outside its cwd and have no workspace owner.

Adding two exact `../../scripts/...` entry/project patterns alone did not fix the
failure: Knip globbed both files but its source analysis skips files without a
workspace owner. A parent workspace must establish that actual caller ownership.

## Narrow implementation

Move the original, unchanged desktop entry/project lists into workspace `.`.
Add the root `../..` workspace with the explicit preparation CLI entry and an
empty root project list. The existing root package's `test:storage:native` script
supplies the native acceptance CLI entry; it remains the real source of that
command. Disable only this new parent workspace's automatic Node, TypeScript,
Tailwind, TanStack Router, Tauri, Vite, Vitest, ESLint and GitHub Actions discovery.
This prevents unrelated root tests, product UI, archived tests and dependency
tests from becoming desktop entry points. Original desktop discovery and all
issue categories remain unchanged.

Final actual traces show:

- `nativeProbeOutputPath` is consumed by the actual preparation CLI.
- `nativeProbeBuildArguments` is consumed by the actual preparation and native
  acceptance CLIs.
- The new parent workspace has no enabled auto-discovery plugins and no wildcard
  project scope. Existing root manifest script entries retain generic CLI
  discovery; no new broad root source entry is declared.

No ignoreExports, tool-resolver-as-entry, ignored findings, removed used export,
fake call or business/CLI change was introduced. The quality command itself and
both package manifests remain unchanged.

## Actual checks and preserved attempts

| Check | Result / raw evidence |
| --- | --- |
| Original desktop quality | Exit1, exact2 unused exports; `desktop-quality-red.log` |
| Exact external entry/project without owner | Still exit1; `desktop-quality-first-green.log` (historical misleading filename, **not a passing result**) and `debug-first.log` |
| Parent workspace before moving desktop scope | Exit1; `desktop-quality-workspace-attempt.log` |
| Intermediate parent automatic discovery | Exit0 but overly broad; `desktop-quality-workspace-second-attempt.log`, `debug-final.log` are superseded |
| Final restricted desktop quality | Exit0, no configuration hints; `desktop-quality-green-restricted.log` |
| Exact real caller traces | Both resolved; `output-path-caller-trace.log`, `build-args-caller-trace.log` |
| Temporary source copy / unchanged final config | Exit0; `negative-copy-clean.log` |
| Add a genuinely unused export to copied tool resolver | Exit1 with `unusedKnipRegressionSentinel`; `negative-unused-export.log` |
| Remove caller ownership from copied config | Exit1, original2 findings return; `negative-remove-caller-workspace.log` |
| Root actual formal quality | Pass; `root-quality-green.log` |
| Root typecheck, desktop types, desktop lint | Pass; respective `*-green.log` |
| Source scope / whitespace | Only desktop Knip authored config; unchanged business/CLI/manifest bytes; `git diff --check` pass |

The counterexamples run the installed real Knip CLI in a disposable copied
source closure, not a mocked graph. Only that copy receives negative mutations;
its temporary directory was removed after process exit. Its config hash matches
the final authored file. `logs/ci-probe-knip/implementation-receipt.json` records
commands/results, hashes and precise finite limits.

## Evidence correction and follow-up

The previous CI prerequisite implementation verified root formal quality but
**did not run desktop Knip quality**. Its root success and independent desktop
lint/types results must not be described as desktop Knip success. This follow-up
reaches and closes that missed local gate.

Root quality/types and desktop lint/types were run during this config-only
iteration. The final restriction changes only parent auto-discovery config;
root gate inputs and business/CLI source remain unchanged. These outcomes are
not a globally frozen combined-source proof with the separate hosted timeout
investigation. Root will coordinate that final freeze.

No full3955 product tests were rerun for this config-only fix. No Rust compilation,
GUI, provider calls, existing user data, shared cache removal, Git commit, push or
remote workflow operation occurred. Actual next GitHub execution and four-platform
H1a/H1b remain pending.
