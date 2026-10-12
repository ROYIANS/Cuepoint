# Hosted normal-product smoke proposal

Date: 2026-10-12. Read-only research by release_repo_audit, persisted by root. This is a proposed acceptance harness, not actual Windows/Linux proof. No build, profile access or runtime test was performed.

## External runner, production application

Use external tauri-driver WebDriver on the normal release product-sqlite binary, driving existing UI. No acceptance IPC, embedded WebDriver plugin, test frontend or new test feature belongs in public installers. [Tauri manual setup](https://v2.tauri.app/develop/tests/webdriver/manual-setup/) and [Tauri CI guide](https://v2.tauri.app/develop/tests/webdriver/ci/) document Windows/Linux support: Linux uses WebKitWebDriver and a virtual display, Windows a compatible Edge driver.

| Existing seam | Evidence |
| --- | --- |
| Root UI appears only after native store opens; failure has a distinct screen | src/main.tsx:26-44; src/db/database.ts:17-27 |
| Frozen profile selects SQLite before frontend modules | runtime_services.rs:276-295; desktop.rs:1615-1632 |
| Real project form uses normal repository | ProjectGalleryPage.tsx:109-122,345-352,420-422; existing #new-project-name |
| Existing file input imports through ProductStore | MaterialImportDialog.tsx:31-46,63-77; src/db/materials.ts:184-187; storage/native.ts:164-170 |
| TXT preview reads verified native binary lease | MaterialDetailPanel.tsx:170-171; MaterialPreview.tsx:41-55,71-72; storage/binary.ts:49-59 |
| External disk verification can inspect actual metadata and generated asset | full_product_store/mod.rs:23-32; product_binary.rs:22-26,361-370 |
| Pinned Linux upstream supports external automation in release runtime | tauri-runtime-wry 2.12.1 lib.rs:4713-4728, TAURI_WEBVIEW_AUTOMATION=true |

## Finite acceptance sequence

1. Record actual normal artifact executable/frontend hashes and identity. Prove the trusted application-data location is absent on the fresh runner. On Windows resolve the actual known-folder path; overriding LOCALAPPDATA does not prove the native APIs use that path.
2. Launch the packaged production binary with the external driver. Wait for the real project UI, check the frozen SQLite profile and absence of the startup-failure screen.
3. Create a uniquely named project through its visible form. Use the normal library file input to import deterministic TXT bytes, then preview a unique marker.
4. The fixture must exceed 262,144 bytes (storage/protocol.ts:50), exercising multiple IPC chunks. Keep the visible marker within the preview's first 16,000 bytes.
5. Close the application, observe actual process exit, remove only the runner-created source fixture, and relaunch the same binary against the same data root. The project/material/preview marker must remain.
6. After another observed exit, inspect SQLite read-only with a host-side reader. Verify project/material/version rows, committed binary reference, length and SHA256; resolve the generated asset and compare all actual bytes/hashes. A renderer cache or surviving original file is insufficient proof.

Do not replace invoke, call direct test helpers, mock storage, seed SQL or manufacture claims. Use normal accessible controls; any selector improvement should be a normal accessibility label, not a test global. Capture bounded polling, screenshots/reports and child cleanup. A timeout followed by forced termination is not graceful-exit proof.

## Proposed ownership and gates

- scripts/release-product-smoke.mjs: external driver lifecycle, UI actions, identity, restart, bounded evidence.
- Optional scripts/verify-release-smoke-store.py: Python standard-library sqlite3/hashlib read-only checks after exit; CI-only, excluded from bundles.
- .github/workflows/desktop-release.yml: driver setup, Linux Xvfb, smoke execution and success/failure evidence, required collector dependency.
- No acceptance module or feature edits required. desktop.rs:1596-1597,1666 and build.rs:29-46 already separate acceptance commands. Cargo.toml:11-19 guards test probes behind test-hooks.

Public builds must select product-sqlite only and exclude acceptance/test-hooks, acceptance capabilities, test binaries and fixture frontend assets. Mac external WebDriver support is not established by this proposal; local actual macOS proof and a reviewed hosted launch strategy must be planned separately.

## Claim boundary

Future passing evidence establishes normal packaged startup, one UI write/import, process reopen and exact managed-file persistence on named Windows/Linux runner images. It does not prove installer GUI/uninstall/upgrade, microphones, native Save panels, media codecs, PDF/DOCX, A4 printing, live suppliers, crash/power-loss durability or all Linux distributions. Record those outcomes independently and disclose pending platform coverage in test release notes.
