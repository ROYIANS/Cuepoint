# Native workspace product foundation design

## Boundary

This task turns the isolated Tauri storage prototype into the first real desktop product slice. The Tauri window loads the existing Cuepoint React application, while a native workspace repository owns the new desktop workspace. The browser build and its Dexie database remain a separate runtime for now; there is no automatic transfer between the two runtimes.

The fresh-development policy is deliberate: the native schema is designed for the current product and starts empty. Existing developer IndexedDB data, old schema versions and prototype records are not inputs or compatibility targets unless a later task explicitly reopens that requirement.

## Runtime flow

```text
Cuepoint React routes
        │ typed native workspace bridge (Tauri mode)
        ▼
Rust workspace owner ── SQLite metadata
        │
        └── managed workspace files (assets / outputs)
```

The renderer owns request envelopes and UI state. Rust owns the workspace root, SQLite connection, file staging and publication. The renderer never supplies a raw SQL statement, absolute destination path or arbitrary filesystem command.

## Fresh native schema

The first product slice uses a small schema that can grow with current product work:

- `workspace`: one stable workspace ID, schema version and creation/update timestamps;
- `projects`: stable project ID, kind, title, status and timestamps;
- `assets`: stable asset ID, project ownership, media/output kind, display name, MIME, byte length, SHA-256, relative managed path and availability state;
- `asset_refs`: explicit project/asset relationship and optional timing metadata;
- `operations`: bounded audit/status rows for staged copy, cancellation and failure recovery.

The schema is not a projection of every existing Dexie table. Additional domain tables are added in later product tasks when their actual desktop flows are implemented. The initial records use the current domain IDs and typed DTOs, but they are created fresh.

## Bridge contract

The existing closed `workspace_request` envelope remains the starting point. Product calls expose typed helpers such as:

```ts
native.workspace.createProject(input): Promise<ProjectSummary>
native.workspace.importAsset(input): Promise<AssetSummary>
native.workspace.getState(): Promise<WorkspaceState>
native.workspace.reopen(): Promise<WorkspaceState>
```

Every request carries `version`, `operationId` and `expectedGeneration`. Native replies carry the current generation and a discriminated result. Unknown actions, extra fields, unsafe relative paths, stale generations and existing targets fail before mutation.

## File ownership

An import stages bytes under the application-owned workspace, hashes the complete staged file, atomically publishes it under a generated relative path, then commits the SQLite asset row. Cancellation or failure removes only the task-owned stage. A source path is diagnostic input and is never a live authority. Missing managed bytes set `availability=missing` without deleting the asset row or its references.

## Product integration

The desktop bundle reuses the root Vite/React entry and actual navigation. A small runtime adapter selects the native workspace repository when running under Tauri and leaves browser-only routes on their existing IndexedDB owner until a later task gives them native implementations. No compatibility adapter is added to import old browser records.

## Recovery and limits

Reopen must validate workspace identity, schema and file references before reporting ready. An incomplete staged operation is recoverable or explicitly failed and never appears as a ready asset. The task does not implement cloud sync, provider authentication, conflict resolution, full domain-table parity, or a plugin marketplace.
