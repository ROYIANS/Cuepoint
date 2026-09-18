# Research: Manual production workflow and future AI write boundaries

- Query: Can a user complete project → episode → story → shots → media → delivery → backup/restore without AI, with reliable data, sensible configuration, and safe future AI integration points?
- Scope: internal; repository and pure/in-memory runtime audit. Root session owns live browser UX; peer owns detailed library forms.
- Date: 2026-09-18

## Findings

### Overall assessment

The manual skeleton exists and is useful: film/series creation, episode story, script-to-beat selection, project-owned asset snapshots, shot creation and bulk editing, media upload, ordering/undo, delivery CSV/print, and project ZIP restore. It does not yet form a dependable end-to-end production foundation. The most immediate risks are lost concurrent updates, filters that hide unrelated episodes or imported shots, and media/delivery state that can claim completion without deliverable media. Assets and shot slots are reasonable initial boundaries, but future AI must not write asynchronous results through the current unconditional whole-record replacement paths.

### Files found

| File | Responsibility |
| --- | --- |
| `src/domain/types.ts` | Project/episode/story/shot/media schemas and settings normalization |
| `src/db/database.ts` | Dexie tables and local schema migrations |
| `src/db/repo.ts` | All entity mutations, copy, deletion, ordering, slot recycling, undo restoration |
| `src/components/studio/ProjectGalleryPage.tsx` | Create/rename/delete projects and project import/export |
| `src/components/workspace/WorkspaceChrome.tsx` | Project navigation, output ratio/cover settings, backup action |
| `src/components/workspace/EpisodeListPage.tsx` | Series story, episode ordering/deletion/undo |
| `src/components/story/StoryPage.tsx` | Script draft, drag-file import, selected-text beats, beat metadata |
| `src/components/shots/ShotEditorPage.tsx` | Shot design/media views, filtering, selection, bulk actions, reorder |
| `src/components/slots/GenerationSlotCard.tsx` | Shared prompt/reference/result editor for shots and assets |
| `src/lib/media.ts` | Upload storage, file picker, local Blob URL read |
| `src/lib/debouncedDraft.ts` | Serialized draft persistence and SPA unmount flush |
| `src/lib/shotFilters.ts` | Shot filter semantics |
| `src/lib/projectPackage.ts` | Full project ZIP backup/import/remapping |
| `src/lib/episodeDelivery.ts` | Delivery completeness, CSV derivation |
| `src/components/produce/ProducePage.tsx` | Completeness checklist, CSV/print actions, shot deep links |
| `src/components/produce/StoryboardPrintPage.tsx` | Printable episode storyboard |

### Confirmed defects and reliability findings

Priority below is an implementation recommendation, not a preexisting project classification. P1 should precede connecting AI writeback; P2 should accompany the manual UX foundation.

**WF-01 — P1: overlapping field edits overwrite each other. Confirmed by runtime probe.**

- `patchShot` reads the whole row and later writes `{ ...shot, ...patch }` without one encompassing transaction (`src/db/repo.ts:1117`). The UI calls it directly on each field change (`src/components/shots/ShotEditorPage.tsx:224`, `:1641`, `:1652`, `:1815`).
- Trigger: two updates for the same shot overlap while setting different fields. Fast interaction, another tab, or future AI/manual concurrent updates can produce this interleaving.
- Probe: `Promise.all([patchShot(id, { content: 'saved text' }), patchShot(id, { notes: 'saved notes' })])` left `{ content: '', notes: 'saved notes' }` in fake-indexeddb.
- Impact: a successful save silently restores older unrelated field values.
- The pattern also exists in `patchCharacter` (`repo.ts:654`), `patchScene` (`:715`), `updateProject` (`:237`), and slot setters (`:664`, `:725`, `:1243`). The concrete runtime probe covered shots; others are source-confirmed pattern matches, not separately executed reproductions.
- Recommended contract: field-level atomic updates or serialized transactions merging latest state; keep media replacement, validation, and orphan cleanup in the same intentional operation. Async AI result application additionally needs a captured revision/target check.

