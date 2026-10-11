# Implementation plan

## Phase 1 — contract and browser adapter

1. Add canonical video repository/controller types and capability/error/result unions. Map existing browser project, episode, beat and shot commands without changing their transaction or undo owners.
2. Add browser adapter/controller tests for project ownership, ordered reads, field-baseline conflicts, undo receipts, unavailable owners and capability gating.
3. Extract shared view-only sections from the existing project home, episode list, story and shot pages. Keep the browser pages as the behavior oracle until each extracted section has parity coverage.

## Phase 2 — native contract completion

4. Extend fresh native DTOs/actions/database rows for the canonical fields required by the shared views. Add typed baseline/conflict results and atomic undo-friendly command results.
5. Extend `nativeWorkspace` to use the closed result parser and add adapter tests for generation, ownership, order, reopen closure, conflicts, rollback and unsupported capabilities.
6. Keep native files app-owned and browser Dexie untouched. Do not add migration readers, browser imports or compatibility aliases.

## Phase 3 — one page tree

7. Replace the direct `NativeProjectWorkspacePage` branch in `WorkspaceChrome` with the shared AppFrame/workspace header/Outlet and runtime-selected provider/controller.
8. Make project home, episode list, story/beat editor and shot workbench consume the shared controller. Preserve existing draft retention, conflict/retry, undo, keyboard, filter, media-slot and scroll-owner contracts.
9. Add explicit capability pages for native domains that are not in this slice. Remove native-only simplified editor/gallery imports once parity checks prove no route reaches them.

## Phase 4 — native icon

10. Create a reproducible native-only opaque icon source using the existing logo and `#0c0c0c` background. Run the pinned Tauri icon generator into `desktop/tauri/src-tauri/icons` and update only native bundle resources if required.
11. Verify every tracked/generated icon size has opaque corners, expected RGB, preserved centered artwork and valid ICNS entries. Confirm the Web logo files and favicon hashes remain unchanged.

## Phase 5 — verification and evidence

12. Run root lint, tests, quality and build; desktop TypeScript/lint/quality; Rust fmt/tests/clippy; normal and acceptance frontend builds; and normal packaged app build.
13. Run browser/native route parity smoke checks for project → episode → story/beat → shots, including empty/loading/missing/error/capability states and no cross-runtime store calls.
14. Inspect the packaged macOS icon and record actual image metadata, screenshots and command output in implementation evidence. Run `git diff --check` and the Trellis validation gate.

## Risky files and rollback points

- `src/components/workspace/WorkspaceChrome.tsx`: shared shell/runtime boundary; revert this file alone to restore existing browser/native routing if the provider is incomplete.
- `src/components/workspace/NativeProjectWorkspacePage.tsx` and `NativeProjectGalleryPage.tsx`: remove only after shared route parity; keep changes isolated until then.
- `src/domain/`, `src/lib/`, `src/db/`, `desktop/tauri/src-tauri/src/{contracts,database,workspace,desktop}.rs`: canonical contract and persistence parity; preserve existing browser command tests and native reopen tests.
- `desktop/tauri/src-tauri/icons/*`: native-only reversible assets; do not touch web brand files.

## Required commands

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` for project commands. At minimum:

```text
pnpm lint
pnpm test
pnpm quality
pnpm build
pnpm --dir desktop/tauri types
pnpm --dir desktop/tauri lint
pnpm --dir desktop/tauri quality
node desktop/tauri/scripts/tools.mjs cargo fmt --manifest-path src-tauri/Cargo.toml --locked -- --check
node desktop/tauri/scripts/tools.mjs cargo test --manifest-path src-tauri/Cargo.toml --locked --features test-hooks
node desktop/tauri/scripts/tools.mjs cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --features acceptance -- -D warnings
node desktop/tauri/scripts/build-frontend.mjs
node desktop/tauri/scripts/build-frontend.mjs --acceptance
pnpm --dir desktop/tauri build:app
git diff --check
python3 ./.trellis/scripts/task.py validate shared-product-ui-native-adapters
```
