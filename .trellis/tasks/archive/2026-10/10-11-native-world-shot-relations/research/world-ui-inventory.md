# Research: Shared world UI and story/shot relationships

- Query: Which existing world controls can be shared by the native runtime without bringing studio/material/media/AI owners into this slice, and what exact fields, relationships, lifecycle and acceptance behavior must be retained?
- Scope: Internal repository research only; no product changes, tests/builds, live application operations or network calls.
- Date: 2026-10-11
- Active task: `.trellis/tasks/10-11-native-world-shot-relations` (planning; implementation not approved).

**Priority update received from the main session:** the user has redirected planning toward bringing the complete existing Web product to desktop quickly, with **Agent/AI the highest priority**, and questioned why the work feels like rebuilding. The bounded world inventory below is historical research, **not a chosen first slice or approved implementation scope**. No additional world-depth research or global/studio implementation research is required by this report.

The central reuse observation is that the UI and browser business commands already exist. Remaining work is extracting direct Dexie ownership from shared components and supplying native implementations behind shared command/query contracts, not rewriting screens or duplicating all product logic. `WorldSettingPanel`, entity details and `AssetLibraryPage` currently embed Dexie reads and browser mutation imports, while story/shots/settings already call the shared `VideoWorkspaceRepository`; even there, native world readers intentionally return empty unavailable lists and some methods throw unsupported. Agent-first planning should apply this same ownership audit to its existing owners before deciding scope.

## Findings

### 1. Conclusion and approval boundary

Before the priority update, the smallest useful bounded option identified was **project-owned manual world data**: the three world-setting text fields, all authored text fields of character/scene/prop/style records, story-beat cast/scene, shot cast/scene/props/style, project default style, and the already existing duplicate/bulk/delete-shot inverses that interact with those references. That option can use the existing world collection, four detail pages, story page, shot rows, relation dialog and settings panel. A second native page tree is unnecessary. This option is retained as inventory only; it has not been selected after the user redirected priority.

This is a recommendation for final planning review, not implementation approval. The user's current approval covers creating/researching a child for four entity domains and their story/shot relationships; the exact deletion, studio ownership and lifecycle scope still needs the main session's PRD/design review. Existing browser behavior below is evidence, not proof the user has approved every adjacent feature.

No media import is required to make this slice useful. Empty native `slots` are a valid presentation projection only while media slots remain explicitly unavailable. They must not be represented as an accepted media mutation. Existing managed `/assets` file import remains a separate, already implemented capability.

### 2. Files found

