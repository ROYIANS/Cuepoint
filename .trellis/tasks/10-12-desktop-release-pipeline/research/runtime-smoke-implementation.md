# Packaged runtime and external smoke implementation

Date: 2026-10-12. Owner: release_runtime_smoke. This report records source and
local test evidence. It does **not** establish actual Windows/Linux installer
execution, hosted Mac launch, external driver installation or draft delivery.

## Scope and source changes

- `bundled_origin.rs` closes the platform entry policy to
  `http://tauri.localhost` on Windows and `tauri://localhost` on Mac/Linux.
  Navigation, trusted IPC, microphone decisions and the managed media origin
  use that same native helper. Entry/root/index paths and hash routes remain
  valid; other schemes, hosts, credentials, nondefault ports, queries and
  application paths reject. No CSP/CORS wildcard or startup fallback was added.
- `runtime_services.rs` chooses a native app-private
  `webview-profiles-v1/<fixed-profile-digest>` on Windows/Linux. Ordinary native
  directory checks reject a file or alias occupying that namespace. Mac keeps
  its existing WK data-store identifier. Normal, review and IndexedDB reference
  profile identities remain distinct; renderer input never chooses a directory.
- `release-product-smoke.mjs` is an external hosted-only harness. It requires the
  matching host/architecture, fresh runner evidence, an absent actual native
  application-data root and the exact receipted installer. A preexisting user
  profile is refused before launch. It never overrides HOME or writes test IPC,
  WebDriver plugins, acceptance frontends or SQL seed data into public builds.
- `release-smoke-support.mjs` owns closed CLI/path/hash/architecture/icon/profile
  assertions, a finite standard W3C client and the multi-chunk deterministic TXT.
  Windows checks installed PE64 executable bytes and actual ICO resource bytes.
  Linux checks extracted ELF64 bytes and the packaged hicolor PNG against the
  approved source PNG. Mac checks the mounted app executable, Info.plist,
  architecture, strict ad-hoc signature and ICNS bytes.
- `setup-release-driver.mjs` pins tauri-driver2.1.0. After Cargo's locked registry
  install, it hashes the actual cached `.crate` archive against the declared
  crates.io checksum and records both values. Missing, modified or linked
  archives fail before the driver is used. Windows observes the installed
  WebView2 executable version, downloads the exact-version Edge driver and
  checks the compatible first three version components; Linux records the real
  WebKitWebDriver and WebKit packages. Acquisition remains pending on real hosts.

The actual UI sequence uses existing visible project controls, the project
card's normal `aria-label`, the material file input and the existing TXT preview.
No frontend accessibility hook was needed. The fixture exceeds262144 bytes and
places its unique marker in the first16000 preview bytes. The harness observes
the actual executable's process exit after closing the last window, then disposes
the driver session, removes the original fixture and reopens the same product.
Deleting a WebDriver session or forced termination cannot substitute for the
observed close. The loaded JS/CSS entry bytes and frozen SQLite profile are
checked against the exact receipt on both launches.

`verify-release-smoke-store.py` runs only after the second observed exit. Its
SQLite connection is read-only and immutable, with no nonempty WAL/journal. It
requires the schema1 workspace, one exact UI project, a global document material
and version, the canonical owned binary reference, committed binary operation,
no incomplete intent and the actual generated managed asset path. It compares
all file bytes/length/SHA256, checks object identity while reading and requires
the original fixture to remain absent. It cannot repair data or create sidecars.

AppImage and DEB each run independently against fresh application state. The
AppImage case launches its extracted AppRun, not a FUSE mounted image. Mac's
bounded process launch deliberately does not claim UI/SQLite persistence.
Evidence is bounded to top-level JSON/log/screenshots; extracted payloads,
fixtures and WebView profiles are excluded from uploads. Cleanup removes only
the newly created profile with the recorded directory identity and private
owner marker, after observing no corresponding product process.

## Narrow reached-publication correction

