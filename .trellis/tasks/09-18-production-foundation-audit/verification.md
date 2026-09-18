# First-batch verification — 2026-09-18

## Outcome
R1–R6 implemented. User approved execution on 2026-09-18. Independent trellis-check review completed with fixes incorporated; work is ready for final commit proposal after final gate. No code commits or pushes yet.

## Covered contracts
- Transactional read/merge/write across project, episode, assets and shots; independent slots survive concurrency; deleting episodes cannot remove the last one; orphan cleanup protects shared media and rolls back failed slot changes.
- Scoped, keyed asset/story/world drafts expose saving/error/retry. In-app navigation retains failed drafts for reopening and backup retry. Active unsaved drafts request browser beforeunload protection and attempt a flush. This is not durable crash recovery.
- Media dialogs await save, retain failed input/uploads for retry, serialize actions, clean draft-owned uploads on cancel/replacement, and inspect full images / playable video outside tile buttons.
- Dexie v6 moves filters to episodes, prunes beat IDs and migrates/remaps legacy/current ZIP filters. Deep-link reveal waits for current project/episode/media and clears obstructing filters.
- Delivery and gap predicates require existing same-project nonempty media of the correct result kind/MIME. Image clip placeholders do not count as videos; missing scene targets remain gaps. Manual status stays manual.
- Both workspace and project-gallery backups flush scoped drafts then capture a consistent read transaction including Blobs. Failure stops export visibly. Long storyboard content has no line clamp/truncation.
- Multi-copy retry excludes committed source IDs; pending dialog actions disabled; associated field labels and accessible removal controls.

## Independent review corrections
1. Guard useShotMedia collection identity so a prior query result cannot masquerade as current loaded media; regression added.
2. Add missing project-gallery backup flush/error handling, including detached failed draft regression.
3. Browser found reveal-shot running before episode filters loaded; wait for matching current project and episode before marking reveal complete.
4. Browser reload inside debounce window loses unsaved input; add active-editor beforeunload guard and best-effort flush, with clean/dirty/inflight/error regressions.

## Browser verification
Production preview `127.0.0.1:5175` with synthetic audit fixture only; no existing user records, credentials or paid calls touched.
- Filter status to approved (0/1), visit Produce, follow locate-shot: final build reveals the draft shot and clears filters (1 shot).
- Slot prompt cancel → reopen: abandoned text absent. Save → reopen: persisted prompt restored.
- Story logline edit → immediate backup: download success shown; opened `/Users/xiaomengdao/Downloads/审查样例 · 生产预览.zip`, verified `episodes.json` contains the exact new logline.
- Eight-line shot content including an explicit end marker is fully visible on storyboard page and screenshot. Actual printer/PDF pagination not exercised.
- Character label-based editing of name, bio, appearance → immediate in-app navigation → reopen: all three values restored with saved states.
- Browser hard reload within debounce initially reproduced loss; addressed by beforeunload guard with unit tests. Browser-prompt compatibility remains dependent on browser activation/event policy; forced termination cannot be protected.
- Native file picker upload, actual video playback, disk quota failure, and multi-page print not manually exercised. Lifecycle/storage failures and partial-copy retry covered by automated tests.

## Automated gate
Use only `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.
- Full lint/typecheck: passed (`tsc -b --pretty false`).
- Full test suite: 26 files, 340 tests passed.
- Production build: passed in 14.37 seconds; existing large-chunk warning only.
- `git diff --check`: passed.
- Independent follow-up review of beforeunload guard: passed, no blocking finding.

## Remaining roadmap
Second batch: optional entity fields/relationships/media reuse + APIMart model-aware project image/video defaults. Third: manual media handoff package and typed AI context/target/revision/provenance boundaries. Model parameters documented in the second task research, not implemented in project settings yet.

Known existing warning: Vite Agent chunk ~7.9 MB (gzip ~1.9 MB), outside this non-AI batch. Unrelated `.tanstack/` stays outside proposed commits. Synthetic fixture and downloaded backup remain available for inspection.
