# Independent Trellis check — reference intake

Date: 2026-09-19. Reviewer: existing `/root/agent_run_review` agent; no nested agents and no commit.

## Scope and evidence

Read the active PRD, design, implementation plan, check manifest, frontend index/Quality Check and referenced execution/context/tools/project/memory/production/component/hook specifications. Reviewed the complete runtime/storage/parser/GC/ZIP/task-evidence changes, including new files, against actual call paths. The reviewer previously implemented the attachment UI; its browser acceptance is performed independently by the main session.

Reviewed boundaries:
- Project-owned source identity, exact revision, local bytes, parse-operation CAS and cancelled/removed source handling.
- Native TXT/DOCX/PDF paths, local worker/font assets, raw-text rendering, ZIP preflight plus actual decompression cap, byte/unit/character bounds and image dimensions before decoding.
- Selected-only context, both real multimodal wire formats, tool-output/image pairing, opaque Responses continuation, retry, compaction and source checks after asynchronous Blob encoding.
- Prepared-input audit semantics and image-token estimates; compressed source coverage is not a claim that old pixels were resent.
- Thread/project lifecycle, media ownership/retention, backup/import ID remapping, source digest and chunk validation.
- Task record/evidence provenance and indirect source replay through history and AI wrap-up.

## Findings fixed

1. **Historical tool-cache replay bypassed source withdrawal.** `project_history_read(type=tool)` excluded memory tools but could return an old `project_reference_read/search` result as plain historical text, outside `referenceInput` validation. `memoryTools.ts` now excludes reference-tool caches too. A regression withdraws a real source and proves every reference-tool result is unavailable through the historical-read path.
2. **AI wrap-up replayed cached reference prose.** `collectWrapupSnapshot` serialized whole reference tool results even after the separate source evidence became unavailable. `referenceToolSummary` now projects identities, coverage, image metadata and historical status only. A real mocked `prepareTaskWrapup` POST regression proves that neither withdrawn raw bodies/search excerpts nor an old saved snapshot's cached body enter the new request. User records and historical user/assistant prose stay intact, and old snapshots are not rewritten.
3. **Reference-owned media looked orphaned during approval preparation.** `mediaUsage` and `ownerSnapshot` omitted project references even though GC correctly retained them. Both now include reference ownership, and cleanup copy names the library. The business-tool regression proves a library-owned file is rejected before approval and source changes affect the preview fingerprint without exposing document text.
4. **Valid long multiline text could not round-trip through backup.** Parsing excluded inserted line separators from `coverage.characters`, while import capped actual chunk text using an insufficient chunk-count allowance. Character accounting now exactly matches persisted chunk text, separators included. A 100,000-line source imports, honestly truncates within the character cap, exports and imports with unchanged chunks/coverage. Package validation also rejects conflicting active status, coverage counts and missing-text PDF claims.
5. **Audit UI overstated transmission.** Image labels now describe prepared inputs, not proven POSTs. Historical image coverage with an empty image list explicitly says the current request does not contain those pixels. Source-link metadata read failures cannot throw the entire chat out of rendering.
6. **Explicit image re-add was blocked by an old tombstone.** Coordinated with the runtime owner, who fixed exact new-reference validation and current-active-source selection. Old precise references and unqualified old raw-media descriptors remain invalid. Reviewed the finished patch and its passing regression.

## Verification

Reviewer checks with `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`:
- `lint` / TypeScript: passed after review fixes.
- `git diff --check`: passed.
- `agentMemoryTools.test.ts`: 9 passed.
- `referenceEvidence.test.ts` + `agentTaskWrapup.test.ts`: 20 passed.
- Latest `references.test.ts` + `agentReferences.test.ts`: 24 passed, including long multiline ZIP and explicit image re-add.
- `agentBusiness.test.ts`: 20 passed.

The main session independently owns final full-suite/build and native-browser validation. It reported real four-format import, both protocols, selected and tool-read pixels, source/citation viewing, failure-draft retention with zero provider POST, context preview and 390px modal layout passing. Those are main-session browser results, not a duplicate reviewer run.

## Final assessment

No unresolved concrete blocker remains from this review. Final full-suite/build are the main-session release gate. Source withdrawal blocks structured stale source replay; it intentionally does not erase user-authored records, already-saved human/assistant prose or historical snapshots. PDF/DOCX extraction limitations, no OCR and approximate image token counts remain documented product boundaries.
