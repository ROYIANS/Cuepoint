# Development Change Policy

## Default: fresh development

This project is currently in active development with disposable local data. New work starts from a fresh product state by default. Do not add migration code, legacy-data readers, compatibility aliases, backfills, schema upgrade paths or historical behavior shims unless the task explicitly requires them.

The rule applies to browser storage, the native SQLite workspace, project files, serialized records and provider checkpoints. A new desktop workspace may define its schema and file layout directly without importing the developer's existing IndexedDB records.

## Explicit exception

When a task names a compatibility requirement, record the exact source version, affected records/files, preservation rules, rollback behavior and acceptance tests in that task's PRD and design. Keep the compatibility boundary limited to the named requirement; do not generalize it to every historical shape.

## Released desktop data exception

The user explicitly required reliable upgrades preserving installed data on
2026-10-17 after repeated startup failures. Shipped native workspace registries
are persistent user data, not disposable development fixtures. Preserve the
[released upgrade contract](../frontend/native-product-runtime.md#workspace-registry-identity-and-released-upgrades),
its immutable release snapshots and migration/regression gate when changing the
current registry. This ongoing requirement authorizes the documented legacy
bootstrap and automatic additive upgrades from validated persisted registry
snapshots, including successive future/development additions. It does not
authorize accepting unknown formats, clearing user
data, importing browser databases or inventing aliases for abandoned prototypes.
The source versions, preservation rules, rollback and acceptance scope are recorded
in that contract because this session explicitly declined a Trellis task.

## Current source contracts still apply

Fresh development does not authorize removing active product behavior or current contracts without a task decision. Preserve code that the current product and tests still use. The exception is specifically for historical local data and legacy compatibility work that has not been requested.

## Good / Bad examples

- Good: create the first native SQLite schema for the current product and seed it with disposable fixtures.
- Good: replace an experimental schema during development when the task explicitly resets the workspace.
- Bad: add a Dexie-to-SQLite migration solely because an old local browser database exists during development.
- Bad: keep aliases, version branches or fallback readers for an abandoned prototype without an explicit acceptance requirement.

## Review checklist

- [ ] Does the task explicitly require preserving old user data or an older file/schema version?
- [ ] If not, remove migration and compatibility work from the scope and use fresh fixtures.
- [ ] If yes, document the source version, closure, rollback and tests before implementation.
