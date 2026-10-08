# Asset relationships and model-aware output defaults

## 1. Scope / Trigger
Use for project metadata, optional asset creative fields, props/style references, media reuse, generation defaults, and package compatibility. These are manual data foundations; choosing defaults does not submit a generation task.

## 2. Signatures
```ts
patchProjectDetails(id: Id, patch: Partial<Pick<Project,
  'name' | 'brief' | 'genre' | 'audience' | 'tone' | 'aspectPreset' |
  'defaultStyleId' | 'generationDefaults'>>): Promise<void>

Shot.propIds?: Id[]
Shot.styleId?: Id | null // undefined inherit; null none; string explicit
Project.defaultStyleId?: Id
Project.generationDefaults?: ProjectGenerationDefaults

parseGenerationDefaults(raw: unknown): ProjectGenerationDefaults | undefined
validateGenerationDefaults(raw: unknown): string[]
generationParameters(config: ProjectGenerationDefaults, kind: 'image' | 'video'): Record<string, string | number>
```

`src/domain/output.ts` owns versioned provider capabilities and validation. `src/lib/shotRelations.ts` owns effective relationship names for UI and delivery. Optional creative strings live on domain entities; missing legacy fields display as empty without a DB version change. Package parsers validate their types.

## 3. Contracts
- Project creative target aspect and image/video generation defaults are separate. Expanding target aspects does not change existing dimension mappings or authored shot durations.
- APIMart image defaults accept `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, and `gpt-image-2.5-ext` under profile version `2026-09-18` (do not bump the version when adding these models). New projects still default to `gpt-image-2`. All keep `n: 1`.
- Image 2: 15 ratios + auto, lowercase `1k`/`2k`/`4k`, max 15 refs, reject `quality`/`version`. Standard 2.5 flare/sunburst: same sizes, lowercase resolution, max 16 refs, optional `quality` (`low`/`medium`/`high`/`xhigh`/`max`/`auto`, default `auto`), reject `version`. Ext: 10 ratios + auto (no `2:1`/`1:2`/`3:1`/`1:3`/`9:21`), store lowercase resolution and map to `1K`/`2K`/`4K` only in `profileRequest`, max 16 refs, optional `version` (`flare`/`sunburst`, default `flare`), reject `quality`. MiniMax-H3: uppercase 768P/2K, integer 4..15 seconds, six concrete ratios. Reference mode may use adaptive; frames mode requires adaptive and native mapping omits aspect_ratio because inputs determine it. Never infer first/last-frame roles from image array length.
- Profile version is 2026-09-18. Reverify official docs before changing constants. Official GPT Image 2 / 2.5 / Ext and H3-Max are distinct profiles, not aliases of these UI defaults. No silent remap across Image 2 / 2.5 / Ext.
- Parser preserves unknown model/version/value for review, plus unknown keys under extra; validator and parameter builder reject unsupported configurations. Manual legacy projects have no generation defaults. Explicit reset/reselection replaces unsupported settings. Parameter builder only provides common settings, not complete prompt/media validation or paid execution.
- Project config stores no API key or connector instance. Changing defaults never rewrites existing shots/media. Output settings require explicit Save, errors disable Save, pending saves prevent closing, and dirty-close prompts offer return/discard. Auto-saved creative text remains separate.
- A blank project name rejects without changing other fields in the patch; the text draft retains its error/retry state. Relation dialogs prevent closing or switching shots during a pending save; failed choices require retry or explicit discard before leaving.
- Asset/shot references belong to the same owner. Validate before every repo mutation that can introduce links; reject transactionally. Delete prop removes it from shots. Delete style clears project default and converts explicit shot links to null, preventing accidental inheritance.
- Only new shots created under a beat copy its character/scene choices. Subsequent beat edits or moving shots do not overwrite choices. Duplicate keeps explicit style/null/prop choices; restore checks current validity.
- Project ZIP remaps project default style, explicit shot style and prop IDs. Missing explicit style becomes null, missing prop references are pruned. Inherited undefined remains inherited.
- Studio detail routes and grids only expose STUDIO_LIBRARY_ID assets. Project world tab uses optional validated `tab` route search. Return links set the matching tab. Search scans authored strings, not identifiers/provenance.
- Media reuse picker lists same-owner, correct-kind, nonempty files. It shares media IDs without claiming draft upload ownership. Commit checks existence/owner/kind/nonempty Blob again; orphan cleanup protects every committed reference. Asset/still result slots accept images; clip accepts image planning placeholders and videos.

## 4. Validation / Error Matrix
| Condition | Behavior |
| --- | --- |
| Legacy missing optional strings/defaults | Empty optional UI; retain manual operation |
| Unsupported model/profile imported | Preserve for review; generation mapping and Save reject until corrected |
| Image 2 or Ext with `quality`, or standard 2.5 with `version` | Reject Save / mapping; do not strip silently |
| Ext size outside its 10 ratios + auto | Reject; do not remap to Image 2 sizes |
| H3 text→frames with fixed ratio | Show incompatible ratio and block Save; user chooses follow input |
| H3 frames→text with adaptive | Show incompatible ratio and block Save; user chooses supported fixed ratio |
| 1080P or fractional/out-of-range H3 duration | Reject; do not coerce |
| Foreign/deleted props/style/scene/cast on mutation | Reject whole operation; show error/retry |
| Existing media deleted after picker selection | Reject slot save; retain draft for correction |
| Shared file unlinked from one slot | Keep while another committed reference exists |
| Unknown route tab | Ignore; show default setting tab |

## 5. Good / Base / Bad
- Good: project style changes, inherited shots follow while explicit/no-style shots remain unchanged.
- Base: old ZIP imports with no new metadata or AI settings and remains editable.
- Bad: copy project video resolution into image request or silently convert 1080P to 2K.

## 6. Tests Required
- `output.test.ts`: every supported ratio/resolution, duration bounds, mode incompatibility, old profile preservation/rejection and exact native keys/case.
- `assetFoundation.test.ts`: owner rejection, delete cleanup, duplicate/restore, creation-only beat seeding, independent studio snapshot, valid media reuse and invalidated selection, legacy/new ZIP remapping.
- `episodeDelivery.test.ts`: effective inherited/explicit/null style and prop names, foreign refs, CSV quoting, film naming, timing preservation.
- `assetLibrary.test.ts` / `mediaPicker.test.ts`: search ignores internal IDs, tab whitelist, owner/kind/empty-file filtering.
- Browser: settings→save/reopen, invalid mode switch, dirty close, optional fields→navigate→return tab/search, relation controls→delivery, reuse picker, narrow layout.

## 7. Wrong vs Correct
```ts
// Wrong: null and undefined collapse and overwrite explicit no-style intent.
const styleId = shot.styleId || project.defaultStyleId;
// Correct: undefined alone inherits.
const styleId = shot.styleId === undefined ? project.defaultStyleId : shot.styleId;
```
```ts
// Wrong: selector entries from all projects and inferred compatibility.
const files = await db.media.toArray();
// Correct: owner-scoped query plus kind validation, then commit-time validation.
const files = await db.media.where('projectId').equals(projectId).toArray();
```

## C05 generic patch and cover media contract (2026-09-30)

### 1. Scope / Trigger
Repository asset/shot text patches and project cover replacement, including direct API callers outside the UI.

### 2. Signatures
`patchCharacter/Scene/Prop/Style` omit slots; `patchShot` omits firstFrame/lastFrame/clip. An own media property is explicitly rejected at runtime before generic pickPatch, even if undefined. `patchProjectOutput` validates cover media within PRODUCTION_TABLES using the strict owned nonempty image contract.

### 3. Contracts
An optional TypeScript property restriction does not validate untrusted runtime callers. Media mutation requires existing owned nonempty media with a compatible declared kind and MIME, and atomic write/touch/recycling. Asset/shot text and relationship callers must retain their supported behavior. Asset/still result slots accept images; only the shot clip slot also permits a video result. Video reference inputs remain valid where previously supported. Shot clip image planning placeholders remain supported by the dedicated slot API. Shared and historical job/proposal/batch references protect media from recycling; an actual unreferenced predecessor can be removed. Existing slot revision/CAS and undo behavior remains authoritative.

### 4. Validation / Error Matrix
| Input | Required result |
| --- | --- |
| Generic patch contains unsupported media field | Explicit rejection; no silent dropping |
| Cover references foreign/missing/empty/non-image media | Reject without changing project or media |
| Valid owned image cover | Commit and recycle only unreferenced predecessor |
| Shared or history-retained predecessor | Preserve the media |
| Project touch/storage failure | Roll back the entire mutation |

### 5. Good / Base / Bad Cases
Good: text edits continue to use a small generic patch while media uses validated slot APIs. Base: a video shot can retain an image planning placeholder in its clip slot. Bad: a direct patch bypasses the UI's ownership check, or replacement removes a media file still used by a historical result.

### 6. Required Tests
Direct repository rejection and unchanged-row assertions, valid owned media, clear and replacement, shared/history retention, rollback, and adjacent CAS/undo/proposal tests. Audit named imports, namespace dispatch and dynamic caller payloads. These tests demonstrate repository invariants rather than a claimed normal-UI exploit.

### 7. Wrong vs Correct
Wrong: rely on TypeScript Omit alone or silently delete unsupported fields. Correct: enforce the accepted runtime boundary before writing and use one validated media mutation transaction.

## D06 shared generation capability contract (2026-10-08)

### 1. Scope / Trigger

Maintain this contract when changing single/batch generation review controls, project output defaults, model parameter transitions or `profileRequest` validation. Share existing capability facts without conflating provider policies, UI representations, permissive import parsing and executable request validation.

### 2. Signatures / Owners

- `domain/generationCapabilities.ts` owns `GENERATION_CAPABILITIES`, existing ordered image/video constants/model predicates, `GenerationCapability`, `CapabilityParameters`, `ParameterContext` and `ParameterIssue`. Actual pure entry points are `getGenerationCapability`, `defaultImageParameters`, `defaultVideoParameters`, `projectGenerationParameters`, `generationResolutionChange` and `validateGenerationParameters`; exact final contracts are subject to independent acceptance.
- Existing `GenerationConfigurationFields` remains the shared single/batch UI. Project output settings remains its APIMart-specific adapter with its own components and draft/CAS lifecycle. Existing profile schema/type owner from D05 remains authoritative for tool arguments.
- `domain/output.ts` retains actual compatibility exports and project-default parsing/version/native-key responsibilities. `generationProfiles.ts` retains D05 schema ownership and delegates the shared facts/parameter validator, with `GENERATION_PROFILES` referencing the actual capability list. Existing model/mode/owner orchestration remains in its feature consumers; no form registry is introduced.

### 3. Contracts / Invariants

- Preserve every current model name, option ordering/case/default and provider-specific legal combination. Do not add model support, import repair, profile versions or new gateway parameters.
- Model/mode changes project allowed parameters from the same capability facts used by validation. Preserve prompt, target IDs, approved input roles and connector session; remove only fields that the existing transition already removes. Incompatible proposals remain visible/actionable rather than silently repaired into executable requests.
- APIMart frame request may represent follow-input ratio as omitted/adaptive, while persisted project defaults require explicit adaptive. Treat these as boundary representations, not permission to omit an arbitrary fixed ratio.
- Existing `profileRequest` missing-mode derivation remains inputs ? reference : text; it does not infer frame roles. Explicit user application of selections owns frames/reference/text derivation. Rendering cannot silently authorize a proposal with first-frame inputs and missing mode.
- Preserve existing duration/resolution/reference constraints, current image/video ratio sets and upload/input limits. UI hiding a field does not prove an invalid request is safe; executable validation remains authoritative.
- Single/batch call/revision/project/busy ownership, explicit confirmation, remembered defaults, paid submission/recovery, receipt/ledger and mutation guards remain in their existing owners. Saving project defaults cannot submit paid work.
- Project default parsing remains permissive for historical imports, while supported-profile validation and explicit editor Save stay strict. CAS/rebase/acknowledge/dirty/retry/latest semantics remain unchanged.

### 4. Validation / Error Matrix

| Condition | Required behavior |
| --- | --- |
| Unsupported provider/model or parameter | Existing explicit validation error; no paid submission |
| Model/mode switch | Preserve target/input/prompt/session identity; apply only the existing legal parameter transition |
| Incompatible reference/frame/resolution/duration | Explain/reject through authoritative validation; no rendering-time permission |
| Hidden stale field | Preserve existing clear/omit behavior consistently across review and project defaults |
| Busy/revision changes during review | Existing synchronous ownership/confirmation guard prevents wrong target submission |
| Save defaults | Persist reviewed defaults with existing CAS; zero generation request |
| Historical unsupported stored values | Preserve import compatibility and explicit invalid editor feedback |

### 5. Good / Base / Bad Cases

- Base: single and batch use the existing shared fields with the same ordered capability projections.
- Good: project defaults adapt APIMart follow-input semantics without changing request representation; invalid combinations remain editable and do not submit.
- Good: model switches preserve target and inputs, and saving defaults makes no paid provider call.
- Bad: a generic form registry hides policy differences, rendering infers frame mode, imports are silently upgraded, or a model option newly becomes executable without accepted gateway policy.

### 6. Tests Required

Compare actual before/after model matrices, ordered options/defaults and runtime validation. Cover every supported model, important negative parameter/reference combinations, hidden field transitions and target/input/session preservation. Use actual single/batch/project settings consumers, including busy/revision/confirmation and save-defaults-no-submit behavior. Keep D05 advertised-schema bytes/type fixtures and D01 preparation/paid recovery contracts intact where overlapped. Native UI/DB checks must demonstrate concrete changed state/CAS risks, not claim provider support from local mocks. Preserve failures and do not weaken assertions/timeouts.

### 7. Migration / Limits

No form factory, provider request framework, audio/music capability rewrite or unrelated layout/performance work. Shared facts/projections have actual consumer responsibilities; separate adapter policies remain explicit. Model catalogue data and finite local fixtures do not independently verify live provider availability or paid output. D07 transport is specified in `ai-connectors.md`; D08 text drafts are specified in `state-management.md`. E/QG01 remain separate later work. Whole-D current-source acceptance and model/build/native gate remain mandatory.
