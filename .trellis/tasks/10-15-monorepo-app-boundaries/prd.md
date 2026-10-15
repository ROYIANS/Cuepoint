# Application and Workspace Boundaries

## Goal

Give web, desktop and site entry points predictable owners while retaining one shared Cuepoint studio and complete build/quality coverage. This is child 1 of `10-15-monorepo-agent-extraction`, satisfying parent R1 and R7.

## Background and Constraints

The root Vite app, `desktop/tauri` and `src/landing` share path-sensitive tooling. Rust embeds the root product schema, desktop workers traverse root node_modules, and production serves the site at `/` with an app fallback. The parent's `research/architecture-findings.md` supplies evidence and source anchors.

Preserve dependency versions, release identity, routes, storage/schema identity, native behavior and current desktop packaging-only CI policy. Use the approved local pnpm. Do not change the active desktop-release task's scope.

## Requirements

- W1: Establish pnpm workspaces with `apps/web`, `apps/desktop`, `apps/site`, `packages/studio` and `packages/distribution`; apps consume declared package exports.
- W2: Move the shared product into studio with minimal internal reorganization. Web and desktop consume that implementation; site consumes only lightweight distribution exports.
- W3: Give each app its own configuration/commands and preserve combined web/site deployment, root convenience commands and desktop packaging inputs.
- W4: Update generated paths, schema inclusion, workers, assets, native probes, Docker/CI contexts, version readers and source receipts with their owners.
- W5: Move source discovery and quality/test configuration with each relocation. Enforce dependency boundaries and self-test missing source roots and forbidden imports.
- W6: Document actual commands, ownership and verification, distinguishing unavailable host-specific checks.

## Acceptance Criteria

- WA1 (W1-W3): Web, site and desktop frontend build through package commands; web/desktop import the same studio exports and site has no studio/Agent dependency.
- WA2 (W3, W4): Combined output retains site root/app route refresh; desktop loads its normal studio entry/workers/assets. Version/release-input/Rust schema checks resolve new paths.
- WA3 (W4, W5): Root and actual native/desktop checks retain coverage. Discovery accounts for all owned sources; deliberate forbidden imports and an unregistered source root fail self-tests.
- WA4 (W1, W5): No sibling-source traversal, cross-package root alias, hardcoded root node_modules import, temporary bridge or duplicated studio remains.
- WA5 (W6): Authored verification maps these criteria to evidence before child 2 starts.

## Out of Scope

Feature reorganization, Agent package implementation, product changes, dependency upgrades, public publication, hosted delivery, CI policy expansion and storage migrations. Existing release/reference lanes are classified and retained unless removal is separately authorized.

## Readiness

The user approved the parent final summary with “批准” on 2026-10-15. This child is active on `codex/monorepo-app-boundaries` and has no predecessor; child 2 waits for WA1-WA5. The parent design and this child's design/execution plan define implementation.
