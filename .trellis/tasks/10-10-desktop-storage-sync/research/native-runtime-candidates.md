# Native runtime candidates and unresolved integration evidence

Checked 2026-10-10. This is a bounded candidate comparison, not a runtime selection or approval to install/package/deploy.

## Existing source triggers

The repository has no Electron/Tauri/Cargo or SQLite integration files in its tracked source inventory. It is a React/Vite application. `src/lib/audio/recorder.ts` uses MediaRecorder, microphone permission/enumeration and AudioContext; `src/lib/audio/engine.ts` uses AudioContext and OfflineAudioContext for real playback/mixing/export; `src/components/produce/StoryboardPrintPage.tsx` invokes native print; `src/lib/references/import.ts` uses createImageBitmap when available. These actual workflows require runtime acceptance, beyond loading the page shell.

## Primary-source facts

- [Electron introduction](https://www.electronjs.org/docs/latest/) states that Electron embeds Chromium and Node.js and targets Windows, macOS and Linux with HTML/CSS/JavaScript.
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/) requires maintained runtime/dependencies and narrow trusted native access; recommends context isolation and no Node integration for remote content, and validating IPC senders.
- [Tauri architecture](https://v2.tauri.app/concept/architecture/) describes its Rust core, TAO windows and WRY WebViews.
- [Tauri process model](https://v2.tauri.app/concept/process-model/) documents WebView2 on Windows, WKWebView on macOS and WebKitGTK on Linux. OS WebViews avoid embedding the complete Chromium engine, but behavior must be accepted on the real platform engines.

## Inference for this repository

Electron is a reasonable first bounded prototype candidate when preserving the existing audio/media/browser workflows and using TypeScript for native adapters takes priority. Tauri is a reasonable candidate when package size and Rust-native integration take priority. This comparison does not establish measured package/RAM/startup differences or guarantee codec/microphone/print compatibility in either runtime.

The product-approved database-first hybrid does not decide the runtime. Do not select a SQLite binding merely because this research machine has a Node version with a particular API. Runtime/framework choice, packaged Node/Rust versions and supported operating-system versions must be pinned together before choosing a production binding.

## Concrete prototype evidence still required

- Package/open an isolated app with no existing user data; verify microphone device choice/permissions, record/playback/mixing/export, image/PDF imports and print.
- Implement narrow filesystem/SQLite/credential ports without exposing arbitrary filesystem, SQL or execution to renderer/provider plugins.
- Verify owned copy/staging/rename, real-root/symlink constraints, insufficient-space failures and reopen/recovery on disposable roots.
- Verify a durable workspace identity and a schema upgrade/backup policy. Browser-local identity and in-memory application ledgers are insufficient.
- Run actual native builds/acceptance for declared operating systems; one macOS machine cannot prove Windows/Linux behavior.

No runtime package was installed, native app launched or user data migrated during this research.
