# Research: Asset libraries, detail editors, and manual media workflow

- Query: Audit characters, scenes, props, and styles for usable editing, information completeness, reuse, and future AI readiness; distinguish current defects from new product scope.
- Scope: Internal; studio and project asset libraries, asset detail editors, shared generation-slot editor, repository mutations, and relevant tests. Project/story/shot/export auditing is owned by other researchers; only relationship boundaries are noted here.
- Date: 2026-09-18

## Findings

### Executive assessment

The four asset types have genuine local CRUD, editable text, reusable media slots, project ownership, and studio-to-project snapshots. A person can create each type and attach existing image/video files without invoking AI. The foundation is useful, but it is not yet a complete production reference system: props and styles cannot be assigned to their consumers, write reliability needs repair, and several essential controls are unavailable to keyboard users.

Do not equate missing dedicated fields with impossible data entry: current biography/appearance/notes text can hold arbitrary information. Structured continuity fields and relationship selectors are product extensions, while the lost concurrent updates, abandoned uploads, and inaccessible controls are defects in existing behavior.

### Files found

| File | Purpose |
| --- | --- |
| `src/domain/types.ts` | Entity, media, slot, and relationship contracts. |
| `src/db/repo.ts` | Asset creation, patch, slot persistence, deletion, media cleanup, snapshot copying. |
| `src/components/studio/AssetLibraryPages.tsx` | Unified studio library listing for all four kinds; creation, search, sort, delete. |
| `src/components/studio/LibraryHeader.tsx` | Shared name search and modified/created/name sorting controls. |
| `src/components/studio/CoverCard.tsx` | Covers and accessible focus-visible menu behavior that project cards can reuse. |
| `src/components/assets/AssetLibraryPage.tsx` | Project world tabs, project creation, studio snapshot picker, delete. |
| `src/components/assets/CharacterDetailPage.tsx` | Character fields and five slots. |
| `src/components/assets/SceneDetailPage.tsx` | Scene fields and three slots. |
| `src/components/assets/PropDetailPage.tsx` | Prop fields and three slots. |
| `src/components/assets/StyleDetailPage.tsx` | Style fields and three slots. |
| `src/components/assets/WorldSettingPanel.tsx` | Existing reliable draft/status/retry pattern suitable for asset text editors. |
| `src/components/slots/GenerationSlotCard.tsx` | Shared media slot tile, draft dialog, upload and removal controls. |
| `src/components/ui/field.tsx` | Shared field label wrapper; currently lacks input association. |
| `src/lib/media.ts` | Local file picker, immediate persistent upload, object URL lifecycle. |
| `src/components/media/MediaThumb.tsx` | Shared image/video preview renderer. |
| `src/lib/library.ts` | Name-only search and sorting. |
| `src/domain/slot.ts` | Slot normalization, media reference collection/remapping. |
| `tests/repo.test.ts` | Existing snapshot copy/independence/media tests. |
| `tests/projectPackage.test.ts` | Existing props/styles/media/extra round-trip coverage. |

### Editable and persisted inventory

| Entity | Text fields exposed in UI | Media slots | Other persisted fields |
| --- | --- | --- | --- |
| Character | name, bio, appearance, notes | front, side, back, expression, costume | id, owner `projectId`, createdAt, updatedAt, `extra` |
| Scene | name, location, timeOfDay, atmosphere, notes | wide, medium, detail | id, owner, timestamps, `extra` |
| Prop | name, kind, notes | hero, detail, worn | id, owner, timestamps, `extra` |
| VisualStyle | name, notes | look, light, lens | id, owner, timestamps, `extra` |
| Every slot | prompt, reference image IDs, reference video IDs, one selected result | Result can be image or video; uploaded manually | No durable job, candidate history, model, seed, input revision or generation provenance |

Evidence: `src/domain/types.ts:18`, `:230`, `:243`, `:257`, `:269`, `:316`; character fields at `CharacterDetailPage.tsx:77`, scene at `SceneDetailPage.tsx:81`, prop at `PropDetailPage.tsx:81`, style at `StyleDetailPage.tsx:81`. The `extra` object is not editable in these forms; copying preserves it at `src/db/repo.ts:615`.

All input is optional, including blank names after creation. Constructors provide unnamed defaults (`src/db/repo.ts:82`, `:97`, `:113`, `:127`), but the form and patch methods allow replacing these with empty strings. This can leave blank card titles and ambiguous downstream choices; a required display-name or fallback-name policy is recommended, without making detailed creative fields mandatory.

