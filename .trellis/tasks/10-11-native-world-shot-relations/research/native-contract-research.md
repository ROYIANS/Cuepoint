# Research: Native world contracts, relations and durable inverses

- Query: Define a bounded fresh native storage/bridge/repository design for project-owned world settings, characters, scenes, props, styles and their story/shot/default-style relationships. Identify inverse-receipt, owner-validation, deletion and packaged-acceptance obligations.
- Scope: internal; current source and project specs, without product changes or test/build execution.
- Date: 2026-10-11
- Task status: planning; implementation is not approved. **Candidate-only research: the user subsequently redirected toward rapid reuse of existing Web business logic, full desktop parity and Agent/AI priority. The per-domain native implementation below is parked, not an approved scope or execution plan.**

## Findings

### User redirection and architecture implication

The current video slice shares React views but implements persistence/business operations twice: browser commands in `src/db/shots.ts`, `src/db/episodes.ts` and `src/db/projects.ts` own Dexie transaction logic, while native `workspace.rs:855` implements corresponding add/patch/reorder/duplicate/delete/bulk/inverse decisions over typed Rust state. The adapters reuse argument semantics and presentation, not the full business-command bodies. Continuing this pattern for each world domain would add more duplicated business behavior, field validation and cascade decisions.

Given the new user direction, first evaluate a **shared persistence abstraction beneath existing business commands** against their actual transaction/query/Blob/live-query requirements. Rust can retain the secure SQLite/file/IPC owner while common TypeScript commands retain business semantics. This requires research before choosing an API; it is not a justification for arbitrary renderer SQL, untyped JSON patching, Dexie mirroring or a second native UI. The world DTO/schema/actions below are a recorded candidate for the previous per-domain approach, not the selected architecture. Agent/AI integration and whole-product parity were outside this research dispatch; no plan for them is inferred here.

### Files found

| File | Responsibility |
| --- | --- |
| `src/domain/types.ts:193` | Three world-setting text fields; shared project/entity types at lines 243–328. |
| `src/db/productionRecords.ts:46` | Existing empty character/scene/prop/style defaults; IDs, timestamps and empty slots. |
| `src/db/assets.ts:28` | Browser entity CRUD, field whitelists, field baselines and delete cascades. |
| `src/db/productionShared.ts:52` | Browser relation existence/project-owner validation. |
| `src/db/projects.ts:76` | Browser default-style owner checking; world-setting field patch at line 198. |
| `src/lib/shotRelations.ts:10` | Read-time style inheritance and explicit no-style semantics. |
| `src/lib/videoWorkspaceRepository.tsx:29` | Runtime capabilities; native projections; empty native world queries at line 222. |
| `src/lib/nativeWorkspace.ts:59` | Closed product actions, baseline serialization, result-kind checking and serialized requests. |
| `src/lib/nativeWorkspaceContract.ts:13` | Strict shared renderer/acceptance DTO schemas; current schema literal 4 at line 123. |
| `desktop/tauri/ui/bridge.ts:4` | Historical acceptance bridge imports the product action/DTO owners. |
| `desktop/tauri/src-tauri/src/contracts.rs:13` | Schema 4 and closed Rust DTOs/patches/jobs/results. |
| `desktop/tauri/src-tauri/src/database.rs:19` | Exact SQL schema registry; state decoding, validation and video state writes. |
| `desktop/tauri/src-tauri/src/workspace.rs:136` | Field-aware inverse merger; baseline/conflict logic at line 280; transactional receipts at line 747. |
| `desktop/tauri/src-tauri/src/desktop.rs:49` | Closed IPC envelope/action dispatch and generation control. |
| `desktop/tauri/src-tauri/tests/shared_video_contract.rs:249` | Durable reopen/undo and unrelated-edit preservation oracle. |
| `tests/videoWorkspaceRepository.test.ts:1` | Real product adapter with substituted IPC boundary. |
| `tests/sharedVideoPageParity.test.ts:1` | Shared consumer execution and native browser-owner exclusion. |
| `desktop/tauri/scripts/tools.mjs:7` | Workspace-local fixed Rust toolchain and explicit machine pnpm selection. |

