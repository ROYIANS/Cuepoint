# Next native product slice selection

Date: 2026-10-11. Read-only repository research preceded task creation. This document records recommendation evidence, not implementation approval.

Priority correction: the user did not select the project-only recommendation. They want existing Web logic reused for rapid full desktop parity, with Agent/AI first. This comparison remains historical candidate evidence; the current PRD supersedes its proposed sequence.

## Recommendation

The initial candidate was project-local world settings and character, scene, prop and style records with story/shot relationships before native media slots. Only task creation/planning was approved; this candidate's project-only scope was not selected. The new Agent-first reuse direction supersedes it.

## Current gaps and dependencies

| Candidate | Existing foundation | Missing product chain | Independent scope |
| --- | --- | --- | --- |
| World entities and relationships | Shared story/shot relationship controls and reserved native ID fields | Native world records, entity CRUD, relationship ownership, default style, shared world/detail repository extraction | Text and relationship workflow can exclude media slots, generation/providers, audio and Agent history |
| Managed media slots | Native managed file import, hashes/availability and chunk reads | Product read/preview adapter, persistent shot slots, picker integration, draft/cancel/failure lifecycle and reference protection | Can exclude provider execution, but is a complete file-to-slot chain rather than only enabling existing imports |

## Source evidence

- `src/lib/videoWorkspaceRepository.tsx:223`: the native character/scene/prop/style list queries currently return empty lists.
- `src/components/story/StoryPage.tsx:41`: the shared story page already queries character/scene data through the repository.
- `desktop/tauri/src-tauri/src/database.rs:726` and `:752`: native mutations reject non-empty world relationships because the world model is unavailable.
- `src/components/assets/AssetLibraryPage.tsx:109`, `WorldSettingPanel.tsx:33` and `CharacterDetailPage.tsx:27`: current world/list/detail consumers query Dexie directly and need a shared adapter boundary.
- `src/components/workspace/WorkspaceChrome.tsx:122`: the native route allowlist must open world/detail routes only when their owners are implemented.
- `src/db/assets.ts:74`: deleting a character clears shot and story-beat relationships.
- `src/db/assets.ts:278`: deleting a style clears a matching project default and sets dependent shots to explicitly no style.

## Required style distinction

The browser shot model has three states: `undefined` inherits the project default; `null` explicitly disables style; an ID selects a style (`src/domain/types.ts:335`). `ShotRelationsEditor.tsx:27` already exposes those semantics. The current native nullable `styleId` and repository projection (`videoWorkspaceRepository.tsx:671`) collapse inheritance into no-style, and the native project DTO lacks a default-style ID. A world relationship slice must introduce an explicit native three-state contract and project default without changing the shared UI semantics.

## Media-slot boundary

`NativeAssetLibraryPage.tsx:17` displays managed metadata/missing state, but does not provide the existing media preview/select workflow. `nativeWorkspaceContract.ts:74` has no frame/clip slots; `videoWorkspaceRepository.tsx:683` rejects native slot writes. `src/lib/media.ts:22` and `:49` disable native browser media access/upload, while `MediaPicker.tsx:20` queries Dexie. Existing `GenerationSlotCard.tsx:196` draft cleanup depends on browser orphan-media rules. The Rust `ReadStart`/`ReadChunk`/`ReadClose` actions (`desktop.rs:178`) are a foundation, not completed product slot support.

## Planning decisions

- Confirm whether this child is project-local or includes studio/global reuse before final design and approval.
- Inventory all textual fields, optional/null semantics, drafts, delete cleanup and undo before writing contracts.
- Keep generation/media capability states truthful; do not mount a browser data owner in native mode.
- Use a disposable new SQLite schema and isolated packaged identifier, with no old-data migration.

Research source: the `next_native_slice` read-only explorer. No product edits, service calls or tests were run for this comparison.
