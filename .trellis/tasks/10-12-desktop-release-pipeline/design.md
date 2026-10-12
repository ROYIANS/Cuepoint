# Design: one shared desktop product, four native build targets

## Architecture and scope

Keep this as one task with dependency-ordered workstreams. The externally reviewable deliverable is one complete installer set and draft Release; individual platform/build/collector pieces cannot independently satisfy it. Do not create additional product implementations or implied parent/child dependencies.

```text
shared React / commands / Agent
          |
fixed normal product-sqlite owner
          |
native origin/profile/filesystem services
          |
portable release build + target receipts
          |
native tests + installer payload smoke
          |
exact artifact collector
          |
build-only artifact set OR tag-owned draft prerelease
          |
owner inspection / public publication
```

Public artifacts select only product-sqlite, with no acceptance/test-hooks. Test probes/fixture apps may run separately but are excluded from the release payload. Build the root frontend via the existing build-frontend.mjs seam. Preserve real provider transport, tool approval/atomic result evidence and current route tree; no per-domain rewrites or browser-storage mirror.

## Identity, formats and version

Use productName Cuepoint, visible window title 小光点 Cuepoint, existing mainBinaryName cuepoint-prototype and bundle identifier dev.cuepoint.prototype.offline. Preserve 0.1.0 as the initial current-source version. The numeric MAJOR.MINOR.PATCH declarations in root package.json, desktop package.json, Cargo.toml and tauri.conf.json must match. Cargo.lock root-package version follows Cargo.toml. Tag desktop-v0.1.0 matches version0.1.0; the GitHub object is draft/prerelease, independently of the app's numeric version.

The normal local build wrapper must read the normal product name from config instead of keeping a stale hardcoded path. Retain Cuepoint Acceptance and Cuepoint Product Review identities/names/config isolation and their existing Mac evidence locations. No prior profile is read/copied and no owner schema migration is introduced. Changing an internal identifier later is a deliberate product decision, not an automatic release-script suffix.

| Policy target | Host label | Rust triple | Bundles / canonical assets |
| --- | --- | --- | --- |
| macos-arm64 | macos-14 | aarch64-apple-darwin | dmg; Cuepoint_0.1.0_macos_arm64.dmg |
| macos-x64 | macos-15-intel | x86_64-apple-darwin | dmg; Cuepoint_0.1.0_macos_x64.dmg |
| windows-x64 | windows-2022 | x86_64-pc-windows-msvc | nsis; Cuepoint_0.1.0_windows_x64_setup.exe |
| linux-x64 | ubuntu-22.04 | x86_64-unknown-linux-gnu | appimage,deb; Cuepoint_0.1.0_linux_x64.AppImage and .deb |

Maintain a closed machine-readable release policy consumed by build, smoke and collector; no independently copied target lists. Verify host architecture, target triple, format and actual package architecture. Host labels pin OS family, not the full mutable runner image; record actual runner/image/tool versions.

## Native platform boundary (R1)

### Bundled origin and WebView storage

Centralize the closed origin policy: macOS/Linux tauri://localhost; Windows http://tauri.localhost with current default use_https_scheme=false. Reuse it for trusted command callers, navigation, microphone permission and media CORS. Retain main label, empty userinfo/password, no port/query and entry path constraints; hash routes remain allowed. Reject external/file/arbitrary localhost protocols and lookalike hosts. Do not widen the CSP or accept arbitrary HTTP origins to repair Windows startup.

macOS keeps the existing SHA256-derived WK data_store_identifier and minimum14. Windows/Linux use an explicit data_directory derived by Rust from trusted app-private identity plus the fixed storage owner. Normal and review namespaces remain distinct; no renderer path or mutable preference chooses this directory. Startup profile remains frozen/nonwritable and SQLite initialization failure remains visible, without fallback.

### Windows file authority

Introduce a handle-aware native stat/identity seam rather than faking inode from path, size or mtime. Unix preserves dev/inode/link contracts. Windows queries actual no-follow path handles and opened File handles using a narrowly audited pinned Win32 binding. Compare volume/file identity, link count, type/reparse attributes, size and modification state across read/write/publication/recovery boundaries. Use deterministic handle lifetimes.

Reject reparse entries including junctions for managed roots, ancestors, database sidecars, stages and final files. Preserve current generated path/opaque renderer reference boundaries. A preflight canonicalized path is insufficient authority and OPEN_REPARSE_POINT alone is not proof against intermediate swaps.