### Current boundaries that must change together

1. `database.rs:729` rejects nonempty beat characters/scene with `capability`; `database.rs:752` rejects any shot character/scene/prop/style association. Adding entity tables alone cannot enable relations. Replace these capability checks with owner-closure validation and apply the same rules to input, commit, runtime state, reopen, backup/restore and receipt snapshots.
2. `contracts.rs:136` has only `Shot.style_id: Option<String>`, and `nativeWorkspaceContract.ts:96` has nullable `styleId`. `videoWorkspaceRepository.tsx:151` projects null directly into the shared shot. This loses the shared distinction between inherited style and explicit no style. `shotRelations.ts:10` and `ShotRelationsEditor.tsx:27` establish three semantic states: `undefined` inherits, `null` disables, ID selects a style. A fresh schema must represent all three.
3. `videoWorkspaceRepository.tsx:89` creates a native project projection from `emptyProject`; its world setting is currently fabricated as an empty default because native data does not contain it. Project default style is absent, and `patchProjectDetails` at line 359 rejects that field. Both query and write projection must be extended; displaying a saved-looking default without a durable field is insufficient.
4. The exact schema checker (`database.rs:103`) rejects any old schema/table SQL/extra trigger/view/explicit index. Update `SCHEMA`, ready marker/backup schema expectations, Rust/renderer state types and all deterministic fixtures to the next fresh schema. **Do not add schema-4 migration, compatibility aliases or data readers.** Use a new isolated packaged app identifier/workspace for acceptance; never delete an existing developer workspace implicitly.

### Recommended bounded schema and DTOs

Use fresh schema **5** unless another concurrently approved change reserves it. Keep world entities project-owned; reject the virtual owner `studio` for new native world records. The browser owner can retain its Studio/IP workflows, but native capability gating must prevent their mounting. This scope does not require library versions, media slots, adoption/material-use records, generation models or arbitrary plugin payloads.

Recommended tables/closed rows:

| Row | Fields / invariants |
| --- | --- |
| `world_settings` | `projectId`, `worldview`, `background`, `rules`; exactly one row for each native video project, initialized atomically with its project. This separate typed row makes each world-setting field independently patchable/invertible. |
| Character | `id`, `projectId`, `name`, `bio`, `appearance`, `notes`, `personality`, `motivation`, `voice`, `createdAt`, `updatedAt`. |
| Scene | `id`, `projectId`, `name`, `location`, `timeOfDay`, `atmosphere`, `notes`, `geography`, `lighting`, `createdAt`, `updatedAt`. |
| Prop | `id`, `projectId`, `name`, `kind`, `notes`, `appearance`, `material`, `size`, `usage`, `continuity`, `createdAt`, `updatedAt`. |
| Style | `id`, `projectId`, `name`, `notes`, `palette`, `lighting`, `lens`, `composition`, `negativePrompt`, `createdAt`, `updatedAt`. |
| Video project default | Nullable `defaultStyleId`, where a non-null ID resolves to an existing style from that project. Null means no project default. |
| Shot style override | Closed tagged union `{mode: "inherit"}`, `{mode: "none"}`, `{mode: "style", styleId}`; SQL `style_mode` plus nullable `style_id`, with coherent mode/ID validation. All newly created shots use inherit. |

Store the optional shared **text** fields as canonical empty text in native DTOs, or choose explicit nullable text consistently in both Rust and Zod. Empty text is sufficient for existing shared text inputs and avoids missing-field ambiguity in snapshots. Omitted patch keys mean unchanged; blank text clears text. Declare exact bounded UTF-8 byte/text limits and test Chinese/emoji boundaries because Rust `String.len()` counts bytes while Zod `.max()` counts JS units. Follow current bounded-text conventions; do not impose a new nonempty-name rule on browser behavior without a separately documented decision.

