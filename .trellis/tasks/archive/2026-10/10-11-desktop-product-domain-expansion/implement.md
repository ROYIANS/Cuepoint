# Desktop video production core implementation plan

## Ordered work

1. Refresh native workspace and state-management specs, confirm the fresh-development policy, and record the selected video-domain boundary. Do not add migration or browser-data compatibility code.
2. Extend the Rust native schema and closed DTOs for video project mode, episodes, beats and basic shots. Add ownership, order, range, status, duration and generation validation before mutation.
3. Extend the renderer adapter with typed video state and narrow create/update/reorder calls. Keep generation handling and result validation centralized; do not cast raw bridge payloads in pages.
4. Add native product views for project mode/episode list, episode story/beat editing and basic shot list editing. Branch only in Tauri mode; browser routes must continue using their current Dexie owners.
5. Add a deterministic native read boundary for the selected project that returns checkpoint-ready structured records and referenced asset IDs while excluding credentials, caches, active execution authority and provider state.
6. Add focused Rust and renderer tests for fresh schema creation, reopen, ownership, order, baseline conflicts, stale generations, missing parents, invalid ranges/durations, cancellation/rollback, browser/native split and deterministic state ordering.
7. Run root and desktop quality gates, build normal and acceptance frontends, package the normal app, and perform a bounded manual route smoke when the desktop window is available. Record evidence and deferred domains.

## Validation commands

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
node desktop/tauri/scripts/tools.mjs cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
node desktop/tauri/scripts/tools.mjs cargo test --manifest-path src-tauri/Cargo.toml --locked --features test-hooks
node desktop/tauri/scripts/tools.mjs cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --features acceptance -- -D warnings
node desktop/tauri/scripts/build-frontend.mjs
CUEPOINT_STREAM_ENDPOINT=http://127.0.0.1:1234/v1 CUEPOINT_STREAM_TOKEN=test node desktop/tauri/scripts/build-frontend.mjs --acceptance
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri build:app
```

## Review gates

- Native state is owned by SQLite and reopens with the same project/episode/beat/shot IDs and contiguous order.
- Each mutation rejects foreign ownership, stale generation, incomplete order, invalid range/duration and missing parent without a partial write.
- Native routes never call Dexie, and browser routes never invoke `workspace_request`.
- Missing managed assets remain explicit and referenced; a native shot does not silently fall back to an external path.
- The checkpoint-ready reader is deterministic and contains no secrets, caches, provider state or executable authority.
- The normal Tauri bundle uses the real root application; the acceptance fixture remains separate.
- Full generation slots, rich asset entities, audio/music, Agent history, sync providers and conflict UI remain clearly deferred.

## Risky files and rollback

- Risky boundaries: `desktop/tauri/src-tauri/src/contracts.rs`, `database.rs`, `workspace.rs`, `desktop.rs`, `src/lib/nativeWorkspace.ts`, `WorkspaceChrome.tsx`, and the native video pages.
- Existing prototype workspaces are intentionally disposable. If a schema change blocks local development, reset the dev workspace or recreate it; do not add a migration path.
- If a native route is incomplete, remove the Tauri route branch and retain the browser implementation. Do not mirror native rows into Dexie as a fallback.