**WF-02 — P1: per-episode beat filters are stored globally on the project. Confirmed by runtime probe.**

- `ShotSettings.filters` belongs to Project (`types.ts:130`, `:224`); shot view reads it and filters every episode (`ShotEditorPage.tsx:269`); changes call `updateShotSettings(projectId, ...)` (`:492`).
- Trigger: select a beat filter in episode 1 and open episode 2. The old beat ID cannot match episode 2's shots. Deleting a selected beat similarly leaves a dead filter.
- Probe: episode 2 had one shot; after episode 1's beat filter was saved, `filterShots` returned zero.
- Impact: existing work appears absent, and the current episode's filter menu has no matching selected beat to explain why. Clear-all is a workaround, not a correct scope.
- Recommended contract: episode-scoped beat filters; explicitly choose whether status/gap filters are shared or per episode. Prune references when beats are deleted and migrate existing preference data.

**WF-03 — P1: ZIP restore leaves stale beat filter IDs. Confirmed by runtime probe.**

- `parseProject` preserves normalized `shotSettings` (`projectPackage.ts:140`). Import generates new beat IDs (`:568`) and remaps shot `beatId` (`:607`), but never remaps filter IDs.
- Trigger: export a project with a beat filter enabled, import it, then open its shot editor.
- Probe: one imported shot had a new beat ID while `restored.shotSettings.filters.beatIds` retained the old one; one stored shot became zero visible shots.
- Impact: backup restoration seems to lose the user's shots although the rows exist.
- Recommended contract: remap all persisted foreign-key-bearing preferences, preserve the `none` sentinel, and drop invalid legacy IDs. Test alongside any filter schema change.

**WF-04 — P1: media drafts write Blobs before commit and leak abandoned uploads. Source-confirmed.**

- Reference and result selection call `uploadMediaFile` immediately (`GenerationSlotCard.tsx:164`, `:175`); that writes `db.media` (`media.ts:46`). Cancel/Escape only closes (`GenerationSlotCard.tsx:186`, `:264`). Replacing/removing a newly uploaded draft media ID only changes React state.
- Trigger: upload a large video into a slot, then cancel; or replace uploaded draft A with B before saving.
- Impact: abandoned media remain indefinitely in browser storage. They are not reachable from UI and are excluded from ZIP because export only walks referenced IDs (`projectPackage.ts:407`). Orphan cleanup only considers the previously committed slot (`repo.ts:499`), so it cannot find these draft-only uploads.
- Recommended contract: stage uploads until commit, or track draft-owned media and reclaim abandoned IDs after safe reference checks. Do not delete reused/shared assets during cleanup.

**WF-05 — P1: the slot dialog closes without awaiting persistence or exposing failure. Source-confirmed.**

- `onSave` is typed `void`; 完成 invokes it and immediately closes (`GenerationSlotCard.tsx:160`, `:269`). Shot caller discards `setShotSlot`'s promise (`ShotEditorPage.tsx:1613`, `:1623`, `:1633`). Upload handlers likewise have no visible catch/error state.
- Trigger: storage quota failure, failed IndexedDB write, or rapid confirmation while upload is still resolving.
- Impact: the UI appears to accept media/prompt edits even if they fail; draft is gone, and uploaded files may remain unattached. There is no pending guard or retry path.
- Recommended contract: async save, disable duplicate commit while pending, preserve draft on error, show actionable failure, handle uploads resolving after close.

**WF-06 — P1: readiness accepts image placeholders or nonexistent media as finished video. Confirmed by runtime probe.**