| File | Current responsibility |
| --- | --- |
| `src/domain/types.ts:193` | World-setting, project, four entity and shot relationship fields. |
| `src/db/productionRecords.ts:46` | Browser default entity names, generated IDs, blank text, empty slots, timestamps. |
| `src/db/assets.ts:28` | Browser entity create/text patch/slot mutation/delete cleanup. |
| `src/db/productionShared.ts:47` | Same-owner relation validation and production transaction table set. |
| `src/db/projects.ts:71` | Project details/default-style validation and field baselines. |
| `src/db/projects.ts:198` | World-setting field patch with baseline. |
| `src/db/episodes.ts:210` | Beat text and relation mutation. |
| `src/db/shots.ts:65` | Creation-only beat relation seeding; shot relation/checkbox/bulk/duplicate/restore commands. |
| `src/components/assets/AssetLibraryPage.tsx:101` | Project world tabs, owner lists, search, create/detail navigation, confirmed delete, studio-copy picker. |
| `src/components/assets/WorldSettingPanel.tsx:33` | Project world-setting query and three-field autosave draft. |
| `src/components/assets/AssetTextField.tsx:8` | Reusable single-field debounced text draft with retained error/retry/adopt-latest. |
| `src/components/assets/CharacterDetailPage.tsx:13` | Shared project/studio character detail text and editable slots. |
| `src/components/assets/SceneDetailPage.tsx:13` | Shared project/studio scene detail text and editable slots. |
| `src/components/assets/PropDetailPage.tsx:13` | Shared project/studio prop detail text and editable slots. |
| `src/components/assets/StyleDetailPage.tsx:13` | Shared project/studio style detail text and editable slots. |
| `src/lib/assetLibrary.ts:1` | World-tab whitelist and authored-string search. |
| `src/components/story/StoryPage.tsx:33` | Shared story owner/read recovery, cast/scene queries and beat controls. |
| `src/components/shots/ShotEditorPage.tsx:140` | Shared world queries, bulk selection/inverse, relation-session retention and dialog close barriers. |
| `src/components/shots/ShotRow.tsx:370` | Immediate shot cast selection and scene selection. |
| `src/components/shots/ShotRelationsEditor.tsx:12` | Shot prop multiselect and three-state style, failed patch retry/discard. |
| `src/lib/shotRelations.ts:4` | Owner-filtered names and effective inherited/none/explicit style labels. |
| `src/components/workspace/ProjectSettingsPanel.tsx:60` | Project default-style select and separate generation-defaults editor. |
| `src/lib/videoWorkspaceRepository.tsx:158` | Existing runtime-selected shared query/mutation boundary, native invalidation and inverse receipts. |
| `src/domain/videoWorkspace.ts:3` | Existing world/generation/relations/mediaSlots/sync capabilities. |
| `src/components/workspace/WorkspaceChrome.tsx:122` | Native project route allowlist, currently excluding world/detail routes. |
| `src/routes/p.$projectId.world.tsx:6` | Thin world route and validated `tab` search. |
| `src/routes/p.$projectId.assets.*.$*Id.tsx:4` | Four thin project detail routes passing explicit project owner/back route. |
| `src/routes/_studio.tsx:16` | Native studio allowlist still blocking `/characters`, `/scenes`, `/props`, `/styles`. |
| `src/components/studio/AssetLibraryPages.tsx:138` | Browser standalone studio entity collections, with stronger create/delete pending handling. |
| `src/components/studio/MaterialLibraryPage.tsx:27` | Runtime branch to existing native managed file library; browser immutable material versions/IP/global scopes. |
| `src/components/slots/GenerationSlotCard.tsx:494` | Editable slot wrapper; opens browser-oriented editor even when no media result exists. |
| `src/components/media/MediaPicker.tsx:20` | Browser media query, currently without a native runtime guard. |
| `src/lib/media.ts:20` | Native-safe preview query (returns null); native upload explicitly rejected. |
| `src/lib/draftConflict.ts:16` | Text field baseline convergence and conflict behavior. |

### 3. Exact authored fields and creation defaults

Each entity has common `id`, owner `projectId`, `createdAt`, `updatedAt`, optional `extra`, and `slots`. Browser create uses names below, blank required text, empty `slots: {}`, optional authored fields absent; IDs/timestamps originate in the repository, not the UI (`productionRecords.ts:46`, `:61`, `:77`, `:91`). Names can subsequently be empty: entity patch commands do not trim/reject blank names (`assets.ts:47`, `:124`, `:195`, `:253`). Do not accidentally copy project-name nonblank validation onto entity names. This would be a product rule change.

| Domain | Default name | Text fields and existing labels | Optional text fields and labels |
| --- | --- | --- | --- |
| World setting | N/A | `worldview` 世界观; `background` 背景; `rules` 规则 | None. Applies to the whole project, not a single episode. |
| Character | 未命名角色 | `name` 名称; `bio` 简介; `appearance` 外观说明; `notes` 备注 | `personality` 性格与行为; `motivation` 动机与目标; `voice` 声音与表达. |
| Scene | 未命名场景 | `name` 名称; `location` 地点; `timeOfDay` 时段; `atmosphere` 氛围; `notes` 备注 | `geography` 空间布局; `lighting` 光线设计. |
| Prop | 未命名道具 | `name` 名称; `kind` 类型; `notes` 备注 | `appearance` 外观特征; `material` 材质; `size` 尺寸与比例; `usage` 使用方式; `continuity` 连续性要求. |
| Visual style | 未命名风格 | `name` 名称; `notes` 备注 | `palette` 色彩方案; `lighting` 光影风格; `lens` 镜头气质; `composition` 构图原则; `negativePrompt` 避免出现. |

