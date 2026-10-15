# Architecture Findings and Migration Constraints

## Evidence boundary

Inspection date: 2026-10-15. Source baseline: `d0efb823` on `main`; product working tree was clean before task creation. This document records source inspection, not a passing product test/build claim.

The existing `checkArchitecture()` was executed during this conversation: 562 owned TS/TSX files, zero static value SCCs, zero currently forbidden layer edges. Directory-group value import sites included business DB -> Agent library (31) and Agent library -> business DB (69). These are import-site counts, not independent dependencies or a file-level cycle. Existing enforcement only forbids domain -> DB/UI and DB -> UI value edges; it does not establish extractable package boundaries.

`src` contained 47 route files, 199 component files, 45 DB files, 31 domain files, 230 library files and 34 landing files. Registered product tables: 50. Vitest files: 281. Inventories include non-TS files in source directories and must not be equated with the 562-file TS graph.

## Load-bearing source anchors

| Source at baseline | Finding and design consequence |
| --- | --- |
| `src/main.tsx:55` | Storage is initialized before mounting the router. Composition must retain this order. |
| `src/db/database.ts:12` | One ProductStore selects browser or complete native storage. Preserve one owner and the same commands. |
| `src/lib/productStorage.ts:20` | Fixed startup profile and database identity are independent of service/runtime detection. Directory changes cannot change persisted identity. |
| `src/lib/storage/hooks.ts:1` | Reactive hooks bind React to a global DB. Move the binding to an explicit studio integration; lower storage mechanisms cannot import application bootstrap. |
| `src/db/agentRuns.ts:1` | Run creation combines persistence, context assembly, skills and model selection. Extract responsibilities, not the directory verbatim. |
| `src/lib/agent/runChat.ts:105` | Tool execution includes frozen scope, preview, approval, atomic results and uncertainty. These semantics need ports and conformance tests. |
| `src/lib/agent/runChat.ts:247` | Loop directly accesses chat rows and project/memory refreshers. Product data access must move behind host ports. |
| `src/lib/agent/toolDefinition.ts:1` | Tool context imports ProductStore and project identity; schema recipes come from businessSchemas. Use generic typed services and a product-independent schema recipe. |
| `src/domain/agent.ts:1` | Run/preview types contain project snapshots, generation preferences and music settings. Product extensions stay validated in Cuepoint. |
| `src/lib/agent/runOwnership.ts:1` | Web Locks and abandoned-generation recovery are bound together. Separate coordination from business recovery. |
| `src/lib/ai/chatStream.ts:1`; `responsesStream.ts:1` | Chat transports materialize product references and use product connector IDs. Providers need normalized input and an injected content resolver/transport. |
| `src/db/agentTools.ts:359` | Proven rollback differs from an uncertain external effect. Generic storage errors cannot erase this distinction. |
| `src/lib/desktopRelease/releases.ts:1` | Site and studio share lightweight release logic, currently coupled to brand constants. A small distribution package has two actual consumers. |
| `desktop/tauri/scripts/build-frontend-worker.mjs:1` | Desktop reaches into root node_modules and root product source. Replace incidental directory-depth coupling with declared workspace dependencies. |
| `desktop/tauri/src-tauri/src/full_product_store/registry.rs:30` | Rust includes the shared storage schema by a hardcoded source path. Preserve one schema and update compilation closure. |
| `scripts/models-dev-baseline.mjs:8` | Model baseline path is rooted at src/lib. Keep exact baseline content/version validation when relocating. |
| `scripts/quality/architecture.mjs:1`; `knip.json:1` | Source discovery assumes root src. Multi-package graph and isolation coverage must ship with the first move. |
| `vitest.config.ts:1` | Tests replace DB/tool/store imports for real adapters and immutable source comparators. Move-aware resolution must retain those seams. |
| `deploy/nginx.conf:1`; `vite.config.ts:1` | Production root is site, non-root paths use SPA fallback; development has separate HTML inputs. Separate builds must preserve deployment behavior. |

## Proposed source ownership map

This is a family-level target map. Before each move, implementation enumerates current files and checks that every file is assigned once. Keep the checked ownership rules and an authored conclusion; raw inventory output is disposable.

