# Desktop video production core design

## Boundary

This child extends the real Tauri product beyond project summaries and managed assets. It makes the video project spine native: project mode, episodes, episode story text, ordered story beats, and ordered shots. The browser implementation remains the Dexie owner when the app is served in a browser. The native runtime has its own fresh SQLite owner; it does not mirror or import the browser database.

The first slice intentionally stops before the full generation/media editor. Shot picture slots, character/scene/prop/style entity tables, audio/music workspaces, Agent history, checkpoint publication and provider authentication remain later work. A shot may retain stable references to native-managed assets, but this child does not invent native rows for an unimplemented domain.

## Data flow

```text
Native React routes
       │ typed workspace_request envelope
       ▼
Rust video workspace owner
       ├── projects (video identity and mode)
       ├── episodes (ordered project children)
       ├── beats (ordered episode story units)
       ├── shots (ordered episode production units)
       └── assets / refs (existing managed-file owner)
```

SQLite remains the canonical owner for native records. Rust validates project, episode, beat and shot ownership in one transaction. The renderer receives a typed `VideoWorkspaceState` snapshot and sends narrow mutation actions; it never sends SQL, absolute paths or arbitrary JSON patches.

## Fresh schema

The native schema is extended in a new fresh-development schema revision. Existing development workspaces are disposable and are not upgraded. A workspace created by an older native prototype must be reset/recreated before this child is exercised; no legacy reader or migration branch is added.

Tables:

- `projects`: existing stable ID/title plus `kind=video`, `mode=film|series`, `updated_at` and the project logline.
- `episodes`: stable ID, project ownership, contiguous order, title, logline, script and timestamps. A video project starts with one episode; series mode can add or reorder episodes, while deletion refuses to remove the last episode.
- `beats`: stable ID, episode ownership, contiguous order, title, content, time-of-day and an optional validated UTF-16 script range/excerpt. Character/scene IDs remain deferred references until those native tables exist.
- `shots`: stable ID, project and episode ownership, contiguous order, shot number, beat ID, status, duration, content, notes and the current text/camera fields required by the native list. Picture slots and generated media references remain deferred to the later media slice.

The state DTO returns arrays ordered by their explicit order fields and includes only schema-owned fields. A future checkpoint codec can freeze this state together with the existing asset manifest without reading the live SQLite file.

## Bridge contract

The current closed `workspace_request` envelope remains the transport. Product actions are extended with discriminated actions such as:

```ts
nativeWorkspace.videoState(projectId): Promise<VideoWorkspaceState>
nativeWorkspace.createEpisode(projectId): Promise<NativeEpisode>
nativeWorkspace.updateEpisode(id, patch, baseline?): Promise<NativeEpisode>
nativeWorkspace.reorderEpisodes(projectId, orderedIds): Promise<void>
nativeWorkspace.createBeat(episodeId, input): Promise<NativeBeat>
nativeWorkspace.updateBeat(episodeId, beatId, patch, baseline?): Promise<NativeBeat>
nativeWorkspace.reorderBeats(episodeId, orderedIds): Promise<void>
nativeWorkspace.createShot(episodeId, input?): Promise<NativeShot>
nativeWorkspace.updateShot(episodeId, shotId, patch, baseline?): Promise<NativeShot>
nativeWorkspace.reorderShots(episodeId, orderedIds): Promise<void>
```

The exact wire names can be compacted into one `video` action family, but each payload must remain closed and typed. Every mutation carries the current generation and, for editable text, an optional field baseline. Rust rejects missing parents, foreign IDs, duplicate IDs, incomplete reorder lists, invalid ranges, negative/non-finite duration, unsupported project kind and stale generation before committing.

## Product routes

- `/projects` creates a video project with a selected film/series mode and opens `/p/$projectId`.
- `/p/$projectId` shows the native episode list and project logline. Film mode may open its sole episode directly while still retaining the episode row.
- `/p/$projectId/e/$episodeId` shows native title, logline, script and ordered beat editing.
- `/p/$projectId/e/$episodeId/shots` shows ordered shots with basic text/status/duration editing and beat grouping.
- Existing browser-only child routes remain behind the browser implementation. Native routes must render an explicit not-yet-implemented state for domains outside this slice rather than falling through to Dexie.

## Sync preparation

The native state reader exposes a deterministic, immutable view for the selected project: project identity/mode, episode order, story/beat order, shot order and referenced native asset IDs. It excludes credentials, caches, active execution claims, provider state and absolute paths. This is a local read boundary only; no provider, sync code, conflict resolver or sync UI is included.

## Recovery and rollback

All record mutations use the existing native worker transaction/recovery hooks. A failed or canceled mutation leaves no partial child row and does not change order. Reopen validates the new schema and relationship closure before reporting the state ready. If the native route integration proves incomplete, remove only the runtime branch and keep the browser route owner; do not add a compatibility bridge.

## Risks and deferred decisions

- The existing app has rich shot generation slots and asset relations. Deferring them keeps this child reviewable but means the native shot editor must clearly label unavailable generation controls.
- Schema revision invalidates disposable development workspaces by policy. A later user-facing release may require a separately approved migration task.
- Full checkpoint export still depends on codecs for all selected fields and media references; this child only creates the deterministic native read boundary.