Anchors: `types.ts:193`, `:266`, `:282`, `:298`, `:315`; `WorldSettingPanel.tsx:12`; character text controls `CharacterDetailPage.tsx:93`; scene `SceneDetailPage.tsx:105`; prop `PropDetailPage.tsx:105`; style `StyleDetailPage.tsx:105`. Optional creative fields appear in collapsed native HTML `details` sections and render absent values as empty string. Notes/creative fields are textareas; names and scene location/time or prop kind use single-line inputs. A character voice string is authored description, **not** a voice-provider preset or audio capability.

Existing image slot keys are character `front/side/back/expression/costume`, scene `wide/medium/detail`, prop `hero/detail/worn`, style `look/light/lens` (`types.ts:372`). They are not required for text CRUD or relation labels. Keep their browser UI behavior; for the native text slice, show a clear capability notice without mounting editable slot owners.

### 4. Collection, route, search and ordering behavior

- World route has `setting/characters/scenes/props/styles`; optional search `tab` is whitelist-validated, missing/invalid selects setting, tab changes clear local search and replace route search (`assetLibrary.ts:1`, `p.$projectId.world.tsx:6`, `AssetLibraryPage.tsx:184`). Detail back links restore the corresponding world tab (`CharacterDetailPage.tsx:67`; same pattern in the other three pages).
- Each project collection queries only its owner with `.where('projectId').equals(projectId).reverse().sortBy('updatedAt')` (`AssetLibraryPage.tsx:109`). Preserve current most-recently-updated ordering in the adapter; document a deterministic tie-break if native sorting needs one. There is no entity manual reorder/archive UI in this collection.
- Project world search scans authored top-level string properties, excluding `id/projectId/createdAt/updatedAt`; it does not search nested `extra`, slots or provenance (`assetLibrary.ts:11`). Empty/whitespace query shows all; case is normalized with `toLocaleLowerCase`. Search is not a server query and does not mutate data.
- Cards show first available slot result as cover; textual fallback is character appearance, scene location/time, prop kind, style notes (`AssetLibraryPage.tsx:74`). With native empty slots, existing fallback tiles and authored text remain useful.
- Create immediately calls the relevant owner command and navigates to its detail page (`AssetLibraryPage.tsx:141`). Current project create lacks pending/single-flight/error handling; a native adapter extraction must not leave asynchronous failures unhandled or navigate after owner/tab changes. The standalone studio owner already provides a useful pattern: ref-based single-flight, disabled buttons, active-session check and error toast (`AssetLibraryPages.tsx:138`, `:167`).
- Four project detail routes are thin wrappers passing `back: {kind:'project',projectId}`. The corresponding studio routes pass studio owner. Detail components key by `[ownerId,entityId]`, tag query results with both identities, return missing for null or wrong owner (`CharacterDetailPage.tsx:13`, `:27`, `:41`; scene `:13`, `:27`, `:42`; same prop/style pattern). Adapter queries must preserve loading vs missing and not expose a foreign row under a newly changed route.
- Native `WorkspaceChrome` currently only allows project home, episode home and shots (`WorkspaceChrome.tsx:122`, `:342`). Add only the exact world and four entity detail paths after their adapters/capabilities are ready. Do not open all `/p/:projectId/assets/*` or unrelated production routes by substring.

### 5. Story and shot relationship semantics

| Owner | Relationships | Existing user interaction | Semantics |
| --- | --- | --- | --- |
| Story beat | `characterIds: Id[]`, optional `sceneId` | Cast checkboxes and scene select, immediate save | Project-owned choices; beat has no props/style. |
| Shot | `characterIds: Id[]`, optional `sceneId` | Cast dropdown and scene select in row, immediate save | Same project; character checkbox updates one membership against latest committed row. |
| Shot | optional `propIds: Id[]`, optional `styleId: Id|null` | Shared relation dialog, immediate save, retry/discard on failure | Props multiselect; style has three distinct states. |
| Project | optional `defaultStyleId` | Settings “项目风格”, immediate save with baseline | Same-project style only. No selected style clears default. |
| Bulk selected shots | `characterIds`, `sceneId`, plus beat/duration/status/notes | Existing selected-shot toolbar | Cast is **replace entire array**, not additive; existing inverse restores affected fields only. |

