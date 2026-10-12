# Independent release pipeline check

Date: 2026-10-12. Role: trellis-check. Baseline main/HEAD:
`92bb6d4120053453036fbdb1b3b8f23fb9c56385`. Reviewed candidate
branch `codex/desktop-release-pipeline`, before any work commit or hosted
activation.

## Scope and review method

Read the complete saved check hook, curated check.jsonl entries and final
PRD/design/implement, including the owner-approved Windows process-recovery
contract. Reviewed the portable tools, normal build wrapper, closed target policy,
release build/receipt/check seal, artifact selection/collection, draft publisher,
dedicated Actions workflow, desktop package/config/lint/Knip and portable probe
path changes. Read the actual peer smoke/driver consumers only to establish their
interfaces and runtime invocation; this report does not replace the independent
Rust/runtime review.

No recursive implement/check dispatch, Cargo/native build, dependency install,
secret/user-profile access, paid request, remote mutation, commit, push, tag or
Release operation occurred. Read-only official source/API queries confirmed
pinned upstream semantics. The exact authored reviewed-file hashes are retained
in `logs/pipeline-check/reviewed-source-hashes.json`.

## Findings fixed

1. **Final manifest provenance was not revalidated.**
   `release-artifacts.mjs` checked embedded target receipts at publisher entry but
   omitted their original artifact selections. A modified artifact ID, target,
   run, attempt or name, duplicate ID, unknown context field or divergent source
   map could survive this second verification. Reused one closed selection
   validator at collection and release revalidation; validated final context and
   required identical source inputs across targets. `publish-draft.mjs` rejects a
   final manifest from an invalid/future attempt before any GitHub request.
   Actual malformed final manifests now fail with no fake-API request/upload.

2. **macOS DMG-only packaging deletes the receipt's app path.**
   `build-release.mjs` requested only dmg and then read the intermediate
   `bundle/macos/Cuepoint.app` executable. The pinned Tauri bundler explicitly
   removes that app when app is not an explicit requested package type.
   Root reviewed and approved requesting internal app,dmg on Mac while keeping
   the public formats/collector closure limited to one DMG per Mac target.
   `release-policy.mjs` now records those internal bundles. No raw app is added to
   the five-installer asset set.

3. **Default installer-type rewriting conflicts with the exact executable hash.**
   Pinned Tauri rewrites DEB/AppImage/NSIS bundle-type markers and restores the raw
   target executable after each format. The single raw executable SHA therefore
   differs from the normal payload unless rewriting is disabled. Root reviewed
   and approved `--no-binary-patching` for this no-updater release lane.
   `releaseBuildArguments` supplies exact product-sqlite/locked/no-patching
   arguments and is used by the actual build invocation. Regression checks cover
   all four targets, internal Mac app preservation and unchanged public DMG formats.
   This is source/CLI proof; actual host packages still need H1a.

4. **Root quality did not know the external CI/test entrypoints.**
   The first full quality run failed 12 exact unused findings. Root authorized
   narrow `knip.json` entries for `scripts/release-product-smoke.mjs`, invoked by
   `run-release-smokes.mjs` via Node, and
   `scripts/release-smoke-support.test.mjs`, invoked by desktop test:release.
   The next run exposed two genuinely unused exports; root authorized removal of
   only the export keywords from internally used `ordinaryFile` and CLI `main`.
   Their bodies and public UI behavior remain unchanged. Final full quality passes.
   No lint/debt allowance or blanket script entry was introduced.

## Primary source verification

- [Pinned Tauri bundler](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle.rs):
  GitHub blob `e6709eb590ac17925a50e5393215d020269c6f59`; lines40–47
  select format markers;134–145 save the original binary;212–218 restore it;
 269–285 remove the unrequested app. The local pinned CLI2.12.1 help exposes
  `--no-binary-patching` and describes the updater tradeoff.
- [Pinned Tauri CLI bundle options](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-cli/src/bundle.rs):
  blob `ae7b20fa5b50c4fc21dd0e5b9badd75716199a73`,104–111 and221–222
  connect the option to actual bundler behavior.