The native filesystem owner added the closed normal Save warning `fileSync`
for a failed final writable-file flush after atomic no-overwrite publication.
The shared renderer accepts this code as `published:true`, preserves the exact
length/hash and presents a file-already-saved warning. Existing `directorySync`
and `stageCleanup` outcomes retain their previous behavior. Actual audio/music,
material and general Save callback tests prove that these outcomes do not become
cancellation or automatic retry.

The retained schema4 export lane also calls the native final-file flush helper.
On Windows it holds parent ancestor guards through publication/cleanup. It binds
the original parent/stage/name/open handle, expected length and owned link count
before publishing or removing a stage. A changed or additionally linked stage
is retained. Reached post-publication failures use the existing typed native
Error with code `published` and a phase-bearing file-already-saved message;
cleanup cannot erase that error. Shared adapter and retained prototype bridge
map it to the same safe fixed warning while preserving `published:true` and code.
No broad reference DTO redesign or normal full-product protocol replacement was
introduced. The prototype and acceptance UI already display Error.message and
contain no automatic export retry.

This follows the separately recorded owner-approved Windows first-test strength:
real regular-file flush, no-overwrite publication and process-recovery
persistence. New directory namespace survival after sudden OS crash/power loss
is unpromised. Actual corresponding-host gates remain required.

## Local verification

| Command / lane | Actual outcome |
| --- | --- |
| `node --test scripts/release-smoke-support.test.mjs` |11 passed: source checksum failure guards, driver compatibility, actual PE/ELF/header/icon failures, closed CLI/path, fixture/profile, real installer/executable byte changes, finite polling and WebDriver session/close failure behavior |
| `python3 scripts/verify-release-smoke-store.test.py` |13 passed using real temporary SQLite/files: read-only success, byte corruption, source still present, scope/schema drift, uncommitted binary, foreign reference, path-shaped ID, ambiguous versions, incomplete intent, WAL, symlink and malformed codec |
| Vitest7 focused files |62 passed: native adapter, actual retained export bridge, native Save wrapper, real audio/music callbacks, runtime Save, material preview and About sponsor Save |
| Locked `cargo test --features desktop --lib` |65 passed on local Mac, including both packaged origin policies, profile namespaces, real retained post-publication flush fault and unowned third-link retention |
| Scoped Rust formatting |Passed for bundled_origin/desktop/runtime_services |
| Owned root smoke script ESLint + retained desktop bridge ESLint |Passed |
| Shared native renderer lint |No errors; existing saveNativeBlob complexity warnings remain |
| `git diff --check` |Passed |

The first retained bridge test attempt mocked a different package resolution and
did not reach the actual invoke call. It was corrected to exercise the actual
Tauri wrapper with the ordinary window invoke seam. The first native fault test
compared `/var` against Mac's canonical `/private/var`; it was corrected to assert
the actual canonical destination. Those failures were test setup errors, and the
final runs above passed. The vendored HTTP plugin still emits its existing unused
app/event warnings; no vendored source was changed for this task.

Root owns the frozen full-suite/build gates and final release evidence. No native
GUI, microphone, paid provider, existing normal profile, remote workflow, tag or
Release was accessed by this worker. Actual Windows/Linux drivers, installer
execution, Mac DMG launch and all hosted storage gates remain H1a pending. Exact
Edge acquisition availability, installed PE resource structure and real Linux
WebKit file-input behavior must pass on their corresponding hosts; none is
silently waived by synthetic tests.

## Primary sources

- [Tauri external driver setup](https://v2.tauri.app/develop/tests/webdriver/manual-setup/)
- [tauri-driver server option translation](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-driver/src/server.rs)
- [Edge driver version matching](https://learn.microsoft.com/en-us/microsoft-edge/webdriver/)
- [Tauri Linux icon copying](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-bundler/src/bundle/linux/freedesktop/mod.rs)

These explain source behavior. They are not corresponding-host execution evidence.
