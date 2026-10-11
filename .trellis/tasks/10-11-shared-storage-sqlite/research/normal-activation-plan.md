# Research: Normal product SQLite activation

- Query: Identify the minimum safe normal-build activation edit and focused verification/build identity after complete isolated acceptance.
- Scope: internal
- Date: 2026-10-12

## Findings

### Current ownership chain

| File | Existing behavior and anchor |
| --- | --- |
| `desktop/tauri/scripts/build-app.mjs:8` | Build lane flags; `productSqlite` currently depends only on explicit `--sqlite-product`; line11 forbids that flag outside isolated product. |
| `desktop/tauri/scripts/build-app.mjs:26` | Actual normal/isolated Tauri build chooses `product-sqlite` when the boolean is true; otherwise `desktop`. |
| `desktop/tauri/scripts/build-app.mjs:48` | Bundle receipt storage and derived WK identifier use that same boolean. |
| `desktop/tauri/src-tauri/Cargo.toml:26` | Existing `product-sqlite` includes desktop; no dependency or Cargo default-feature edit is needed. |
| `desktop/tauri/src-tauri/src/desktop.rs:1615` | Trusted startup calls `profile(identifier, acceptance || product-sqlite)`, installs the script and explicit WK store before page modules. |
| `desktop/tauri/src-tauri/src/runtime_services.rs:276` | Closed profile validation, storage name, SHA256 WK identifier and frozen/nonwritable profile injection. |
| `src/lib/productStorage.ts:20` | Browser remains `aifenjing`/IndexedDB regardless of incidental native profile; genuine native validates and snapshots the declared profile. |
| `src/lib/storage/browserDatabase.ts:319` | SQLite does not construct the browser database. |
| `src/db/database.ts:12` | One fixed adapter is selected; SQLite installs actual native managed-byte services; no failure fallback. |
| `src/main.tsx:26` | Routes render only after `initializeProductStorage`; native open failure renders `工作区无法打开`. |
| `desktop/tauri/src-tauri/src/desktop.rs:64` | Native app data owns the new `product-workspace-v1` directory; renderer provides no path. |
| `desktop/tauri/src-tauri/src/full_product_store/mod.rs:184` | New full store owns `.local/state.sqlite` and exclusive writer state; it does not read old schema4/IndexedDB data. |
| `desktop/tauri/scripts/build-frontend.mjs:13` | Normal and isolated products use the same root React frontend; historical acceptance frontend remains separate. |

### Required prerequisite

Do not activate while any actual isolated packaged gate remains pending. Implementation Phase5/Phase6 and design section8 require complete isolated full-product acceptance first: fixed owner/startup/hash navigation, all product families, actual Agent approval/reject/Stop/error/original histories and relaunch, managed-byte retention/missing files/Save, and genuine WK playback/seek/grid-capacity. Unit/probe/parser/build evidence cannot close an unavailable system or host gate.

Record exact isolated app/source/fixture identities and independent acceptance review. Prior genuine-provider evidence is a baseline; a synthetic fixture does not become genuine-model evidence. The existing authorization covers the routine local activation/check/commit work after this prerequisite, but not push/main merge.

### Minimal recommended product edit

Only `desktop/tauri/scripts/build-app.mjs` needs a runtime/build selection change. Replace the current productSqlite declaration and gate (lines10–11) with the following equivalent policy:

```js
const productSqlite = process.argv.includes('--sqlite-product') || (!acceptance && !isolated);
if (productSqlite && acceptance) throw new Error('Full-product SQLite and fixture acceptance are separate build lanes');
```

Keep the existing `acceptance && isolated` rejection and isolated identifier validation. Existing line26 then compiles normal builds with `product-sqlite`; line48 truthfully writes SQLite to the normal receipt. Explicit normal `--sqlite-product` is also valid. Default isolated without the flag remains the existing explicit IndexedDB reference; isolated with the flag remains the accepted full SQLite lane. `--acceptance --sqlite-product` rejects before build instead of silently ignoring the conflicting flag.