Anchors: story `StoryPage.tsx:405`; row `ShotRow.tsx:370`, `:468`; dialog `ShotRelationsEditor.tsx:26`; settings `ProjectSettingsPanel.tsx:69`; bulk `ShotEditorPage.tsx:457`, `:470`, `:824`. UI does not currently offer bulk prop/style controls, though the existing repository bulk patch accepts those fields (`shots.ts:178`). Do not infer a request for new controls.

Important existing rules:

1. `shot.styleId === undefined` means inherit current `project.defaultStyleId`; `null` means explicitly use no style; a string means explicitly use that project style (`types.ts:335`, `shotRelations.ts:11`). Project default changes affect only inherited shots. Never use `||` to collapse these states. A JSON/native wire must preserve the distinction between omission/inherit and null/none, potentially through an explicit mode/clear contract agreed in design.
2. Same-owner validation occurs inside transactions for cast, scenes, props, style (`productionShared.ts:47`). Project default is validated in `projects.ts:90`. Validation also applies on duplicate/restore/bulk paths, not just picker selection. Lists are owner-scoped; stale selections still require commit-time validation.
3. New shots created under a beat copy its cast/scene (`shots.ts:79`, `:108`). Subsequent beat edits or moving a shot to another beat do not overwrite authored shot cast/scene. Copying a shot preserves existing explicit/null/inherited style and props; restoring must validate surviving referenced entities (`shots.ts:308`, `:337`; `assetFoundation.test.ts:45`, `:63`).
4. `setShotCharacterSelected` is an intention command: read latest array, add/remove one ID, preserve other memberships, validate, commit (`shots.ts:154`). Current native adapter throws unsupported (`videoWorkspaceRepository.tsx:676`). Implementing it by constructing a new array from render state is a regression.
5. Story cast checkboxes and prop checkboxes currently construct a whole array from render props (`StoryPage.tsx:416`; `ShotRelationsEditor.tsx:81`). They are not equivalent to the existing shot membership command. Native serialization alone does not stop a stale render from dropping a rapid earlier selection. Planning should choose owner-serialized latest-membership commands, or captured per-field baselines with explicit conflict/retry. Do not claim current instant relation controls already satisfy CAS.
6. Shot filter dimensions are status, beat and media gaps, not character/scene/prop/style (`types.ts:90`, `ShotEditorPage.tsx:198`). Keep existing selection/filter ownership and bulk “all visible” behavior; adding relationship filters is a separate feature.
7. Relation name resolution filters props/styles by owner and labels missing references (`shotRelations.ts:10`). Prop/style selector arrays currently come from owner-scoped queries; preserve that at the new boundary. Readiness/delivery pure helpers already know these fields, but native production/storyboard routes remain separately gated. Do not open delivery merely because labels can resolve.

### 6. Text drafts, conflicts, deletion and undo

**Text drafts:** `AssetTextField` is already persistence-agnostic: its only owner callback is `persist(value, baseline)` (`AssetTextField.tsx:8`). It scopes retention by project and stable entity-field key, exposes saving/error/retry/adopt-latest, and relies on existing `useDebouncedDraft` for serial writes/unmount flush/failed keyed draft retention. Four detail pages pass exactly one field patch and baseline, so unrelated slot/live edits do not replace text. The world editor uses one flat three-field draft and `changedDraftFields` (`WorldSettingPanel.tsx:62`). Native owner adapters can reuse these controls; do not recreate their state machine.

Browser asset/world CAS occurs inside write transactions (`assets.ts:48`, `:125`, `:196`, `:254`; `projects.ts:207`). Absent optional text and empty editor baseline agree; if current already equals requested it can converge; a third same-field value rejects the whole patch (`draftConflict.ts:16`). Required new UI read-error recovery must retain an existing draft, not unmount it behind a fresh loading/missing state.

