# Reusable Agent Runtime

## Goal

Allow another TypeScript project to run the Agent with its own tools, policies and storage while Cuepoint uses the same extracted implementation. This is child 3 of `10-15-monorepo-agent-extraction`, satisfying parent R3-R7.

## Background and Constraints

Current execution/tool types depend on ProductStore and creative entities; chat providers also resolve product connector/reference state. Local tools atomically commit business state, receipts and tool results. Parent research supplies code/spec anchors. Children 1 and 2 must complete first.

Retain execution/provider/privacy/recovery contracts and shared product transaction capability. Product tools, creative skills/prompts, memory selection, media jobs, settings and UI remain product-owned.

## Requirements

- A1: Provide `@cuepoint/agent-core` with runtime-neutral typed execution/tools/validation/approvals/checkpoints/policies/context/coordination/persistence/events, without product/UI/concrete-storage dependencies.
- A2: Provide `@cuepoint/agent-providers` for current Chat Completions/Responses protocols, depending on core and preserving stream/abort/error/request policy and exact opaque continuation.
- A3: Bind Cuepoint services/tools/context/permissions/persistence through typed adapters; switch the actual product path to the packages with one execution implementation.
- A4: Preserve atomic local effects/evidence/results, explicit certainty, serialized terminal settlement, ownership, frozen approvals, cancellation and zero-network startup recovery. Unknown external effects never authorize automatic replay.
- A5: Provide a non-creative todo CLI with its own SQLite schema/tools. Through public built exports, demonstrate approval/rejection, cancellation and durable process restart/resume without studio imports.
- A6: Enforce emitted ESM/type exports, dependency closure, actual browser/native integration and affected root/package checks.

## Acceptance Criteria

- AA1 (A1, A2, A6): Packages build/typecheck/test. An outside-workspace consumer installs locally packed artifacts, compiles/runs without source aliases, studio, React, Dexie or Tauri.
- AA2 (A3, A4): Browser/real-native Cuepoint paths use the packages; existing approval/context/tool/recovery/provider/UI behavior and atomicity remain intact.
- AA3 (A4): Conformance covers duplicate/stale ownership, stale/rejected approvals, cancellation, serialization rollback, committed-result preservation, sole terminal settlement and refusal to replay unknown external submission.
- AA4 (A5): The example owns tools/schema, survives actual process termination/reopen and resumes explicitly from durable state. Deterministic model fixtures need no paid requests; memory-only persistence does not satisfy acceptance.
- AA5 (A2, A6): Protocol tests preserve exact continuation and credential/privacy boundaries. Dependency checks reject product/core/provider leakage; final quality/build/native coverage includes new packages.

## Out of Scope

Public npm publication/API stability promises, Agent React UI, new providers/features, media protocol unification, generic workflow/service-locator frameworks, separate product databases, historical migrations, cloud services and paid acceptance requests.

## Readiness

The parent final summary requires subsequent approval and both predecessors require accepted verification. Parent integration review follows AA1-AA5; package compilation alone cannot complete this task.
