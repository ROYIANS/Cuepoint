# Desktop delivery: packaging-only change boundary

## Authorization and smallest gap

The owner requested that this workflow only build packages: testing happens before the owner initiates publication. This supersedes every earlier desktop workflow automatic test/smoke gate, including the temporary suggestion to skip one long Agent test. Independent GHCR quality remains active.

## Concrete flow

Prepare exact version/target context → native-host locked compilation/bundling → `packaged` receipt → immutable source/artifact closure and five-file collection → existing tag-only owned draft. Checks of metadata, lengths and hashes remain packaging integrity, not product tests. No UI driver, launch, storage suite, Rust test/Clippy/fmt, Vitest, lint/quality/model test job executes in desktop delivery.

## Ownership

- Release-contract implementer: `build-release.mjs`, `release-artifacts.mjs`, `release-policy.mjs` if needed, `release-pipeline.test.mjs`, the reached workflow dependency assertion in `logged-process.test.mjs`, and bounded own report/logs. Emit packaged receipts with no fabricated passed checks. Accept only exact package closure, retain standalone explicit verified-check tools if possible without unnecessary changes, preserve all integrity/ownership/retry rejection behavior, update generated package-only notes.
- Workflow/docs implementer: `.github/workflows/desktop-release.yml`, `docs/desktop-distribution.md`, `desktop/tauri/README.md`, own report/logs. Remove test dependencies/gates and smoke driver setup, retain all required native packaging dependencies and matrix/draft permissions. GHCR untouched.
- Root: task artifacts, specs, final review and Git.
- Independent checker: the reached `scripts/prepare-native-test-probe.test.mjs` workflow-shape assertion. Preserve strict GHCR cold-probe prerequisites and assert the desktop workflow has no quality/probe/root-test invocation. The old two-workflow assumption would otherwise break the unchanged GHCR job. This is local regression maintenance, not a desktop delivery test step.
- Independent checker follow-up: removing the external-driver workflow caller exposes three genuinely unused exports in `scripts/setup-release-driver.mjs`. Remove only those export keywords; retain the constants, function bodies and explicit standalone CLI. Do not add dummy callers, suppressions or entries to hide the quality failure. Recheck the relevant root quality and actual release protocol tests after this mechanical edit.

## Validation

Run meaningful collector/publisher/build-contract/workflow regressions and desktop types/lint/quality locally; these checks validate the change while staying outside the packaging workflow. No need to rerun unrelated full Agent/SQLite/Rust suites for removal of CI execution. Independent check traces all four targets and manual/tag modes, package-only receipts and hashes, rejected malformed/changed inputs, and truthful draft limitations. No local or remote full package build is claimed unless actually run. No push, tag, hosted dispatch or Release mutation occurs.

## Limits

The known64turn SQLite Agent test can still exceed20s; this change does not fix its performance. Packaging success is no automated functional acceptance. User-authorized delivery no longer depends on H1a test/smoke gates, but actual four-target installer creation/collection and H1b draft evidence remain pending. Existing earlier evidence is historical, not rewritten into current package-only proof.
