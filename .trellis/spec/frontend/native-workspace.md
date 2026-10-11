# Native Workspace and Packaged Acceptance Contract

## 1. Scope / Trigger

Apply when changing the Tauri 2 desktop product shell, the Rust workspace bridge, packaged compatibility checks, native generated-file export, or browser APIs whose behavior differs inside the packaged WebKit view. Browser mode and Tauri mode are separate owners in the current slice: browser routes keep Dexie, while native `/projects`, `/assets`, and `/p/:projectId` routes use the fresh SQLite workspace. There is no browser-to-native migration, legacy reader, compatibility alias, or data mirror unless a later task explicitly requests one.

## 2. Signatures

The renderer owns the closed `workspace_request` envelope through `desktop/tauri/ui/bridge.ts`:

```ts
nativeWorkspace.ensure(): Promise<NativeWorkspaceState>
nativeWorkspace.state(): Promise<NativeWorkspaceState>
nativeWorkspace.createProject(title): Promise<NativeProject>
nativeWorkspace.importAsset(projectId, displayName, mimeType): Promise<NativeAsset | null>
nativeWorkspace.availability(): Promise<NativeAvailability[]>
native.request(action: Action): Promise<Result>
native.save(blob, projectId, format, mode?, recordedMime?): Promise<Result>
acceptanceRequest({type: "setup" | "ready" | "report" | "openDeniedProbe", json?})
```

`nativeWorkspace` sends the closed `workspace_request` envelope through the Tauri runtime and validates the monotonic `generation` before accepting a result. Its product actions are `ensure`, `state`, `project`, `import` and `availability`; the lower-level bridge additionally supports `create`, `open`, `reopen`, `close`, `restore`, `backup`, `readStart`, `readChunk`, `readClose` and `saveGenerated`. Rust dispatches the same closed DTO in `src-tauri/src/desktop.rs`; unrecognized fields, paths and commands are rejected before filesystem access.

Native generated export accepts `format: "csv" | "zip" | "wav" | "microphone"` and `mode: "retain" | "export"`. `retain` commits a workspace asset; `export` opens a native Save panel and publishes only to a fresh destination. `readChunk` is exactly 262,144 bytes at most.

## 3. Contracts

- Every request carries `version: 1`, a UUID `operationId`, and `expectedGeneration`. Replies carry the current generation and a discriminated result. A stale generation, extra envelope field, extra action field, unknown operation or unauthorized plugin command is an error.
- Native workspace state is SQLite-backed and includes `schema: 1`, `workspaceId`, project summaries, asset summaries, reference timings and `sqliteVersion`. Imported bytes are copied into the managed workspace; original source paths are not live authorities.
- `ensure` opens or creates `<app_data_dir>/workspace` and is idempotent while the current generation owns the worker. A first successful ensure creates the workspace identity and managed directories; a later ensure returns the existing state without changing generation. Product code must never choose an absolute root.
- The normal Tauri frontend is the root React/Vite application. The historical acceptance fixture is built only with `--acceptance`; changing the normal build must not silently replace it with the fixture or make the packaged product depend on a development server.
- `NativeProjectGalleryPage`, `NativeAssetLibraryPage` and `NativeProjectWorkspacePage` are the native route boundary. They must not mirror rows into Dexie; browser implementations remain behind the runtime check until their native domain tables are implemented.
- Tauri packaged entry navigation is restricted to `tauri://localhost` with no port or query and an entry path of `""`, `/` or `/index.html`. The empty path is required because packaged WebKit launches at `tauri://localhost`.
- The acceptance app uses its own identifier and `data_store_identifier`, but must not enable WebKit private/incognito mode: IndexedDB Blob persistence fails in private mode even when an isolated store is configured.
- Native generated files preserve renderer bytes and SHA-256. CSV is UTF-8 BOM text, ZIP begins with `PK`, and WAV is RIFF/WAVE. Existing destinations are rejected without changing workspace state.
- `MicrophoneRecorder` requests the Web standard baseline `{audio: true}` (or only an exact selected `deviceId`). Optional WebKit processing constraints are forbidden at this boundary because they produce `OverconstrainedError` on otherwise valid devices. The packaged acceptance may record an explicit, user-selected skip when the host has no input device; the final report keeps that item in `pending`.
- The acceptance report is written through `acceptance_request` and may finish only with no failed events, both storyboards inspected, print preview confirmed, and either actual denial evidence or an explicit no-input-device skip. A skipped microphone/denial check is never presented as a pass.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Tauri navigation has a foreign scheme/host/port/query/path | Reject navigation and permission; do not widen to arbitrary local URLs |
| Packaged root path is empty, `/` or `/index.html` | Allow the entry document |
| Request has stale generation, extra field, SQL/path field or unknown action | Return a typed rejection; workspace state and generation remain unchanged |
| Read chunk exceeds 256 KiB or session/generation is invalid | Reject and require the caller to close the read session |
| Native export target already exists | Return `exists`; do not overwrite and do not mutate SQLite state |
| `ensure` has no opened worker | Create/open only under the application data directory, validate the ready marker and return a typed state |
| `ensure` is called with an already opened worker | Return the current state and keep the generation stable |
| Native project or asset owner is absent | Return `ownership`; do not create an orphan row or managed file |
| Product code runs in browser mode | Keep the existing Dexie implementation; do not invoke the native command or import local data |
| Export is canceled | Return `canceled`; do not create an asset or destination |
| Renderer bytes/hash differ from native result | Fail the acceptance event; never report a successful export |
| WebKit rejects optional microphone constraints | Do not retry with more constraints; request baseline audio and surface device/permission failure |
| Host has no audio input and user chooses to continue other checks | Record an explicit skip with `requiresFollowUp: true`; keep microphone work in report `pending` |
| Print preview is not visibly white, A4 landscape, chrome-free and complete for both episodes | Do not mark print confirmation or finish the packaged report |

