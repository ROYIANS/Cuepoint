# C05 implementation handoff

Ready for independent check; PD-03 remains a repository-boundary risk, no normal UI exploit demonstrated. No C06/spec/ledger/commit/archive changes.

`src/db/repo.ts`: asset patch types omit `slots`; shot patch type omits all `ShotPictureField` keys. A shared `assertTextPatch` rejects own media keys (including `undefined`) before `pickPatch` or mutations. All existing permitted text, relations, extra and baseline CAS remain. Removed asset patch slot merging. Media writes continue through dedicated setters.

`assertSlotMedia` now defaults to image results; only shot `clip` permits image or video results. Image/video references retain their existing respective MIME rules. Studio copy reuses default image-result validation. `patchProjectOutput` validates new cover with the same owned/nonempty/image rule in its existing `PRODUCTION_TABLES` transaction before writing; existing orphan recycling and shared/proposal/job/batch retention remain atomic.

Changed tests (all six owned files and before/after hashes in `reviews/C05-implement-snapshot.json`):
- `tests/mediaPatchBoundary.test.ts`: 82 cases for explicit media-key rejection, invalid owner/existence/size/MIME/declared and target kinds, valid/clear/replacement, text/relations/extra/CAS, studio copy, shared/proposal/job/batch retention, proposal undo, true orphan recycling, rollback after actual media deletion and failed project touch. Full production-table snapshots compare rows/timestamps/media bytes around rejection/failure.
- `tests/repo.test.ts`: shared studio slot fixture uses two dedicated setters.
- `tests/projectPackage.test.ts`: export snapshot firstFrame and prop result fixtures use dedicated setters. Studio character's illegal video result changed to legal video reference; imported remapped video reference asserted.
- `tests/productionContext.test.ts`: separate text/relations patch from dedicated first-frame setter.
- `tests/b03IntentBoundaries.test.ts`: same concurrent membership/text/slot preservation assertion with dedicated slot setter.

No production caller edits needed: existing 43 AST calls / 4 namespace function references plus manual dynamic ShotEditor column/relationship, strict agent schema and normalized proposal paths remain text/relations only. Fixture AST follow-up located six wide-media calls in the four files above.

Validation:
- Old entry `C05-old-entry-red.log`: 24 failed / 54 passed. **23 actual expected boundary failures**; the additional failure was the new test's incomplete multi-field baseline. It is excluded from risk proof.
- First patched `C05-boundary-first-run.log`: 77 passed / 1 incomplete-baseline failure. Corrected test to use complete captured shot baseline; production CAS unchanged.
- Final `C05-focused-tests.log`: **12 files / 260 passed**, including boundary 82 and adjacent repo, package, context, B03, reliability, baseline, asset, proposal, job, batch and C03 parent suites.
- Explicit local pnpm `lint`: exit 0 (`C05-lint.log`).
- Existing audit ESLint configuration/tool: 11 before / 11 after repo diagnostics, **zero added**, including complexity (`C05-static-summary.json`); new helper clean, no suppressions.
- Scoped `git diff --check`: exit 0. No full suite/browser as requested.

Entry snapshot backs up repo and migrated tests. All 29 prior reviewed file hashes matched entry. Final prior drift is only authorized `src/db/repo.ts`; independent checker should review the full current repository scope including preserved C03 changes. `allChangedBefore` / `allChangedAfter` cover the whole changed source/test/script set (29 -> 34); six owned hashes are explicit. Independent checker follows; do not close ledger from this implementation handoff.