| Invocation | Result after this edit |
| --- | --- |
| No flags / normal `build:app` | Root frontend; product-sqlite; normal identifier; SQLite. |
| Normal `--sqlite-product` | Same normal SQLite result. |
| `--isolated-product` with valid review ID | Root frontend; desktop; separate review identifier; IndexedDB explicit reference. |
| `--isolated-product --sqlite-product` with valid review ID | Root frontend; product-sqlite; separate review identifier; SQLite. |
| `--acceptance` | Historical fixture frontend/acceptance feature; existing separate acceptance identity. |
| `--acceptance --sqlite-product` or `--acceptance --isolated-product` | Reject before side effects/build. |

No changes are required in shared React/Agent/business/storage code, SQLite schema, Rust profile injection, dependency locks, normal bundle identifier/name, or CSP/ATS. Do not set all `desktop` Rust builds to SQLite: that would make the deliberately IndexedDB isolated reference disagree with its receipt. Do not add Cargo default features: that broadens probe/test builds and is unnecessary. A direct manual Tauri build with only `desktop` remains an explicit feature-selected reference rather than the official `build:app` release lane; document the normal build command clearly.

### Focused code verification after the edit

The change is a two-line build policy change, not another data-layer implementation. Keep every prior passed input/result immutable. Capture the new complete source identity and diff it against the accepted1122-input identity: only the reviewed activation script (plus separately documented specs/evidence) should change. A changed input invalidates an exact-source reuse claim; reuse the unchanged adapter/business evidence with an explicit scoped diff, not by overwriting the old frozen receipt.

- Review the six lane decisions above against source, including early mutually exclusive errors. The file currently executes builds at module load, so importing it as a test helper would launch builds; do not do that.
- Run the existing desktop types/lint/quality commands and capture exits/logs using the explicit machine pnpm. Preserve the known quality warning/allowance distinctions.
- Existing `tests/productStorage.test.ts` covers explicit native owner identity, malformed profile, later mutation and isolation; `tests/productStorageQueries.test.ts` covers shared query behavior. Their explicit IndexedDB cases remain valid reference-adapter cases and must not be mechanically changed to SQLite just because normal packaging changes.
- The actual native/browser all-table/tool gates already prove unchanged adapter/business inputs. Broaden/repeat them only for additional affected source changes, failing focused checks or unresolved concerns.
- Rust `runtime_services::tests::profiles_are_stable_isolated_and_explicit` at335 verifies storage-dependent WK separation; its existing false argument is intentionally an IndexedDB reference, not the normal-build default. The normal `.app` build compiles the already accepted `product-sqlite` native feature. No new mocked startup proof replaces the actual normal host check.
- Root dispatches the implement/check roles for the activation edit and independent review, updates the owning runtime/build spec after verified behavior, and records the concrete local commit plan/journal. This research does not perform those steps.

### Exact normal build identity and receipt

After code checks, root builds using the standard entry point, without isolated/acceptance flags:

```sh
CARGO_INCREMENTAL=0 /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri build:app
```

Capture pre/post source hashes, command/environment/exit/raw frontend and native build logs. `build-app.mjs` archives the actual app into a timestamped `.acceptance/builds/<timestamp>-normal/` directory and writes `desktop/tauri/.acceptance/normal-bundle.json`. Launch the exact archived path returned by this build; do not use an older normal app or the still-running review bundle.

Expected identity, calculated from current source:

- profile: `normal`;
- identifier: `dev.cuepoint.prototype.offline`;
- storage: `sqlite`;
- WK data-store identifier: **`ed4550f181f509d050d0643fe7cb7ae0`**, first16 bytes of SHA256 of `cuepoint-product-profile-v1:dev.cuepoint.prototype.offline:sqlite`;
- previous normal IndexedDB WK identifier: `e134b2dd73075e564ecb45da1d2e3e25`, intentionally different; no previous profile is opened/copied;
- app name: current `Cuepoint Prototype.app`; executable `cuepoint-prototype` (branding is not part of activation);
- native root: the normal identifier's server-resolved application data plus `product-workspace-v1`;
- managed format: current full product workspace and `.local/state.sqlite`, not the old schema4 prototype.

