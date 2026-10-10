# A02 independent check — PU-01 / SS-05

Date: 2026-09-30. Role: native trellis-check. Scope: A02 only.

## Decision

**PASS — PU-01 and SS-05 within the A02 contract. BLOCK: none.** No functional blocker was found. A follow-up readability correction removes the new undo button no-nested-ternary warning; no test changes were necessary. Main may record A02 as independently checked; this report does not close the task or advance A03/A04.

Read the check.jsonl context, task PRD/design/implementation plan, and reviews/A02-implementation.md; compared the actual repository/UI/controller callchain and tests with those claims and the synchronized state-management contract. Existing A01, spec, ledger and task changes were preserved.

## Actual callchain and database evidence

- `ShotEditorPage.tsx:608–611`: applyBulkPatch awaits patchEpisodeShots using selected IDs, then registers only its returned inverse; restore calls undoEpisodeShotBulkPatch. No rendered shot snapshot or per-row patchShot inverse remains in this path. Empty selection produces no registration.
- `repo.ts:1466–1537`: the allowed fields and snapshot mapping include all eight fields: beatId, durationSec, status, characterIds, sceneId, propIds, styleId, notes. Before is read from rows inside the forward transaction; after comes from the normalized updated rows. The transaction must finish successfully before its inverse reaches the UI. Structured copies detach array payloads, and explicit undefined preserves clearing semantics; null style remains distinct.
- `repo.ts:1539–1575`: one PRODUCTION_TABLES write transaction checks episode/project scope, project kind, duplicate IDs, every target owner, nonempty allowed before/after keys with matching sets, and each affected current value. Values may equal captured after or captured before; ordered arrays compare by contents. Current and proposed restored relationships are checked for every row before bulkPut. A third value rejects the entire group. Restored rows merge before fields onto current rows, retaining independent edits. Shot writes and project touch share the transaction.
- `tests/shotBulkUndo.test.ts`: executes the real repository with Dexie/fake-indexeddb. It proves latest committed before versus stale view, normalized after, all-eight-field capture/restore, scope and malformed-key rejection, array equality/reordering and detachment, coherent partial/whole already-before convergence, and undefined/null restoration. Independent content, shot number, camera angle, slot result and media survive. Conflict on the second target and invalid restored references have zero updating-hook calls, proving validation precedes writes rather than merely proving rollback. Injected second-row and project-touch failures prove complete storage rollback and successful retry with the same inverse; forward failure also rolls back.

## Controller and provider evidence

- `undo.tsx:40–66`: inFlight is keyed by action identity and stores the Promise before restore executes or subscribers are notified. Duplicate calls for the same pending action share it and invoke restore once. Success clears only the still-current action. Failure rejects to callers, keeps that action with pending=false/error while unexpired, and does not reset its timer or expiresAt. Old settlement cannot clear or attach an error to a newly registered action; clear/expiry cannot resurrect an action.
- `undo.tsx:84–116`: the provider subscribes to state changes, displays the failure with role=alert, exposes retry, disables pending clicks, and catches the button call rejection. The controller retains the visible error; programmatic callers still receive rejection.
- `tests/undo.test.ts`: deferred restore and fake-time assertions prove duplicate invocation suppression on success/failure, retry after rejection, the original expiry window, replacement during old success/failure, an older success settling while a newer restore remains pending, clear/expiry during both outcomes, and pending/error/retry subscriber notifications. These test public state and behavior rather than reproducing the controller implementation.

## Independent validation

Command executed in this check:

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/undo.test.ts tests/shotBulkUndo.test.ts tests/repo.test.ts tests/repoReliability.test.ts --reporter=dot
exit 0 — 4 files passed, 75 tests passed, duration 509ms
```

The initial check needed no source correction and did not rerun lint. The follow-up below independently reran undo and lint after the small label correction. Existing test-first red evidence is sufficient; no mutation harness was repeated.

## Limits and changed files

No browser mount, visual/interaction test, full suite or build was performed. Provider feedback and click rejection handling were verified by source inspection, with controller notification/lifecycle behavior tested separately. Database evidence uses fake-indexeddb rather than a browser storage engine. The older-failure/newer-pending combination is supported by the same action-identity guard inspected in source; its dedicated newer-pending test exercises older success, while replacement tests cover both outcomes. No issue found requires expanding this unit.

Files written by this check: `src/lib/undo.tsx` (button label only) and `.trellis/tasks/09-30-src-remediation-a/reviews/A02-check.md`. No test/spec/ledger edits, spawning, installation, commit, push, or archive.

## A02 closeout — undo button readability

The main session's independent ESLint/SonarJS results in reviews/A02-eslint-*.json identified one new no-nested-ternary warning in the undo button label. Replaced that nested expression with a local buttonLabel and explicit if / else if branches. Pending retains priority over error, and the three displayed strings are unchanged. No controller or repository behavior was changed. The historical ESLint artifacts were preserved; this bounded follow-up did not rerun the scanner, so rule removal is supported by inspecting the replacement source rather than a new ESLint result.

Validation after the label change, limited to the requested undo + lint:

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/undo.test.ts --reporter=dot
exit 0 — 1 file passed, 15 tests passed, duration 299ms

/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
exit 0 — tsc -b --pretty false
```

Final decision remains PASS / no blockers. This is A02 closeout only; A03/A04 were not advanced.
