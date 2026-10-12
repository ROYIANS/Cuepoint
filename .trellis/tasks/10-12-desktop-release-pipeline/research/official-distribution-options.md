# Official distribution options

Research date: 2026-10-12. This document records primary-source evidence and proposed choices. The owner has accepted initial test packages without formal signing certificates; other recommendations remain subject to planning review. No workflow has been dispatched and no Release has been created.

## Build and delivery

- The [Tauri GitHub Actions guide](https://v2.tauri.app/distribute/pipelines/github/) documents native runner builds, projectPath for a nested desktop package, releaseDraft, version-tag or manual triggers, and tauri-apps/tauri-action. A dedicated desktop workflow can reuse the existing shared frontend/native product rather than creating another application implementation.
- [tauri-action](https://github.com/tauri-apps/tauri-action) supports workflow artifact upload independently of Release upload. Prefer matrix jobs that upload validated artifacts, followed by one dependent collector/publisher job. Do not let individual matrix jobs independently advertise a partially successful release.
- [GitHub token authentication](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) supports scoped GITHUB_TOKEN permissions. Prefer read-only build jobs and contents:write only for the release collector; a persistent personal access token is not required for same-repository release uploads.
- [GitHub hosted runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) lists architecture-specific runners. Proposed initial hosts are macOS ARM64, macOS Intel, Windows x64 and Ubuntu 22.04 x64. Fixed host labels and pinned tool/action versions should be resolved at implementation time. Hosted-runner availability is separate from actual application compatibility.

## Proposed first installer matrix

| System | Architecture | Format | Reason / evidence boundary |
| --- | --- | --- | --- |
| macOS | ARM64 and x86_64 | DMG | [Tauri DMG](https://v2.tauri.app/distribute/dmg/) supports a conventional install flow. Keep the current macOS 14 application minimum until deliberately changed. Separate artifacts avoid requiring a new universal-binary policy. |
| Windows | x86_64 | NSIS setup EXE | [Tauri Windows installers](https://v2.tauri.app/distribute/windows-installer/) supports NSIS EXE and WiX MSI. NSIS provides an appropriate first direct-download installer; build it on Windows. WebView2 install behavior must be explicit and exercised. |
| Linux | x86_64 | AppImage and DEB | [Tauri AppImage](https://v2.tauri.app/distribute/appimage/) and [Debian packaging](https://v2.tauri.app/distribute/debian/) cover the two formats. AppImage portability does not imply support for every distribution. |

Windows ARM64, Linux ARM64, MSI, store distribution and automatic updating are proposed follow-ups, not hidden first-release deliverables. The user's request for platform packages is satisfied by the agreed desktop matrix only after corresponding build/runtime evidence is available.

## Linux baseline and media

The [AppImage guide](https://v2.tauri.app/distribute/appimage/) recommends building on the oldest intended supported base because newer glibc dependencies narrow compatibility. Ubuntu 22.04 is a proposed build baseline with WebKitGTK 4.1 support. Required packages must follow the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), not the current Mac's local tool setup.

The same AppImage guide documents bundleMediaFramework and GStreamer requirements for multimedia. Cuepoint contains audio/video workflows, so packaging must address the media framework and required codecs explicitly. A successful installer build alone is insufficient evidence for playback, recording or printing. Linux support claims must name verified baselines and remaining system interaction limitations.

## Signing choices

Owner decision, 2026-10-12: initial test distribution without formal certificates. Select the first row below; the second row is a documented future option only. First-release implementation does not require signing credentials or external account purchases.

| Choice | macOS | Windows | Consequence |
| --- | --- | --- | --- |
| Initial test distribution without purchased certificates | Ad-hoc signing, retaining the current signingIdentity '-' policy | Unsigned installer | Packages can be built without new signing accounts. Installation can require user approval in OS security prompts; clearly label signing/notarization status. |
| Signed release from the beginning | Developer ID signing and notarization | A supported code-signing certificate/service | Requires external account/certificate configuration and owner-controlled secrets. Availability and acquisition are not inferable from source code. |

The [macOS signing guide](https://v2.tauri.app/distribute/sign/macos/) explains Developer ID, notarization credentials and ad-hoc signing. Ad-hoc signing is not equivalent to notarization or an OS-trusted publisher. The [Windows signing guide](https://v2.tauri.app/distribute/sign/windows/) explains unsigned installation and reputation-dependent SmartScreen behavior. Signing does not guarantee that every Windows warning disappears.

Do not request private keys, certificate passwords or notarization credentials in chat. If signed distribution is selected, prepare the exact required GitHub secret names and configuration first; the owner can then configure them in the repository's settings. Purchasing accounts/certificates and uploading secrets require a separate explicit destination/action instruction.

## Recommended release flow

1. Confirm application version and stable public identity; build the normal product-sqlite feature and existing complete shared frontend.
2. Trigger a version-tag build or a manual dry run.
3. Run each native platform's compile/storage/file-origin regressions and installer creation.
4. Record artifact OS, architecture, version, source revision, storage owner, signing status and SHA256 hashes.
5. Aggregate only after all required target jobs succeed; upload one draft GitHub Release with complete notes/assets. A failed required target must not create an apparently complete advertised release.
6. The owner reviews installation/runtime evidence and publishes the draft. Retry behavior and existing-draft handling must be defined in design before implementation.

This is a recommendation for planning, not authorization to push tags, execute hosted workflows or publish a Release. Repository findings and actual host acceptance gaps are recorded separately in repository-audit.md.
