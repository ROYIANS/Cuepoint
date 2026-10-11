# Product slice change boundary

The packaged prototype proved the native owner in an isolated fixture UI. The real product routes currently read and write Dexie records directly: `ProjectGalleryPage` uses `db.projects`, `WorkspaceChrome`/`ProjectHomePage` resolve project and episode rows, and `MaterialLibraryPage` uses the versioned material tables. Mirroring native rows into Dexie would create two authorities and would violate the fresh native-owner boundary.

This slice therefore integrates a narrow vertical path in the real Cuepoint shell: Tauri initializes a fresh application-owned workspace, `/projects` renders and creates native project summaries, `/assets` renders native managed assets and imports bytes through the existing typed bridge, and `/p/$projectId` renders the native project overview. Browser mode and richer Dexie editors remain unchanged until their native domain tables are implemented. A project created in the desktop slice never navigates into an unimplemented Dexie editor and missing managed files remain explicit in the native asset view.

The desktop build uses the root Vite/React route tree and AppFrame, with a runtime adapter based on the closed `workspace_request` envelope. There is no IndexedDB-to-SQLite migration, legacy reader, compatibility alias or data mirror.
