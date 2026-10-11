# Native workspace product foundation execution plan

## Ordered work

1. Refresh the native-workspace spec context and record the fresh-development decision in this task. Do not add migration code, legacy readers or historical fixtures.
2. Replace the prototype-only frontend build entry with the real root React/Vite application while retaining a separate acceptance fixture only where it tests native boundaries.
3. Add the typed runtime adapter and native bridge calls for workspace state, project creation and managed asset import. Keep action/envelope parsing closed and generation-aware.
4. Extend the Rust workspace owner with the fresh schema, project/asset DTOs, staged copy/hash publication, missing-file inspection and reopen validation. Reuse the prototype's proven ownership and recovery primitives without copying fixture-only UI behavior into product code.
5. Wire the real desktop project and asset flows to the adapter. Browser builds continue using their existing runtime; Tauri mode must use the native owner for this slice.
6. Add focused Rust and renderer tests for round trips, hash/path checks, cancellation/partial-copy cleanup, duplicate targets, missing files, stale generations and restart/reopen.
7. Run root and desktop quality gates, then perform a packaged smoke acceptance against the real app routes and a fresh temporary workspace. Record the evidence in this task.

## Validation commands

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
node desktop/tauri/scripts/tools.mjs cargo fmt --manifest-path desktop/tauri/src-tauri/Cargo.toml --all -- --check
node desktop/tauri/scripts/tools.mjs cargo test --manifest-path desktop/tauri/src-tauri/Cargo.toml --locked --features test-hooks
node desktop/tauri/scripts/tools.mjs cargo clippy --manifest-path desktop/tauri/src-tauri/Cargo.toml --locked --all-targets --features acceptance -- -D warnings
```

## Review gates

- The packaged app must load real product routes from bundled assets, with no dev-server dependency.
- The native workspace must be fresh, self-owned and reopenable; no test may seed it from the existing browser database.
- A ready asset requires verified bytes and a committed SQLite row. Failed or canceled imports leave no ready reference.
- Product code must not expose raw SQL, arbitrary paths or filesystem commands to the renderer.
- Root/browser behavior must remain green, but no compatibility branch is added for historical local data.
- The final review must distinguish this product slice from the archived isolated prototype and list the later work: full native domain coverage, checkpoint application and sync providers.

## Rollback

The native runtime remains behind its Tauri adapter boundary. If packaged product integration is not ready, retain the working browser entry and remove only the incomplete native wiring; do not add a migration shim to bridge the two runtimes.
