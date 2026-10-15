# Lightweight Distribution Library

## Scope

`packages/distribution` owns the small release/platform/version/brand and analytics mechanism closure shared by the site and studio. Keep exports narrow and product-neutral. Installer download verification, system Save and device settings remain studio/runtime responsibilities.

## Pre-Development Checklist

- Read [release/update contracts](../../frontend/settings-update.md), [site contracts](../../frontend/component-guidelines.md#landing-page-standalone-entry-2026-10-14) and [quality](../../frontend/quality-guidelines.md).
- Read [guides](../../guides/index.md); search both consumers before changing a shared constant or format.
- Verify declared exports and both consumers' actual dependency closures, not just direct imports.

## Quality Check

- No studio/app/storage/Agent/native dependency or product styling enters this package.
- Preserve bounded anonymous release reads, normalized URLs, exact asset names, numeric version comparisons and ambiguous-platform alternatives.
- Root type/formal/test gates and both site/studio builds exercise exports. Built site budgets and forbidden-dependency checks stay effective.
- Keep one app release identity/version source; private package structure does not authorize new independent release versions or public publication.