## 5. Good / Base / Bad Cases

- Good: call `native.save` with a verified Blob, choose a fresh native destination, compare returned byte length and hash, then leave workspace state unchanged.
- Good: in a packaged Tauri window, call `nativeWorkspace.ensure`, create a project, import through the native picker, refresh state, and navigate only to the native project overview. Reopening the app reads the same SQLite state and reports missing managed bytes without deleting the row.
- Base: use an isolated acceptance identifier and SQLite fixture workspace, project the same fixture into a temporary Dexie database for storyboards, and shut the app down after the persisted report is complete.
- Bad: allow `tauri://localhost/anything`, enable private WebKit mode, accept a client-supplied SQL/path field, overwrite an existing export, mirror native rows into Dexie, add a migration reader for the old IndexedDB schema, or mark a missing microphone as `NotAllowedError` evidence.

## 6. Tests Required

- Rust unit/integration tests cover closed DTO/envelope rejection, generation checks, path containment, chunk limits, SQLite state/reopen, backup/restore, byte hashes, existing-target rejection and cancel behavior.
- Native product tests cover idempotent `ensure`, project/asset round trips, source independence, missing-file reporting, duplicate managed targets and reopen identity. Renderer tests must cover the adapter's closed result handling, browser/native runtime split and generation regression without requiring a Tauri window.
- Renderer tests cover `MicrophoneRecorder` lifecycle, final chunk handling, device loss, permission errors and the baseline `getUserMedia` shape.
- Packaged acceptance must run the real `.app` and record automatic bridge/media/document/stream checks, user-gesture playback, native CSV/ZIP/WAV byte equality, cancel and existing-target flows, both storyboard DOM/image/full-text checks, and actual system print previews.
- When no input device is available, the acceptance report must assert the explicit skip path and preserve the missing microphone checks in `pending`; it must not fabricate a Blob or denial result.
- Run the explicit local pnpm path for frontend typecheck/lint/tests and the Tauri Rust format, tests and clippy gates. Preserve `runner-receipt.json`, `report.json`, `server-events.json` and screenshots as evidence.

## 7. Wrong vs Correct

### Wrong

```ts
// Let the product renderer choose a database root or mirror native rows.
await db.projects.bulkPut(await nativeWorkspace.state().then(state => state.projects));
// Import an existing browser database into the first native workspace.
await migrateIndexedDbToSqlite();
```

### Correct

```ts
// Product routes select one owner for the active runtime.
if (isNativeWorkspaceRuntime()) {
    const state = await nativeWorkspace.ensure();
    // Render state from the typed native DTO; never write a Dexie mirror.
} else {
    // Keep the existing browser Dexie implementation.
}

await navigator.mediaDevices.getUserMedia({audio: deviceId ? {deviceId: {exact: deviceId}} : true});
// If there is no input device, record an explicit pending skip and preserve
// the requirement for a later real-device acceptance run.
```
