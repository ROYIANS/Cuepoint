# Implementation evidence

## Delivered

- Fresh native SQLite schema 3 adds `video_projects`, `episodes`, `beats` and `shots`.
- Native actions support video project state, episode/beat/shot save and reorder operations with owner, order, UTF-16 range, status and duration validation.
- New projects receive a fresh `film` video record and first episode.
- `VideoWorkspaceState` is a deterministic read boundary containing project mode, ordered video rows and deduplicated referenced asset IDs; it excludes credentials, caches, execution authority, absolute paths and provider state.
- The Tauri runtime renders native project, episode/story/beat and shot views. Browser runtime remains Dexie-backed.
- Reopen validates relationship closure. Runtime state can retain a diagnostic row during an external owner race, but mutation and reopen boundaries reject missing owners.

## Verification

- Root `pnpm lint`: pass.
- Root `pnpm test`: 189 files, 3,358 tests passed, 1 skipped.
- Root `pnpm build`: pass.
- Root `pnpm quality`: pass (13 existing lint review errors, 0 unallowed failures).
- Desktop `types`, `lint`, `quality`: pass.
- Rust `cargo fmt --check`: pass.
- Rust `cargo test --locked --features test-hooks`: 20 native, 2 portable, 8 storage tests passed.
- Rust `cargo clippy --all-targets --features acceptance -- -D warnings`: pass.
- Normal and acceptance frontend builds: pass.
- Normal packaged Tauri `.app` build: pass.
- `git diff --check`: pass.

## Deferred

- The normal renderer adapter still performs a shallow response envelope check; full Zod closure remains in the existing Tauri bridge/acceptance path and should be unified in a future bridge-hardening task.
- Native project creation currently defaults to `film`; an explicit series-mode creation control belongs in a later product UI task.
- Full generation/media slots, entity libraries, audio/music, Agent history and sync providers remain later native slices.