- [Pinned pnpm action installer](https://github.com/pnpm/action-setup/blob/f40ffcd9367d9f12939873eb1018b921a783ffaa/src/install-pnpm/run.ts):
  blob `005c500aaf95216547a21ef34dd4baee8a24caa0`; installs pnpm under the
  requested dest, consistent with explicit node_modules/pnpm/bin/pnpm.cjs.
- [Pinned download action inputs](https://github.com/actions/download-artifact/blob/37930b1c2abaa49bbe596cd826c3c89aef350131/action.yml):
  supports exact artifact-ids and merge-multiple. The downloaded workflow YAML
  was also parsed using the installed ESLint js-yaml closure.

The browsing fetch returned404 for pnpm raw URLs; read-only GitHub contents API
and ls-remote subsequently confirmed the actual pinned ref/source. No downloaded
upstream package was installed. An initial local YAML probe named the wrong
installed js-yaml subdirectory and failed module resolution; the corrected probe
resolved js-yaml through ESLint and parsed the real workflow successfully.

## Integration observations

- Tool wrapper runs in desktopRoot, so hosted frozen root install
  `pnpm --dir ../.. install --frozen-lockfile` and subsequent desktop install
  resolve correctly despite the Actions step starting at repository root.
- Windows pnpm.cjs uses process.execPath and explicit argument arrays; no shell
  command shim interpolation is added. Hosted probe paths include the target
  triple and Windows .exe while preserving local Mac reference paths.
- Normal packaging selects product-sqlite only, checks exact clean HEAD/version,
  fresh output and bundle namespace, hashes tracked source before/after and
  independently checks named receipt/evidence/installer closure.
- Exact branch/manual modes stay build-only; only push of a closed desktop tag
  reaches draft. Actions build matrix comes from the shared policy; final writer
  permission is confined to draft. GHCR workflow has no task diff.
- Collector retry from original target IDs reconstructs identical manifest bytes.
  Publisher pagination, immutable ownership, exact asset resume, changed payload,
  unknown assets, lost reply and incomplete starter cases are exercised by the
  real functions against the controlled fake API. Starter placeholders remain
  incomplete for owner recovery and are never deleted.
- Installer/system success and GitHub remote behavior are not inferred from fake
  payload or API tests.

## Verification actually executed

Commands use the explicitly approved
`/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

| Gate | Actual outcome | Raw evidence |
| --- | --- | --- |
| Root lint | PASS exit0 | logs/pipeline-check/lint.log |
| Root quality initial | FAIL exit1;12 exact unused findings | logs/pipeline-check/quality.log |
| Root quality after entry fix | FAIL exit1;2 unused exports | logs/pipeline-check/quality-fixed.log |
| Root quality after all fixes | PASS exit0;0 failures,12 existing reviewed lint allowances,584 review warnings | logs/pipeline-check/quality-final.log |
| Root quality:self-test | PASS exit0;88 cases | logs/pipeline-check/quality-self-test.log |
| Root full Vitest | PASS exit0;228 files/3,955 tests passed;1 file/7 tests explicitly skipped | logs/pipeline-check/test.log |
| Model bank verify | PASS exit0 | logs/pipeline-check/model-bank-verify.log |
| Root production build | PASS exit0 | logs/pipeline-check/build.log |
| Desktop types | PASS exit0 | logs/pipeline-check/desktop-types.log |
| Desktop lint | PASS exit0 | logs/pipeline-check/desktop-lint.log |
| Desktop Knip | PASS exit0 | logs/pipeline-check/desktop-knip.log |
| Release/peer support Node tests final | PASS exit0;46 tests | logs/pipeline-check/release-tests.log |
| git diff --check | PASS exit0 | logs/pipeline-check/diff-check.log |
| Actual workflow YAML parse | PASS;push/manual/PR and prepare/quality/build/collect/draft jobs | tool transcript |

The full root batch's before/after source scope is recorded in
`logs/pipeline-check/root-gates.json`. It saw this reviewer's knip.json correction
and peer changes to release-product-smoke.mjs plus the Python verifier/tests
during the batch. Therefore the entire batch is **not** described as a fully
frozen all-file acceptance. The actual React/business/Agent/TypeScript test
inputs did not change, and no routeTree.gen.ts regeneration occurred. Subsequent
exact quality, desktop gates and release tests ran after those changes and the
approved packaging/provenance fixes. An intermediate new test initially changed
the first sorted target to its same linux-x64 value and failed its expected
rejection; corrected the test to a genuinely different target and reran green.
No failing result was relabeled as a pass.

## Findings not fixed / remaining gates

No unresolved reachable source defect remains in this assigned pipeline scope.
H1a actual four-host compilation/storage/filesystem/installer smokes, Linux
AppImage bundled-library/license inventory review and H1b actual draft
upload/retry remain **pending**. They require owner-activated remote execution and
actual artifacts; no local source test closes them. Normal local packaged Mac UI
proof and Intel/hardware/media/system gaps remain separate per root/runtime plans.
No speculative license policy was added. No Rust platform guarantee, UI owner or
remote permission was widened by this review.
