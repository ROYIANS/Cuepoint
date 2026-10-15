# Browser Application

## Scope

`apps/web` owns the browser entry, HTML, development/build configuration and browser-specific delivery inputs. Product routes, UI, business commands and Agent behavior belong to the shared studio.

## Pre-Development Checklist

- Read [directory ownership](../../frontend/directory-structure.md) and the [studio checklist](../../studio/frontend/index.md).
- Read [shared storage](../../frontend/shared-product-storage.md) and [native runtime](../../frontend/native-product-runtime.md) before changing bootstrap/runtime selection; browser identity and initialization order are current contracts.
- Read [quality](../../frontend/quality-guidelines.md) for build, deployment and source discovery, and [guides](../../guides/index.md) for cross-layer changes.

## Quality Check

- Entry uses declared studio exports and initializes the existing browser owner before render; it does not duplicate the product tree.
- Package build and assembled production routing retain the site root and SPA fallback with correct workers/assets.
- Package types, root formal checks/tests and model/build gates cover the moved sources. Public routes and storage identity remain unchanged.
- No sibling-app import, cross-package alias, hardcoded root node_modules traversal or temporary bridge remains.