Four detail pages retain last row only while a media slot editor is open (`CharacterDetailPage.tsx:33`). Text drafts survive via keyed draft store, but this is not the same as presenting a retained text editor when a record disappears. The task should explicitly handle native read errors and deleted/missing owner without reusing the slot-only retention flag as a generic editing rule. The accepted shared story/shot pages provide `useVideoWorkspaceReadStatus`, owner-tagged reads and retained manual-session patterns (`StoryPage.tsx:33`, `ShotEditorPage.tsx:140`).

**Immediate relation lifecycle:** Prop/style dialog tracks in-flight via ref; saves frozen retry patch, prevents close/switch while pending/error, and retains the affected shot if it disappears (`ShotRelationsEditor.tsx:24`, `:31`; `ShotEditorPage.tsx:172`, `:1044`). It currently calls `repository.patchShot(id,patch)` **without a baseline** (`ShotRelationsEditor.tsx:39`), as do immediate beat and scene controls. Native `patchShot/patchStoryBeat` only map a provided baseline (`videoWorkspaceRepository.tsx:555`, `:666`); no implicit CAS is added by those calls. Project default style does provide its field baseline (`ProjectSettingsPanel.tsx:72`). Retry/discard must keep the original attempted intent/field baseline rather than silently overwrite newer relations.

**Confirmed entity deletion:** Project world confirm states “已有引用会被清除” (`AssetLibraryPage.tsx:246`). Browser entity deletion is one `PRODUCTION_TABLES` transaction and cleans references across the entire owner project:

| Deleted entity | Browser cleanup |
| --- | --- |
| Character | Remove ID from every project shot's cast and every episode beat cast (`assets.ts:74`). |
| Scene | Clear matching scene on every project shot and every episode beat (`assets.ts:149`). |
| Prop | Remove ID from every project shot's `propIds` (`assets.ts:220`). |
| Style | Clear matching project default; convert matching explicit shot style to **null** to avoid accidental inheritance (`assets.ts:278`). Inherited shots continue inheriting the possibly cleared/new project default. |

These commands then touch project, touch affected episodes for character/scene, and recycle only truly orphaned slot media. Browser shots have no updatedAt field. Native timestamp design should follow the existing native project/episode mutation convention rather than fabricate a browser shot field. Deleting an already missing entity currently returns success/no-op. There is **no existing entity deletion undo**, duplicate entity button, or entity archive in project world. This research does not propose adding a new entity Undo UX.

The project-world confirm is currently fire-and-forget, has no pending/error state, and auto-closes (`AssetLibraryPage.tsx:252`). Preserve the chosen deletion meaning, but adopt an awaited ref-guarded handler with visible failure and disabled close while pending, following the already present studio delete pattern (`AssetLibraryPages.tsx:201`, `:271`). Otherwise native ownership/validation errors vanish from the only destructive action.

Existing story/shot deletion, duplicate, reorder and bulk commands already use short-lived Undo UI; native inverses come from committed SQLite receipts (`videoWorkspaceRepository.tsx:808`; `shotEditorCommands.ts:7`; `StoryPage.tsx:221`). Adding entities means their inverses must reject safely if a referenced entity was deleted since the forward operation. Preserve unrelated edits. Those current shot/beat receipts are necessary reference-safety work; they do **not** imply adding entity-deletion Undo.

### 7. Dependencies that must stay outside the first slice

