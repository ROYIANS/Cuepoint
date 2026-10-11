# Shared export and system integration boundary

The existing product exports Blob data through browser-only anchors and several callers announce success without awaiting persistence. The approved desktop delivery needs the same export data and commands to await a real native Save panel and bounded byte transfer, independently of SQLite project identity.

Root owns `src/lib/runtimeSave.ts`, the existing `projectPackage` download export, CSV saving in `episodeDelivery`, and export completion/cancellation handling in ProducePage, WorkspaceChrome, ProjectGalleryPage, AudioExports, AudioTimeline, MusicWorkspacePage and audioMusic/shared. Existing ZIP/CSV/audio generation and domain persistence remain their current owners. A canceled external save must not imply deletion of an already generated internal audio mix.

Root also owns one document-level native external-link binding and the `main.tsx` installation, preserving browser anchor behavior and native trusted-document restrictions. Internal storyboard navigation stays in the native main window. `pickZipFile` gets the standard file input cancel event so cancel resolves and releases the existing import UI.

Native services and transfer validation are owned by the native-services worker; root calls its leaf APIs. HTTP transport, storage selection, routes and repository gates belong to the other workers. No duplicated export codecs, business CRUD, Agent loop, migration or new project kind is introduced. Existing behavioral export tests remain; focused runtime tests prove native dispatch, awaited results/errors/cancel, browser URL cleanup and external-link handling.
