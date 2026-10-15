# Monorepo Organization and Reusable Agent Extraction

## Goal

Make Cuepoint's application and feature ownership predictable, and allow another TypeScript project to use its Agent execution capabilities without depending on Cuepoint's studio, product database or UI.

## Confirmed User Decisions

- The owner accepted separating browser, desktop and site entry points into a lightweight monorepo, and organizing the shared studio by business feature.
- The owner explicitly requested reusable Agent capabilities for other projects and accepted a headless core plus model protocol adapters. Cuepoint tools, creative instructions, product context, storage integration and UI stay in the studio.
- On 2026-10-15 the owner authorized creating Trellis tasks and preparing development. Implementation awaits review of the completed planning artifacts.

## Requirements

- R1: Application entry points, build configuration and delivery scripts have explicit web, desktop or site ownership; web and desktop share one studio implementation.
- R2: Business-specific UI, models, queries, commands and tests are discoverable under their owning feature; platform mechanisms and application composition have explicit owners.
- R3: The reusable Agent core exposes typed execution, tools, approvals, context, persistence and coordination interfaces without depending on Cuepoint or a specific UI/runtime/storage implementation.
- R4: Reusable chat model adapters preserve existing supported protocols and continuation semantics; media-generation workflows remain Cuepoint integrations.
- R5: Cuepoint uses the extracted Agent packages in its actual product path and preserves current behavior, transaction guarantees, approvals, recovery and outcome evidence.
- R6: An independent non-creative consumer demonstrates tool execution, approval, cancellation and durable restart/resume using public interfaces and its own tools and storage.
- R7: Quality, tests, native builds, site isolation, model baseline generation, CI and documentation follow the new locations and cover all owned sources.

## Acceptance Criteria

- AC1 (R1): Each application builds through its own workspace command, and browser/desktop consume the same studio code.
- AC2 (R2): A complete source ownership map accounts for current sources; no permanent catch-all replacement for the old lib/db split remains.
- AC3 (R3, R4): Agent imports compile and execute independently of studio, React, Dexie and Tauri; dependency rules reject prohibited edges.
- AC4 (R5): Product acceptance tests retain current transaction, recovery, provider and UI behavior on browser and real native storage.
- AC5 (R6): An independent consumer validates reusable execution and restart/resume without studio or product-schema imports.
- AC6 (R7): All affected checks discover the new packages; paths, fixtures and release inputs change without reducing verification coverage.

## Delivery Ownership

| Order | Child task | Requirements | Independently reviewable outcome |
| --- | --- | --- | --- |
| 1 | `10-15-monorepo-app-boundaries` | R1, R7 | Explicit applications and shared studio/distribution packages with working builds and complete quality coverage. |
| 2 | `10-15-studio-feature-organization` | R2, R5, R7 | Feature-owned studio code, explicit composition/platform boundaries and preserved behavior. |
| 3 | `10-15-reusable-agent-runtime` | R3-R7 | Extracted Agent packages, production Cuepoint integration and independent durable consumer. |

The parent owns requirements and final integration review. Execute children in this order; the parent/child links themselves are not dependency enforcement.

## Constraints

- Preserve current product workflows, routes, storage identity, schema/wire contracts, project ZIP behavior, supported model behavior and release policy. Existing compatibility code remains where current contracts require it; new historical-data migrations are excluded.
- Retain atomic business/receipt/tool-result writes, confirmed-versus-uncertain effects, frozen approvals, explicit resume, cancellation, exact provider continuation and one fixed product storage owner.
- Retain the shared browser/native product and the site's lightweight dependency closure. The reusable runtime has no dependency on studio, React, browser globals at import time, or a particular database.
- Use the approved local pnpm path. Tool/dependency version upgrades, public publishing and remote delivery actions are not implicit parts of directory restructuring.
- Required tests, formal quality, native adapter checks and build coverage follow moved sources. Path changes do not permit blanket allowances, ignored packages or edits to immutable comparator snapshots.

## Out of Scope

Public npm publication, a public API stability promise, an Agent React UI library, new product features, new cloud services or model protocols, a new generic workflow framework, historical-data migrations and automatic synchronization.

## Planning Status

All product/scope decisions are resolved by this conversation. `design.md`, `implement.md`, three complete child plans and curated context manifests define execution. Requirements were rewritten into the final structure without temporary brainstorm sections. The owner subsequently approved the final summary with “批准”; child 1 is active on `codex/monorepo-app-boundaries`. The parent coordinates integration, and later children remain gated by predecessor acceptance.