- **Studio entity ownership:** Browser uses `STUDIO_LIBRARY_ID` rather than a project row; `assertProjectOwner` permits it and `touchProject` no-ops (`productionShared.ts:27`). Native project-only world commands should reject studio owner, not create a fake project. Existing standalone `/characters|scenes|props|styles` routes remain behind studio capability state (`_studio.tsx:16`).
- **Studio copy picker:** `AssetLibraryPage` currently mounts `StudioAssetPicker` on every non-setting tab even when `open=false` (`AssetLibraryPage.tsx:226`). The picker immediately issues `db.<entity>` live query (`:360`), excludes previously copied source IDs via `extra.sourceAssetId`, and invokes independent snapshot copy commands with owned media cloning (`:383`). Native page must conditionally avoid mounting the browser picker at all and disable/show unavailable “从工作室添加”. Hiding only the open Dialog contents is insufficient.
- **Versioned material/IP/global library:** `libraryMaterials/materialVersions/materialUses` snapshots and IP/global scopes are a different owner from world entities; browser `/assets` settings links are not proof native studio settings are supported (`MaterialLibraryPage.tsx:27`, `:46`, `:78`; `ip-material-library.md`). No adoption, promote, refresh version, release-use or IP binding is necessary for native project relationships. Keep existing native managed file `/assets` reachable and unchanged.
- **Editable media slots:** `EditableGenerationSlot` has no disabled open trigger; `unavailable` only reaches the mounted editor (`GenerationSlotCard.tsx:529`). Native `useMedia` already avoids Dexie and upload rejects native (`media.ts:22`, `:49`); however opening the editor can reach `MediaPicker`'s unguarded Dexie query (`MediaPicker.tsx:20`) and browser cleanup/save callbacks. For the proposed text slice, do not mount editable slot controls or their editor. Render a shared capability notice/disabled presentation; keep browser slot behavior unchanged. “GenerationSlot” here is primarily manual media/prompt/reference editing, not itself a paid supplier request.
- **Paid generation/output:** Project style does not require project generationDefaults. `ProjectSettingsPanel` separately gates generation configuration (`:140`), and `patchProjectDetails` native currently rejects defaultStyleId/generationDefaults together with unknown unsupported fields (`videoWorkspaceRepository.tsx:353`). Add only reviewed default-style support; retain generation rejection and no provider calls.
- **Audio/music/Agent/sync:** No relevant owner is required by manual world fields. Character voice notes are ordinary text. Existing world/relations capability should become available only after all approved commands exist; mediaSlots/generation/sync remain unavailable. If studio copying needs distinct capability granularity, name that explicitly rather than treating world availability as permission to copy studio data.

### 8. Proposed shared extraction and affected files

Recommended approach: extend the already accepted `VideoWorkspaceRepository` rather than add a second native UI or migrate old data. World is project-wide and consumed by both story and shots, so one repository/query invalidation boundary remains coherent. The main session may choose a typed world sub-repository delegated by this owner to avoid excessive file growth; consumers should still have one runtime owner.

1. Add typed project-scoped four-kind entity list/detail/create/text-patch/delete methods and world-setting patch to the repository. Existing `characters/scenes/props/styles` readers should return actual native project rows. Browser branches call existing `src/db/assets.ts` / `src/db/projects.ts` owner commands; preserve their transaction/media behavior. Native branches call closed native DTO commands and never run the Dexie callback.
2. Map native project world setting/default style into shared Project projection (`videoWorkspaceRepository.tsx:88` currently starts from `emptyProject`, leaving setting empty and default style absent). Add reviewed `defaultStyleId` handling to project patch mapping; protect shot style tri-state on wire. Only update `world`/`relations` capabilities after implementing all relation paths, including native `setShotCharacterSelected`.
3. Convert query/mutation ownership in `AssetLibraryPage`, `WorldSettingPanel`, and the four detail pages to runtime-aware repository hooks. Keep `AssetTextField`, route wrappers, layout, labels, return-tab links and `details` creative fields. Add owner-tagging/read-error/retry handling and native media/studio capability branches. Strengthen project collection create/delete pending/session/error behavior using the existing studio pattern.
4. Preserve existing `StoryPage`, `ShotRow`, `ShotRelationsEditor`, `ProjectSettingsPanel` UI and explicit semantics. Add current-owner intention/baseline plumbing where required by native conflict/race acceptance; do not just switch the relations capability flag. Include bulk scene/cast disabled/error rules when lists are unavailable/loading.
5. Open exact world/detail routes in `WorkspaceChrome`. Keep `_studio` entity routes and unrelated production/backup/sync unavailable. No route generator format churn or top-level redesign is necessary.

Potential focused files: `src/lib/videoWorkspaceRepository.tsx`, `src/domain/videoWorkspace.ts`, `src/lib/nativeWorkspace.ts`, native contract DTO validator, `AssetLibraryPage.tsx`, `WorldSettingPanel.tsx`, four detail pages, `WorkspaceChrome.tsx`, `StoryPage.tsx`, `ShotRow.tsx`, `ShotRelationsEditor.tsx`, `ProjectSettingsPanel.tsx`. Keep backend storage/schema/API details in the separately owned native-storage research; this report does not prescribe its exact tables.

