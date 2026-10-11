# Technical design

## Boundary

The product remains one React/Vite application. Routes and presentation primitives stay shared. Runtime selection moves down to a typed video repository/controller so the same feature pages can render browser Dexie state or native SQLite state. The native workspace remains the owner of native rows and managed files; it never mirrors rows into Dexie.

The current simplified native pages are an implementation gap, not a second product surface. They are removed from the final route tree after shared feature pages are ready. Unsupported domains use an explicit capability state under the shared shell.

## Canonical model and controller

Create a canonical video workspace contract under `src/domain/` or `src/lib/` with:

- project metadata and mode/kind/aspect/output fields used by the project library and landing page;
- ordered episode/story/beat/shot reads;
- draft patches carrying field baselines and conflict outcomes;
- episode and shot filters/settings/visible columns;
- character/scene/prop/style relationship summaries and generation-slot/media availability;
- add/update/delete/restore/duplicate/reorder/bulk commands returning durable undo receipts;
- explicit capability and unavailable/missing-owner states.

The browser adapter wraps existing commands in `src/db/projects.ts`, `src/db/episodes.ts`, `src/db/shots.ts` and existing draft/undo helpers. It keeps `useLiveQuery` subscription ownership in the controller hook and retains current Dexie transaction/undo behavior. It does not copy rows into a new store.

The native adapter expands the previous schema 3 DTOs into fresh schema 4 and closed Rust actions. Rust remains responsible for ownership, complete reorder lists, finite durations, UTF-16 ranges, generation/CAS baselines, relationship membership, media-slot capabilities and transaction rollback. Every response is closed and typed at the normal renderer boundary; the acceptance bridge and product adapter share the same result parsers.

## Shared page tree

`WorkspaceChrome` always supplies the shared `AppFrame`, workspace header and nested route outlet. A provider/controller selected once at the runtime boundary supplies the active repository. The existing feature pages are refactored into shared view components with repository-backed hooks:

```text
route params
   -> shared WorkspaceChrome/AppFrame
      -> VideoWorkspaceProvider (browser Dexie | native SQLite)
         -> ProjectHome / EpisodeList / Story / ShotEditor views
```

The shared views retain their current page-level ownership guards, draft retention, conflict UI, undo registration, scroll owners and keyboard behavior. Runtime-specific code is limited to repository implementations and capability panels. Native pages no longer infer product navigation by parsing `location.pathname` or bypassing the route tree.

The first implementation batch can land the controller and shell without deleting the simplified page until parity tests cover the shared core. The final batch removes the native-only page imports and verifies no route can reach the simplified editor.

## Native schema and wire changes

The shared fields require disposable schema 4; older workspaces are rejected explicitly without a migration reader. Packaged verification uses an isolated application identifier rather than deleting the developer workspace. Model metadata split between `projects` and `video_projects` is projected into the canonical contract. Episode story data, beat ranges/relationships, shot metadata/settings/columns/filters use typed columns according to native database conventions. Generation and media slots expose unavailable capabilities until those domains are implemented. No renderer-supplied SQL, absolute path, unbounded JSON patch or browser record is accepted. Internal committed inverse snapshots remain closed typed state owned by Rust.

Create Rust unit/integration coverage for each command family, reopen closure, ownership, order, baseline conflict and rollback. Keep the deterministic read projection free of credentials, caches, active execution claims, provider state and absolute paths.

## Native icon source and generation

Keep the approved web logo untouched. Add a native-only source that composites the existing mark over an opaque `#0c0c0c` square with the current framing. Use the pinned Tauri CLI `tauri icon` to generate the tracked PNG/ICNS set under `desktop/tauri/src-tauri/icons`. If the source is generated from Web artwork, make the composition reproducible (a small local script or checked-in SVG/data URI source) so future icon regeneration cannot accidentally restore transparent corners.

Verify source and generated images independently: inspect dimensions, corner alpha, corner RGB, center alignment and visual output; then build the macOS app and inspect the actual bundle icon. Do not alter `public/brand/logo*.png|webp` or browser icon declarations.

## Failure, rollout and rollback

Each batch is independently buildable. If repository parity is incomplete, keep the native runtime behind an explicit capability state while the shared browser feature remains the behavior oracle. If route integration fails, revert only the provider/shell branch and retain the native database work; do not add a migration bridge. If icon generation is wrong, restore the previous tracked native icon files without touching web brand assets.

## Evidence

Record browser tests, native Rust tests, adapter/controller tests, type/lint/quality, normal and acceptance builds, packaged smoke traces, route parity screenshots, and icon alpha/color checks in the task research/evidence files before archive.
