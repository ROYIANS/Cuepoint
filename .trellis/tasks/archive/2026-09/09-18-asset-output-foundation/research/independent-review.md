# Independent review — second foundation batch

Reviewed the task PRD, design, implementation plan, check context and the complete current product diff against frontend state, component, type, export and quality contracts.

## Findings fixed

1. `src/db/repo.ts`: slot commit validation checked owner and MIME but accepted an empty Blob. The picker already excludes empty records, so a record becoming empty between selection and Save could previously be committed. Added a Blob size check inside the same transaction and a regression assertion in `tests/assetFoundation.test.ts`.
2. `src/db/repo.ts`: the new project-details patch silently retained the old name for blank input, allowing the keyed text editor to report a blank draft as saved. It now rejects whitespace-only/undefined names with an actionable error. The regression test verifies that a mixed patch rolls back its other fields. Existing `renameProject` behavior is unchanged.
3. `src/components/shots/ShotEditorPage.tsx`: the new relationship dialog allowed closing or switching shots while a save was pending or had failed, discarding its retry state. The editor now reports status to the parent, blocks those actions until the write finishes or the user retries/discards the failed choice, and protects browser unload. A deleted-target fallback can discard the failed choice without trapping the user.

## Findings not fixed

No remaining code blocker found within this batch. The root session owns final executable-spec synchronization and browser acceptance checks. No paid provider request or user database manipulation was performed by this reviewer.

The production build still reports the existing large Agent chunk warning (approximately 7.9 MB before gzip). Bundle redesign is outside this batch and was not changed.

## Review coverage

- Optional entity fields: asset editing, independent studio snapshots and package round-trip.
- Project/shot styles: inheritance versus explicit none, project ownership, deletion cleanup, duplication and import remapping.
- Shot props and beat-seeded cast/scene: transactional validation, explicit creation only and restore boundaries.
- Output defaults: independent image/video contracts, exact native names and casing, unsupported profile retention, invalid mode transitions, no silent shot timing changes.
- Media reuse: owner and modality filtering, stale reference rejection at commit, shared-media orphan safety.
- Library routing/search: studio ownership, project tab return, authored-text search.
- Delivery: derived relation names, inherited style resolution, CSV/print integration and loading gates.
- Save behavior: root output close/discard guard, optional text draft status and relationship retry handling.

## Verification

- Lint / TypeCheck: PASS (`pnpm lint`, the project command runs `tsc -b --pretty false`).
- Tests: PASS, 386 tests across 30 files.
- Production build: PASS, 12.90 seconds.
- `git diff --check`: PASS.
- All package commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.
- Final browser verification is performed separately by the root session against this production build.

## Narrow-layout follow-up

Reviewed the root session's `min-w-0` additions on the project settings wrapper, sections and output fieldset. They remove intrinsic minimum-width overflow without changing form behavior. Reviewed the new executable asset/output spec and its index/component/delivery links, and added explicit blank-name, relation-close and nonempty-commit contracts.

Fresh lint/typecheck and production build PASS after this CSS change (13.77 seconds). Behavioral tests were not rerun for CSS/documentation-only changes; the 386-test result above remains applicable. Updated production files are ready for the root session's 390px browser recheck.