### Existing working patterns to preserve

1. Studio creation uses `STUDIO_LIBRARY_ID` and stays in studio routes (`AssetLibraryPages.tsx:139`). Project creation assigns the real project and goes to project asset detail routes (`AssetLibraryPage.tsx:132`).
2. Project-owned detail routes check owner match; missing IDs correctly resolve to null, rather than permanent loading (`CharacterDetailPage.tsx:21`, `:29`; equivalent other editors).
3. Snapshot copy is one transaction, checks destination and studio source, remaps media to independent owned IDs, records `extra.sourceAssetId`, and rejects duplicate source additions (`src/db/repo.ts:535`). Tests assert all four types, independence, source deletion safety, media deduplication, and duplicate rejection (`tests/repo.test.ts:116`, `:152`, `:186`).
4. Character/scene delete removes their links from project shots and episode beats and recycles media when no longer referenced (`src/db/repo.ts:679`, `:738`). Prop/style deletion recycles their media (`:793`, `:832`).
5. Asset descriptions can be written entirely by the user. Slot dialogs allow existing images/videos as references or results (`GenerationSlotCard.tsx:164`, `:175`, `:240`). AI is not required for these operations.
6. Asset package support exists for all four types and their media; preserve it when fields/relations evolve. Broader export behavior is covered by the project researcher.

### Confirmed existing defects

#### A1 — P1: Independent overlapping writes overwrite each other

- Trigger: Two updates to distinct fields on the same asset overlap, or two distinct slot updates overlap. This can arise from fast field transitions under slow IndexedDB, another tab, or a future job result arriving while the user edits.
- Evidence: `patchCharacter` reads the entire row then puts a merged full snapshot outside a transaction (`src/db/repo.ts:658`–`:660`); `setCharacterSlot` independently does the same (`:669`–`:674`). Scene (`:719`, `:730`), prop (`:774`, `:785`), and style (`:813`, `:824`) repeat the pattern. Detail input callbacks do not serialize writes (`CharacterDetailPage.tsx:80`, `:86`).
- Reproduction: `research/assets-repo.probe.ts` runs real repo functions with fake-indexeddb. `Promise.all([patchCharacter(name), patchCharacter(bio)])` leaves the new bio and original name. Parallel front/side slot writes leave the new side and lose front. Both characterization assertions passed on 2026-09-18.
- Impact: Previously entered information or a completed uploaded/generated slot can silently disappear. This is especially important before adding asynchronous AI writes.
- Remediation: Atomic field updates or serialized transaction-based read/merge/write for each affected record; transactionally merge nested slots. Keep UI drafts local, serialize saves, and preserve unrelated fields when a generated result arrives. Add desired-contract tests asserting both updates survive.
- Scope caveat: The probe confirms overlapping repository calls, not a measured rate of lost real-world keystrokes. Do not claim every fast typing sequence loses content.

#### A2 — P1: Asset save/upload errors are invisible; slot closes before persistence succeeds

- Trigger: IndexedDB write rejects, storage quota is exceeded, or upload validation throws.
- Evidence: Each text field calls `void patch*` with no catch or status (`CharacterDetailPage.tsx:80`–`:100`, equivalent other detail editors). Slot callback type is `(slot) => void` (`GenerationSlotCard.tsx:160`); the Done button calls `onSave(draft)` and immediately closes (`:269`–`:271`). Upload callbacks also discard promises with no visible error (`:208`, `:222`, `:240`). Parent passes `void setCharacterSlot(...)` at `CharacterDetailPage.tsx:72`.
- Impact: User sees the dialog disappear despite failed saving; text input may revert to the last live row without an actionable explanation. There is no retry affordance or retained slot draft after failure.
- Remediation: Await slot save, retain draft until success, add pending/error/retry controls, and apply the existing `useDebouncedDraft` / `DraftStatus` approach used by `WorldSettingPanel.tsx:60`–`:71` to asset fields. Handle upload and create/delete errors explicitly.

#### A3 — P2: Canceled/replaced draft uploads become unreachable persistent media

