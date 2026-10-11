# Research: Tauri 2 prototype implementation plan

- Query: After the user's explicit choice to verify Tauri 2 first, determine a pinned, isolated, executable storage-first prototype plan and honest macOS compatibility gates.
- Scope: mixed; official primary-source version/source/API research and read-only repository inspection. Write ownership is this research file only. No installation, product/lifecycle edit, native launch or Git operation.
- Date: 2026-10-11

## Findings

### Bounded decision and pins

The selected experiment is Tauri 2, not a permanent production runtime. Preserve the unaccepted Electron draft and its limited capability-probe logs; do not transfer its validation claims to Rust/WKWebView. Use a new nested `desktop/tauri/` package/crate so root dependencies, routes, Dexie data and the existing dev server remain untouched.

Direct official registry/release queries returned:

| Component | Exact proposed pin | Evidence / constraint |
| --- | --- | --- |
| Rust toolchain | **1.99.0**, minimal profile plus rustfmt/clippy, `aarch64-apple-darwin` | Official [stable channel manifest](https://static.rust-lang.org/dist/channel-rust-stable.toml): manifest date 2026-10-01; version `1.99.0 (b940084d7 2026-09-28)`. Pin rather than depend on future `stable`. |
| Rust `tauri` | **=2.12.2** | [Official release](https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.12.2), 2026-10-09, non-prerelease; [crate metadata](https://crates.io/api/v1/crates/tauri). MSRV 1.90. |
| Rust `tauri-build` | **=2.7.1** | [Metadata](https://crates.io/api/v1/crates/tauri-build); tauri 2.12.2 itself requires `^2.7.1`. MSRV 1.90. |
| npm CLI | **@tauri-apps/cli 2.12.1** | [Official npm metadata](https://registry.npmjs.org/@tauri-apps/cli/2.12.1); do not force all Tauri package version numbers to match. |
| npm API | **@tauri-apps/api 2.12.2** | [Official npm metadata](https://registry.npmjs.org/@tauri-apps/api/2.12.2). |
| Rust SQLite | **rusqlite =0.40.2**, `default-features = false`, features **bundled, backup** | [Release-matched Cargo.toml](https://github.com/rusqlite/rusqlite/blob/v0.40.2/Cargo.toml): bundled/backup exist; native binding dependency `libsqlite3-sys ^0.38.2`. No crate-level Rust MSRV was returned; selected full locked graph must actually compile. |
| Native dialogs, if used | **tauri-plugin-dialog =2.8.1** | [Official crate metadata](https://crates.io/api/v1/crates/tauri-plugin-dialog), MSRV 1.90. Invoke dialog Rust API inside trusted app commands; no general JS filesystem port. |

Other minimal direct Rust candidates verified from crates.io: `sha2 =0.11.0` (MSRV 1.85), `serde =1.0.229` with derive (MSRV 1.56), `serde_json =1.0.151` (MSRV 1.71), `uuid =1.28.0` with v4 (MSRV 1.89). Add only what is used, use exact direct versions and commit the resulting Cargo.lock. The lock's resolved transitive graph and actual compiler/build output, not metadata alone, certify compatibility. Do not add SQL/FS/shell plugins merely because they exist.

Release-matched Tauri source inspected: [root Cargo.toml](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/Cargo.toml) sets Rust 1.90 at line 46, runtime-wry `~2.12.1` at line 51 and build 2.7.1 at line 52; [crates/tauri/Cargo.toml](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/Cargo.toml) identifies package 2.12.2 and platform WebView dependencies. Prefer npm CLI's provided native executable over `cargo install tauri-cli`, avoiding an unnecessary second CLI build.

### Machine and future toolchain isolation

This host is arm64, Apple Command Line Tools path `/Library/Developer/CommandLineTools`; the coordinator's preflight reports clang 21. `command -v cargo` / `rustc` produced no paths, and the coordinator found no `~/.cargo/bin`. No Rust installation was attempted.

After updated-plan approval, install official rustup with **no shell/PATH modification**, per-process `RUSTUP_HOME=<repo>/desktop/tauri/.tools/rustup` and `CARGO_HOME=<repo>/desktop/tauri/.tools/cargo`; record installer URL/hash/version and first inspect its `--help` flags. Set `.tools/target` as CARGO_TARGET_DIR. Explicitly invoke the local tool executables through a committed wrapper that supplies these environment variables. A process-local PATH for Cargo's child rustc lookup is acceptable; do not edit shell profiles, repurpose HOME/CODEX_HOME or change global developer defaults.

The [rustup environment-variable reference](https://rust-lang.github.io/rustup/environment-variables.html) documents RUSTUP_HOME and RUSTUP_TOOLCHAIN; [Cargo Home](https://doc.rust-lang.org/cargo/guide/cargo-home.html) documents CARGO_HOME. Record a `rust-toolchain.toml` with 1.99.0 and required components; ignore only concrete local `.tools/`, target/generated build directories and fixture output. User-facing packaged runtime must not require Rust/Node/SQLite-server installation.

Concrete future download sequence: reserve `desktop/tauri/.tools/downloads/`, fetch the official [arm64 macOS rustup-init](https://static.rust-lang.org/rustup/dist/aarch64-apple-darwin/rustup-init) and its [SHA-256 sidecar](https://static.rust-lang.org/rustup/dist/aarch64-apple-darwin/rustup-init.sha256), compare the downloaded bytes before executing, and preserve the download URL/date/checksum in evidence. The sidecar observed on 2026-10-11 was `ec1b9233e7f72990ecd8e62063fa7f6c3dfc2bec8e97f88bff165f9100ac696a`; these are moving installer endpoints, so re-fetch and validate at implementation time instead of treating this observation as a future immutable pin. No installer binary was downloaded or executed during this research. Inspect `--help`, then use the available `--no-modify-path`, minimal profile and explicit 1.99.0 toolchain flags with the local homes above; install rustfmt/clippy for that same pinned toolchain. Record the actual rustup version and `rustc -Vv` result.

Cleanup is limited to the recorded local download/toolchain/build-cache paths beneath the canonical project root, after checking those paths are not symlinks or aliases outside that root. Keep source, Cargo.lock/pnpm-lock.yaml, immutable fixtures and required acceptance evidence. Never delete the user's global Rust homes or edit shell initialization. Retain the local cache while repeat acceptance is useful; its removal is a later explicit local cleanup action, not part of this research. The wrapper must supply the local environment to both direct Cargo commands and the npm CLI's Cargo children.

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly for the isolated nested package. Installed root Vite 7.3.6 / TypeScript 5.9.3 / React can build the minimal TSX fixture through a separate `configFile: false` configuration and existing source alias. No root install/rebuild. [Official Tauri Vite integration](https://v2.tauri.app/start/frontend/vite/) supplies frontendDist/devUrl/beforeBuildCommand behavior; isolate any development server/port and use the packaged app for acceptance.

### Proposed owners and layout

```text
desktop/tauri/
  package.json / pnpm-lock.yaml / rust-toolchain.toml / .gitignore
  build.mjs / tsconfig.json / eslint.config.mjs / knip.json
  ui/{index.html,main.tsx,bridge.ts,compatibility.ts,styles.css}
  fixtures/{portable-contract-v1.json,media/,documents/}
  scripts/{tools.mjs,generate-contract-fixture.mjs,native-regression.mjs,acceptance.mjs}
  src-tauri/{Cargo.toml,Cargo.lock,build.rs,tauri.conf.json,Info.plist}
  src-tauri/{capabilities/main.json,permissions/workspace.toml}
  src-tauri/src/{lib.rs,main.rs,contracts.rs,paths.rs,database.rs,workspace.rs,bridge.rs}
  src-tauri/src/bin/workspace_probe.rs
  src-tauri/tests/{portable_contract.rs,workspace.rs,crash.rs,backup.rs}
```

Native storage owner owns Rust paths/SQLite/copy/journal/backup; renderer owner owns TSX fixture, typed bridge, compatibility helpers and frontend gates. Keep native and frontend ownership separate even if one implementer handles both. Coordinator owns task lifecycle/evidence/spec updates. Do not scatter direct SQL/filesystem access across commands or a generic plugin layer.

`workspace_probe` executes the **same Rust storage owner** without creating a GUI, allowing deterministic failpoint handshake, SIGKILL, reopen and two-process contention. It is a test tool; it does not prove WKWebView compatibility. Actual packaged window tests separately prove production-style frontend→command→native-owner calls.

### Portable contract parity and SQLite authority

Reuse accepted TypeScript helpers in the frontend and fixture generator, **not directly as Rust native code**. Generate an immutable JSON golden corpus by executing current `workspaceId`, `mediaWorkspaceRef`, `resolveWorkspaceRef` and `Sha256`; record source hashes and generator/version provenance. Rust consumes it read-only. Test exact project/Studio refs, workspace identity, case distinctions, composed/decomposed Unicode, emoji, literal slash/backslash/colon IDs, malformed-surrogate rejection at the wire, invalid workspace/path/owner, digest block/padding vectors and long-name rejection. JSON wire decoding must reject malformed/unknown fields without replacement/normalization creating an ID alias.

Existing owners: `src/lib/workspace.ts:37` identity, `:46` well-formed IDs, `:59` lowercase UTF-8 hex, `:86` reference derivation, `:93` lexical containment; `src/lib/sha256.ts:8` incremental hashing; `tests/workspace.test.ts:21` exact existing regressions. Keep the TypeScript accepted bytes/behavior unchanged. Add native golden parity to the existing browser regressions rather than replacing them.

SQLite remains authoritative; generated JSON is an app-owned projection, not an external-edit ingestion channel. No full 49-table migration. Preserve the prior minimal fixture schema and version/identity checks, separate `writer.sqlite` lifetime `BEGIN EXCLUSIVE` owner, short metadata transactions, durable pending-import intent, bounded copied/hashing chunks, exclusive final publication, cancellation before actual commit and authoritative committed outcome. Missing/corrupt managed bytes retain metadata/ref/timing. Imports copy into managed roots and never remain live original paths.

Create all SQLite connections and `Backup` handles in one serial storage worker thread. Keep blocking file/SQLite operations off the GUI thread; async commands submit work and await results. Cancellation flags must be signalable without waiting behind the blocked storage queue; use operation IDs and an independent atomic cancellation registry. Close and backup serialize with mutations; closed owners reject new work.

[rusqlite 0.40.2 Backup API](https://docs.rs/rusqlite/0.40.2/rusqlite/backup/struct.Backup.html) has `Backup::new(&source, &mut destination)` and `step(pages)`, and its handle is not Send/Sync. Busy/Locked are transient step results. Use bounded step/retry/cancellation checks, not an unbounded convenience-loop timeout assumption. Back up a new exclusively reserved directory under the complete storage queue, validate snapshot schema/closure, copy/hash every referenced owned binary, publish strict completion manifest last. Restore only to a newly reserved root; existing empty/nonempty roots reject, incomplete restore cannot open as a new workspace. No writer/profile/credential data enters backups.

The physical-path restrictions and process-vs-power-loss boundary from the initial native research remain applicable. Rust no-follow/exclusive opens and link publication need actual host tests; no network-filesystem or hostile concurrent OS-user claim. An actual compiled binding must report `sqlite_version()`, effective pragmas and integrity-check results.

### Trusted WKWebView, permissions and streaming

Use the Tauri bundled frontend origin, one known window label, isolated app identifier/data directory and disposable workspace. Record actual URL and WKWebView/macOS versions; do not reuse Electron's Node/contextIsolation/sandbox configuration fields, which are different APIs. Deny unexpected navigation/new windows/remote resources. Keep `withGlobalTauri` false unless required; import the narrow API package in a typed frontend bridge.

Critical permission detail: [Tauri capabilities](https://v2.tauri.app/security/capabilities/) states ordinary app commands registered via invoke_handler default to all windows/WebViews. In `build.rs`, use `tauri_build::try_build(Attributes::new().app_manifest(AppManifest::new().commands(&[...])));` so explicit command permissions can be granted only to the intended main window. Explicitly select the production capability set. Also validate trusted WebView/window/origin at commands, closed serde shapes (`deny_unknown_fields`), bounded inputs and owner IDs. Do not expose generic SQL, arbitrary paths, shell execution or a test root/failpoint command to the renderer.

Native file selection/backup/restore destination selection belongs to trusted Rust dialog commands; renderer passes logical IDs, not unrestricted OS paths. The [dialog plugin](https://v2.tauri.app/plugin/dialog/) supports Rust dialog APIs; only the required plugin is initialized. Do not grant frontend FS/SQL/shell defaults.

[Tauri CSP](https://v2.tauri.app/security/csp/) handles bundled-script hashes/nonces. Set specific app-scheme sources, `worker-src` for packaged module/blob workers as actually required, media/img blob sources for local fixtures and exact IPC connectivity; do not disable CSP to make PDF/DOCX work. Prefer packaged fixture bytes or a narrow verified binary command. If native asset protocol is enabled later, its [scope](https://v2.tauri.app/security/asset-protocol/) must cover only the managed fixture assets, excluding DB/writer/profile; do not serve the whole workspace.

For this experiment, use bounded reads by stable asset ID into Blob/object URLs instead of enabling the filesystem asset protocol. Restrict fixture size to at most 32 MiB; native code resolves the asset's authoritative metadata/ref, checks root containment and owned-file status, and returns bounded chunks with verified offsets/lengths. The renderer receives bytes, MIME and logical IDs, never absolute paths. Reject missing/corrupt files distinctly and release object URLs after use. This is a bounded fixture transport, not a claim that large-video random access or streaming is solved; an asset changed between chunk reads must fail or be read from one protected operation, rather than returning a mixed file. Do not grant wildcard asset protocol scope.

[Tauri channels](https://v2.tauri.app/develop/calling-rust/) provide ordered incremental Rust→frontend messages. A free fixture stream must emit delayed chunks before completion and respond to cancellation; it cannot silently return the entire response as one JSON result. A channel→ReadableStream adapter can exercise the existing `readSseEvents` parser, but is not proof of renderer HTTP/CORS streaming. A local loopback SSE fixture exercises actual fetch/getReader/origin behavior; any test-only endpoint/CSP extension is excluded from normal builds. Preserve partial-output/error/cancellation budget semantics and no automatic paid replay.

### Two execution stages and executable gates

**Stage 1 — native storage and minimal real window:** isolated toolchain/package bootstrap after approval; immutable TS golden generation; Rust storage implementation/probe; types/lint/reachability/build; real process failpoint/backup/missing-file/writer tests; packaged `.app` with trusted window/bridge. Stop compatibility expansion until source and process invariants pass independent review.

Suggested native commands through the environment wrapper (working directory `desktop/tauri/src-tauri`):

```text
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked --all-targets
```

Run strict frontend TypeScript/typed ESLint/Knip on explicit nested entry/source manifests, with no root debt allowance. Build via the exact local pnpm and pinned CLI: `pnpm --dir desktop/tauri exec tauri build --bundles app` (invoke pnpm by its full executable path; wrapper supplies project-local Rust environment). Tauri `.app` building is documented in [macOS bundle guide](https://v2.tauri.app/distribute/macos-application-bundle/). Keep normal local prototype bundle distinct from a test-feature acceptance bundle, and verify the normal bundle excludes test commands/server/probe fixtures beyond intended user fixture data.

**Stage 2 — bounded WebView compatibility and observations:** use existing helpers and small local generated fixtures inside the packaged app; no simultaneous full UI migration.

| Existing helper / acceptance | Required evidence |
| --- | --- |
| `src/lib/audio/engine.ts:13,140,169` | Known generated WAV decode, real playback/seek under a user gesture, short OfflineAudioContext mix and exact valid WAV save/reopen. Include error/unsupported-codec behavior; do not count constructor presence as success. |
| `src/lib/audio/recorder.ts:26,29,35` | Report MIME/device API capabilities first. Real microphone recording is a separate pending consent gate; prior browser-context permission is not automatically authorization for this new native app. If currently approved later, configure microphone usage description and perform only the agreed local recording. |
| `src/lib/references/import.ts:17,39` | Actual packaged DOCX module worker and transfer/cancellation, image dimensions/decode, corrupted input. This module imports Dexie at line 1; any isolated fixture-origin DB initialization must be identified, never described as using production storage. |
| `src/lib/references/pdf.ts:3,6,20,37` | Actual bundled PDF worker, offline font/CMap fetch and a CJK-text fixture with correct extracted text. No web CDN dependence. |
| `src/lib/ai/boundedSse.ts:76` | Gradual local free SSE or explicit channel fixture with parser/partial text/cancel/error checks and accurately labeled transport evidence. No provider/API key/request. |
| `src/components/produce/StoryboardPrintPage.tsx:101` | Print-specific fixture preserving current white A4 landscape/no-app-navigation/multi-page layout; actual native preview checked via readable automation or user confirmation, not DOM screenshot alone. |
| `src/lib/episodeDelivery.ts:196` / `projectPackage.ts:345` | CSV/ZIP/download adaptation saves exact local bytes, handles cancellation and avoids partial ready output. |

Actual microphone usage description can be merged through src-tauri Info.plist; [Tauri macOS guide](https://v2.tauri.app/distribute/macos-application-bundle/) documents `NSMicrophoneUsageDescription`. Adding that key is not evidence of granted permission or successful recording. Denied-permission behavior can be tested independently; do not silently prompt/record before current consent.

Release-matched [Tauri 2.12.2 WebviewWindow source](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/webview/webview_window.rs#L2427) provides `WebviewWindow::print() -> crate::Result<()>` under desktop APIs; its documentation specifically says the native method is currently supported on macOS with wry and opens the print dialog. The matching [Webview implementation](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/webview/mod.rs#L1620) forwards to the dispatcher. If the packaged fixture's `window.print()` cannot open the expected dialog, an allow-listed trusted-main-window native print command is a viable macOS fallback with no additional plugin. Invoke it only after print-fixture content/fonts are ready and under the user's print action. Neither method existence nor an `Ok(())` return proves white background, A4 landscape, removed navigation or complete multi-page preview: those remain explicit actual-preview checks, with readable automation evidence or human acknowledgement. This native-method source does not establish Windows/Linux support.

### macOS testing, measurements and finite claims

Current [Tauri WebDriver documentation](https://v2.tauri.app/develop/tests/webdriver/) was updated 2026-06-29. Direct `tauri-driver` remains Windows/Linux only because macOS has no native WKWebView driver tool. However its recommended WDIO embedded-server approach **now supports macOS** through optional `tauri-plugin-wdio-webdriver` and `tauri-plugin-wdio`. Do not write a blanket claim that macOS automation is unavailable.

For this bounded prototype, a compile-gated internal acceptance harness using real frontend invoke/commands plus CUA native-window checks is smaller than a new automation stack. If WDIO is adopted, pin its actual compatible packages and isolate both plugins/server strictly to test builds; command mocks do not count as real storage/IPC proof. System print/microphone dialogs may still require human confirmation. CLI process tests, renderer harness, UI screenshots and human acknowledgements are separate evidence classes.

The preferred no-new-service harness is a test-feature UI mode in the packaged local-origin app: run the real typed frontend bridge and Rust storage commands, render a bounded per-case result log, and submit its final report through a test-only native command to a preselected local evidence destination. Native dialogs may use preselected fixture paths only inside this test feature; normal builds retain trusted dialogs and do not expose test-root/failpoint/report commands. Exercise success, denied/untrusted boundary, chunk/cancel and reopen behavior; capture the actual window state through CUA. Exclude that feature and command capability set from the normal bundle and inspect the normal command list/artifact. This proves direct real WKWebView-to-Rust behavior without claiming a complete automated cross-platform UI suite.

Measure only the actual fixture app: `.app` directory/archive bytes, actual startup-to-ready duration and process-tree memory under a stated idle/audio/PDF workload. Record OS/runtime/build/fixtures and limitations of attributing shared WKWebView processes. No performance advantage claim against the incomplete Electron draft, and no Windows/Linux/macOS-version-wide guarantee from this one host.

### Related specs

- `.trellis/spec/frontend/workspace-storage.md` and `checkpoint-protocol.md`: persistent exact portable identity, owned bytes, bounded hashing, transaction/cancellation authority and partial scope.
- `.trellis/spec/frontend/audio-music.md`, `audio-batch-arrangement.md`, `delivery-export.md`: preserve current media/print/export behavior when exercising real helpers.
- `.trellis/spec/frontend/type-safety.md`, `quality-guidelines.md`: strict external boundaries, meaningful tests, source-frozen evidence and no blanket exceptions.
- `.trellis/spec/frontend/desktop-ui.md`: minimal fixture should use existing neutral typography/spacing and not trigger another full UI redesign.
- `research/native-prototype-research.md` / `runtime-reconsideration.md`: preserved prior findings, finite Electron evidence and reopened runtime choice.

## Caveats / Not Found

- User selected the Tauri feasibility candidate; updated PRD/design/implementation plan still require the coordinator's concrete review step before implementation. This researcher made no installation or activation change.
- Rust is currently unavailable on this host. Pinned package metadata/source/API availability is not compilation or packaged-app acceptance. Lock resolution, isolated rustup behavior, macOS native prerequisites and actual bundle/IPC must be verified after approval.
- rusqlite registry metadata does not declare an MSRV; Rust 1.99.0 is the verified current stable candidate, with actual locked compile as the gate. SQLite's effective runtime version is not inferred from an upstream README.
- Direct TS reuse is limited to frontend/generator paths. Native Rust path/hash implementations require immutable cross-language parity evidence.
- Tauri built-in/framework Rust plugins are separate from Cuepoint's future user-installable plugin API and marketplace; this prototype does not implement that system.
- The unfinished Electron files are retained research drafts, not accepted functionality and not a comparison benchmark. Full production records/original tool history, live managed sync, credentials, other OSes, physical power loss and a permanent desktop runtime decision remain separate parent gates.
