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
