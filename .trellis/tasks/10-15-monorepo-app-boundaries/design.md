# Workspace Boundary Design

## Ownership and bootstrap

Follow the parent's package graph. Web owns browser entry/Vite config; desktop owns native entry/Tauri/Rust/installer scripts; site owns landing entry/assets. Studio owns shared product source; distribution owns release/platform/version/brand definitions already shared by site and product settings. Repository checks move to tooling as needed.

Studio may expose source compiled by Vite consumers. Cross-package imports use declared `workspace:*` dependencies and explicit exports; aliases remain package-private. Keep internal studio organization stable until child 2. Introduce Agent packages only in child 3.

Each runtime entry selects the existing adapter and initializes one fixed ProductStore before rendering the shared studio. No duplicate React tree, store owner or Agent implementation.

## Delivery and path consumers

Build web/site independently and deliberately assemble the current production layout, preserving Nginx site root and SPA fallback. Desktop bundles only its normal app entry. The site must not inherit product storage/runtime/theme through shared definitions.

Keep one authoritative app release version. Update manifest/Cargo/Tauri/integrity readers together. Preserve versions and inspect necessary workspace lockfile changes; do not resolve the current pnpm discrepancy through the bundled runtime or opportunistic upgrades.

Inventory TypeScript/Vite aliases, generated route/model/icon paths, media/PDF/DOCX workers, public assets, Rust schema inclusion, native probes, test resolver seams/fixtures, desktop integrity/release scripts, Docker/CI inputs and receipt hash closure. Replace root node_modules traversal with declared dependencies and supported resolution.

Keep immutable comparator bytes and native assertions intact. Give existing Electron/schema reference lanes explicit ownership. Preserve package-only desktop CI and separate GHCR checks; adapt source closure without initiating delivery.

## Verification and rollback

All source-owning packages participate in root type/lint/architecture/unused/test discovery. Self-tests reject sibling-app imports, site-to-studio edges and an owned source root omitted from coverage. Update diagnostic identities per finding without broad ignores, bulk baselines or historical snapshot regeneration.

Move/check one owner slice at a time. Enumerate temporary bridges and remove them before acceptance. Record an accepted checkpoint before child 2; rollback never resets user data or discards another contributor's changes.
