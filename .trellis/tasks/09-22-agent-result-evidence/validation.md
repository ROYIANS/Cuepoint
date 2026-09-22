# Validation — direct-write evidence first delivery

## Implemented scope
- Versioned bounded direct-write receipts committed atomically with existing local business writes and tool ledger results.
- Film project/episode/beat/shot/asset CRUD returns bounded normalized records; shot effective style resolves inheritance. Real project seeds are recorded. Deletions cover the explicit target only.
- Audio chapter/speaker/segment/track edits, clip placement/edit/removal, music draft/reuse and work metadata emit receipts through an opt-in library helper.
- Owned persisted receipt projection and one compact shadcn saved-changes disclosure, with original-call navigation, operation counts and explicit missing/omitted coverage.
- Both Chat and Responses continuation receives actual committed audio receipts. Model instruction explains their direct-effect limits.

## Automated verification
- Full Vitest: 116 files / 1380 tests passed before final review refinements.
- Focused sound/receipt/protocol tests: 3 files / 56 tests passed.
- Business/transaction tests: 2 files / 54 tests passed.
- Final lint/typecheck passed after review fix.
- Production build passed; existing >500 kB chunk warnings remain.
- Model snapshot verified: 197 files, 85 providers, 1855 models.
- Task manifests verified (5 real entries each); whitespace check passed.

## Review and acceptance limits
Independent review found and fixed numeric CAS revision mismatch for audio/music seeds: receipts now return actual persisted numeric revisions, with exact DB-match assertions. Final focused regression: 5 files / 110 tests passed after the fix. No further concrete blocking defect found.

Browser inventory returned `Codex auth token is unavailable`; no desktop/narrow visual or live-model acceptance was possible. No paid generation or user project mutation was used for tests.

The stage does not add creation/binding handoff, contextual owner defaults, general structured recovery, asynchronous job outcome projection, script-range impact reporting, heterogeneous shot batches, semantic claim adjudication or forced continuation. Audio split and other unsupported mutations remain explicitly uncovered, not inferred as successful. Task remains in progress; no commit made.