Native DTOs must exclude `slots`, `extra`, media blobs/paths and generation provenance. The product adapter may supply `slots: {}` when converting typed native entities for shared display, with `mediaSlots` still unavailable; it must never persist that empty presentation value into a media owner. Do not use `serde_json::Value` as an entity payload or arbitrary JSON patch. Four explicit patch structs retain browser text whitelists (`assets.ts:47`, `:124`, `:195`, `:253`) with `deny_unknown_fields` and strict Zod equivalents.

Recommended closed actions/jobs/results:

- `worldState {projectId}` returns one typed owner-scoped snapshot (setting, four entity arrays, default style), or extend the existing owner-scoped `videoState` with these fields. Prefer one coherent snapshot per editor read rather than repeated whole-workspace calls.
- `patchWorldSetting {projectId, patch, baseline?}` patches its three text fields.
- Explicit `addCharacter/addScene/addProp/addStyle {projectId}` return their committed typed row, using current default names. Native code generates authoritative timestamps and identity, or strictly validates a renderer-generated identity; the task design must choose one convention.
- Explicit `patchCharacter/patchScene/patchProp/patchStyle {projectId, id, patch, baseline?}` return their committed typed row. Including expected project owner prevents an ID-only editor from mutating another project when a stale view hands it an ID.
- Explicit typed delete actions return the committed result. Existing entity deletion has no undo UX, so **no new entity-delete inverse/undo command is required by baseline parity**. A receipt-based entity undo is an optional separate tradeoff only if explicitly added to the later approved scope.
- Extend `patchVideoProject` for nullable `defaultStyleId`, and replace the native shot wire `styleId` with the tagged `styleOverride`. Map shared `undefined/null/string` at the adapter boundary. Never run generic `nullableFields` over shared style ID after this change: it currently collapses `undefined` to null (`videoWorkspaceRepository.tsx:484`, `:671`, `:758`).
- Extend `State`, owner-scoped snapshot, strict result discriminator, product `assertActionResult`, historical acceptance bridge types and generation checks together. Extra/malformed fields and wrong result kinds reject **before** accepted generation advances (`nativeWorkspace.ts:301`). Failure never retries in Dexie.

### Relation storage and owner invariants

The existing schema stores character/prop lists in delimiter-separated text (`database.rs:50`, `:54`, `:445`, `:470`). A bounded next slice can retain this convention without introducing relation tables, provided every list ID rejects U+001F, lists contain unique valid IDs, ordering round-trips unchanged, and complete closure resolves each ID against the expected entity type/project. `contracts.rs:527` identity validation alone does **not** exclude U+001F; enforce the additional encoding constraint explicitly. A future normalized relation-table choice would expand full state write/inverse work and is unnecessary for this slice.

Required closure:

- Beat character/scene owners are derived through its episode’s project. Shot characters, scene, props and selected style must belong to `shot.projectId`, which already must equal its episode owner.
- Default style belongs to the video project. An inherited shot has no copied style ID: resolve the project default at read time, matching `shotRelations.ts:10`.
- `none` carries no ID; `inherit` carries no ID; `style` carries exactly one valid project style ID. Unknown mode, extra ID, missing selected ID and foreign/missing style all reject.
- Empty character/prop list clears; scene null clears; missing patch key retains. Validate all associations in multi-add, duplicate beat/shot, bulk patches, reorder/inverse and normal patch commands, not just the new CRUD entry points.
- New shots created under a beat copy that beat’s characters/scene, as browser `shots.ts:109` already does. Subsequent beat relation edits should retain current browser semantics: no implicit propagation into existing shots unless an explicit operation does so.
- Global row/count/text/list boundaries remain enforced. Strict reopen rejects orphan/malformed world rows and invalid relationships. Existing open-runtime tolerance for externally removed owners should remain diagnostic only; never treat a malformed logical row as authorization for a new mutation.

### Field compare-and-swap and deletion behavior

