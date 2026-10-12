# Desktop cross-platform packaging and GitHub Release

## Goal

Give the owner five downloadable desktop installer files from one shared Cuepoint product, built repeatably on GitHub Actions and collected into a reviewable draft GitHub Release. Users install the software and use its existing UI, business commands and Agent with native SQLite and internally managed files.

## Decisions and delivery boundary

- On 2026-10-12 the user approved task creation/research and selected initial test packages without formal signing certificates: macOS ad-hoc, no notarization; Windows unsigned. No certificate purchase or secret configuration is necessary for this lane.
- The latest user correction, "按你的这个来吧，开始吧。我看错了", selects the original four-target scope below. It supersedes the briefly suggested ARM64 expansion. Windows/Linux ARM64 remain follow-up work.
- Keep the established "小光点 Cuepoint" brand, approved dark icons, current app version 0.1.0, internal bundle/data identifier dev.cuepoint.prototype.offline and executable cuepoint-prototype. Align the normal visible bundle/window name with Cuepoint; acceptance/review lanes keep distinct identities and names. No old-data migration or historical reader is included.
- A dedicated desktop workflow uses desktop-vMAJOR.MINOR.PATCH tags for one draft prerelease; manual dispatch builds and verifies artifacts only once the workflow exists on main. For the first hosted feasibility run, an exact codex/desktop-release-pipeline branch push is build-only and has no Release publication permission. The owner publishes a complete draft after checking its asset set. Existing web/GHCR delivery remains separate.
- Final planning was reviewed and subsequently approved by the user with “开始吧”; local implementation is active. This does not authorize root to push/tag, dispatch remote jobs, upload secrets or publish a public Release. Actual hosted evidence follows owner activation of the workflow; source checks are not that evidence.
- During W1/W2 the owner reviewed research/native-files-implementation.md and explicitly approved the narrower Windows first-test contract: supported regular-file byte/metadata flushing, local NTFS no-overwrite hard-link publication and intent/SQLite recovery after process termination. Newly created directory/file names and unlink/completion names are not promised to persist after sudden OS crash or power loss. Unix directory fsync remains unchanged. Actual Windows host proof of the stated process contract is still mandatory.

| Target | Installer | Baseline / acceptance host |
| --- | --- | --- |
| macOS ARM64 | DMG | macOS 14 minimum; native ARM64 runner |
| macOS x86_64 | DMG | macOS 14 minimum; native Intel runner |
| Windows x86_64 | NSIS setup EXE | Native Windows x64 runner; local NTFS private workspace is the initial verification baseline |
| Linux x86_64 | AppImage and DEB | Ubuntu 22.04 build/runtime baseline with WebKitGTK 4.1 and appropriate media dependencies |

## Background and source evidence

Baseline main is 92bb6d4120053453036fbdb1b3b8f23fb9c56385. The accepted full-product owner covers 49 table families and 95 tools; actual prior packaged host evidence is macOS only. Windows/Linux acceptance and installer distribution were deliberately deferred. No local version tags exist.

| Source anchor | Existing limitation / owning requirement |
| --- | --- |
| desktop/tauri/scripts/build-app.mjs:10,26 | Normal packaging already selects product-sqlite; R1/R2 preserve this owner. |
| desktop/tauri/scripts/tools.mjs:6-23; desktop .gitignore:1 | Ignored local Rust homes and an absolute Mac Node/pnpm path cannot serve fresh hosted runners; R2. |
| build-app.mjs:26,45-50; tauri.conf.json:18 | App-only format and Mac artifact path cannot supply the matrix; R2/R4. |
| .github/workflows/ghcr.yml:3-9,15-40,45-88 | Existing workflow is web quality/Docker GHCR only, with v* triggers; R3/R5. |
| desktop.rs:608-627,1634-1639 versus276-279 | Trusted/navigation origin assumes tauri://localhost although Windows uses http://tauri.localhost; R1. |
| paths.rs:70-82; product_binary.rs:150,184,473,552; full_product_store/mod.rs:246 | Non-Unix identity rejection prevents normal Windows startup; R1. |
| paths.rs:181-183; full_product_store/mod.rs:182,213; file_transfer.rs:219,264,271 | Directory persistence assumes Unix; Windows requires a verified publication/recovery contract, not unconditional success; R1. |
| desktop.rs:1631; pinned Tauri webview_window.rs:1194-1204 | WK store IDs only support macOS14+/iOS17+; non-Mac WebView isolation needs its own trusted directory policy; R1. |
| tauri.conf.json:3-6,11,18-19; icons/README.md:9-13 | Prototype visible naming, existing 0.1.0/macOS14/ad-hoc config, approved ICO/PNG/ICNS; R4/R6. |
| packaged-regression.mjs:33; native-locks-regression.mjs:73; native-tavily-regression.mjs:92-105 | Existing launch harnesses are Mac-specific and do not prove other OS runtime behavior; R3/R7. |
| desktop/tauri/README.md:3-8 | Normal IndexedDB statement is stale; update to current full SQLite/files architecture; R7. |

## Requirements

