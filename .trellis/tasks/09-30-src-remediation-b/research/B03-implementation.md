# B03 implementation checkpoint — AU-03 / PU-04

2026-09-30, implementation only after B02 PASS. This report is a bounded handoff for independent review; it does not close findings or update coordinator metadata.

## Product changes

- `ContextParameters` passes only the changed `Partial<ContextPolicy>` fields. The existing synchronous save lock remains. A previously rendered callback can no longer replay other rendered policy values into storage.
- `contextSettings.updateContextPolicy` reads the target thread/general agent inside the existing read/write transaction, normalizes the latest policy, merges explicit fields, then normalizes the result. Independent fields survive; same-field updates follow the last committed explicit value. Complete-policy callers remain accepted. Explicit `customContextTokens: undefined` clears that optional field.
- Reset and save-as-default use the private full-replacement path in their existing transactions, reading the current source there. An optional token field absent from the chosen source is removed from the destination. They do not implement reset by merging a partial patch. General-agent initialization/migration and missing-thread errors remain transaction-scoped.
- `repo.setShotCharacterSelected(shotId, characterId, selected)` applies one boolean intention to the transaction-latest shot membership using explicit add/remove branches. Repeated adds/removes are idempotent; existing member order is preserved and a new member appends. `assertShotReferences` validates current project, episode, beat, and surviving character/scene/prop/style ownership before writes. The existing production transaction and project touch preserve unrelated shot fields/media.
- Selecting a missing/deleted target rejects. An existing foreign target rejects for either boolean. Removing a missing/deleted target is allowed only when the resulting remaining references validate, enabling repair without resurrecting anything. Any invalid surviving reference rejects without changing shot/project.
- The actual `ShotRow` checkbox passes `checked === true` directly, and failures use the existing toast outlet (`保存角色失败，请重试`). It does not construct a fresh whole array. The explicit clear command, `patchShot` array replacement, and A02 bulk assignment/undo remain intentional exact replacements.

B03 changes are limited to these four product files and one new test file. `ShotEditorPage` already contained B01 edits on entry; its B03 edits are only the new repo import and checkbox callback. No coordinator spec/status/ledger files were edited by this unit.

## Behavioral evidence

`tests/b03IntentBoundaries.test.ts` adds 22 cases. It executes the production component functions and their actual callback props through a deterministic hook host, and production Dexie mutations against fake IndexedDB. It traverses the actual ShotEditorPage → BeatBlock → BeatBlockView → ShotRow render path without exporting private components or copying mutation/callback logic.

Context coverage includes two stale callbacks on different fields for both thread and default policy, concurrent independent callbacks from two hosts, same-field last-commit values, actual optional-budget input clearing, stale reset/save-default callbacks reading latest source and clearing absent optional tokens, bounded normalization, missing-thread rejection, and complete-policy compatibility through existing context tests. The single-host case waits for the existing lock to release without rerender; the two-host case accepts concurrent transactions. Neither claims that the lock accepts two synchronous same-host events while saving.

Character coverage includes rapid same-render add/add, add/remove, duplicate explicit intents, ordered membership, unrelated concurrent notes/media-slot edits, project touch, actual exact clear and `patchShot` replacement, foreign target rejection for both booleans, missing shot/project/episode/selected character, foreign episode ownership, invalid surviving character/scene/prop/style references, and deleted-reference removal followed by failed reselect/toast. Failed mutations compare the complete stored shot/project before and after.

## Final checks

After the explicit-branch cleanup, the final focused command was:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b03IntentBoundaries.test.ts tests/contextManagement.test.ts tests/repo.test.ts tests/repoReliability.test.ts tests/shotBulkUndo.test.ts tests/draftConcurrency.test.ts tests/draftMedia.test.ts tests/manualDraftBaseline.test.ts tests/manualDraftWiring.test.ts tests/b01QueryIdentity.test.ts tests/b02MemoryPromotion.test.ts
```

Result: **11 files / 166 tests passed**, exit 0; start 15:21:15 Asia/Shanghai, duration 2.13s. This includes focused A02 bulk undo, A03/A04 draft/media/baseline, and B01/B02 regressions. The earlier 3-file run passed 49 tests; the final expanded run supersedes it.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm run lint
```

Result: **passed**, `tsc -b --pretty false`, exit 0. `git diff --check`: **passed**, exit 0. No product or test edits followed these final checks; only this report was added.

## Evidence limits

The callback fixture is a lightweight hook host, not ReactDOM/browser/Radix scheduling. Effects are not run; supplied query results deliberately retain snapshots. Transactions and persistence are production Dexie code over fake-indexeddb, not a real browser IndexedDB engine. No full application/browser acceptance, full-suite, or whole-batch review claim is made. Existing A02/A04/B01/B02 focused regressions passed; independent review remains the coordinator's next step. No install, commit, push, archive, spawn, spec/status/ledger changes, or later B04 implementation occurred.

## Final source fingerprints

SHA-256 at handoff (the ShotEditorPage fingerprint includes preserved B01 work):

| Path | SHA-256 |
| --- | --- |
| `src/components/agent/ContextParameters.tsx` | `436e0f779181f61661c36bb83e10c4fa97e762c8140e6cb748712bdc42f8348a` |
| `src/db/contextSettings.ts` | `e599b1ada783a7aa31c2e3234186a91cf05d63ba2fb49ed6b08a116320f28109` |
| `src/db/repo.ts` | `f87b802e9b9eea8a4642e60bd8ed9180d1f1b9113c3de42d2e6717176f2792cd` |
| `src/components/shots/ShotEditorPage.tsx` | `c2e83c197b71236a2f09985012fcc8447b51392db5ca2b43499bc057fcaac428` |
| `tests/b03IntentBoundaries.test.ts` | `c4619b7cf76ea84b42945777df36e96d8a360d57a342585be9784dd25432d528` |