Reuse native field baselines and current=requested convergence (`workspace.rs:280`), with typed current/expected/requested conflict outcomes for new world/entity actions in `conflict_for_job` (`workspace.rs:380`). Each baseline may mention only a unique field present in the intended patch; unknown/duplicate/unpatched fields reject. Numeric and JSON-structured baselines retain typed semantic equality (`workspace.rs:264`); lists are ordered arrays and style override is a closed JSON value, not a nullable-string special case.

World text baselines are leaf-field baselines. Do not send an entire stale `Project.setting` object or make whole-setting replacement the only write operation. Entity text updates preserve unrelated fields, and both parent/entity timestamps are server-derived bookkeeping. Relation controls currently send whole rendered lists without field baselines (`StoryPage.tsx:415`), while `patchStoryBeat` browser baseline typing is text-only (`episodes.ts:210`). The implementation design must explicitly choose relationship safety: recommend passing relation field baselines (widen the shared typing and browser assertion accordingly) or atomic select/unselect commands, rather than claiming the current controls already prevent lost list edits.

Existing browser delete semantics are a useful product oracle:

| Entity removed | Atomic logical cascade |
| --- | --- |
| Character (`assets.ts:74`) | Remove its ID from all project shot and episode beat character lists. |
| Scene (`assets.ts:149`) | Clear its ID on all project shots and beats. |
| Prop (`assets.ts:220`) | Remove its ID from project shot prop lists. |
| Style (`assets.ts:278`) | Clear the matching project default; explicitly selected matching shots become **none**, not inherit. Existing inherited shots remain inherit and naturally reflect the new default. |

Keep unrelated shot/beat text, other relation IDs/order, and unrelated default/override choices. Native delete cascades, record deletion, timestamps and inverse receipt must commit in one SQLite transaction. No physical file cleanup is part of this text-only task. Entity deletion currently has confirmation but **no browser undo registration** (`AssetLibraryPage.tsx:256`); native deletion receipts/UI undo are a proposed addition requiring explicit scope documentation, not an already existing cross-runtime feature.

### Durable inverse integration and snapshot pitfalls

Current `video_undo` stores **complete before/after State JSON**, not only operation deltas (`workspace.rs:747`). It caps each JSON snapshot at 64 MiB and total receipts at 1,000; strict reopen validates both historical states (`database.rs:332`). The inverse operates per row/per changed top-level field while preserving unrelated current edits (`workspace.rs:136`), excluding `updatedAt` for existing-row patch merges, and consumes its token only on successful commit (`workspace.rs:1304`).

The next schema must extend all of the following coherently:

1. Snapshot state decoding/strict validation, `database::validate_state_closure`, world closure and stored-receipt validation. Old receipts are not compatible; a fresh workspace has new-schema receipts only.
2. `write_video_state` or a renamed shared logical writer (`database.rs:375`). It currently deletes/reinserts only project/video/episode/beat/shot rows. Add world rows to the same transaction and keep assets/refs outside this logical writer. If SQL foreign keys are added, deletion/insertion order must respect them.
3. `VideoUndo` inverse arrays for all new entity rows and world setting rows, in addition to video project default style and shot override/cascade changes. Failing to inverse entity rows while restoring their relation IDs produces an invalid state.
4. Project comparison/touching: `project_contents` (`workspace.rs:52`) currently sees no world rows. Include them or explicitly touch project for all create/patch/delete/undo commands. Refresh affected episode timestamps on beat cascades consistently with shared behavior. Recreated entity rows retain `createdAt`; use a new `updatedAt` for restored/modified rows rather than rolling back bookkeeping time.
5. Full closure before write and again inside transaction, precommit hook/boundary/cancellation checks, atomic receipt insertion/deletion and rollback. A failed inverse must preserve both all current records and its unconsumed receipt.