### 9. Meaningful test and packaged acceptance inventory

Existing regressions to preserve (do not rewrite assertions to merely match the new implementation):

| Test | Why relevant |
| --- | --- |
| `tests/assetFoundation.test.ts:25` | Default-style owner validation, beat creation-only seeding, duplicate/restore owner rejection, prop/style delete cleanup. |
| `tests/assetLibrary.test.ts:4` | Authored search and route-tab whitelist. |
| `tests/draftConcurrency.test.ts:98` | World and optional entity field conflict/rebase behavior. |
| `tests/repoReliability.test.ts:16`, `:50` | Independent project/world/asset fields and slots survive concurrent writes; deleted target cannot save. |
| `tests/manualDraftWiring.test.ts:192`, `:252` | Actual four detail text/slot baselines and settings text/default style callback wiring. |
| `tests/manualDraftBaseline.test.ts:95` | Asset text and project-default CAS/convergence. |
| `tests/shotBulkUndo.test.ts:58`, `:95`, `:240` | All eight affected fields, same-field later edits, relationship validity on inverse. |
| `tests/episodeDelivery.test.ts:86` | Inherited/none/explicit style and prop names resolved without foreign owners. Pure helper regression only; not native delivery acceptance. |
| `tests/videoWorkspaceRepository.test.ts:212`, `:331` | Native no-browser boundary, unsupported read contract must change only for newly supported world/relations. |
| `tests/videoWorkspaceBrowserRepository.test.ts:9` | Shared repository keeps existing browser owner semantics. |
| `tests/b01QueryIdentity.test.ts` | Actual detail query identity prevents stale foreign-owner rows. |

Focused new coverage proposed:

- Native list/detail DTO rejects malformed/wrong owner fields before accepted generation; exact text fields including optional empty/absent normalization, `slots` unsupported mutation rejection, proper missing vs loading/error.
- All four real detail consumers send one-field patch plus frozen baseline to the chosen repository; native branch cannot query `db`, mount StudioAssetPicker/MediaPicker, invoke browser create/delete/slot commands or generation providers.
- World flat draft preserves independent changed fields, holds dirty/error/retry/adopt-latest across invalidation/unmount/read failure; same-field stale edit rejects atomically.
- Two rapid cast/prop membership intents preserve both choices; deselect deleted reference is safe; same-field scene/style conflicts retain attempted patch; dialog stays open/shot-switch disabled until retry or explicit discard.
- Project default and shot inherited/null/explicit style survive serialization/reopen; changing default does not rewrite explicit/no-style shots; deleting style clears default and maps explicit matches to null.
- Cross-project/deleted cast/scene/prop/style rejected at beat/shot/default-style/create-under-beat/duplicate/bulk/undo boundaries; any invalid selected target causes whole-operation rollback.
- Deletion cleanup across two episodes plus shots is atomic; storage failure keeps entity/references; confirmed delete is single-flight, pending controls disabled, error visible and retryable. Existing entity deletion has no undo unless reviewed scope adds it.
- Creation navigation freezes original project/tab and ignores stale completion; wrong-owner detail never shows last row from previous route. Text save after deletion cannot resurrect it.
- Existing native bulk/duplicate/deletion inverses preserve independent text but reject inverse after a referenced entity has been removed. Existing receipts remain authoritative.
- Actual normal packaged macOS app in isolated **fresh** workspace: create/edit all four entities and world fields, return to correct tab/search, set project default, assign beat/shot relations, add shot under beat, show explicit/no-style choices, delete each referenced entity, inspect cleanup, close/reopen and verify restored accepted state. Keep browser/fixture evidence separately labeled. No paid call, microphone or file import is needed for this slice.
- Shared presentation evidence at desktop and short-window widths: text controls reachable; capability notice replaces media editing; Tabs selected surface/focus unchanged; delete safe Cancel focus and focus return. Avoid broad UI restyling.

