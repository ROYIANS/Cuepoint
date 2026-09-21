# Repository-wide code and user experience audit

## Goal

Review Cuepoint from system architecture to implementation details and actual user journeys. Identify reproducible bugs, inconsistent business rules, redundant code, reliability gaps and usability barriers; deliver an evidence-backed, prioritized repair backlog.

## Background

Planning reconnaissance on 2026-09-21 used commit `988daf335aa7ebeb8b3e435a51bd3a3e9ceb033a`; the working tree was initially clean. Cuepoint is a local-first React/TanStack Router film and storyboard workspace with Dexie IndexedDB as its durable store and user-configured external AI providers.

Inventory: 272 source files / 32,441 lines (`src` TS/TSX/CSS excluding `routeTree.gen.ts`), 42 route files and 72 top-level test files. These are inventory counts, not coverage measurements. `lint` runs TypeScript, `test` runs Vitest, and `build` runs Vite. Shared tests use fake IndexedDB; the quality spec describes lib/repository tests rather than a component/browser test suite.

The user approved execution and requested a Chinese final report. The first full audit has been executed; report.md records findings and explicit validation limitations. No product fixes were made.

## Requirements

| ID | Required outcome |
| --- | --- |
| R1 | Track every first-party module and route; progress from architecture and ownership to detailed code and real user flows. |
| R2 | Verify integrity of persistence, migrations, import/export, deletion, undo, ownership and concurrent writes. |
| R3 | Compare manual UI, Agent tools, repositories and exported results for conflicting defaults, validation, scope and state transitions. |
| R4 | Verify approvals, async execution, cancellation, retries, uncertain provider outcomes, refresh recovery and cross-tab ownership. |
| R5 | Identify dead code, duplicated business concepts, redundant state and unnecessary coupling; distinguish intentional compatibility and provider differences. |
| R6 | Evaluate complete workflows, feedback/recovery, accessibility, responsive layouts and measured performance in a browser. |
| R7 | Review external-input boundaries, secret handling, dependencies, build/release behavior and whether tests detect incorrect behavior. |
| R8 | Deliver evidence, severity, confidence, coverage limitations and staged remediation proposals with regression expectations. |

## Scope and constraints

First-party source, tests, scripts, build/deployment configuration and relevant product/spec contracts are in scope. Generated and vendored content receives integration, reproducibility and boundary review, not first-party line-by-line review of upstream code.

Use synthetic fixtures in an isolated browser profile/origin. Do not clear or alter existing user databases. Baseline fault injection uses fake transports. Real-provider checks require an available test environment and an established spending scope; otherwise record them as unverified. Mocks cannot prove live provider compatibility.

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` for project commands, with the intended Node bin directory in PATH. Do not reinstall dependencies just to audit. The repository declares pnpm 10.15.0; the user requires the local pnpm path. Investigate compatibility without overriding that instruction.

Out of scope: new features, wholesale architecture/UI replacement, automatic dependency upgrades, production deployment and silent changes to intended behavior. Auditing produces findings and reproducers; product repairs should be separately scoped.

## Acceptance criteria

- [ ] AC1 (R1): Every in-scope file has a review disposition; all route files map to a page/layout/redirect scenario. Every critical mutation has a caller-to-storage trace.
- [ ] AC2 (R2–R4): Critical invariants have static evidence plus an automated/browser scenario, or an explicit blocked/unverified reason.
- [ ] AC3 (R5): Cleanup recommendations name callers, semantic equivalence/divergence, compatibility concerns, expected benefit and regression risk.
- [ ] AC4 (R6): Browser journeys record happy, boundary and failure outcomes; actionable UX/performance issues include evidence and environment.
- [ ] AC5 (R7): Typecheck, test, build and model-bank verification outcomes are logged against an execution commit; test and environment gaps remain visible.
- [ ] AC6 (R8): Confirmed findings include precise locations, expected/actual behavior, reproduction or proof, impact, confidence and validation guidance. Suspicions are not presented as bugs.
- [ ] AC7 (R8): Final report includes severity counts, coverage, unresolved limitations and ordered repair batches with dependencies and acceptance criteria. Audit completion is distinct from repair completion.

## Delivery status

Artifacts: `prd.md`, `design.md`, `implement.md`, `coverage.md`, `findings.md`. No blocking product decision is needed to complete this plan. User approved execution on 2026-09-21 and requested the final report in Chinese. Audit results remain evidence-dependent.

Delivered Chinese report.md, evidence-backed findings, file coverage and a staged repair backlog. See coverage.md for acceptance mapping and report section 10 for unverified scenarios; these are not counted as passed.