**Optional entity-delete undo only:** if later approved, it would restore its record and only those relation/default/override fields changed by that deletion, using the committed before/after receipt. Preserve later unrelated text and different relation fields. If a user changed the same relation list/scene/default/style choice after deletion, **reject the entire undo** instead of restoring an old whole row or unioning values silently. If a target ID was reused with different data, reject. If the parent project was deleted, reject; an entity receipt must not resurrect a project or its descendants. This optional proposal is not an acceptance requirement.

**Required existing inverse soundness:** even without entity undo, an old shot/beat/bulk receipt can refer to a world entity deleted later. Inverting it must validate the final current closure and reject atomically when it would restore a now-missing entity reference, preserving unrelated edits and the receipt. Historical snapshot validation must use historical entity rows, while the proposed final state must use current entity rows. Do not silently resurrect deleted entities from full-State snapshots when an earlier video operation never changed those entity rows.

`DeleteProject` currently deletes logical asset/ref/video children but leaves `video_undo` snapshots (`workspace.rs:916`). Add all world children to its atomic deletion. Choose a documented receipt policy: recommended new receipts carry a closed owner `projectId` in persisted metadata/returned token so project deletion invalidates only that project’s receipts atomically. If retaining the current receipt metadata, explicitly validate target ownership at inverse time and test that stale entity/shot receipts cannot recreate deleted rows. Historical snapshots are independently valid historical states, so do not validate their entity references against current live tables during reopen. Also prove a receipt from another surviving project still works after deleting this project.

The existing inverse merger compares entire newly created rows, including their updated timestamp (`workspace.rs:158`), while existing-row merges skip `updatedAt` (`:187`). Extending this helper should preserve conservative changed-created-row rejection and add tests for derived timestamps; do not treat all timestamps as unrelated fields without assessing whether removal of an edited newly created entity is safe.

### Recommended verification plan and exact invocation conventions

No tests or builds were run for this research. The following are **candidate validation targets for the parked per-domain approach**, not a current implementation acceptance plan. Baseline deletion tests do not require introducing entity-delete undo; optional undo-specific tests apply only if that UX is later explicitly approved. Existing video inverse/deletion-race tests remain necessary under any architecture that retains those operations.

**Rust domain/storage:** add a focused `native_world_contract.rs` suite, while retaining `shared_video_contract.rs`, `native_workspace.rs`, `storage_review.rs` and `portable_contract.rs`. Cover fresh-schema identity/table allowlist; default world row; all text/optional-field round trips; duplicate IDs; absent/studio/foreign owners; exact list encoding/duplicates/Unicode boundaries; beat/shot/bulk/default-style validation; style inherit/none/ID serialization and transitions; beat-derived addShots relations; leaf baselines conflict/merge/convergence; all four delete cascades; rollback at precommit and cancellation; entity/episode/project timestamps; distinct receipt tokens, reopen undo, consumed/stale/reused-ID/same-field rejection, unrelated-edit preservation, other-project independence and project-deletion non-resurrection. Strict reopen corruption tests must alter SQLite externally and expect rejection, not repair rows. Extend backup/restore coverage with valid world relations and receipts; backup restore remains existing native behavior, not migration.

**IPC/renderer contract:** strict Zod and Rust closed DTO/action/result parity; reject `slots`, `extra`, SQL/path fields, invalid mode/ID combinations, wrong resource/owner and malformed/conflict result metadata before generation advance. Extend the existing desktop bridge unit tests under the `desktop` feature, not only default-storage tests. `tests/nativeWorkspace.test.ts`, `nativeWorkspaceConcurrency.test.ts`, `nativeWorkspaceDeletion.test.ts` and `videoWorkspaceRepository.test.ts` are the existing owners for request serialization, result validation and runtime deletion behavior.

**Repository/browser/shared consumers:** extend `videoWorkspaceBrowserRepository.test.ts` and draft/relation/cascade tests around actual browser commands; native-mode spies must prove zero Dexie reads/writes for world, entity detail and story/shot relation controls. Shared pages should use the same components with available world/relations capabilities and unavailable slots/generation/Studio/IP. Test stale owner query completions, retained drafts/read failures, missing entity state, relation field CAS, project-default style edit, style delete fallback and repository-returned inverse registration. A mocked JSX/hook host proves adapter consumer wiring, not packaged persistence.

