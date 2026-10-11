# Research: Desktop runtime reconsideration

- Query: Reconsider Electron's bundled browser after the user's SiYuan question; compare Tauri 2 and Wails for this React/Vite media application without prematurely selecting a production runtime.
- Scope: mixed; official upstream documentation/source plus read-only current repository inspection. No install, native launch, product edit, lifecycle change or Git operation. Initial Electron research and current prototype are preserved.
- Date: 2026-10-11

## Findings

### Recommendation

Keep desktop runtime choice open. If avoiding a bundled Chromium runtime is a product priority, the next decision artifact should be a **bounded Tauri 2 feasibility slice**, with Wails stable v2 as the Go-oriented alternative. This is a technical recommendation for what to measure, not authorization to install or implement a replacement now. The existing Electron files remain a storage-contract experiment and evidence; their existence must not decide the product runtime.

Both alternatives keep the HTML/CSS/React/TypeScript frontend. They change the native language, privileged bridge and actual browser engine. No full frontend rewrite follows from choosing either. Neither makes the UI cease using web technology; “desktop appearance” and bundled-browser cost are separate decisions.

### Primary-source facts and version caveats

| Candidate | Verified architecture / status | Implication for Cuepoint |
| --- | --- | --- |
| Electron prototype | Pinned Electron 44.7.0 embeds Chromium and Node; documented in the preserved initial research. | Closest native TypeScript reuse; consistent bundled Chromium candidate. No measured memory/package/startup conclusion yet. |
| Tauri 2 | Rust core plus operating-system WebViews: WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux. [Official process model](https://v2.tauri.app/concept/process-model/). | Avoids bundling a complete Chromium engine by default; actual media/worker/print behavior varies with the platform engine and runtime version. |
| Wails stable v2 | Go application with web frontend and generated frontend-callable Go methods. [Official architecture](https://wails.io/docs/howdoesitwork/). Official release API currently returns **v2.14.0**, published 2026-08-10, prerelease false. [Stable release](https://github.com/wailsapp/wails/releases/tag/v2.14.0). | Natural choice if Go is preferred for storage/sync ownership. Keep generated bindings narrow; do not expose generic filesystem/SQL methods. |
| Wails v3 | Official site explicitly calls it **beta**, even though it describes its desktop API as stable. Latest queried release **v3.0.0-beta.28**, 2026-10-05, prerelease true. [Official v3 status](https://v3.wails.io/), [release](https://github.com/wailsapp/wails/releases/tag/v3.0.0-beta.28). | Treat v3 as a separate exploratory version; do not silently substitute its API/examples for a v2 implementation. |

Important version discrepancy: the Wails v2 documentation header says **v2.15.0**, but `https://api.github.com/repos/wailsapp/wails/releases/latest` returned v2.14.0 during this research. The documentation label alone does not establish a published stable binary/module. A later prototype must pin and inspect the actual selected release/tag and matching Go requirements.

[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) require Rust plus platform tools: macOS Xcode Command Line Tools suffice for desktop; Windows uses C++ Build Tools and WebView2; Linux has distribution-specific native WebKit/GTK dependencies. [Tauri's Vite integration](https://v2.tauri.app/start/frontend/vite/) explicitly supports a Vite frontend. Development toolchains are not a database-server installation requirement imposed on end users.

[Wails installation documentation](https://wails.io/docs/gettingstarted/installation/) requires Go/Node for development and platform-specific tools. Its current text gives Go 1.21+ and Go 1.23.3+ for macOS 15+, but a release's own `go.mod` is the authority when pinning. Wails uses the OS WebView; its [options reference](https://wails.io/docs/reference/options/) includes Windows WebView2 controls and platform-specific Mac/Linux options. Read release-matched options rather than assuming all v3 examples exist in v2.

No published marketing package-size, RAM or startup numbers are adopted here. An OS WebView still contains a browser engine and may involve multiple processes; not bundling it does not prove a particular application's total memory use or speed. Windows installation policy can also supply a WebView2 runtime separately, affecting the actual download/install experience.

### SiYuan: stack and storage are separate choices

Directly inspected upstream `master` files, dated above:

- [app/package.json](https://github.com/siyuan-note/siyuan/blob/master/app/package.json): Electron **44.4.5**, TypeScript **^4.9.5**, webpack build scripts and `electron ./electron/main.js` start command.
- [app/electron/main.js](https://github.com/siyuan-note/siyuan/blob/master/app/electron/main.js): lines 2551 and 2592 select and spawn `SiYuan-Kernel` / `SiYuan-Kernel.exe`. This is an Electron shell with a separate native kernel, not evidence that the desktop uses Go instead of a browser engine.
- [kernel/go.mod](https://github.com/siyuan-note/siyuan/blob/master/kernel/go.mod): Go module; current Go directive 1.26.5; SQLite driver dependency and a project-maintained replacement are present. These are observed upstream versions, not dependencies proposed for Cuepoint.
- [kernel/filesys/tree.go](https://github.com/siyuan-note/siyuan/blob/master/kernel/filesys/tree.go): `LoadTreeWithFix` reads document files at line 215; `LoadTree` at line 241; JSON decoding/rendering and `WriteTree` at line 475. [Repository FAQ](https://github.com/siyuan-note/siyuan#how-does-siyuan-store-data) explicitly identifies workspace `data/assets` and notebook `.sy` JSON document files.
- [kernel/sql/database.go](https://github.com/siyuan-note/siyuan/blob/master/kernel/sql/database.go): SQLite registration/opening at lines 79/328; `InitDatabase(forceRebuild)` and removal/rebuild branch at lines 92–115; separate history and asset-content databases. Together with file-based document loading, this shows a document-file model plus databases for queries/indexing and other subsystems. It does **not** establish that every database/table is merely a disposable cache.

Do not copy SiYuan's storage authority accidentally: Cuepoint currently chose an authoritative embedded database plus owned binary files, with generated JSON replaceable by the app. SiYuan's document JSON approach is a useful reference, but not the same accepted contract. A Go kernel is possible under Electron or under an OS-WebView shell; backend language does not determine the renderer runtime.

The same [SiYuan FAQ](https://github.com/siyuan-note/siyuan#does-it-support-data-synchronization-through-a-third-party-sync-disk) says generic sync-disk synchronization is unsupported while third-party cloud-storage integration exists. Thus “uses ordinary files” is not proof that copying a live SQLite/file tree through any cloud drive is safe. Existing Cuepoint immutable-checkpoint/verified-application requirements remain relevant under every shell.

### Repository capabilities and concrete compatibility gates

| Current code / behavior | Gate in a real Tauri or Wails build |
| --- | --- |
| `src/lib/audio/recorder.ts:26`: WebM/Opus, Ogg/Opus, MP4 MIME negotiation; lines 29/35 enumerate devices and use getUserMedia/MediaRecorder. | Device list, explicit permission gesture, denied permission, 3-second local recording, stop/reopen/decode; supported MIME negotiation in the actual packaged WebView. No new microphone use was performed in this research. |
| `src/lib/audio/engine.ts:13`: decodeAudioData using OfflineAudioContext; line 140 playback AudioContext; line 169 offline mix to WAV. | Decode representative WAV/MP3/AAC and recorded format; playback/seek/fades; deterministic short offline mix/WAV export. A constructor's presence is insufficient. |
| `src/lib/references/import.ts:39`: dynamic PDF import, DOCX worker, image decode/createImageBitmap. | Bundled worker URLs, image decode fallback, DOCX transfer/cancellation and corrupted-input errors under the actual app origin/CSP. |
| `src/lib/references/pdf.ts:3`: PDF worker URL; lines 6–20 package-owned font/CMap assets and fetch. | Offline PDF with CJK fonts loads entirely from the packaged app scheme; workers/asset fetch/MIME/CSP work without a dev server. |
| `src/components/produce/StoryboardPrintPage.tsx:101`: window.print. | Actual print dialog with current white A4 landscape output/no app chrome and complete multi-page content, or a native print port preserving that result. |
| `src/lib/ai/boundedSse.ts:76`: response.body.getReader; `chatStream.ts:396` / `responsesStream.ts:244`: SSE response handling. | A local free fixture endpoint streams gradually, cancels promptly, handles failures and origin policy. If using a Rust/Go HTTP port instead of renderer fetch, preserve chunk/cancellation/budget semantics; do not buffer the complete result accidentally. |
| `src/lib/episodeDelivery.ts:196` / `projectPackage.ts:345`: Blob/object-URL downloads. | Save dialog/native export produces exact CSV/ZIP/WAV bytes; cancellation leaves no partial ready output. Browser download assumptions may need a narrow native save port. |
| `src/lib/workspace.ts` / `src/lib/sha256.ts`: exact portable refs and digest. | Keep TS frontend helpers and cross-language golden fixtures. Rust/Go must validate the same exact IDs/Unicode/path/ownership/hash contracts; no normalization or alternative path codec. |
| `desktop/src/database.ts` / `nativePaths.ts` / `nativeWorkspace.ts`: current Node-native prototype work. | `node:sqlite`, `node:fs`, Electron IPC and preload do not run directly in Tauri/Wails. Port the native owner and verify the same black-box crash/backup/writer tests; preserve earlier evidence rather than pretending it executed under the new runtime. |

The critical question is whether the current media workflows work in **each actual supported OS WebView**, not whether React can render. Start with macOS on this host; Windows/Linux acceptance remains separate. Keep prototype data isolated from production IndexedDB and real credentials.

### Native storage / plugin alternatives

**Tauri:** keep storage mutation/backup/recovery in Rust commands behind scoped capabilities. The official [SQL plugin](https://v2.tauri.app/plugin/sql/) supports SQLite through sqlx and Cargo features, but its frontend SQL interface is not automatically the right domain owner. This app needs a concrete atomic DB-plus-files owner, not generic renderer SQL. A direct Rust SQLite owner is a valid prototype candidate: [rusqlite](https://github.com/rusqlite/rusqlite) documents bundled SQLite and backup features. Pin crate/toolchain versions together; prove backup, held writer connection, fsync, no-overwrite publication and process-kill recovery on the chosen binding before adoption.

**Wails:** keep the same owner in Go, exposing small typed bound methods. A possible embedded binding is [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite), whose primary package docs describe a CGo-free SQLite driver and backup/restore objects. Go `database/sql` connection pooling cannot silently replace the dedicated lifetime writer connection: explicitly retain the underlying connection used for the lock and the short metadata transactions. Choose/pin/verify a driver separately; the shell itself does not solve backup consistency or media staging.

Framework-native plugins (Tauri Rust plugins or Wails Go services) are not an Obsidian-like end-user plugin marketplace. Cuepoint still owns its future JS/plugin manifest, capability boundaries, trusted provider contract and installation/update model. An OS-WebView shell neither supplies that complete system nor prevents it. Keep first provider adapters internal and narrow, regardless of runtime.

### Suggested bounded decision experiment

1. Freeze runtime-independent portable contracts and the meaningful native-storage acceptance cases already designed; record which current Electron work exists and which tests actually passed.
2. If approved, implement one Tauri 2 disposable slice using the existing React/Vite shell and a small Rust SQLite/file owner. Do not migrate production records, add a general plugin marketplace or live sync service. Use a local free stream fixture and local media fixtures.
3. Test the compatibility rows above on a packaged macOS app, including cold launch/reopen and two independent processes. Reuse equivalent crash failpoints and corruption/restore-no-overwrite checks.
4. Measure equal-feature fixtures: application/archive size, first-install WebView/runtime requirements, total process-tree memory at idle and after representative media, cold/warm launch time. Record OS/runtime versions and fixture sizes. No performance conclusion from empty-shell versus full-product comparisons.
5. If Rust ownership is the main adoption concern, test the same slice under pinned Wails stable v2.14.0 before considering beta v3. Compare actual developer/toolchain burden and capability results.
6. Select a production runtime only after these observed results and the user's priority tradeoffs are reviewed. Real sync/service and full production codecs remain separate parent deliverables.

### Related specs

- `.trellis/spec/frontend/workspace-storage.md`: exact identity/reference codec, independent owned copy and missing-byte semantics.
- `.trellis/spec/frontend/checkpoint-protocol.md`: partial immutable protocol scope, transport/application distinction and no generic credential/raw-record export.
- `.trellis/spec/frontend/audio-music.md` / `audio-batch-arrangement.md`: existing audio commands, scheduling and export ownership; runtime migration must preserve them.
- `.trellis/spec/frontend/desktop-ui.md` / `delivery-export.md`: current UI/print/export contracts are renderer-portability gates.
- `.trellis/spec/frontend/quality-guidelines.md`: exact final source/command/runtime evidence; passing one platform is not another platform's proof.

## Caveats / Not Found

- This is reconsideration research, not an approved runtime switch or completed prototype. No Rust/Go/Wails/Tauri package/toolchain was installed or invoked.
- Upstream SiYuan `master` and documentation are moving references. The dates/observed source paths above support the architecture finding, not a reproducible release benchmark. A production comparison should pin upstream commits/releases.
- Wails v2 documentation header and latest-stable release metadata differ. Release-matched source/API/toolchain verification is required before implementation.
- No actual app-size/RAM/startup/media/print measurements were taken; upstream marketing comparisons are deliberately excluded.
- SiYuan's index/database architecture is not evidence that Cuepoint should change its already accepted DB-authoritative design or depend on SiYuan as a host.
- Rust/Go storage adapters require implementation work and their own gate coverage; frontend reuse does not imply native Node source portability. No live provider/paid request/complete history codec/production-data migration was exercised.
