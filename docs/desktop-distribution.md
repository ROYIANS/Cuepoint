# Desktop distribution

Cuepoint's desktop application loads the same React interface, business commands
and Agent as the browser. Normal desktop packaging selects `product-sqlite`: all
ProductStore tables live in the application workspace's SQLite database, and
imported media is copied into managed files. The browser keeps a separate
IndexedDB adapter. Desktop and browser profiles do not synchronize automatically.
No historical data migration is part of this delivery.

## Initial installer matrix

| Target | Installer | Baseline | Signing |
| --- | --- | --- | --- |
| macOS ARM64 | DMG | macOS 14 or later | Ad-hoc signature; no Apple notarization |
| macOS Intel x64 | DMG | macOS 14 or later | Ad-hoc signature; no Apple notarization |
| Windows x64 | NSIS EXE | Local NTFS application workspace; WebView2 | Unsigned test package |
| Linux x64 | AppImage and DEB | Ubuntu 22.04 build baseline; WebKitGTK/GStreamer | No distribution signing |

This is the first test-package matrix. Windows ARM64, Linux ARM64, a universal
Mac binary, MSI, RPM and mobile packages are outside it. The normal display name
is **Cuepoint**, the window title is **小光点 Cuepoint**, and the existing dark
application icons are reused. The internal bundle identifier remains
`dev.cuepoint.prototype.offline`; the executable remains `cuepoint-prototype`.
Changing visible branding must not create a new data profile.

The current source version is `0.1.0`. Root package, desktop package, Cargo and
Tauri versions must agree. Distribution tags use `desktop-vMAJOR.MINOR.PATCH`
with that exact source version. The separate container workflow retains its
existing `v*` tags.

## Verification status and meaning

A source change or a local macOS pass does not establish Windows or Linux
installer compatibility. Actual corresponding-host reports are required before
a complete release draft can be assembled. The workflow records build,
installer/payload identity and runtime evidence separately.

Windows and Linux checks drive the actual normal product through external
WebDriver. The test creates a project through the existing UI, imports a text
file larger than one binary transfer chunk, previews its marker, observes the
application process exit, deletes the original import source, and reopens the
same product profile. A separate read-only verifier checks the committed SQLite
rows and the managed file's exact length and SHA-256. The runner does not seed
SQLite or add acceptance commands to the shipping application.

Linux DEB and AppImage payloads each use a separate fresh profile and complete
this sequence. Testing an extracted AppImage does not prove FUSE mounting or
normal desktop integration. Mac checks verify the mounted DMG, application
architecture, icons, ad-hoc signature and bounded launch. Mac launch-only reports
do not prove UI, microphone, printing or provider behavior. Available local
normal-product UI checks are recorded separately. Intel UI and actual hardware
or system-dialog checks remain explicit additional verification.

No paid provider request, microphone recording or unattended printing is part
of the installer gate. Retained historical receipts and unit/fixture tests do
not substitute for current installer reports.

## Build and release ownership

The dedicated workflow is `.github/workflows/desktop-release.yml`. Its activation
modes are intentionally distinct:

1. Pushing the exact `codex/desktop-release-pipeline` branch bootstraps the new
   workflow with build-only verification. This allows testing before it exists
   on the repository's default branch.
2. Manual **Run workflow** is build-only. GitHub requires the workflow to exist
   on the default branch before manual dispatch becomes available.
3. An owner-created `desktop-vMAJOR.MINOR.PATCH` tag requests a draft prerelease.
   Quality, every target build and its required payload checks must all pass.
   Only the final publisher receives release-write permission; collection is read-only.

Both the desktop and GHCR quality jobs prepare the real no-GUI SQLite test
probe before the complete root suite. They install pinned Rust1.99.0, build
with locked dependencies into a fresh runner target, check its ready/close
protocol and export the exact executable path. Root tests retain their existing
browser/native coverage and opt-in acceptance boundary. Preparing Rust only in
a later matrix job cannot satisfy the earlier quality job. A preparation failure
stops testing and preserves its build/readiness diagnostics for 14 days. GHCR
keeps its Node22 setup; the desktop tool lane remains Node24.11.0.

Implementation approval does not authorize a Git push, tag creation, workflow
dispatch or GitHub Release mutation. First review the concrete local work-commit
plan; then the repository owner pushes the bootstrap branch, or pushes the
reviewed main and manually runs this workflow on main. Resolve actual
host failures before creating a version tag. Source fixes require a new verified
source and, after a tagged attempt, a new version/tag; do not move tags to replace
failed payloads.

