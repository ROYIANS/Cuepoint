# Reference intake implementation plan

## Activation
- User approved implementation and selected-model native image reading on 2026-09-19. The task was activated with `task.py start`.
- Read current Trellis before-dev guidelines and check repository state. Memory retrieval is archived; do not reopen that child.
- Confirm browser parser entrypoints, package licenses, worker assets and provider image contracts before dependency installation or wire-format edits. Use the existing full model-bank snapshot as evidence, not guessed capability defaults.

## Ordered checkpoints
1. Domain/storage: source aggregate, chunks, typed message descriptors, schema addition, revision/ownership validation and import operation identity. Add repository tests for duplicate, cancellation, interrupted parsing and project isolation. Cover media GC, deletion and ZIP together.
2. Parser foundation: lazy PDF.js and Mammoth browser integration, text decoder, image validation, digest reuse, caps and actionable errors. Build fixtures for every format, empty text, mixed/scanned/password PDF, corrupt DOCX and resource limits. Keep filesystem/network parsing out of browser code and Dexie transactions.
3. Request integration: typed image parts through both protocols; verified capability gate, ephemeral byte materialization, document budget/coverage, attachment audits, compaction/retry/continuation. Verify both actual request payloads, not just UI badges.
4. Project tools and provenance: bounded search/read, frozen enabled skills and chat-only restrictions, task evidence source links, existing reviewed image generation media reuse. Ensure source removal invalidates new reads and prepared requests.
5. UX: plus-menu entries, picker/drop/paste, project selection, compact chips, project reference list and source inspector. Preserve draft on errors, show import progress/retry, no empty strip, flat dark design, mobile and keyboard behavior.
6. Integration review: library reuse from conversation B without automatic bulk injection, foreign-project rejection, source locator navigation, long-document compression, delete/dedupe/ZIP roundtrip and recovery. Independent review according to the active Trellis execution/check workflow.
7. Finish: record exact checks, parser/dependency notices, new reference intake spec, cross-layer contracts and retrospective. Archive only after accepted completion; the next batch-generation child remains separate.

## Validation
Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly.
- Targeted Vitest files for reference repository/parsers/tools/context/protocol adapters while iterating.
- Final `pnpm test`, `pnpm lint`, `pnpm build` via the explicit path above.
- Real-browser fixtures: each supported file imported and sent through mocked Chat Completions and Responses; same-project reuse, different-project denial, narrow screen, keyboard, outside-click, cancel/retry/reload and citation coverage.
- Include a many-source/missing-source native-browser transaction test so fake-indexeddb cannot hide the previous premature-commit class.
- No paid provider calls or destructive operations on the user's real project data.

## High-risk seams
`src/domain/agent.ts`, `src/domain/types.ts`, `src/db/repo.ts`, database schema and project ZIP code; `src/lib/ai/chatStream.ts`, `src/lib/ai/responsesStream.ts`; context planner/compaction/runtime persistence; composer controls and task source inspector. Request-envelope and media-retention changes need focused tests before UI integration. No compatibility branches for hypothetical old datasets.

## Delivery checkpoint
- [x] Storage, parser foundation and lifecycle/ZIP integration.
- [x] Both request protocols, scoped source tools and native selected-model image reading.
- [x] Composer/library/preview UX and shared context preview.
- [x] Task evidence, source withdrawal and independent full-scope review.
- [x] Full tests, typecheck, build and native browser validation (see validation/quality.md).
- [x] Dependency notices, executable specs and retrospective.
- [x] User confirmed the concrete commit batch and archival on 2026-09-19. Work commits are followed by the archive and journal scripts.
