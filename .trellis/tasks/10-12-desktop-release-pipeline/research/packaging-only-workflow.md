# Packaging-only desktop workflow implementation

## Owner decision and scope

The owner requested removal of all tests from the desktop packaging workflow;
functional testing happens before owner-controlled publication. This work changes
the workflow and its user documentation only. The release receipt/collection
implementation is owned by the parallel contract implementer. Product code,
Agent logic, test workload/deadlines, and `.github/workflows/ghcr.yml` are outside
this implementation's edits. No Git mutation, push, tag, dispatch, package build
or Release mutation was performed by this worker.

## Files changed

- `.github/workflows/desktop-release.yml`: remove the quality job, no-GUI SQLite
  probe preparation, native Rust/SQLite suites, installed-payload smoke runner
  and external UI driver setup. `build` depends only on `prepare`; `collect`
  depends only on all `build` matrix results. Remove the inert pull-request
  trigger whose sole executing job was the removed quality job. Exact bootstrap
  branch, manual dispatch and `desktop-v*` tag modes remain. Rename target upload
  wording from verified to packaged and retain only actual build diagnostics.
- `docs/desktop-distribution.md`: describe package-only receipts and the exact
  delivery flow; preserve owner test/publication responsibility and separate
  local/GHCR testing; remove automatic UI/storage/launch/installed-payload
  architecture claims. The known native 64-turn Agent 20-second timeout remains
  unresolved. Explicit finalization/smoke commands are standalone developer tools.
- `desktop/tauri/README.md`: introduce the same package-only boundary and mark
  existing quality/native/smoke tools as explicit developer checks.

The receipt owner separately emits `state: packaged` with empty test checks and
evidence. It preserves source/product/host/version/tool/file/hash closure rather
than manufacturing passed test results. This report does not claim that peer
implementation is validated; root's combined final review records that result.

## Packaging prerequisites preserved

Pinned actions and Node/Rust/pnpm versions, frozen JavaScript installs, locked
Cargo bundling, four native runner targets and five installer formats are
unchanged. Matrix `fail-fast: false`, immutable run/attempt artifact names,
success-only installer upload and collection, artifact retention, least token
permissions, tag-only owned draft and conservative retry semantics are retained.
No `continue-on-error`, optional test-skip input, or fake check pass was added.

Only `xvfb` and `webkit2gtk-driver` are removed from Linux dependencies. The
actual source proves they serve the removed smoke path:
`run-release-smokes.mjs` selects `/usr/bin/xvfb-run`, while
`scripts/setup-release-driver.mjs` reads `/usr/bin/WebKitWebDriver` and the
`webkit2gtk-driver` package. WebKit/GTK/build/bundling libraries, GStreamer
packages and `libfuse2` remain. `tauri.conf.json` configures AppImage
`bundleMediaFramework` and DEB media dependencies; removing them would change
the package build/runtime configuration.

The Rustfmt component remains installed only because
`configure-hosted-tools.mjs` discovers it and `tool-resolver.mjs` requires its
explicit executable path for hosted resolution. No formatting command runs.
The Clippy component and test-profile debug setting are removed. Existing root
and desktop packages have no preinstall/install/postinstall/prepare lifecycle
scripts that could silently reintroduce product tests during frozen installs.

## Checks run and finite evidence

- `git diff --check`: pass after the owned edits.
- Read the complete owned-file diff and trace the remaining command entry points
  through prepare/source-version, hosted tool configuration, package install and
  build-release. Source metadata and hash checking stay distinct from tests.
- Parse the actual YAML with Node24.11.0 and the existing local `js-yaml`4.3.2;
  no dependency install or package change. Assert actual job/event/dependency
  shapes, closed bootstrap/tag triggers, four shared policy targets, matrix
  behavior, least permissions, tag-only publisher, preserved native dependencies,
  finite failure/cancel diagnostics and absence of test/quality/smoke/driver/skip
  commands. Fourteen direct workflow run commands are inspected.
- Compare `.github/workflows/ghcr.yml` byte-for-byte with `HEAD`: unchanged,
  SHA256 `68a135604a1e794a04f54f847c1e99eb37cd87be9ab1def36910d2bd1e60f26c`.

Evidence: `logs/packaging-only-workflow/workflow-source-check.json` includes the
parser path/version, owned-file hashes, parsed jobs/dependencies, target matrix,
remaining direct commands, and unchanged GHCR hash. The combined release-contract
and desktop quality gates are coordinated by root/contract worker; this worker
does not duplicate their runs while peer source edits are active.

## Limits and follow-up

This is source/YAML validation, not a hosted installer or draft run. The owner
must push the new reviewed source and start a new workflow to exercise its
packaging behavior. Re-running an old workflow keeps the old source. A package
run does not launch, install/extract/reverify payload contents, exercise SQLite
or test hardware/providers. Actual installation and functional acceptance stay
with the owner. The performance timeout remains a separate known issue, and
four-target actual package creation/collection and draft delivery remain pending
until the corresponding run supplies evidence.