The final draft has exactly four target receipts and five installer files, plus
canonical `SHA256SUMS` and `release-manifest.json`. Collection verifies source
commit, source tree stability, version, normal SQLite owner, target/architecture,
required check results, run/attempt identity, file names, lengths and hashes.
Missing, stale, ambiguous or unexpected payloads prevent completion.

The publisher creates or resumes only its own draft prerelease, using a closed
ownership marker. It never publishes automatically or overwrites a published,
immutable or unrelated release. Uploading assets is not atomic: an interrupted
upload leaves an incomplete draft. A retry can reuse the identical original
payload; different bytes or unknown remote assets stop the retry. Completion is
recorded only after the full remote asset set is verified. Retain the original
workflow artifacts for retries before their configured retention expires.

Target and combined installer artifacts are retained for 30 days; separate
failure diagnostics are retained for 14 days. A retry after the original
verified payload expires requires explicit recovery rather than a rebuild that
pretends to have identical installer bytes.

The owner reviews the completed draft, installer reports and checksums before
making it public. Repository workflow permission for the normal `GITHUB_TOKEN`
is sufficient for draft delivery; no signing certificates or personal access
token are part of this first package flow.

## Local development and data isolation

On the project owner's Mac, use the approved local pnpm explicitly:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri build:app
```

The dedicated release helpers have closed named arguments:

```text
build:release --target TARGET_ID --output ABSOLUTE_FRESH_DIRECTORY
node desktop/tauri/scripts/finalize-release.mjs --receipt RECEIPT_PATH --checks CHECK_REPORT_PATH
node desktop/tauri/scripts/collect-release.mjs --input DOWNLOAD_DIRECTORY --selection SELECTION_PATH --output ABSOLUTE_FRESH_DIRECTORY
node desktop/tauri/scripts/publish-draft.mjs --directory COLLECTED_RELEASE_DIRECTORY
```

`TARGET_ID` is `macos-arm64`, `macos-x64`, `windows-x64` or `linux-x64`.
Finalization accepts repeated `--checks` arguments and seals only a complete set
of required actual checks. Collection uses an explicit artifact selection;
it does not infer a target from loose installer files. Publishing is tag-only
and needs the reviewed workflow context/token; it is not a local build action.
The workflow supplies exact source, run and attempt identity. Target artifact
names are `desktop-<target>-<runId>-<attempt>`; the combined artifact is
`desktop-set-<runId>-<attempt>`. Diagnostic artifacts remain separate.

The release helper disables Tauri's bundle-type binary patching so the receipt's
executable hash matches the installed or extracted payload for every format.
Automatic updating is outside this package flow. On macOS it requests both the
app and DMG internally to retain the signed app for verification; the DMG is the
only downloadable installer. These choices follow the behavior of the
[pinned Tauri bundler](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle.rs).

Local tool homes remain under `desktop/tauri/.tools`; no shell profile or global
Cargo/Rust home is changed. Hosted tool resolution is an explicit CI mode with
pinned versions. Test hooks, storage probes, fixture acceptance assets and
runner evidence do not belong in normal installer payloads.

The normal product, isolated SQLite review and IndexedDB reference lanes have
separate fixed identities. An isolated IndexedDB build is an intentional test
reference, not a fallback for normal SQLite startup. A storage initialization
failure remains visible and cannot silently change the data owner.

For project backups, use the existing ZIP export/import UI. Server containers
and browser storage do not back up desktop profiles. Never replace the live
SQLite file with a cloud-drive copy while the application is running; live
cross-device synchronization is separate future work.

## Installing test packages

Download the installer for the device's architecture from a completed Release
and compare its SHA-256 with `SHA256SUMS`. These initial packages do not have
formal developer certificates. macOS and Windows may therefore show security
prompts; review the release provenance and the operating system's own options
before opening them. Formal signing/notarization can be added in a later task.

Windows needs WebView2. The NSIS installer downloads its bootstrapper when the
runtime is absent, so that first installation requires an internet connection;
the runner's existing-runtime check does not establish a clean offline install.
Linux needs the declared WebKitGTK/GStreamer runtime libraries. The installer dependency policy and actual host reports are part of
the release verification; compilation alone is insufficient. Linux audio/video
support may also depend on the device's available codecs and audio system.

Filesystem identity, link and reparse-point validation apply to managed files.
Windows requires local NTFS and rejects unsupported filesystem or reparse
outcomes. Its first test-package contract flushes written ordinary-file bytes
and metadata, publishes without overwriting existing files, and verifies
intent/SQLite recovery after process termination. It does not promise that new
directory or file names, stage unlink operations or completion-marker names
survive sudden OS crash or power loss. macOS/Linux keep the existing directory
fsync policy. Process-recovery tests must never be described as physical
power-loss proof. A package is not accepted while its required actual host
checks are pending; consult the corresponding workflow reports.
