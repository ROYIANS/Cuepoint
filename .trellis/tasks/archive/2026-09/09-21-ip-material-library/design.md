# Design and ownership

Add additive Dexie tables for IP profiles, project-IP links, material metadata, immutable versions, explicit uses and events. Keep existing Project/MediaRecord shapes and owner checks stable. Version payload owns its Blobs, independent of legacy media cleanup. On adoption clone media/settings into project ownership; bindings pin version and target IDs. Hard delete guards bindings and derivation provenance. IP binding separate avoids unsafe imported IP identity.

Primary owns integration in repo.ts/projectPackage.ts, project gallery, routing, verification, context/docs. Data worker owns domain/materials.ts, db/materials.ts, db/ipProfiles.ts, database.ts and new tests. Material UI worker owns MaterialLibraryPage, children/css and /assets route. IP UI worker owns IpProfilesPage, ProjectIpPicker/reusable selector, /ips routes. No overlap in StudioHubPages: primary removes dead placeholder exports and leaves settings.

Contracts live in research/api.md. UI should use shared domain types and repositories. No writes in components. Standard dialog/alert dialog, explicit save retains failed/dirty drafts, loading vs missing distinction. Browser object URLs revoke and follow current version. Never embed HTML/SVG/documents as executable page content.

Material snapshots for structured settings carry typed entity data + source media records; adopt into new owner with remapped IDs. Updates use expected revision and target fingerprint checks. Existing media IDs are immutable, so adoption update can create a new media ID; old references remain until user replaces them in their editor. Binding history retains used revisions for deletion safety.
