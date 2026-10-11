# Shared product implementation and final acceptance

Date: 2026-10-11. Branch: `codex/shared-product-ui-native-adapters`.

## Scope

One React product page tree serves both runtimes. Existing browser command
owners remain authoritative in IndexedDB; native commands persist in SQLite
and the managed application workspace. Simplified native gallery and workspace
pages were removed. Unsupported native domains have capability states.

The native table shape changes to disposable schema 4. An older workspace is
rejected explicitly; no migration, legacy reader or data mirror is added.
Packaged UI verification uses a separate application identifier so it does not
delete or rewrite the developer's existing workspace.

## Earlier integration checkpoint

- Browser real UI smoke: 12 checks passed, no page runtime errors, fresh
  Chromium context; `browser-product-smoke/report.json`, screenshots and trace.
  See `shared-pages-evidence.md` for exact cases and preserved early failures.
- Shared consumer/browser targeted checks: 5 files, 109 tests passed at page
  integration checkpoint. Final complete gates are recorded separately below.
- Root product build: passed; Vite large-chunk warnings remain existing build
  diagnostics. The final build must be repeated if subsequent product edits
  change its inputs.
- Native icon standalone checks passed: opaque alpha across all seven PNGs,
  eight modern ICNS members and six ICO sizes; corners `[12,12,12,255]`.
  Reproducibility, independent macOS decoding and negative probes are in the
  icon evidence JSONs. Packaged resource checking is a distinct follow-up.
- macOS accessibility helper `mac-product-smoke.swift` compiled with
  `swiftc -swift-version 5 -warnings-as-errors`. It operates the actual window,
  without evaluating arbitrary renderer code or using a fixture bridge.

## Findings resolved during integration

- Native project metadata/timestamps must be persisted, not synthesized by the
  canonical mapper. Shared settings cannot silently omit supported fields.
- Multi-shot insertion and selected project mode/aspect creation must be one
  native transaction; incremental saves could leave partial operations.
- Each operation needs its own committed inverse. A map keyed only by entity or
  selection can overwrite a previous undo receipt.
- Copy/undo is a composite operation; two ad-hoc deletes are not a safe native
  inverse, and copy identity cannot be guessed by rereading the next list row.
- Concurrent first-load `ensure` calls must not race the generation transition;
  malformed replies must not advance the accepted generation.

## Final full-scope gates

All final checks pass after the native `/assets` route repair. Raw logs are in
`full-check-logs/`; reports are `final-resumption-review.md`,
`full-check-evidence.md` and `rust-implementation-evidence.md`.

| Gate | Final result | Evidence |
| --- | --- | --- |
| Root TypeScript/lint | Pass | `root-lint-resumption.log` |
| Root complete Vitest | **196 files / 3400 passed / 1 skipped** | `root-tests-resumption.log` |
| Root quality | Pass; 0 failures / cycles | `root-quality-resumption.log` |
| Quality self-test | 88 cases pass | `root-quality-self-test.log` |
| Local model bank verify | 197 files / 85 providers / 1855 models | `model-bank-verify.log` |
| Desktop types / lint / quality | All pass | `desktop-{types,lint,quality}.log` |
| Rust acceptance,test-hooks | **51 passed**, 0 failed/ignored | `rust-tests-combined.log` |
| Rust fmt / Clippy all targets -D warnings | Pass | `rust-{fmt,clippy}.log` |
| Root production build | Pass | `root-build.log` |
| Normal native frontend and app build | Pass | `normal-{frontend-build,native-bundle,app-build}.log` |
| Acceptance frontend build | Pass | `acceptance-frontend-build.log` |
| Isolated normal-product app build | Pass | `isolated-product-app-build.log` |
| Actual normal bundle icon | Pass | `../packaged-icon-check.json` |
| Task context / git diff --check | Pass | 7 implement / 6 check entries |

