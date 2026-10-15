# Research: Repository readiness for desktop installers

- Query: Which existing seams can support hosted multi-platform builds, and which assumptions block actual runtime use?
- Scope: read-only main source/config/history; no compile/build/runtime proof claimed.
- Date:2026-10-12
- Researcher: release_repo_audit explorer; compiled by root.

## Findings

| Area | Anchors | Required work |
|---|---|---|
| Tools | scripts/tools.mjs:6-23; desktop .gitignore:1 | Explicit portable runner tools instead of developer Mac paths/ignored Rust homes; retain approved local toolchain lane. |
| Installer/artifact paths | build-app.mjs:26,45-50; tauri.conf.json:18 | Target-aware bundle formats and output receipts; current app-only/macOS path is not a release pipeline. |
| Existing CI | .github/workflows/ghcr.yml:15-40,45-88 | New desktop matrix/release workflow; existing web quality/Docker pipeline remains separate. |
| Windows trust | desktop.rs:608-627,1634-1639 versus276-279 | One closed platform-specific packaged-origin policy reused for navigation/trusted commands/microphone/media. |
| Windows file identity | paths.rs:70-82; product_binary.rs:150,184,473,552; full_product_store/mod.rs:246 | Real stable file/directory identity/link-count contract on Windows. Successful compile would not fix the existing rejected startup. |
| Windows durability | paths.rs:181-183; full_product_store/mod.rs:182,213; file_transfer.rs:219,264,271 | Platform-correct directory durability with explicit guarantees/limits; no silent success no-op. |
| WebView profile | desktop.rs:1631; pinned Tauri source webview_window.rs:1194-1204 | WK data_store_identifier supported only macOS14+/iOS17+; Windows/Linux require reviewed directory/profile identity. This API is not a demonstrated compile failure. |
| Branding/icons | tauri.conf.json:3-6,11,18-19; icons/README.md:9-13 | Select stable public identity/version; reuse approved dark PNG/ICNS/ICO. Identity controls app-data paths. |
| Acceptance | packaged-regression.mjs:33; native-locks-regression.mjs:73; native-tavily-regression.mjs:92-105 | Existing Mac launch harness does not prove other OS behavior. Add target-specific evidence without relabeling old receipts. |

## Reuse recommendation

Reuse build-frontend.mjs:7-20 followed by the Tauri CLI with product-sqlite explicitly selected. Its root React frontend is portable and already isolated from the historical fixture frontend. A platform-neutral release entrypoint can share this seam, resolve pinned runner tools, target/bundle paths and checksum/version receipts. Do not create another business/UI/Agent implementation.

macOS Objective-C crates and printing are cfg-gated (Cargo.toml:44-48, native_print.rs:76-81). No Windows/Linux compilation failure or macOS x64 build has been demonstrated in this research. Linux Unix identity checks already exist; GTK/WebKit dependencies and installed runtime remain to be verified. Root/Tauri packageManager currently both pin pnpm10.15.0, matching the verified explicit machine binary; CI tooling must pin deliberately and never use Codex's bundled pnpm.

## Scope/history

Archived native prototype PRD:59 explicitly deferred signing/installers/Windows/Linux. Archived09-20-ghcr-release covers Docker only. desktop README:3-8 is stale about normal IndexedDB and must be synchronized when release tooling lands. All current product storage/source contracts remain authoritative.

## Caveats

Read-only source audit; no modifications/tests/builds/profile/credential access by the explorer. Future hosted builds and actual native application runs are acceptance work, not facts established here.
