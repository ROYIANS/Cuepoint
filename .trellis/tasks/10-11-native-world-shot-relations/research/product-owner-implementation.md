# Product-owner implementation

## Change boundary

The existing normal Tauri root product inferred SQLite from runtime identity. That inference disabled complete Dexie-backed routes, queries, imports and media. This batch changes startup storage selection and the existing consumers of that selection; existing TypeScript business commands and accepted presentation remain the implementation.

Owned paths: `src/lib/productStorage.ts`, `src/lib/runtimeIdentity.ts`, the existing native detector's delegation in `src/lib/nativeWorkspace.ts`, `src/db/database.ts`, `src/lib/videoWorkspaceRepository.tsx`, `src/routes/_studio.tsx`, `src/routes/_studio.index.tsx`, `src/lib/media.ts`, `src/lib/useShotMedia.ts`, MaterialLibraryPage, ProjectGalleryPage, ProjectHomePage and WorkspaceChrome, plus focused owner/consumer tests. Gallery and WorkspaceChrome export-call bodies belong to the root integrator after the storage-gate edits. Native services, HTTP, save helpers, dependencies, specs and task metadata belong to other workers/root.

No migration, data mirror, business-command rewrite, second UI, protocol changes, styling changes or automatic fallback is added. SQLite adapter behavior remains available only under explicitly selected SQLite configuration/tests. Regressions retain its existing native receipts, patch, conflict and transaction coverage.

## Startup profile interface

The native worker installs a frozen, pre-module `window.__CUEPOINT_PRODUCT_PROFILE__ = {version: 1, id: <stable app identifier>, storage: "indexeddb" | "sqlite"}`. `productStorage` validates and freezes a single resolved product configuration before database construction. Browser identity ignores native profile data and keeps `aifenjing`; genuine Tauri requires a valid profile and uses `cuepoint-desktop:<id>:v1` for its fresh IndexedDB identity. No preference/query string or later profile mutation changes the loaded owner. SQLite is selected deliberately in isolated fixtures/tests, never because Tauri exists.

Native services owns the distinct persistent WK store identifier derivation and isolated normal-product build lane. A namespace alone is not packaged store-isolation evidence. Root records actual app close/reopen and isolation outcomes separately.

## Checks

Executed with the user's explicit machine pnpm path `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`:

- Focused Vitest command: `exec vitest run tests/productStorage.test.ts tests/productStorageQueries.test.ts tests/sharedVideoPageParity.test.ts tests/videoWorkspaceRepository.test.ts tests/videoWorkspaceBrowserRepository.test.ts tests/useShotMedia.test.ts tests/workspaceChunkCopy.test.ts tests/workspace.test.ts tests/productRouterHistory.test.ts tests/nativeWorkspace.test.ts tests/nativeWorkspaceConcurrency.test.ts tests/nativeWorkspaceDeletion.test.ts --maxWorkers=2`. Result: **12 files / 117 cases passed**.
- New owner tests prove unchanged browser identity, closed valid native profiles, fresh/distinct database names, frozen selection despite later global mutation, actual project/shot/media writes with unexpected native IPC throwing, real Blob bytes and close/open persistence, two desktop profile isolation, and a late actual episode-write fault rolling back the earlier project write without switching owners.
- Query tests exercise the actual shared hooks: desktop IndexedDB live query, explicit SQLite event/subscription path with disabled Dexie callback, real internal Blob URL lifecycle, referenced-only shot result projection and stale collection guards.
- Consumer tests retain prior SQLite capability/patch/undo coverage under explicit configuration. New assertions exercise Agent/connectors and creative-settings studio routes/import availability, Agent-first home, world/memory/produce/storyboard/asset workspace outlets, audio/music dispatch, IP/backup/audio/music gallery controls, and the complete existing material query.
- Owned source ESLint command lists the 13 source files above. Result: **0 errors, 19 visible review warnings** (existing feature complexity/nested-ternary warnings; no new allowance).
- Root `lint` (`tsc -b --pretty false`) initially ran twice and reported only the other worker's `src/lib/nativeSystemServices.ts:40` UUID-template-literal assignment error; root/native-services were notified. A third run after the worker correction **passed** (exit 0). Final aggregate/quality/build checks still belong to integration after all workers settle.
- Scoped `git diff --check` passed.

One added material-library harness initially failed because importing `database -> productStorage -> nativeWorkspace` preloaded React hooks before the harness's mock. Root approved a real dependency correction: a pure `runtimeIdentity.ts` leaf, with the existing `isNativeWorkspaceRuntime` API delegating to the same detector. The DB startup selector therefore no longer depends on native React hooks; the strengthened material-library regression then passed. Existing detector/router tests still pass. No business behavior or protocol was changed to satisfy the harness.

These deterministic tests do not establish actual packaged WebKit persistence, WK data-store isolation, system dialogs or supplier behavior. The native backend and root acceptance must prove those separately. A later centralized SQLite replacement remains outside this batch/task.

## Registered-tool follow-up

The root requested meaningful tests for six specific registered entries missing from the initial exact-name audit. Added only `tests/nativeRegisteredToolParity.test.ts` and the follow-up in `research/tool-contract-coverage.md`; no product logic was changed. The new **34 cases** exercise the actual registry, frozen approval, durable run/resume, business commands and ledger across both model protocols, including real effects, source/material bytes, mandatory approval, rejection, stale approval, foreign scope, no replay after a subsequent provider failure, and late ledger fault rollback for every entry. The targeted group with `agentBusiness`, `agentIpTools`, `audioArrangementAgent`, `audioMusicAgentTools` and `d05ToolCatalog` passed **6 files / 109 cases**.

Strict source-plus-new-test typechecking passed using an ignored temporary configuration at `node_modules/.tmp/native-registered-test.tsconfig.json`, extending the normal app compiler configuration. It includes source ambient declarations; no tracked compiler configuration was changed. A final new-file Vitest rerun passed **34/34** after the typed connector/fault fixture corrections.

Two existing behaviors are explicitly documented rather than silently treated as new platform regressions: IP archive and clip split lack a direct-target write receipt; splitting uses whole-chapter replacement, which updates unrelated surviving clip revisions while preserving their content/source/placement/fades. The receipt-bearing place/edit/remove/revert cases assert the actual sanitized receipt separately from the persisted business row. Packaged provider, persistence and system acceptance remain independent gates.
