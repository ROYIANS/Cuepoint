# Implementation boundary and acceptance map

## Owners

- Shared product pages own layout, navigation, draft lifetime, visible error/conflict/retry, selection, undo registration and scroll/keyboard lifecycle. They use one typed video repository/controller in both runtimes.
- Existing `src/db/` commands remain the browser persistence/transaction owner through the browser adapter.
- Rust and the typed native adapter own native SQLite mutations, validation, atomic receipts, and managed files. Native rows are never mirrored into Dexie.
- Native icon generation owns only `desktop/tauri/src-tauri/icons` and its reproducible native generation inputs/scripts. Web branding remains alpha-preserving.

## Delivery batches

1. Canonical contract, browser command adapter and shared subscriptions.
2. Native DTO, database, closed actions and transaction parity for supported video commands.
3. The same project library, workspace shell, project landing, episode collection, story editor and shot workbench in both runtimes.
4. Opaque native icon resources generated from the original 1024 artwork.
5. Independent full-scope review and frontend/native/package verification.

These batches are implementation ordering, not separate completion states. Adapter/shell/icon alone does not satisfy this task; the final native route must render the shared feature pages rather than retain the simplified native editor.

## Core command acceptance

| Area | Required native outcome through shared UI |
| --- | --- |
| Project | Create video film/series with selected aspect, display/search/sort, metadata and mode-aware landing |
| Episode | Read ordered children, create, field-baseline edit, delete with last-child guard, restore, reorder |
| Story | Same text editor, retained drafts and conflict/retry feedback, file import/UTF-16 selections, beat CRUD/duplicate/reorder/restore |
| Shots | Same workbench rows/toolbars, text/status/duration/number/category edits, multi-add/delete/duplicate/reorder, inverse receipts, filters/columns/settings |
| Missing owner / stale generation | Block writes, retain the draft, expose error/recovery; never fall through to another store |
| World entities / paid generation / later domains | Typed unavailable capability in the shared UI; no fake records or successful writes into browser Dexie |
| Media references | Explicit representability and availability; no mapper that silently drops a current field |
| Icon | Native-only flattened `#0c0c0c` canvas, preserved pixels/framing, generated sizes and packaged resource verified |

The approved out-of-scope entity domains remain deferred. Capability gating is not permission to replace shared story/shot editors with reduced native-only forms.

## Review assertions

- No direct native page replacement bypassing `AppFrame` or the nested route outlet.
- No native adapter call into Dexie or browser adapter call into Tauri.
- No ignored baseline or successful no-op on a missing mutation owner.
- Undo uses committed command receipts, not a component render snapshot.
- Native wire parsing rejects extra fields, invalid relationship/order/status/range/duration and stale generation.
- Native icon alpha checks are run on actual generated resources and the app bundle, not only a preview.
