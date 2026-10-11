# Change boundary

## Smallest behavior gap

The native product previously persisted project summaries and managed assets only. Its project workspace still fell back to the browser/Dexie owner for the video spine: project mode, episodes, story beats and shots.

## Actual owners

- Rust `database.rs` and `workspace.rs` own the native SQLite schema, relationship validation, transaction writes, reopen checks and deterministic snapshot projection.
- `desktop.rs` and `desktop/tauri/ui/bridge.ts` own the closed native action/result boundary.
- `src/lib/nativeWorkspace.ts` owns the renderer adapter and generation-aware typed calls.
- `NativeProjectWorkspacePage.tsx` owns the native project, episode/story and shot editing views selected by the Tauri runtime branch.
- Browser routes and Dexie command owners remain the browser runtime owner.

## Expected files

The implementation changes the Rust contracts/database/worker and their regression tests, the Tauri bridge schemas, the shared native renderer adapter, the native project workspace page, and the native/state-management specs. The parent task link is updated by task creation.

## Explicit exclusions

This child does not add data migration, legacy readers, compatibility aliases, Dexie mirrors, cloud synchronization, provider/plugin loading, conflict UI, generation slots, character/scene/prop/style tables, audio/music workspaces or Agent history. It also does not accept external absolute paths as canonical data.

## Local refactor safety

The native worker keeps the existing project/asset owner and adds a separate video table family. Relationship validation is shared by reopen and video mutation paths; the browser owner is unchanged. Rust reopen, stable-ID/order, orphan rejection, renderer runtime split and bridge tests plus the root/desktop gates provide behavior evidence for the cross-layer change.