- Shared upload accepts images/videos for every result (`GenerationSlotCard.tsx:175`); clip intentionally supports an image placeholder (`:85`). Completeness checks only the presence of result IDs (`episodeDelivery.ts:83`); gap filters have the same semantics (`shotFilters.ts:26`). The delivery input has no media records to verify existence/kind.
- Trigger: put a still image in 成片; or import/retain an invalid media reference. Set content/duration/scene so no other check fails.
- Probe: shot first-frame ID and clip ID both absent from storage, with clip kind `image`, yielded `missing: []`.
- Impact: 制作 page says 当前集检查通过 although no video is deliverable; missing-clip filter hides the issue. Scene lookup similarly accepts unknown `sceneId` while displaying an unknown label (`episodeDelivery.ts:86`, `:103`).
- Recommended contract: distinguish planning-ready, visual-ready and delivery-ready; accept placeholders for planning but require existing correct-kind media for video readiness. Handle legitimate storyboard-only workflows as a delivery mode rather than forcing every workflow to have clips.

**WF-07 — P2: delivery “locate shot” fails when that shot is filtered out. Source-confirmed.**

- Produce links correctly include target ID (`ProducePage.tsx:153`). Focus effect checks all stored shots and then searches for a DOM row (`ShotEditorPage.tsx:332`), while only filtered rows mount (`:273`, `:296`). It does not clear/bypass filters; next effect clears an active ID not visible (`:348`).
- Trigger: filter to approved shots, open production, click 定位镜头 on a draft shot with missing information.
- Impact: navigation happens but target is absent; user cannot act on the checklist directly.
- Recommended contract: reveal the target with an explicit temporary filter override or reset relevant filters with feedback, preserving useful user preferences.

**WF-08 — P2: backup can miss the still-dirty editing window. Source-confirmed scheduling gap; live timing not tested here.**

- Story has a 400ms debounced draft (`StoryPage.tsx:78`, `debouncedDraft.ts:17`). Header backup directly exports persisted DB data (`WorkspaceChrome.tsx:283`), without navigating/unmounting or requesting draft flush.
- Trigger: type the last line and immediately click 备份项目 while 保存中 is shown.
- Impact: exported package can omit the last edit, even though it subsequently appears saved on screen. Export also reads tables separately rather than one consistent snapshot (`projectPackage.ts:396`).
- Recommended contract: a workspace-level flush barrier before backup, consistent read snapshot, clear progress/failure UI. Do not claim a browser-close guarantee solely from async visibility handlers.

**WF-09 — P2: concurrent episode deletes can violate “at least one episode.” Confirmed by runtime probe.**

- `deleteEpisode` reads/checks sibling count outside its write transaction (`repo.ts:405`), then deletes inside it (`:416`).
- Trigger: two distinct episodes of a two-episode project are deleted concurrently, e.g. from two tabs or overlapping actions.
- Probe: both promises fulfilled and remaining episode count was zero.
- Impact: series workflow ends without any episode despite explicit protection in UI/repo. Film route has repair logic, but invariant should not depend on route repair.
- Recommended contract: read/check/delete/order normalization in one transaction. Add a concurrent-delete test.

**WF-10 — P2: printable storyboard truncates shot content. Source-confirmed.**

- Printed shot text uses `line-clamp-4` (`StoryboardPrintPage.tsx:117`); cards have `overflow-hidden` (`:97`). It prints only content/scene/beat/status/duration, omitting roles/notes and optional shot columns (`:106`).
- Trigger: write a shot description exceeding four lines, print or save PDF.
- Impact: an apparently complete storyboard loses action details needed by the recipient. CSV retains text but is a separate deliverable.
- Recommended contract: print styles must allow content continuation/full text, and the selected delivery template must clearly specify included fields. Browser print/layout verification is needed after changes.

### Existing gaps and product choices (not mislabeled as defects)

**WG-01 — Beat context is not carried into new shots.**

- Story beat captures cast, scene and time (`StoryPage.tsx:289`); “add shot” passes only beatId (`ShotEditorPage.tsx:1380`); `emptyShot` sets cast empty and no scene (`repo.ts:153`). Runtime probe confirmed empty cast, absent scene, empty content after creating a shot in a fully described beat.
- Current behavior is internally consistent but forces repetitive re-entry. Recommend initial defaults for scene/cast from the owning beat, with explicit override semantics. Do not continuously overwrite customized shots when a beat changes. Decide whether beat content stays context instead of being copied verbatim into every shot.

**WG-02 — Props and visual style are collections without operational bindings.**