### 10. Product choices still unresolved by code evidence

| Choice | Evidence and recommendation for main-session review |
| --- | --- |
| Project-only vs studio/global ownership | Project-only is useful and bounded; recommend defer studio creation/copy/material versions. The user approved exploration of ownership, not all owners. |
| Entity deletion | Existing browser world uses confirmation + permanent deletion/ref cleanup, no Undo. Retain that semantics; safe pending/error handling is implementation robustness, not a new Undo feature. |
| Blank entity names | Browser permits blank names after create and selector fallbacks vary. Recommend retain current semantics for parity; changing to required/trimmed names should be a deliberate shared product decision. |
| Relationship conflict/membership contract | Evidence exposes stale whole-array writes and no baseline on some immediate controls. Recommend explicit latest-membership commands for checkboxes and captured field CAS/retry for scalar/whole replacement; document browser regression scope and no silent overwrite. This is a design safety choice, not a request for collaborative realtime editing. |
| World setting in this child | World UI has a “设定” tab already, three fields independent of all deferred domains. Recommend include it alongside entities so native world page is fully useful; PRD R3 should make this concrete. |
| Entity delete while text draft exists | Existing slot-only retained record behavior is insufficient to decide deleted text presentation. Recommend reject write/no resurrection, keep failed keyed text available in the running session with explicit discard/copy guidance; do not promise durable drafts across forced app termination without separate design. |
| Stable list tie order and duplicate reference IDs | Browser query/validation does not specify tie-break or enforce array uniqueness. Native design should state deterministic ordering and normalization/rejection, while avoiding a silent change to authored array order. This is normally a technical design decision; user input only if intended behavior changes. |

### 11. Related specs and local versions

- `.trellis/spec/frontend/index.md`: shared runtime/UI owners, loading vs missing, studio route rules.
- `.trellis/spec/frontend/state-management.md:309`, `:495`: keyed drafts, unmount flush, edited-field baselines, explicit adopt-latest; `:400`, `:533`: short-lived Undo and atomic affected-field inverse.
- `.trellis/spec/frontend/video-workspace.md`: one shared product page tree, native no-Dexie fallback, committed receipt inverses, capability boundaries, normal packaged acceptance.
- `.trellis/spec/frontend/asset-output-foundation.md:25`, `:82`: same-owner references, style tri-state, delete cleanup, creation-only beat seeding, generic media-field rejection.
- `.trellis/spec/frontend/ip-material-library.md`: separate immutable snapshots, version adoption, IP/global/project scopes and retention; deferred here.
- `.trellis/spec/frontend/desktop-ui.md`: shared Tabs, layout/scroll owner, pending/error controls, safe confirm/focus return, print remains unchanged.
- Local manifest declarations inspected: React `^19.1.1`, TanStack Router `^1.131.50`, Dexie/dexie-react-hooks `^4.2.0`, Vitest `^5.0.1` (`package.json:38`, `:43`, `:50`, `:74`); Tauri JS API `2.12.2`, CLI `2.12.1`, Rust Tauri `=2.12.2` (`desktop/tauri/package.json:8`, `:11`; `Cargo.toml:33`). These are manifest declarations, not a new dependency recommendation or claim about latest releases.
- External references: none consulted; dispatch restricted this topic to local code and no network. No library upgrade is required by this UI inventory.

## Caveats / Not Found

- No product implementation, test/build or live browser/native action occurred during this research. Current behavior is based on source and existing test assertions, not newly executed verification.
- Research does not decide SQLite schema, full workspace checkpoint codecs, native safe-error taxonomy or durable reference inverses; those belong to native-storage research and the reviewed design.
- No entity-delete Undo, entity manual reorder/archive, beat prop/style field, relationship-specific shot filter or bulk prop/style UI was found in the inspected manual workflow. Do not create these by inference.
- Browser historical parsers/imports remain existing behavior; fresh-native policy does not authorize removing them, nor require porting their compatibility logic to native.
- “World/relations available” alone is insufficient proof of studio-copy/media/generation support. Prevent deferred browser owners from mounting even behind closed dialogs.