- R1: Preserve one full shared React/business/Agent implementation and native SQLite/files owner. Repair platform-specific origin, file identity/link/reparse containment, publication/recovery barriers and WebView profile assumptions. Keep fixed startup identity, atomic evidence/domain writes, bounded transfers, no IndexedDB fallback and truthful uncertain/post-publication outcomes. Initial Windows native filesystem feasibility is a mandatory execution gate; unsupported APIs/guarantees cannot silently become success or an accepted target.
- R2: Provide a portable release build seam using pinned/locked tools, closed target/bundle selection and exact version/source/storage identity. Preserve the approved local Mac tools and reference/isolated acceptance lanes. Handle Windows executable suffixes and shell launch rules explicitly; never infer success from stale build output.
- R3: Add native host build/tests/artifact verification for all four targets. Retain web/GHCR behavior. Actual Windows/Linux product startup/import/reopen checks use the real release binary and public UI, not acceptance commands or a mocked bridge. Upload finite diagnostic evidence on failures.
- R4: Produce exactly the matrix's five installer files with approved branding/icons, matching root/desktop/Cargo/Tauri versions, clear OS/architecture/version names and SHA256 checksums. Windows installation must make the WebView2 dependency explicit. Linux packaging must include required dependency/media handling; AppImage does not imply universal distro support.
- R5: Collect exact source/run/target receipts only after all required checks pass. Version tags create/resume one pipeline-owned draft prerelease with least token permissions; manual runs cannot mutate tags or Releases. Missing/failed targets prevent complete status. Verify uploaded assets before marking the draft complete; conservative retries may resume identical payloads, never clobber unrelated/published assets.
- R6: Implement the accepted unsigned/ad-hoc test distribution and disclose installation prompts. Keep formal signing/notarization/updater credentials and account purchases out of scope; document later signing entry points without adding unused credentials.
- R7: Document supported baselines, owner build/release steps, exact check outcomes and pending hardware/system coverage. Distinguish compile, installed/extracted executable, native storage, UI/process restart, provider/media/device and power-loss evidence. Do not generalize one host's success to untested architectures/filesystems/OS versions.

## Acceptance criteria and mapping

- AC1 (R1-R3): Every fresh matrix checkout builds the normal product-sqlite runtime with pinned tools and locked root/desktop JS and Cargo dependencies. No developer-home paths, old data or secrets are required. Corresponding-host origin, filesystem, locking/recovery and native SQLite suites pass. Windows unsupported identity/barrier outcomes remain typed and cannot be bypassed.
- AC2 (R2/R4/R6): All five expected installers are newly produced with verified target/version/profile/storage identity and hashes, correct dark icons and explicit signing status. Public packages contain the full normal frontend and exclude acceptance/test-hooks capabilities, fixture frontends, test probes and local evidence/tool directories.
- AC3 (R1/R3/R7): Windows/Linux UI automation on actual installed/extracted payloads creates a project, imports a deterministic multi-chunk file, previews it, exits, removes the original source, reopens and verifies rows plus exact owned-file hashes. Linux DEB and AppImage payloads each execute this sequence with independent fresh workspace state; one format cannot substitute for the other. Both Mac targets have native tests, bundle/architecture/signature/launch evidence; actual local Mac UI evidence is separate. An Intel or hardware/media/system case not exercised remains visibly pending, not implicitly passed.
- AC4 (R3/R5): All required targets and collection gates precede draft completeness. Collector regressions cover malformed/missing/duplicate/wrong-source/wrong-hash artifacts, incomplete upload, exact retry, unrelated or published Release rejection. Manual mode creates no Release/tag. Real hosted run and real draft upload evidence are recorded after owner activation, not claimed from mocks.
- AC5 (R4/R6/R7): Docs and generated notes state baseline, version, signing/prompt behavior, WebView2/Linux dependencies, exact automated coverage and pending manual tests. Download assets plus checksums are usable for owner review and publication; no automatic updater, sync or old-profile import is advertised.
- AC6 (R1-R7): Appropriate existing root/desktop quality, full shared browser/native storage and Rust checks pass on the final frozen source. Independent Trellis review verifies local contracts before a preliminary work-commit plan/owner push, then reviews actual hosted outcomes and residual limits before final completion/evidence commits. Preliminary source commits never close host acceptance. No paid provider requests or recordings are required merely to validate packaging.

## Technical risks and gates

- Windows directory durability has no established drop-in equivalent in the primary-source research. W1/W2 prepare the candidate protocol; H1a must prove supported operations and recovery behavior on the corresponding host before accepting Windows. The concrete narrower process-recovery alternative has now been reviewed and approved by the owner. Implement that explicit platform contract; do not claim Unix-equivalent power-loss namespace persistence, omit a required target or call the task complete without actual host proof.
- Hosted Windows/Linux GUI driver support, Mac Intel launch/installation, Linux codecs and installer behavior require actual execution. External Windows/Linux WebDriver avoids shipping a testing backdoor; Mac automatic UI parity is not assumed.
- GitHub upload/update is not atomic and cannot prevent the owner publishing concurrently. Use an incomplete draft plus verified completion marker and require owner publication after collection finishes. A same-source rebuild may have different bytes; resume only the original verified payload.
- Local implementation/checks can be completed before remote activation, but four-host/build/draft criteria remain pending until those jobs actually run. Technical failures are investigation work, not permission to relabel missing evidence.

## Out of scope

Windows/Linux ARM64; universal Mac bundles; MSI/RPM/store/mobile distribution; formal signing/notarization; automatic updating; cloud sync/plugins; old-data migration/compatibility readers; purchasing accounts/certificates; root-initiated public publication, remote pushes/tags or secret uploads without an explicit concrete action instruction.
