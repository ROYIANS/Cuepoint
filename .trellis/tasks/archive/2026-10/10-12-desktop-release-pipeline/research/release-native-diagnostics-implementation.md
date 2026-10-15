# Native check diagnostic output correction

## Boundary recorded before implementation

Source run: 38208372156, attempt 1, commit
946664ab235e0996da138796bd7d364381dab6ab. The original macOS and Windows
artifacts belong to root's `logs/release-hosted-original/` evidence. Linux's
original detailed failing assertion is unavailable after the owner cancelled
the job; this correction does not identify or repair that unknown failure.

The existing release wrapper redirects all child output to runner files. Its
nested SQLite runner does the same, so the live workflow log cannot explain an
individual failure or show actual suite progress. `failure()` alone also does
not select the finite diagnostic upload after cancellation.

Expected owned paths and reasons:

- `desktop/tauri/scripts/logged-process.mjs`: one shared implementation for the
  two actual command runners, preserving child bytes in an exclusive evidence
  file while forwarding stdout/stderr to their respective live streams. Await
  child stdio close and log completion; fail on spawn/output/log errors.
- `desktop/tauri/scripts/release-native-checks.mjs`: use that runner, retain
  nonzero/signal rejection and add finite step start/result lines. Rust test
  commands use `-- --nocapture` so an abort does not erase earlier panic output.
- `scripts/native-storage-regression.mjs`: use the same runner for probe,
  SQLite and capability commands, without changing their command selection,
  source hashes, coverage, assertions, deadlines or report exit authority.
- `desktop/tauri/scripts/logged-process.test.mjs`: run real Node subprocesses
  to verify output/EOF, argument/environment/cwd boundaries, failure outcomes
  and cancellation diagnostics configuration.
- `.github/workflows/desktop-release.yml`: change only the existing build-job
  finite diagnostic upload condition to `failure() || cancelled()`.
- This report and finite logs under `logs/release-native-diagnostics/`.

No process mocks or production test hooks, periodic monitor, retries, global
Node budget, timeout changes, unrelated runner conversion, event/permission/
collection gate changes, source acceptance claim, Git or remote mutation.
Frontend and Rust implementation belong to other workers; root owns specs and
task metadata. Local macOS runner tests cannot establish corresponding-host
Windows/Linux release success or recovery of a runner forcibly terminated by
GitHub.

## Validation plan

Run the new finite real-process contracts with the pinned local Node 24.11.0;
run appropriate desktop lint/type/unused and existing release contracts when
coordinated with root. Preserve failed attempts. Root schedules the frozen
whole-product gates after all workers finish. Cancellation upload is a best
effort for the surviving runner; it cannot retain files after GitHub destroys
the machine or skips cancellation cleanup.

## Implemented behavior

The two actual callers use `runLoggedProcess`. It exclusively opens the named
log before spawning, uses direct `spawn` with an argument array and no shell,
and pipes real child stdout/stderr both into that shared log and into separate
live stdout/stderr forwarding streams. Those small Writable streams wait for
the live destination write callbacks and participate in normal pipe
backpressure; they do not collect child output in memory or end parent streams.
The runner waits for child `close` (stdio EOF), evidence stream completion and
both live forwarding completions. Any spawn, child-pipe, evidence or live-output
error rejects, terminates/drains the child and releases the owned evidence
handle. A nonzero exit or signal is returned unchanged for caller failure
classification.

The release wrapper prints one start and one actual result line per command.
All three Rust test command lists now append `-- --nocapture`; their suites,
features, locked requirement and existing tests are unchanged. A failed check
still throws and prevents its success receipt. The SQLite runner retains its
complete suite selection, environment, table/tool coverage and exit formula.
Its explicit before/after hash list now includes the newly imported logging
owner so this correction is covered by its own frozen-input check.

Only the existing build-job diagnostic upload's condition changed to
`failure() || cancelled()`. The source condition test also retains the sole
`contents: write` occurrence, tag-only publisher guard and quality/build
collection dependencies. GitHub documents `cancelled()` as a status condition
and describes re-evaluating unfinished step conditions during cancellation;
these are configuration grounds, not a performed hosted cancellation test.
See [GitHub expression status functions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions)
and [workflow cancellation](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation).

## Actual finite validation

All validation here ran on the local macOS ARM64 machine. Pinned local Node is
24.11.0. Package commands invoked the explicit approved pnpm path
`/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

| Check | Actual outcome | Retained file |
| --- | --- | --- |
| First real-process test attempt | 7 pass / 2 fixture failures | `process-tests-attempt-1-tool-output.txt` |
| Corrected real-process tests | 9 pass | `process-tests-attempt-2.log` |
| Final tests including post-open write fault | 10 pass, no skips on this Mac | `process-tests-attempt-3.log` |
| Desktop ESLint, final candidate | Exit 0 | `desktop-lint-final.log` |
| Desktop Knip, final candidate | Exit 0 | `desktop-quality-final.log` |
| Desktop TypeScript | Exit 0 | `desktop-types.log` |
| Existing release/probe contracts | 43 pass | `release-probe-contracts.log` |
| Owned tracked diff whitespace | Exit 0 | Root can repeat final `git diff --check` |

Log paths above are relative to `logs/release-native-diagnostics/`. The first
attempt was captured in a tool result and retained explicitly as that result,
not retroactively described as an original shell log. One fixture expected
macOS's `/var` spelling while `process.cwd()` correctly returned canonical
`/private/var`; it now compares with `realpath`. Closing fd 1 inside a process
did not reliably produce a broken Node stdout destination. The corrected
fixture closes the parent's real stdout pipe instead. That review also made
the runner await live write callbacks, preventing a late EPIPE from appearing
after a purported success.

The final success contract writes 2 MiB to each actual child stream and checks
both exact live byte sequences, retained total length/byte counts and complete
UTF-8 EOF markers. Other cases exercise literal hostile-looking arguments,
Unicode/spaced cwd, environment, actual exit 23 with panic detail, ENOENT
spawning, SIGTERM, existing-log preservation, a missing log directory and an
actual broken stdout pipe. Independent review requested a post-open evidence
failure. The POSIX-only fixture uses `/usr/bin/python3` solely to set an actual
64 KiB `RLIMIT_FSIZE`, ignore SIGXFSZ and exec the unchanged Node driver. A
4 MiB child pipe write then produces real EFBIG on its ordinary evidence file;
the rejected result, exact partial bytes, bounded file size and released handle
are checked. No filesystem/process mock or production hook is used. Windows
explicitly skips only this POSIX resource-limit fault contract.

## Freeze and remaining evidence limits

Source was handed to root and the independent checker after the final tests.
The checker identified the new directly imported helper as an input missing
from the native runner's original explicit identity list; root authorized one
fixed-list addition before starting its full native suite. That edit does not
change execution or coverage. Owned final input hashes are recorded in
`logs/release-native-diagnostics/verification.json`.

This correction gives subsequent runs real diagnostic output. It does not
recover Linux's original missing detail, fix the unknown Linux assertion,
establish Windows/macOS Intel behavior, or guarantee cleanup/upload after a
force-terminated hosted runner. Root owns full frozen product/native checks and
the hosted acceptance decision. No Git operation or remote mutation was made
by this worker.