- Trigger: Open slot → upload reference/result → cancel; or upload result A, replace it with B, then save B; or remove a newly uploaded reference before saving.
- Evidence: `uploadMediaFile` immediately writes `db.media` through `putMedia` (`src/lib/media.ts:46`–`:62`). The editor only tracks IDs in local `draft` (`GenerationSlotCard.tsx:162`–`:181`). Cancel, outside dismissal, and Done simply close (`:186`, `:264`, `:271`). There is no cleanup of newly created IDs. Repo recycling only considers the previously persisted slot (`src/db/repo.ts:499`–`:506`), so it cannot discover uploads that never belonged to that slot.
- Impact: Canceled large videos continue consuming IndexedDB quota while no UI can locate or remove them. Repeated usage can lead to save failures.
- Remediation: Keep pending uploads transient until successful commit, or maintain a dialog-owned upload set and orphan-check the abandoned IDs on cancel/removal/replacement/failure. Wait for upload settlement before cleanup to cover dismissal during an upload. Never delete pre-existing shared media blindly.

#### A4 — P2: Project asset deletion and reference removal require pointer hover

- Trigger: Keyboard-only navigation to a project asset card or an existing reference thumbnail; touch/mobile usage without hover.
- Evidence: Project delete button is `hidden ... group-hover:flex` (`AssetLibraryPage.tsx:322`); reference remove uses the same pattern (`GenerationSlotCard.tsx:127`). `display:none` removes these buttons from the keyboard sequence, so focus cannot reveal them.
- Impact: Manual cleanup is not fully operable by keyboard. Touch behavior is browser-dependent and undiscoverable.
- Remediation: Keep controls in the focus order; reveal with focus-within and make them visible at touch breakpoints, or use an always-available action menu. Studio `CoverCard.tsx:60` already uses opacity + group-focus-within rather than display:none.

#### A5 — P2: Visible form labels are not associated with controls

- Trigger: Click the label or navigate the field with a screen reader.
- Evidence: `Field` renders sibling `Label` and child with neither `htmlFor` nor ID (`src/components/ui/field.tsx:12`–`:14`); detail form Input/Textarea children supply neither IDs nor aria labels (`CharacterDetailPage.tsx:77`–`:100`, equivalent others). Slot prompt also has unassociated Label/Textarea (`GenerationSlotCard.tsx:194`–`:195`).
- Impact: Clickable labels do not focus the field; several inputs lack programmatically determinable names. Visible layout is not sufficient accessibility.
- Remediation: Generate stable control IDs and connect labels/descriptions/errors; support label association in the shared Field contract and apply it consistently.

#### A6 — P2: Partial multi-copy failure leaves a retry trap

- Trigger: Select two studio assets. First copy succeeds, second fails (source removed elsewhere, duplicate created elsewhere, or storage error), then retry.
- Evidence: Picker iterates `selected` with separate snapshot transactions (`AssetLibraryPage.tsx:369`–`:377`). Catch shows an error but does not remove successful IDs from selected (`:380`–`:383`). Live `available` removes already copied sources (`:359`–`:362`), while `selected` retains them. Retry hits duplicate rejection for the now-hidden first source (`src/db/repo.ts:568`).
- Impact: User cannot retry the remaining selection without closing/reopening and selecting again; UI count includes hidden completed assets. Existing per-asset transactions prevent a broken individual snapshot, but do not make the batch atomic.
- Remediation: Either make an explicitly atomic multi-copy operation or remove completed IDs after each success and show accurate partial-success state. Use a captured validated selection and define cancellation behavior while copying.

### Confirmed workflow and product gaps

#### A7 — High-priority foundation gap: Props and styles have no application relationship

- Evidence: `Project` contains no default style reference (`src/domain/types.ts:215`); `StoryBeat` only has characterIds and sceneId (`:141`); `Shot` only has characterIds, sceneId, beatId (`:282`); Character has no prop/costume assignment (`:230`). A repository-wide search for `propIds`, `styleId`, and `styleIds` found styleId only in route/detail selection, not a consuming domain relation.
- User impact: A user can create a gun or a visual style and copy it to a project, but cannot state which shot uses the gun or which style governs a project/episode/shot. Notes can describe intent but are not traceable references. The studio prop hint explicitly calls these references future work (`AssetLibraryPages.tsx:79`).
- Classification: Missing production capability, not an unexpected regression. This is a direct obstacle to the requested full manual chain and consistent AI context assembly.
- Proposed minimum: Project default style (with explicit override semantics if needed), shot prop references, and meaningful prop ownership/character links only where the product requires them. Resolve deletion, copy/import ID remapping, and export representation in the same change. Avoid introducing a large generic graph before the concrete relationships work.

#### A8 — P2 UX gap: Global library ownership/reuse model is inconsistent in presentation