Local NTFS is the initial Windows managed-workspace verification baseline: supports current no-overwrite hard-link publication and volume+64-bit file ID. Do not truncate a ReFS128-bit ID or claim FAT/network/cloud-placeholder support. Unsupported identity/filesystem outcomes are typed and actionable; retain current external bytes. Shared Boundary, product_binary, database and retained import/reference callers must use the same seam, without breaking Unix recovery.

### Windows publication/durability gate

The owner explicitly reviewed research/native-files-implementation.md and approved the narrower Windows first-test contract on 2026-10-12: supported regular-file bytes and metadata flushing, local NTFS no-overwrite hard-link publication, and intent/SQLite process-termination recovery. Newly created directories, hard-link names, stage unlink operations and completion-marker names are not promised to persist after sudden OS crash or physical power loss. Unix directory fsync remains unchanged.

Name the Windows process-only namespace validation policy explicitly; never describe an ordinary directory open/check as a flush or Unix-equivalent persistence barrier. Flush written ordinary file bytes and metadata using a writable actual handle. After fresh-target hard-link publication, verify final/stage identities and expected link count, open the final writable/no-follow handle and flush it. Unsupported identity, filesystem or real file-flush failures remain errors. No elevation or unconditional dummy success.

Retain write-ahead intents, provenance, ready-state ordering, SQLite claim atomicity and interrupted-state reconciliation. Before-publication failures remain ordinary failures; after external publication keep the existing published/error receipt without cancellation, rollback or automatic retry. Internal interruption retains intent/provenance and visible recovery refusal for ambiguous authority; never invent ready rows or erase unproven bytes. The corresponding-host gates exercise API flags/results, junction/ancestor authority, actual file flushing and process interruption/reopen. Passing those tests is process-recovery proof, not power-loss proof. Failure to prove this reviewed target contract prevents release completeness.

## Portable tooling and package build (R2/R4/R6)

Pin Node24.11.0, pnpm10.15.0, Rust1.99.0 and existing Tauri CLI/API/crates/locks. Use frozen installs in root and desktop packages and locked Cargo. Current local pnpm stays the explicit approved /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm, verified outside Codex runtimes. Hosted mode uses deliberately configured runner tools and records resolved executable versions; it must not reuse the developer's ignored .tools homes or Mac path.

Preserve the default local tools lane. Add an explicit closed hosted/release mode or equivalent shared resolver that supplies real Cargo/target roots to native tests and release scripts. Make probe resolution platform/target aware (.exe on Windows), including scripts/native-storage-regression.mjs and self-hosted helpers. Avoid unsafe .cmd/shell interpolation: prefer invoking the installed JS CLI with process.execPath or platform-aware reviewed executable launch. Do not silently fall back to a different package-manager/tool version.

Proposed source owners:

- desktop/tauri/scripts/release-policy.mjs (or equivalent JSON): one target/version/receipt policy.
- build-release.mjs: validate arguments/source/tools, build existing normal frontend, invoke pinned Tauri CLI, discover only this run's whitelisted output, verify/rename installers and write target receipt.
- release-artifacts.mjs: receipt/schema/path/hash checks shared by collector and meaningful failure regressions.
- Existing tools.mjs/build-app.mjs and native probe helpers: portable tools/native test path integration; preserve local acceptance receipts.

Release output/evidence lives in a fresh ignored run-specific directory, not a task directory or bundle. Record source before/after and reject changing inputs or stale output. Do not copy .tools, .acceptance, local credentials/data, fixture frontends or test executables into packages. Include only approved PNG/ICNS/ICO assets; verify matching embedded icons.

Pinned Tauri CLI2.12.1 changes bundle-type markers in Windows/Linux payloads and restores the build executable after each format. Use `--no-binary-patching` in the release lane so its recorded executable SHA matches each installed/extracted payload; the updater is excluded. On macOS request `app,dmg` internally to retain the signed `.app` for executable verification; only the DMG remains an eligible asset. This preserves the five-installer contract. The independent review verified both behaviors against the [pinned bundler source](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle.rs).

