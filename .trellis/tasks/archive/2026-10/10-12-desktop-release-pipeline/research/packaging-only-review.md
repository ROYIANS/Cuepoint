# Independent packaging-only review

## Decision, scope and result

The latest explicit owner decision supersedes earlier desktop delivery test and
installed-payload smoke prerequisites. Review uses the appended owner decision
in PRD/design/implement, packaging-only-boundary.md and updated distribution,
quality and index specs. Removing automated desktop tests is authorized behavior,
not a finding. This review found two missed mechanical touchpoints and fixed
both. Final review has no unresolved source/spec issue in this change.

Read the saved complete hook output, current task artifacts and changed scope.
The workflow/docs and contract workers froze their source before review edits.
No product UI, business/Agent, native storage, original test workload/deadline,
package dependency, signing, platform or migration code changed. No Git staging,
commit, push, tag, hosted dispatch, Release mutation or task archive was performed.

## Findings fixed

1. `scripts/prepare-native-test-probe.test.mjs`: the workflow regression still
   iterated both GHCR and desktop and immediately split a `quality` job. After
   the authorized removal, it threw TypeError in desktop. GHCR still executes
   this standalone test, so unchanged GHCR YAML would have failed. Reproduced
   the exact assertion alone: one failure, exit1, in
   `logs/packaging-only-review/probe-workflow-red.log`. Replaced the stale loop
   with the existing strict GHCR setup/order/real-probe/adapters/Node22 assertions
   and an explicit assertion that desktop contains no quality/probe/root-test or
   native/smoke invocation. All eight original suite cases now pass with no skip.
2. `scripts/setup-release-driver.mjs`: actual full root quality then found three
   unused exports exposed by removing the old workflow caller:
   TAURI_DRIVER_VERSION, TAURI_DRIVER_CRATE_SHA256 and main. Searched all actual
   consumers; only compatibleDriver and verifyConsumedCrate are imported. Removed
   precisely the three unnecessary export keywords. Pinned values, every body,
   the standalone CLI entry and the two used exports remain exact. No dummy
   caller, expanded entry configuration or reviewed allowance was introduced.
   The original failed quality output is retained as `root-quality.log`; final
   root quality passes in `root-quality-after-driver-fix.log`.

A stale comment that claimed per-format executable parity was identified during
read-only review and corrected by the owning contract worker before its freeze.
The comment now states built-executable hashing without installed/extracted
parity or launch proof. Root synchronized the corresponding quality-spec lesson.

## Independent behavior review

- Actual parsed workflow contains only prepare/build/collect/draft, with build
  needing prepare, collection needing all four builds, and tag-only publication
  needing collection. Matrix fail-fast remains false. Bootstrap/manual modes
  cannot publish; only the final desktop-tag publisher has contents-write.
  Pinned actions/tools, frozen installs, locked Cargo, clean exact source and
  fresh output/bundle namespace remain.
- Trace remaining prepare, hosted resolver, package-install lifecycle, frontend
  and Tauri build, explicit artifact selection, collection and publication entry
  points. No direct or indirect product tests, lint/types/quality/Clippy/format,
  UI driver, application launch or storage/payload smoke executes in desktop
  delivery. Installing rustfmt only supplies the existing resolver's mandatory
  path. Only Xvfb/WebKitWebDriver dependencies were removed; compiler, WebKit,
  media, FUSE and bundler requirements remain.
- Build success emits packaged state with strictly empty checks/evidence. Common
  closed context/product/target/native-host/tool/source/payload/asset checks run
  before the packaged state branch. Actual target files are rehashed and checked
  against exact receipt/installer closure. Four targets and five installers are
  required; source divergence, wrong attempts/provenance, malformed fields,
  paths/links, extra/missing files and changed bytes still reject.
- The explicit standalone verified branch retains exact named passed checks and
  hashed closed evidence. Empty reports cannot manufacture verified state.
  Mixed receipt sets disclose the least acceptance scope: any packaged target
  produces package-only limitations. Canonical state-derived limitations are
  revalidated before publisher API calls, preventing fabricated all-tests-passed
  notes. Publication still consumes exact original assets and conservative
  ownership/source/tag/retry/remote-hash rules; complete means uploaded file set.
- Documentation and current specs distinguish declared native build metadata
  and built hashes from installed architecture, payload parity and runtime
  acceptance. No claim says the owner already tested these unbuilt artifacts.
  Independent GHCR keeps its probe/root quality and Node22. Byte comparison to
  HEAD confirms unchanged GHCR SHA256
  `68a135604a1e794a04f54f847c1e99eb37cd87be9ab1def36910d2bd1e60f26c`.

## Verification

All checks below are local development verification of the changed delivery
contracts; they are not steps restored to the packaging workflow.

| Check | Final outcome | Evidence |
| --- | --- | --- |
| Desktop release/protocol regressions | 79 passed, 0 failed/skipped, including packaged collector/publisher and strict verified negatives; repeated only after driver export change | contract release-tests.log and review release-after-driver-fix.log |
| Desktop TypeScript | pass, exit0; original 31 frozen inputs independently reconciled | contract types.log/checks.json |
| Desktop ESLint | pass, exit0; original frozen source unchanged | contract lint.log/checks.json |
| Desktop Knip | pass, exit0; original frozen source unchanged | contract quality.log/checks.json |
| Probe preparation/workflow regression | 8 passed, 0 failed/skipped | review probe-contracts.log/mechanical-fix-checks.json |
| Root TypeScript (`pnpm lint`) | pass, exit0 | review root-types.log |
| Full root quality (ESLint, architecture, unused) | pass, exit0 after actual three-export correction | review root-quality-after-driver-fix.log/final-checks.json |
| Workflow YAML/source closure | pass; four jobs, fourteen direct commands, unchanged GHCR | workflow workflow-source-check.json plus independent source trace |
| Final source/diff audit | no source hash mismatch across contract31, review34 and workflow3 entries; no src/native/fixture changes; diff-check exit0 | review final-source-audit.json |

Use approved machine Node24.11.0 and the explicit approved pnpm10.15.0 path.
`logs/packaging-only-review/mechanical-fix-checks.json` intentionally retains the
initial quality exit1. `final-checks.json` records the subsequent frozen34-input
passing release/quality batch. Worker hashes match current source; duplicate
broad desktop/type/native/root suites were not run without a changed input.

## Findings not fixed / remaining evidence limits

No unresolved mechanical or spec issue remains in the reviewed change. The
known 64-turn native SQLite Agent case can still exceed its20-second deadline;
performance work is outside this packaging-only task and was not disguised by a
fixture, deadline, assertion or Agent change. Product tests and standalone smoke
utilities remain available when explicitly invoked.

No actual installer was built, installed/extracted or launched during this
review. Four-target hosted package creation/collection and real tag/draft
integration remain pending until the owner activates new reviewed source.
These are unobserved delivery outcomes, not failures established by this local
review. Previous automated native/runtime test gates were explicitly waived for
this workflow; owner functional acceptance stays separate. Current source tests
cannot claim cross-platform runtime behavior or remote upload success, and the
parent task remains active for actual package/draft delivery.