- Evidence: Studio queries every project-owned and studio-owned asset (`AssetLibraryPages.tsx:110`–`:132`). Cards label the owner (`:203`), but every card opens a studio detail URL (`:159`–`:172`). Studio detail mode accepts any owner and has only generic title/back link (`CharacterDetailPage.tsx:29`, `:45`, `:61`). Global deletion confirms only the name (`AssetLibraryPages.tsx:225`) although deleting a project-owned character/scene also removes beat/shot references. Project picker accepts studio-owned rows only (`AssetLibraryPage.tsx:357`).
- Impact: A project character is visible in the global library and can be edited/deleted there, but cannot be reused into another project using the picker. Detail view no longer identifies which project will be changed. The card owner subtitle provides some warning, so this is not an invisible cross-project data leak.
- Proposed decision: Explicitly distinguish reusable studio masters from a browse-all-assets view, or retain the combined view with owner filters and owner-aware navigation/detail header/destructive impact. Add project→studio promotion/copy only as an explicit new workflow; do not silently convert live project assets into masters.

#### A9 — P2 UX gap: Project world return loses selected asset tab; no project library search

- Evidence: `AssetLibraryPage` initializes tab to `setting` in local state (`:103`); detail back links navigate to bare `/p/$projectId/world` (`CharacterDetailPage.tsx:53`–`:59`, equivalent other pages). Project asset list and studio picker expose no query/sort controls (`AssetLibraryPage.tsx:160` onward / `:387` onward). Studio search is name-only (`src/lib/library.ts:6`–`:8`).
- Impact: After editing a prop, returning lands on world settings rather than props. Large casts and libraries require repeated tab changes and visual scanning.
- Remediation: Persist/deep-link active tab and return context; add name query and clear empty/loading states to project lists and picker. Studio owner/type/tag filters can be deferred until actual library size warrants them.

#### A10 — P2 usability gap: Uploaded video cannot be played or inspected in the slot

- Evidence: Result/reference preview uses `MediaPreview` (`GenerationSlotCard.tsx:122`, `:255`), whose video renderer is `<video ... muted playsInline />` with no controls, autoplay, playback handler or inspection dialog (`src/components/media/MediaThumb.tsx:27`–`:28`). Images are object-cover with no full-size inspection in this path (`:30`).
- Impact: Users can store videos, but cannot verify the uploaded clip through the asset/slot editing flow. This also limits future generated-result selection.
- Remediation: Keep card thumbnails lightweight; provide a separate inspect action with video controls and a fit/full-size image view in the slot dialog. Do not nest interactive video controls in the clickable tile button.

### Data completeness: recommended additions, not an indiscriminate field checklist

| Entity | Present coverage | Most useful optional structured additions | Why it matters |
| --- | --- | --- | --- |
| Character | Identity label, narrative bio, visual appearance, free notes, five images | Role/function, age description, personality/motivation, key relationships, immutable visual traits, costume/prop associations | Separate story identity from visual continuity, make later context assembly explicit. |
| Scene | Name, location, time of day, atmosphere, notes, three images | Interior/exterior, era, layout/landmarks, lighting/weather, continuity constraints | Distinguish a reusable location from shot-specific staging without overloading notes. |
| Prop | Name, broad type, notes, three images | Appearance/material/color/scale, function, owner/associated characters, state/continuity notes | A named prop becomes usable continuity information instead of a gallery item. |
| Style | Name, one notes field, look/light/lens image prompts | Medium/art direction, palette, lighting, texture, lens/composition, forbidden elements | Reusable machine-readable context and legible manual style selection. |

Do not make all fields required. Prefer a small core and optional expandable sections with examples; retain existing notes and legacy imports. No current migration should destructively parse user prose into new fields. A user can currently place all of this in free text, so claims of “cannot enter personality” would be inaccurate; the gap is discoverability, consistency, and structured reuse.

### Templates, views, reuse, and saving inventory

