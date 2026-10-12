# Hosted failure corrections: local final validation

## Source and acceptance boundary

Baseline: `946664ab235e0996da138796bd7d364381dab6ab`.
Correction branch: `codex/release-hosted-native-failures`.
Original owner-activated desktop run: `38208372156`, attempt 1.

The original workflow's two macOS normal frontend builds exhausted V8's
approximately 2 GiB default heap; actual artifact hashes and logs are retained.
Windows reached directory guard and binary/media fixture failures before an
abnormal `0xc0000409` test-process exit, without individual assertion details.
The original Linux summary reports one native test failure before owner
cancellation; its precise test and cause remain unknown. Original and corrected
local failures are retained separately rather than overwritten by passing runs.

The changes are four bounded units: dedicated frontend child heap budget with
unchanged Vite worker; actual Windows pinned-directory access and deterministic
test-owner release; faithful live nested process logs and failure/cancel
diagnostics; a reached Agent gate correction avoiding historical terminal point
reads while preserving fresh nonterminal authority. No dependency, test
deadline, boundary workload, product route, release target or assertion is
relaxed. The Agent behavior and five meaningful regressions are independently
reviewed in `release-hosted-native-check.md`.

## Final frozen-source gates

The exact commands, outcomes, durations and 1,016 input hashes are written in
`logs/release-hosted-final-after-agent/receipt.json`. Sequential checks stop on a
failed check or input change; heavy suites do not overlap. All eleven sequential
commands passed with all 1,016 input hashes unchanged.

| Gate | Actual local result |
| --- | --- |
| Root types / quality | Both pass |
| Desktop types / lint / Knip | All pass |
| Desktop release script contracts | 64 tests pass, no skips |
| Full ordinary product suite, Node 24.11.0 | 228 files / 3,965 tests pass; existing one file / seven tests skipped |
| Complete real SQLite all lane | 108 files / 1,910 tests pass; source unchanged |
| Additional real native binary / explicit browser capabilities | Six / five tests pass |
| Registered tool coverage | All 95 tools have valid/invalid parse and successful execution evidence |
| Committed tables / business / domain assertion anchors | All 49 tables, no missing native owner assertions |
| Root production build | Pass, 24.256s command elapsed |
| Normal desktop frontend build | Pass, 18.521s command elapsed; peak RSS 3,167,289,344 bytes (about 2.95 GiB) |
| Final acceptance frontend compilation | Pass, 2.932s; same 1,016 inputs unchanged |
| Source/spec/report whitespace check | Pass; original captured log bytes preserved |

The build's existing large-chunk warnings remain warnings; they are not the
original OOM failure. The 4096 MiB limit is a V8 old-space budget, not an RSS
ceiling. The final acceptance build uses a clearly labelled synthetic compile
endpoint/token; it does not contact a provider or claim application/media
runtime acceptance. Its extra receipt is `desktop-acceptance-build.json`.

The unchanged Rust source already passed both complete feature configurations,
locked formatting/Clippy and portable tests in
`logs/release-hosted-final/rust-checks.json`; all Rust source hashes still match.
Quality self-tests (88) and model verification likewise passed before the
isolated Agent correction; their implementations did not change. The exact
comparison is retained in `retained-gates-current-source.json`: only the two
Agent implementation/test files differ from the earlier gate. Both final
normal and acceptance frontend builds were repeated after that change.

The first failed and final passed original `acceptance.json` and full
`tool-and-table-coverage.json` are retained as byte-exact `.json.gz` files, with
raw/compressed SHA256, paths and sizes in
`logs/release-hosted-evidence-compression.json`. Original per-command logs and
per-worker JSONL remain present; this compresses storage without removing any
event or rewriting the failed outcome.

## Focused and negative proof

- Browser Agent/metadata: 44 passing cases at the original 5-second deadline.
- Actual SQLite Agent/metadata: 44 passing cases at the original 20-second
  per-test deadline, coverage enabled, with unchanged input hashes.
- Actual old loop against the new three-round read bound fails as intended:
  six root point reads versus three. The candidate passes with actual tool
  execution, exact completed results and complete continuation.
- Matched actual SQLite 64-turn profiles remove exactly 2,112 `get` and their
  read-only transaction lifecycle requests; query/write/commit counts stay the
  same. About 4% lower elapsed time is a local measurement, not proportional
  application speedup or guaranteed runner headroom. Empty phase metric arrays
  are explicitly explained in the implementation report.
- Launcher and process logging regressions use actual child processes,
  stdout/stderr beyond pipe capacity, complete EOF, nonzero and signal outcomes,
  spawn errors and actual stream/file write failures.

## Remaining corresponding-host and delivery gates

Local evidence is macOS ARM64 only. The Windows-only guard test has not run on
this host, and no Windows cross-compilation is claimed. macOS Intel, Windows and
Linux builds, required runtime/package smoke and the actual Linux media payload
license inventory require a new owner-activated workflow at the corrected
source. Successful local commands cannot close H1a/H1b or justify task archival.
Re-running the old failed workflow retains the old source commit; the correction
must first reach the owner's chosen branch before a new run is dispatched.

No push, tag, workflow dispatch, remote Release mutation or installer publication
is performed here. The task remains active. Concrete local commit grouping will
be presented after independent final reconciliation.

## Staged evidence whitespace boundary

The final staged check reached newly tracked original command logs containing tool-emitted trailing spaces and blank terminal lines. Those raw logs are deliberately preserved byte-for-byte; changing them would invalidate their provenance. The source, specs and authored reports pass a staged `git diff --check` with only the task `research/logs/` directory excluded. One extra final blank line in the authored independent report was removed mechanically before this documentation commit; its source-review conclusions and frozen code hashes are unchanged. The earlier pre-stage check applied to tracked changes and did not inspect untracked logs. No source or test was changed at commit time.