Mac config retains minimum14/hardenedRuntime/ad-hoc '-'. Verify actual binary architecture, codesign and DMG content. Windows uses NSIS and the current default WebView2 bootstrapper install policy, clearly documented as needing internet when the runtime is absent; verify existing-runtime and runner installation paths. Linux builds on22.04, declares DEB dependencies and configures AppImage media framework with required GStreamer packages. Record codec/dependency evidence and license provenance; no universal-distribution claim.

## Runtime evidence (R3/R7)

All targets run native Rust storage/origin/file tests and the maintained shared SQLite core/business gate on their own host. Preserve all current table/tool assertion anchors; update only executable/environment resolution where needed, not expected outcomes. Existing browser/Agent tests and Mac reference lanes remain separate.

Windows/Linux: external pinned tauri-driver and compatible native driver, Linux Xvfb. Launch the payload installed/extracted from the actual installer (Windows per-user silent install on fresh runner, Linux DEB/AppImage contents), and prove executable/frontend identity. Linux DEB and AppImage each run the complete sequence in a separate fresh workspace/profile state with independent format-specific receipts; extracted AppImage smoke must be labeled extracted-payload proof, not FUSE/desktop-launch proof. Reset only a recorded runner-created root between formats, never an arbitrary app directory. No embedded WebDriver plugin or acceptance command is added. Through existing project/material UI: create unique project, import deterministic TXT >262144 bytes, preview marker, close/observe process exit, remove only original fixture, relaunch and verify retained UI. After exit, a host-only read-only SQLite reader verifies exact rows, committed binary reference, generated file size/hash and owned bytes. Avoid direct invoke calls, SQL seeding or manufactured claims. Reports/screenshots are bounded and contain only runner-owned fixtures.

Mac ARM64/Intel: inspect/mount DMG, verify .app/executable/icon/architecture/signature, run native suites and a bounded corresponding-host process launch with captured diagnostics. A process staying alive does not prove UI/store success. Rerun actual local Mac UI import/preview, native Save and restart proof for the changed shared product on an available unlocked host using only disposable task-created fixtures and a unique isolated SQLite review identity. Verify the current normal bundle separately without opening an existing normal user profile. Current real media/codec, microphone, print-dialog, provider and Intel UI/hardware checks remain explicit pending cases where unexercised; they are not implied by this packaging gate. External tauri-driver has no native WK driver. Do not add a production testing backdoor to hide that limit.

Required collector gates are named per target, not fabricated as uniform full-platform parity. Release notes distinguish automated storage smoke, Mac launch/basic artifact evidence, local actual UI and pending Intel/hardware/system interactions. Microphone, printing, live suppliers, PDF/video/audio codecs and power loss are not established by a TXT/process restart smoke. Existing functionality remains present; test-distribution labels disclose gaps.

## Actions and collector (R3/R5)

Add .github/workflows/desktop-release.yml. Proposed flow: prepare -> quality -> four native builds/checks -> collect -> optional tag-only draft upload. GitHub requires a manual-dispatch workflow to exist on the default branch; owner push of a new development-branch workflow alone is not enough. Use an explicit push trigger limited to codex/desktop-release-pipeline for the first build-only feasibility/bootstrap run. It has no Release write permission and cannot enter the publisher. After the reviewed workflow lands on main, workflow_dispatch remains build-only and may select a reviewed ref. desktop-v* tags alone create draft prereleases. No ordinary v* desktop trigger or modification to GHCR publication. PR checks are read-only and can validate policy/collector/source contracts without full installer builds on every PR. These exact event/ref gates must be tested; no generic development-branch publish condition.

Build jobs have contents:read and fail-fast:false; each uploads one explicit target artifact plus finite evidence. Verification accepts this run's exact artifact IDs/names/attempt provenance, not arbitrary repository-wide globs. Actions are pinned to verified commit SHAs with readable version comments; add checks for action/input/YAML contracts. Use shared run policy/sourceSHA and match tag to all version declarations. Source corrections require a new version/build; rerunning an old workflow retains its original SHA.

Each target receipt includes schema, repo/workflow/source SHA, event mode, tag/version, run ID/attempt, target/host/triple, normal profile/SQLite/bundle identity, lock/config/tool/input hashes, checks and installer filenames/length/SHA256. Different successful attempts may be reused only for one source/run/version/policy with explicit artifact selection; duplicate/ambiguous target payloads fail.