- Views: Studio cover grid with name search and modified/created/name sort; project world uses setting/characters/scenes/props/styles tabs and cover grid. No project asset search, table/detail toggle, filters, tags, readiness indicators or backlink counts found.
- Templates: No entity-field templates or preset form system found. Fixed image slot labels are not templates. Studio snapshots provide reusable actual data.
- Reuse: Studio→project copy exists and is independent, with per-project source deduplication. No project→studio promotion, project→other-project copy, asset duplicate, or independent asset import/export UI found in audited files. Those are optional expansions; they should not be described as broken existing actions.
- Text saving: Immediate per-event repository mutation, live row as input value, no local draft/error status. World settings already use a more resilient draft pattern.
- Slot saving: Explicit Done or Cancel; uploaded blobs are durable before Done; no await/error guard on commit.
- Deletion: AlertDialog confirmation in studio and project list; removes row, links for characters/scenes, and orphan media. No undo or usage count in the audited asset deletion flow. Delete chain is not wrapped in a single transaction (`src/db/repo.ts:679`, `:738`); interruption/failure atomicity should be tested alongside reliability improvements, but no partial-delete runtime fault was injected in this audit.

### AI extension readiness without connecting AI yet

Existing IDs, project ownership, GenerationSlot prompt/references/result, media records, slot write helpers, and snapshots are good extension points. They avoid binding business entities to one provider. However:

1. Fix atomic writes before async outputs compete with human edits (A1).
2. Add explicit prop/style relationships before building automatic context; otherwise the agent must guess which assets matter (A7).
3. Define a provider-neutral generation record or service contract separately from an asset: target entity/slot, source revision, input snapshot, provenance, selected result, and conflict policy. These fields are currently absent; defer actual execution/UI until the foundations are approved.
4. Keep generated candidate history separate from the one selected slot result; manual uploads must continue using the same final assignment path.
5. `parseGenerationSlot` and `remapSlot` currently reconstruct only the defined known keys (`src/domain/slot.ts:11`, `:52`). Adding metadata inside a slot without updating normalization/remapping would drop it across import/copy; prefer explicit versioned contracts over ad hoc unknown properties.

### Recommended sequencing

1. **Reliability and operability:** atomic field/slot writes, retained draft/error feedback, pending upload cleanup, keyboard/touch controls, associated labels, usable media inspection.
2. **Asset continuity:** minimal prop/style consuming relationships, selective optional structured fields, deletion impact/backlinks, round-trip and copy semantics.
3. **Navigation and reuse:** preserve project world tab, searchable picker/list, unambiguous owner context, then optional duplicate/promotion/library filters.
4. **AI boundary contract:** consume this stable context and write version-aware suggestions/results; actual AI generation wiring remains a later deliverable.

### Validation performed and recommended

Actual audit command:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config .trellis/tasks/09-18-production-foundation-audit/research/assets-probe.config.ts
```

Result: 1 probe file, 2 characterization tests passed. These passing tests deliberately assert current data-loss behavior, not quality acceptance. Probe files are named `.probe.ts` and use a dedicated config so the normal test suite does not adopt those inverted expectations.

For implementation, validate concurrent independent fields/slots survive; rejected save keeps draft; canceled/replaced uploads leave no orphan; failed second snapshot can retry the remaining source; keyboard can remove references/delete assets; project back link retains tab; prop/style links survive copy/import and clear safely on deletion. Browser visual and mobile results are owned by the main session and are not claimed here.

## Related specs

- `.trellis/spec/frontend/index.md`: studio ownership, missing detail semantics, media/cascade quality checklist.
- `.trellis/spec/frontend/state-management.md`: snapshot ownership/transactions, durable local draft safety, undo pattern.
- `.trellis/spec/frontend/component-guidelines.md`: shared slot editor, focus controls, Chinese empty/error states, Radix confirmation dialogs.
- `.trellis/spec/frontend/hook-guidelines.md`: null vs loading and live-query patterns.

## External references

None needed. This audit is grounded in repository source and executable repository probes, not external UX rankings. Runtime versions from `package.json`: React 19.1.1 range, Dexie 4.2.0 range, Vitest 5.0.1 range; actual probe reported Vitest 5.0.1.

## Caveats / Not Found

- No production code, specs, task metadata, or git state was modified by this researcher; only this task's research directory was written.
- No live user records were edited. Probe uses isolated fake-indexeddb, with the project's test setup deleting that in-memory database between cases.
- No claim that the interface meets “ultimate UX” is defensible from code alone. Main-session live-browser inspection should cover mobile, Chinese IME behavior under saving, tab return, ownership visibility, and keyboard controls.
- Concurrent overwrite is executable evidence; upload lifecycle, inaccessible controls, retry trap, and missing links are source-confirmed. Slow-storage typing frequency, quota failure UI, and interrupted deletion were not live fault-injected.
- Missing structured creative fields, variants/templates, asset promotion, and candidate history are proposals; field scope and inheritance semantics require product decisions before implementation.