- Project, StoryBeat and Shot lack prop/style reference fields (`types.ts:141`, `:215`, `:282`). Roles/scenes have ID references, but props/styles cannot participate structurally in per-shot context or delivery.
- This is the biggest semantic discontinuity for future AI context, shared with the asset-form audit. Add deliberate project default style + per-beat/shot override rules and prop usage references; include reference validation, deletion behavior, copy/import remapping and delivery visibility. Avoid merely adding free-text fields.

**WG-03 — Slot references can only be uploaded, not selected from already authored project assets.**

- `RefStrip` add calls `pickMediaFile` (`GenerationSlotCard.tsx:164`); there is no asset/media picker. A role's front portrait or a shot's first frame cannot be selected directly as another slot's reference.
- Manual workflow requires exporting/reuploading a local file, with duplicate storage and lost source relationship. Provide scoped existing-media selection; future prompt context should resolve asset → selected rendition → media through an explicit contract.

**WG-04 — No result history or provenance.**

- `GenerationSlot` contains a prompt, reference IDs and one current `result`; `MediaRecord` only has owner/MIME/filename/Blob (`types.ts:13`, `:308`). Replacing a result recycles prior media if orphaned (`repo.ts:499`).
- Suitable for simple manual attachments, insufficient for selecting alternatives or auditing/retrying AI generations. Add optional durable provenance and candidate history when defining integration contracts, with explicit accepted result and deletion/retention semantics. Never persist connector secrets in project records/ZIP.

**WG-05 — Current “delivery” is document delivery, not a finished video pipeline.**

- Produce offers CSV and print (`ProducePage.tsx:84`); ZIP is explicitly a project backup in the shared chrome (`WorkspaceChrome.tsx:280`). ZIP media filenames are generated IDs (`projectPackage.ts:424`) without shot-oriented handoff manifest.
- A user can manually author a story and storyboard, attach externally made clips, and back up everything. There is no sequence playback, timeline, transitions/audio mix, concatenated video export, or named per-shot media handoff. These are scope decisions; do not promise full film production completion from the current page label.
- Near-term foundation: a usable media handoff package/manifest with shot order and stable filenames plus full storyboard. A full editor/rendering engine should be a separate product decision.

**WG-06 — Project output and editorial configuration is minimal.**

- Project settings expose three aspect presets and cover (`WorkspaceChrome.tsx:298`); Project has name/mode/aspect/logline/world, but no output frame rate, target duration, synopsis/genre/audience or selected default style (`types.ts:215`). Story uses episode vocabulary even for film (`StoryPage.tsx:153`).
- Some useful generation defaults (aspect/duration) exist. Add only fields with clear downstream consumption; structured FPS/resolution policy matters if video assembly is in scope, while genre/audience can remain optional editorial metadata. Prioritize meaningful links and safe saves over an exhaustive questionnaire.

### Future AI contract readiness

Already useful:

- Owner IDs separate studio from independent project snapshots (`repo.ts:535`); entity/slot routes form clear write targets.
- Prompt + image/video references are common across assets and shots (`types.ts:18`). Media bytes are local, not transient provider URLs.
- Repository mutations and field-draft helpers provide central places for validation. Episode ownership, reorder membership and import transactions already have substantial tests.
- Extra fields and all project-owned media/props/styles survive current roundtrip at entity level. Connector/chat secrets are excluded.

Must define before accepting generated writes:

1. A typed target identifies project + entity kind + entity ID + slot/field; validate target still exists and belongs to the expected owner.
2. Capture source fields/revision and resolved asset context. A late job must not overwrite newer manual edits or write into a deleted/recreated target.
3. Persist media and attach the accepted candidate atomically; keep prompts, parameters/model/provider ID, provenance and job status without API keys. Store provider errors/results in bounded typed records.
4. Resolve props/style/default inheritance deliberately and preserve stable relationship IDs through export/import.
5. AI proposals should use the same validation and mutation contracts as manual edits, with preview/apply/undo for bulk story/shot changes. `extra` alone is not a robust job/revision/relationship protocol.
6. Add provider/job scheduling only in the subsequent AI integration task; the current audit does not call for implementing AI generation UI now.