Invocation owner is the repo root, and explicit local pnpm is mandatory:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test -- tests/nativeWorkspace.test.ts tests/nativeWorkspaceConcurrency.test.ts tests/nativeWorkspaceDeletion.test.ts tests/videoWorkspaceRepository.test.ts tests/videoWorkspaceBrowserRepository.test.ts tests/sharedVideoPageParity.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
node desktop/tauri/scripts/tools.mjs cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
node desktop/tauri/scripts/tools.mjs cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --features acceptance,test-hooks
node desktop/tauri/scripts/tools.mjs cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --features acceptance,test-hooks -- -D warnings
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri build:app
```

`tools.mjs` runs in the desktop package and supplies local Cargo/Rustup roots, target directory, Rust **1.99.0** and machine Node/pnpm. Cargo `--manifest-path` above is therefore relative to that package. `native-regression.mjs` adds read-only source-hash receipts/default/test-hooks suites, but it does not substitute for compiling/testing the `desktop`/`acceptance` bridge feature. Normal `build:app` uses root product frontend and `desktop`; `--acceptance` selects the historical fixture and is supplementary evidence.

**Actual packaged macOS smoke:** build the normal product UI/Rust code with a run-specific identifier/name only; use a fresh isolated workspace and embed frontend assets. Through actual UI create a project, edit all three world fields, create/edit four entities, choose default style, create beat/shot relations, exercise inherit/none/selected style, delete an in-use character/scene/prop/style, and confirm unrelated edits survive. Exercise an existing shot/beat inverse with surviving relations and a safe rejection after a referenced entity is deleted. Close/reopen and verify IDs/text/relations/default/override plus a remaining durable video receipt; navigate back to story/shots and unavailable generation/media-slot/Studio surfaces without browser owner access. Add independent read-only SQLite assertions for final rows and absence of foreign/orphan relations; fixtures/IPC mocks are labeled separately. No microphone, paid model/provider, cloud service or imported file is necessary for the parked text/relationship slice.

### Related specs and versions

- `.trellis/spec/frontend/native-workspace.md`: single native owner, closed IPC, fresh schema, exact trusted entry/hash history, managed files and real normal-product packaged acceptance.
- `.trellis/spec/frontend/video-workspace.md`: shared UI, field baselines, committed operation-specific inverses, atomic owner operations and capability gating.
- `.trellis/spec/frontend/workspace-storage.md`: copied managed assets and retained missing references. This task need not touch file lifecycle.
- `.trellis/workflow.md`: planning artifacts precede implementation review/start. This research does not authorize implementation.
- Current pinned dependencies are read from `desktop/tauri/src-tauri/Cargo.toml`: rusqlite 0.40.2, serde 1.0.229, serde_json 1.0.151, Tauri 2.12.2, Tauri dialog 2.8.1; local tools use Rust 1.99.0. No dependency/API upgrade is proposed.
- External references: none required or fetched; all recommendations derive from the current primary project source and local specs.

## Caveats / Not Found

- Entity deletion currently does not expose browser undo. Native undo and cross-runtime presentation must be specified openly rather than described as existing parity.
- Relation list controls currently use snapshots without relation baselines. A new native closed patch alone does not make rapid/stale list editing safe; the shared controls/repository must supply baselines or atomic membership operations.
- Existing full-State inverse storage is bounded but potentially large. This slice can safely extend it with typed fields; converting the entire receipt system to compact deltas is a separate optional refactor, not necessary scope.
- The parent’s old migration wording is superseded by its fresh-development policy and this PRD. No old data readers, repairs, migrations or legacy alias were researched/proposed.
- This research did not establish native Studio/IP adoption, media-version slots, paid generation, audio/music, Agent history or real sync. They remain deferred capabilities.