Collector requires exactly four targets/five installer files and only named metadata, checks closed paths/no links/file sizes/hashes/architecture/version/storage/status, and writes canonical SHA256SUMS plus release-manifest.json. Raw binary/updater assets are not download deliverables. Installer hash mismatches fail regardless of artifact-download action warnings.

Only the final tag job gets contents:write (actions:read only if REST artifact retrieval requires it), using GITHUB_TOKEN. No PAT/signing secrets. Serialize by repository+desktop tag, cancel-in-progress:false. Recheck the remote tag's exact commit.

Use authenticated paginated Release listing to discover draft objects. Create draft:true/prerelease:true/make_latest:false with an explicit workflow/tag/source/payload ownership marker and initial incomplete status. Require an existing verified tag; do not implicitly create one. Reject published/immutable/duplicate/unowned or mismatched objects. Upload only missing assets; skip identical verified assets; changed or unrelated payloads fail without clobber/delete. Reconcile only an operation-owned upload placeholder when proven safe. Verify remote complete asset set, size/digest (or downloaded hash) and draft ownership before replacing incomplete with complete.

Release upload is not atomic and REST does not lock out owner publication. The owner must publish after successful collector completion. Failure leaves a visibly incomplete draft. Preserve original artifact IDs for exact retry; expired payload or changed rebuild bytes requires explicit recovery/new version. Document artifact retention and never amend/move an existing version tag to hide failed source.

## Rollback and activation

Before activation, reviewed commits can be reverted or the desktop workflow disabled; no external Release was created by local implementation. After a failed tag run, retain diagnostics/incomplete draft and fix source under a new version or resume exact original assets. No automatic asset deletion, tag rewrite, public publication or paid request replay.

Root prepares local source/tests/docs and independent review, then presents the concrete grouped work-commit plan. After approved local work commits, owner push of the exact bootstrap branch activates build-only four-host proof. Default-branch manual dispatch is available only after the workflow is present there. Archive/journal and public Release promotion wait for their respective accepted gates; hosted/draft outcomes remain separate and PRD AC1-AC4 are not waived because a token, runner or lock screen is unavailable.

## Primary-source research

See research/repository-audit.md, official-distribution-options.md, hosted-product-smoke.md, release-collection-design.md and windows-native-feasibility.md. Those preserve exact official links/evidence and distinguish recommendations from observations. Windows barrier/protocol feasibility and actual corresponding-host execution remain explicit execution gates; neither is inferred from documentation or prior Mac evidence.

## Owner decision: packaging-only delivery (2026-10-12)

The owner explicitly superseded the single-test exception proposal: “可以关掉软件包打包这个工作流里面全部test…我发布前肯定自己test过了…这里只需要打包就行”. This authorizes removing the desktop workflow's full quality/native/shared SQLite/test and installed-payload smoke gates for manual, bootstrap and desktop-tag builds. The separate GHCR/daily quality workflow is unchanged. The owner handles functional testing before publication; no automated testing success may be inferred from a packaging run.

The desktop workflow now needs only source/version/matrix preparation, locked build prerequisites, four corresponding-host package builds, file/source/host/version/hash closure, collection of five installers and existing tag-only draft delivery. Remove external UI drivers and smoke-only Linux dependencies. Keep actual compilation and required bundle dependencies. Keep unsigned/ad-hoc identity, exact source, fresh outputs, immutable retry, conservative draft ownership and owner-controlled publication.

Successful build receipts must explicitly say `state: packaged`, with empty test checks/evidence, rather than inventing passed test or launch/storage evidence. The collector accepts this package-only state only with all existing source/product/host/tool/asset/hash closure checks. Existing standalone test/smoke commands may remain available for explicit developer use; they are not run by desktop packaging. Generated limitations and user docs must say tests/runtime acceptance are the owner's responsibility, and the known64turn native performance issue remains unresolved. No product/Agent/database code changes, test workload/deadline edits, migration or new test-skip options are needed.

## Packaging follow-up: tracked source enumeration (2026-10-12)

The owner supplied a macOS ARM64 packaging failure at the initial Git tracked-file snapshot (`spawnSync git ENOBUFS`). Resolve the default synchronous output-buffer failure while preserving the exact existing hash scope and all package-only delivery decisions. See `research/release-source-list-buffer-boundary.md` for observed evidence, ownership, scope and focused local validation. No CI tests, product/data changes or remote actions are added.