Quality retains 13 reviewed allowances and 564 visible review warnings; it is
not a zero-warning claim. Vite's existing large-chunk diagnostics remain build
warnings. The earlier unbounded test run timed out under resource contention;
the final bounded run changes neither assertions nor timeouts. The final
59-path product/test/native/config footprint is `final-resumption-source.json`.
`build-receipt.json` verifies no product drift after final builds. Rust's exact
command/exit/source receipt is `full-check-logs/rust-final-receipt.json`.

The staged precommit whitespace check also examines newly added files. It
reported only terminal-generated blank lines at EOF in twelve raw command
logs, which earlier unstaged diff checks did not include. Those raw bytes and
their receipt hashes are preserved. Code/spec/task text uses the normal staged
whitespace check; the raw log paths are checked separately with only
`blank-at-eof` permitted. No product lint rule or test assertion is relaxed.

## Actual packaged product smoke

The macOS application uses the **normal product frontend and desktop Rust
code**, with only name/identifier changed to
`dev.cuepoint.shared-ui-review.20261011` for an isolated schema-4 workspace.
It neither deletes nor rewrites the developer's existing workspace. The
acceptance-fixture WebView and mocked adapters are not product evidence. The
normal app is about **22 MiB**; bundle paths, executable/icon hashes and size
are recorded in `build-receipt.json`.

Actual UI operations create and save a series/9:16 project, project
title/brief/logline, two episodes, episode title/logline/script, scene
title/content/time of day, shot content/notes/duration/status, default settings
and status filters. A 0→3.5-second duration edit succeeds. Default duration
2.25 and automatic numbering off both persist. Five new shots adopt the
2.25-second default with contiguous orders. A fresh copy then undo restores
eight rows to seven. One earlier missed expiring undo leaves an additional
test copy; that attempt is disclosed and is not counted as a successful undo.

Closing/relaunching the final package restores all those fields/settings and
the ready-status filter (1/7). The produce route keeps shared chrome, shows
its capability state and offers a working return link. The repaired `/assets`
entry reaches the managed library. The real macOS Open panel imports a
13,718-byte PNG into an internal file copy; its relative path, SHA-256 and
length match SQLite. Closing/reopening retains this managed asset.

All writes came from UI interactions. Initial integration used the saved
macOS accessibility helper; final testing uses `cua_repl` controls,
screenshots and the native file chooser. The persistence check opens SQLite
**read-only**, never seeds or repairs rows:

```sh
python3 -B .trellis/tasks/10-11-shared-product-ui-native-adapters/research/verify-mac-product-sqlite.py
```

See `mac-product-smoke/report.json`, `final-sqlite.json`, `multiadd-sqlite.json`
and screenshots 11–18. Early helper/index mistakes are recorded separately
from product defects. One stale UI index closed the isolated window; reopening
it confirmed no stored data mutation. Browser smoke's 12 checks remain passed,
with no page runtime errors and no changes to the user's IndexedDB.

## Limits and completion state

There is **no unresolved in-scope implementation or acceptance blocker**.
The independent review documents fixes for opening races, nullable/numeric
baselines, atomic ownership, order validation, UTF-16 associations, durable
inverses, ISO timestamps, settings/filter overwrite, wrong/canceled outcomes,
parser drift, native hash routing and assets entry reachability.

Native world, generation/media slots, audio/music, cloud sync and other OS
packages remain outside this task. Logical deletion retains managed bytes;
physical reclamation is later work. Actual bundle resources, all eight ICNS
members, seven PNGs and six ICO sizes pass opaque alpha and `#0c0c0c` corner
checks. Finder/Dock cache refresh is not claimed as a separate automated gate.
Paid providers, recording and printing are outside this shared-UI task.

All acceptance criteria are met. This acceptance record was written before
work commits; the user subsequently approved the complete workflow 3.4 commit
plan and child-task archive/journal sequence. Actual work commit hashes and
archival outcome are recorded in the developer journal. The parent storage/sync
task continues; push, merge and release are outside the approved wrap-up.
