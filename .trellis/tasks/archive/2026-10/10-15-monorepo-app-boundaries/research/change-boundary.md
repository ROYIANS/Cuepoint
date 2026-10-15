# Child 1 change boundary and ownership inventory

## Gap and behavior owner

The current root Vite application, landing entry and nested desktop projects have implicit source/dependency ownership. This slice creates declared workspace owners while preserving the existing shared bootstrap, fixed storage selection, business commands, route semantics, schema bytes and execution behavior. Product-internal feature organization and Agent extraction are later children.

## Exhaustive relocation rules

- Root `src/landing/**` -> `apps/site/src/**`; `landing.html` -> `apps/site/landing.html`.
- Remaining root `src/**` -> `packages/studio/src/**`, retaining internal paths. Shared bootstrap stays one implementation. Web and normal desktop own tiny entry files that import its public bootstrap export.
- Existing `desktop/tauri/**` -> `apps/desktop/**`, including ignored native caches by same-filesystem rename. Remaining Electron prototype -> `apps/desktop/reference/electron/**`, an explicitly retained independent reference lane.
- Root `scripts/**` -> `tooling/**`, retaining relative hierarchy. Source path consumers in tooling, tests, app scripts, CI, Docker and authored current documentation follow their actual owner.
- Brand, analytics initialization and desktop release listing/platform/version -> narrow source exports of `packages/distribution`; installer download/save remains studio-owned.
- Public brand assets -> distribution-owned public directory, shared through explicit Vite configuration. Site robots/sitemap -> site public directory.
- Permanent `tests/**`, immutable `tests/fixtures/sourceSnapshots/**`, quality contracts and deploy files stay repository-owned. Snapshot bytes and original-path provenance do not change.

All tracked source files in these families receive exactly one owner. Root quality discovery is updated in the same slice, with explicit package exports/dependencies and negative boundary/discovery regressions. Root fixture Vite config remains repository integration infrastructure; no root-src bridge remains.

## Necessary integration edits

Workspace manifests and lock importers; app/root TypeScript/Vite/Vitest/ESLint/Knip configuration; safe assembled web/site output and module reports; worker resolution; generated route/model/icon paths; Rust schema include; native test probe and source snapshots; native/release scripts and integrity readers; Docker/Actions contexts; package commands and README locations. The single release version remains root package version, matched by existing native metadata. Local approved pnpm currently reports 10.15.0, matching the existing metadata; no upgrade is necessary.

## Preservation proof

Record pre-edit root and desktop gate outcomes, then run equivalent final root/app/desktop/actual-Rust checks. Compare immutable source-snapshot hashes and storage registry bytes. Exercise deliberate forbidden cross-package imports and missing owned source roots, plus output assembly collisions and manifest completeness. Manual/host-specific startup evidence is reported separately; compilation cannot establish it.

No dependency upgrades, storage migrations, product redesign, remote delivery, public publication, CI test-policy expansion or task/spec lifecycle edits belong to this writer.
