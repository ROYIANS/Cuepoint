# Native workspace product foundation implementation evidence

## Implemented boundary

- `desktop/tauri/scripts/build-frontend.mjs` now builds the normal Tauri bundle from the real root `index.html` and `src/main.tsx`. The `--acceptance` switch intentionally continues to build the archived fixture UI, preserving its existing selector and media evidence.
- The native bridge has a closed `ensure` action. It creates or reopens the fresh workspace at the Tauri application data directory (`workspace/`) and never reads browser IndexedDB.
- The real Cuepoint route tree keeps `AppFrame`/navigation. `/projects`, `/assets` and `/p/:projectId` select native product views only under Tauri (`window.__TAURI_INTERNALS__`); browser routes retain Dexie behavior. Native project creation and file import call the typed `workspace_request` envelope; imported files remain owned by SQLite plus managed files.
- Native views expose missing/empty state, refresh `availability`, and distinguish present, missing and corrupt managed bytes without deleting the logical asset row. They do not navigate a native project into a Dexie episode/editor that has not been implemented yet. Versioned material/IP/audio/story domains remain later native slices.
- `tests/nativeWorkspace.test.ts` covers the browser/native runtime split, closed result handling, operation IDs, generation propagation and stale-generation rejection with isolated adapter instances.

## Checks

- Root TypeScript: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint` passed.
- Root production build: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build` passed.
- Root Vitest: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test` passed (189 files, 3,358 passing, one existing skip); focused adapter test passed 3/3.
- Normal product frontend: `node desktop/tauri/scripts/build-frontend.mjs` passed and emitted `desktop/tauri/dist/normal` from the root app.
- Acceptance fixture frontend: `CUEPOINT_STREAM_ENDPOINT=http://127.0.0.1:1234/v1 CUEPOINT_STREAM_TOKEN=test node desktop/tauri/scripts/build-frontend.mjs --acceptance` passed and emitted the legacy fixture under `desktop/tauri/dist/acceptance`.
- Desktop types/lint/quality passed with the explicit local pnpm path.
- Rust fmt check, `cargo check`, 29 native tests and clippy passed through `desktop/tauri/scripts/tools.mjs`.
- Normal packaged app build completed as `Cuepoint Prototype.app` (19.87 MiB in the build log); the existing acceptance app remains fixture-only by design.
- There is no independent automated packaged UI click-through for the normal `/projects`, `/assets` and `/p/:id` routes yet; the normal root bundle and `.app` build are verified, while full UI smoke remains a later acceptance task.

## Remaining boundary

The packaged real app currently owns project summaries and managed assets only. Full native domain parity (episodes, story/shots, material versions/IP, audio/music, agent history), checkpoint application and provider plugins are later tasks. No compatibility or migration path is added.