### Manual workflow coverage matrix

| Stage | Present | Foundation limitation |
| --- | --- | --- |
| Create film/series | Yes; film owns an internal episode, series list supports multiple episodes | Film copy still says episode; minimal project metadata |
| Reuse/create world assets | Yes; independent project snapshots | Props/style not bound to production usage |
| Write/import script | Yes; text editor, .txt/.md drag, save state/retry | No file-picker import alternative; replacement lacks clear review/undo |
| Break story into beats | Yes; selection ranges, cast/scene/time, order/copy/delete/undo | No automatic context defaults for shots |
| Design shots | Yes; fields, cast/scene, statuses, bulk edits, drag/move/undo | Unsafe overlapping row writes; filter scope broken |
| Attach manually produced media | Yes; prompt/reference/result editor | Draft leaks, silent save failures, no existing-media reuse/history |
| Check production | Yes; content/duration/scene/frame/clip checklist | Placeholder/broken-media false positives; filtered deep links fail |
| Hand off | Yes for CSV/print and full backup | Print truncation; no named media delivery or assembled video |
| Restore project | Transactional import/new IDs and preserved snapshots | Beat filter IDs not remapped; incomplete media silently omitted |

### Validation performed

Ran on 2026-09-18:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/repo.test.ts tests/projectPackage.test.ts tests/episodeDelivery.test.ts tests/shotFilters.test.ts tests/debouncedDraft.test.ts tests/reorderIds.test.ts tests/undo.test.ts tests/aspectPreset.test.ts
```

Result: **8 files, 55 tests passed**, ~393ms. Relevant existing tests cover project/episode ownership, snapshot copying, media remapping, reorder validation, bulk scope, duplication/undo, save serialization, package legacy compatibility, status/cover/aspect preservation, delivery CSV quoting and filtering. They do not cover the defects above.

Additional direct runtime probes loaded repository modules with Vite SSR and `fake-indexeddb/auto` in an isolated Node process. They created only in-memory fixtures, did not connect to browser IndexedDB, and deleted the in-memory DB afterward. Observed:

```text
ZIP_FILTER: imported 1 shot; filter kept old beat ID; visible 0
CROSS_EPISODE_FILTER: episode 2 total 1; visible 0
BEAT_CONTEXT: characterIds []; sceneId absent; content ""
FALSE_READINESS: missing [] with nonexistent IDs and image-kind clip
PARALLEL_PATCH: content ""; notes "saved notes"
LAST_EPISODE: both deletes fulfilled; remaining 0
```

These probes did not create product test files or change product code. They establish current behavior, not corrected behavior. Add permanent regression tests only during the corresponding implementation work.

### Related specs

- `.trellis/spec/frontend/index.md` — routing and package-wide quality gates.
- `.trellis/spec/frontend/state-management.md` — owner isolation, episode scoping, draft integrity, ordering/undo, full ZIP roundtrip.
- `.trellis/spec/frontend/delivery-export.md` — delivery derivation and print/CSV contract; currently documents image-ID checks more weakly than a real media-ready workflow needs.
- `.trellis/spec/frontend/quality-guidelines.md` — focused repo/lib tests and no ad-hoc durable UI writes.

### External references

None needed: this topic audits current local behavior and contracts, not third-party capabilities or current external product recommendations.

## Caveats / Not Found

- Browser screenshots, responsive/touch UX, printing layout and live edit timing belong to the root session's independent UI check. Source-only findings are explicitly marked above.
- “Extreme UX” is not a binary compliance claim; priorities are based on recoverability, successful manual completion, discoverability and prevention of silent data loss.
- No real project/user data was mutated. No provider or paid requests were made. No git operations were performed.
- No UI-level regression harness was found for the manual workflow. Existing relevant tests pass despite these findings.
- Normal manual operations work in many sequential cases; concurrency probes intentionally expose valid overlapping async operations that future AI makes more likely.
