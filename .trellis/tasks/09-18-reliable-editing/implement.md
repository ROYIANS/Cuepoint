# Implementation Plan — 编辑可靠性与测试基线

1. Add Vitest, fake-indexeddb, test scripts, and database reset helpers.
2. Add reusable debounced draft persistence with revision, flush, and retry semantics.
3. Migrate series logline, world setting, and episode title/story editors.
4. Separate beat mutations from aggregate story autosave to prevent stale overwrites.
5. Add a one-action short-lived undo controller and root provider.
6. Add unit tests for persistence, ownership, package round-trip, and undo behavior.
7. Run `pnpm test`, `pnpm lint`, and `pnpm build`.
