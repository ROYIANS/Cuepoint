# Standalone Site

## Scope

`apps/site` owns the landing HTML, site source/assets, film/download presentation and standalone build. It may consume declared lightweight distribution exports; it does not depend on studio, product storage, Agent or native runtime.

## Pre-Development Checklist

- Read the [landing contract](../../frontend/component-guidelines.md#landing-page-standalone-entry-2026-10-14), [directory ownership](../../frontend/directory-structure.md) and [quality/budget rules](../../frontend/quality-guidelines.md).
- Read [release/update contracts](../../frontend/settings-update.md) for normalized URLs, bounds, cache and platform selection. Installer verification/save remains product-owned.
- Read [guides](../../guides/index.md) before changing shared definitions or deployment paths.

## Quality Check

- Source and built module closures stay independent of studio/storage/Agent; retain first-screen size budgets and lazy film rendering.
- Static readable markup survives missing/failed JavaScript; motion/accessibility/playback/download semantics remain covered.
- Separate site and assembled deployment builds preserve the production site root and app fallback. Shared outputs never silently overwrite conflicting files.
- Retain semantic tests for tokens, claims, release metadata and platform ambiguity; device performance/layout remains distinct from unit proof.
