# Feature-Owned Studio Organization

## Goal

Make a product feature's UI, models, commands, queries and tests discoverable together, with explicit application/platform responsibilities. This is child 2 of `10-15-monorepo-agent-extraction`, satisfying parent R2, R5 and R7.

## Background and Constraints

Business behavior is currently split across components/domain/db/lib/routes; some db modules orchestrate Agent behavior and storage hooks depend on React/global product state. The parent's evidence map identifies these responsibilities. Child 1 must complete before execution.

Preserve behavior, schema/route/storage identities, project ZIP contracts, typed store propagation, native ownership and Agent safety/recovery. Reorganize ownership without introducing reusable Agent packages yet.

## Requirements

- F1: Assign every studio source to app composition, a named feature, platform mechanism or neutral UI; maintain a complete old-to-new inventory.
- F2: Co-locate business UI/models/commands/queries/tests under projects, video, audio, music, library, references, memory, settings or agent. Use audio as the first vertical slice.
- F3: Give bootstrap/routes/cross-feature workflows explicit app ownership; platform storage/transport do not depend on app initialization or feature orchestration.
- F4: Expose narrow feature APIs and typed service/store/transaction inputs. Shared models and central schema registration each have one authoritative owner.
- F5: Preserve one transaction through cross-feature writes, receipts and tool completion, with the existing fixed store and native/browser behavior.
- F6: Enforce dependency rules and update affected tests/tools/specs without reducing behavioral coverage.

## Acceptance Criteria

- FA1 (F1, F2): Every studio source has exactly one owner. Audio demonstrates the vertical pattern and remaining features follow it; no generic lib/db replacement becomes a catch-all.
- FA2 (F3, F4): Feature commands/queries are discoverable. Gates reject forbidden runtime/deep imports and permit documented type-only model relationships.
- FA3 (F4, F5): Nested readers/writers share the explicit store/transaction; failure cases retain atomic rollback/uncertain outcomes. Product schema/table definitions stay singular.
- FA4 (F5, F6): Browser/real-native product and Agent acceptance, query subscriptions, context selection and ZIP/lifecycle tests pass at new locations.
- FA5 (F1, F6): Formal quality/source discovery and builds cover the final tree; no old-path bridge/duplicate implementation remains. Verification maps FA1-FA5 to evidence.

## Out of Scope

New product behavior, UI redesign, rewriting every large module, repository/service-locator frameworks, Agent library extraction, storage migrations, synchronization and new deployment mechanisms.

## Readiness

The parent implementation was approved, and the user explicitly authorized committing child 1 and starting this stage on 2026-10-15. Accepted child-1 source checkpoint is `bb3a9580`; its verification is archived under `../archive/2026-10/10-15-monorepo-app-boundaries/verification.md`. This child is active on `codex/studio-feature-organization`. Child 3 waits for accepted feature/transaction boundaries.
