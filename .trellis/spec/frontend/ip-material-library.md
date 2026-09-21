# IP profiles and versioned material library

## 1. Scope / Trigger

Multiple long-lived IP identities organize video/image/copy/podcast/music projects. IP is not a project type. Independent projects are supported. Derivative image/emoji/merch creation belongs to future image templates; no separate commerce menu. Current non-video editors remain upcoming. The current increment persists profiles/materials; it does not inject IP facts into agent requests automatically.

## 2. Signatures

- Dexie v22 adds `ipProfiles`, `projectIpLinks`, `libraryMaterials`, `materialVersions`, `materialUses`, `materialEvents`; domain types in `src/domain/materials.ts`.
- `createIpProfile(input)`, `updateIpProfile(id, patch, expectedRevision)`, `setIpArchived(id, archived)`, `bindProjectIp(projectId, ipId|null)` in `src/db/ipProfiles.ts`.
- `createProject(name, mode, aspectPreset, ipId?)` validates optional binding atomically.
- `createFileMaterial(file, scope)`, `promoteLegacyMaterial(kind, entityId, scope)`, `promoteMaterial(id, scope)` create independent snapshots.
- `addFileMaterialVersion(id, file, expectedRevision)`, `refreshSettingMaterial(id, expectedRevision)`, `updateMaterialMetadata(id, patch, expectedRevision)` preserve prior payloads.
- `useMaterialInProject(id, projectId)`, `updateMaterialUse(useId)`, `setMaterialArchived(id, archived)`, `deleteMaterial(id)` in `src/db/materials.ts`.
- `releaseMaterialUse(useId)` in `src/db/repo.ts` shares production reference locks.

## 3. Contracts

- One scope: `{kind:'global'}` or `{kind:'ip'|'project',id}`. Ownership and project use are separate.
- Global sources may be adopted by any active project; IP sources only by projects linked to that IP; project sources only by their owner. Checks occur inside transactions, including idempotent returns.
- Media/document view: image/video/audio/document. Creative setting view: character/scene/prop/style. Default excludes project-only content. Legacy sources remain accessible by selected owner; never default-query every project Blob.
- Versions store immutable file Blob or typed setting entity plus media snapshot. Adoption clones into project-owned IDs and remaps slots. `MaterialUse` pins revision/target/media IDs. Explicit update is labeled “加入新版副本”: it does not repoint existing slots. Prior uses remain history. Edited settings reject update by fingerprint; separate adoption preserves local work.
- Metadata edits, explicit archive and restore also advance revision with a corresponding payload version to protect stale drafts.
- `libraryRetained:true` media and all use media IDs participate in `collectMediaIds`; every caller transaction must include `materialUses` plus existing production tables. Release removes unused copies atomically; referenced copies remain untouched on failure.
- Project archive hides project-owned materials. Project deletion removes bindings/uses and archives owned library snapshots; promoted shared snapshots survive. IP archive preserves projects.
- Project ZIP contains adopted media/settings and retained loose files; imports generate independent project data and never bind to workspace IP/library IDs. ZIP is not a backup of all IP profiles or library snapshots. Owned-but-unadopted library snapshots are not exported. UI states this limit.
- Shared UI primitives are required: existing Select/Tabs/Button/Input/Textarea/Dialog/Sheet/AlertDialog/Checkbox. No new native selects. Hidden file inputs are activated through shared Button. Current media preview follows existing browser media playback convention.
- IP and metadata forms preserve failed drafts; explicit save uses captured revision; closing or SPA navigation with dirty draft asks retain/discard. Saved repository updates never overwrite in-progress form values.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing/archived owner or destination | Reject new save/adoption; no partial rows |
| IP/project source used outside scope | Reject inside transaction |
| Concurrent revision or archived/restored stale form | Reject save, keep draft |
| Empty/unsupported/over 512 MB file | Actionable error; no stored partial material |
| SVG/HTML/active content | No embedded preview; reject import |
| Setting missing media or cross-owner slot | Reject snapshot/adoption atomically |
| Project target edited since adoption | Reject explicit update; explain separate adoption |
| Hard delete active or referenced material | Require archive; reject uses/derived source references |
| Release still used by cover/slot/reference/job/proposal/batch | Roll back use removal, retention flag and deletions |
| Original project removed | Shared snapshots survive; project-owned archived snapshots can be inspected/downloaded but not restored to missing owner |

## 5. Good / Base / Bad Cases

- Base: create independent video project, use global audio; ZIP round-trip retains loose audio.
- Good: create IP, bind project, import IP reference, adopt v1; publish v2 explicitly, v1 in project stays unchanged.
- Bad: deleting original character destroys shared reference Blob; forbidden because versions own snapshots.

## 6. Tests Required

`tests/materialLibrary.test.ts`: IP CAS and archive race; scope checks; missing target idempotence; immutable versions; fingerprint guards; source deletion; transactional rollback; guarded deletion.
`tests/materialIntegration.test.ts`: atomic optional project binding; release failure restores use/media; orphan retention; ZIP double round-trip; project archive/delete preserves shared snapshots.
Browser evidence in task `09-21-ip-material-library/evidence`: real import/version/adoption/explicit update/dirty form/archive/release, IP persistence/CAS/back navigation, desktop and 390px with shared controls. No paid generation requests.

## 7. Wrong vs Correct

Wrong: update the shared material Blob under a reused media ID and refresh every project's slots.
Correct: append an immutable version; explicit adoption creates new project-owned IDs and records the selected revision. Old slot IDs stay valid until the user explicitly changes them in their editor.

Wrong: keep adopted media alive only in React state.
Correct: persist material use and retention metadata; include them in garbage collection and project ZIP tests.