Verify actual copied `Contents/Info.plist` identifier/executable against the receipt and record executable/plist hashes. Recompute WK ID independently and compare receipt. Preserve the current narrow127.0.0.1 ATS exception, microphone purpose, dark icon identity and media-only loopback CSP; profile activation does not authorize expanding network policy. The receipt alone establishes declared build identity, not observed SQLite writes.

### Focused normal packaged acceptance

Root is sole CUA owner and uses only fresh synthetic data in the normal new full-store identity. Do not read old connection/profile keys or import the isolated database. If the new full-store path already exists unexpectedly, record and investigate its known provenance; do not delete or reset unknown files to fabricate freshness. Existing unrelated normal app-data directories are not a migration source.

1. Quit the isolated product cleanly, launch the exact archived normal app, and verify startup has no Vite/development server dependency, shared hash navigation and full route controls. No fallback/loading loop or reduced native feature gate.
2. Verify the normal owner by actual new full-store ready marker/SQLite file and same-workspace persistent synthetic writes. Merely seeing the normal window or storage receipt is insufficient. Read only the new known synthetic workspace metadata/rows needed for proof, never previous secrets.
3. Smoke the full existing route tree: Agent/home/tasks, projects/video/world, studio IP/library, audio/music, references/memory, settings/connectors. Reuse the isolated full-domain acceptance for unchanged functionality but observe the normal identity's route availability.
4. Create a named synthetic project with a text edit and import a known synthetic image/audio/video; ensure live shared views update. Configure only the existing public loopback fixture/token in the fresh normal profile. Run one actual approved project write and inspect saved original result; verify no automatic paid/provider replay.
5. Verify managed preview/seek and system Save on one representative owned asset; compare saved bytes/hash. Keep system cancellation truthful. A previously proven system flow need not be exhaustively repeated unless the normal identity or new failure requires it.
6. Quit/reopen the exact normal app. Verify same project IDs/text/managed bytes/chat/original tool histories and normal workspace identity. Confirm no unsolicited chat/generation POST in fixture evidence on idle reopen. Releasing the app must release its workspace lock; successful reopen is focused proof, not a replacement for actual native lock/crash gates.
7. Check that an ordinary browser still uses its separate IndexedDB boundary by existing explicit browser tests; do not inspect or reset the user's browser data.
8. Consolidate normal actual-host evidence with isolated full acceptance and immutable all-table/tool/native gates. Independent review must find no unexplained R/AC exclusion. Only then complete/archive the child; parent synchronization remains in progress.

### Related specs and references

`.trellis/spec/frontend/shared-product-storage.md`, `native-product-runtime.md`, `native-workspace.md`, task `design.md` sections1/4/8, `implement.md` Phase5/Phase6 and PRD R2/R7/AC8–AC10 define the activation order. Current pinned Rust1.99/Tauri2.12.2/rusqlite0.40.2 remain unchanged. No external references were required: source directly owns the build/profile semantics; research executed only source reads and SHA256 calculation of public identifier strings.

## Caveats / Not Found

- Investigation performs no activation, test, build, profile/key/UI access or Git operation. Only this task-local research file is written.
- No dedicated pure build-lane policy helper/test exists; the entry point has build side effects. Avoid a test that imports and executes it to assert flags.
- The normal config still says Prototype. Renaming the package/product/identifier during this minimal activation would add unreviewed identity/branding changes and is not required.
- Actual normal bundle smoke cannot be replaced by the isolated review app because app-data and WK identities differ.
- Source1122 exact-identity reuse ends when activation script changes; keep the old receipts and provide the scoped new-source comparison rather than rewriting them.
- Windows/Linux actual-host proof remains deferred. Synthetic providers establish transport/control/storage behavior, not genuine model quality or paid-provider compatibility in the new normal profile.