| Current family | Target owner |
| --- | --- |
| Root application HTML/Vite browser entry | `apps/web` |
| `desktop/tauri` normal runtime, Rust, build/release tooling | `apps/desktop` |
| `src/landing`, landing HTML, site-only public assets | `apps/site` |
| Release listing/platform/version and shared public brand facts | Narrow exports of `packages/distribution` |
| Root React startup, route tree, studio/project frames | `packages/studio/src/app` |
| Project creation/gallery/IP association | `features/projects`, with IP-owned commands in library |
| Episodes, beats, shots, world assets, production delivery | `features/video` with named model/command/query/UI owners |
| Audio models/DB/UI/engine/generation | `features/audio` |
| Music models/DB/UI/generation | `features/music` |
| IP, global materials, versions, use history and shared assets | `features/library` |
| Project references, document parsing and selected sources | `features/references` |
| Project memory, versions and retrieval | `features/memory` |
| Settings, connectors, device preferences, model catalog, updates | `features/settings` |
| Agent UI, product tools/skills, project context and adapters | `features/agent` |
| Pure Agent runtime/tool/approval/context contracts | `packages/agent-core` after the reusable-runtime child |
| Chat protocol parsing/streaming and normalized model inputs | `packages/agent-providers` after the reusable-runtime child |
| Storage protocol/drivers, binary IO, system services/transport | `platform/storage`, `platform/media`, `platform/runtime` |
| Draft and navigation coordination, error reporting, import/export cross-feature orchestration | Explicit app services/workflows, with pure reusable mechanisms next to their actual owner |
| Radix/shadcn primitives, icons, neutral layout presentation | `ui` and `app/layout` as appropriate |
| Formal source gates and repository-wide fixture orchestration | `tooling`, with application-specific drivers beside their app |
| Pure/business tests | Owning package/feature tests; integration fixtures and immutable comparators remain repository integration infrastructure |

Do not make `shared`, `utils`, a new aggregate repository facade or a generic `core` directory absorb unmapped responsibilities. Central table/schema registration and cross-feature transactions remain explicit, rather than being duplicated per feature.

## Existing contracts that survive reorganization

- Fixed browser namespace `aifenjing`, native profile identity, project package format, routes, IPC names, table keys/indexes and current wire behavior remain unchanged.
- Business mutations, write receipts and completed tool results share the same confirmed transaction. Readonly snapshots and nested transactions retain their real adapter semantics.
- Stop/reload never approves, claims, retries or resubmits paid work. Opaque Responses continuation is not reconstructed from visible chat text.
- The sole terminal writer settles run/message/ledger consistently. Finishing checks remain bounded; plain Q&A does not acquire another paid request.
- Preserve draft/IME/focus/navigation/scroll/print, exact audio precision, source ownership and managed binary retention across all current carriers.
- Existing source snapshots are immutable comparators. Change import resolution and current fixtures when necessary, not historical source contents or their assertions.
- Existing debt/unused contracts are individually reviewed and path-rebound with producer identities; moving code does not authorize blanket baselining or diagnostic removal.

## Toolchain and delivery constraints

Local pnpm must be `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`. Root package metadata pins pnpm 10.15.0. The global instruction described this machine path as pnpm 9.12.0, but the child-1 execution baseline verified the approved path currently returns 10.15.0 under Node24.11.0, matching the project pin. No version change is needed. Do not upgrade tools, purge node_modules or combine dependency upgrades with reorganization; inspect only necessary workspace lockfile changes.

The local Node v24.11.0 exposes `node:sqlite.DatabaseSync` (verified by import only; SQLite emitted its experimental warning). The independent example can declare Node >=24.11 and use a disposable SQLite database without another SQLite dependency. This proves that example runtime, not every Node/browser/OS combination. Its transactional adapter and restart behavior still need actual tests.

Desktop release CI is packaging-only by prior owner decision. Preserve standalone verification and GHCR quality; do not add launch/tests to the package workflow or publish/tag/dispatch a release as a side effect of this task. Retained Electron/schema-4/reference lanes must be moved or explicitly classified without changing their contracts; deletion is not required for acceptance.

## Acceptance method

Use one declared workspace package graph, one complete source graph and explicit package exports. Reject package cycles, deep sibling-source imports, model-provider -> studio imports and site -> studio closures. Test the gate with deliberate forbidden imports so an empty scan cannot pass as success.

Use an independent Node example with its own SQLite schema, a deterministic fake provider and non-creative tools. Verify the built Agent artifacts in an isolated temporary consumer, with no studio alias/root source available. Separate test passes from pending actual native host/provider/system-dialog coverage.

## External references consulted during the discussion

- https://pnpm.io/workspaces — workspace dependency protocol.
- https://turborepo.dev/docs/core-concepts/package-types — application/library ownership; no Turborepo adoption is required.
- https://docs.langchain.com/oss/javascript/langgraph/functional-api — durable side effects and continuation concepts; no framework migration is proposed.
