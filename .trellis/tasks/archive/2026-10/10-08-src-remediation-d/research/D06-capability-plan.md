# D06 / AU-07: shared generation capability plan

Status: proposal preparation only, 2026-10-08. No implementation, test execution, independent acceptance, ledger closure, or provider verification is claimed. Research role; no child dispatch. Sole write ownership: this document. Existing workspace changes belong to other work and must be preserved.

## 1. Requirement and implementation-entry gate

The exact original finding is `.trellis/tasks/09-30-src-quality-architecture-audit/research/agent-ui.md:111–121`, **AU-07**, P2 structural debt. Its location is `GenerationReview.tsx:194/197/262/283/285/286/289/294` and `AgentGenerationBatches.tsx:591`. It explicitly acknowledges that `GenerationConfigurationFields` already eliminated whole-form duplication between single and batch review. Remaining debt is duplicated provider/model option arrays and legal parameter transitions, also repeated in profile validation. This is not evidence of a currently permitted illegal paid submission.

Original acceptance: project allowed combinations through `profileRequest`, explain incompatible choices without silently changing a proposal, preserve target/input identity across model switches, and prove that saving defaults does not submit a paid request. Parent `research/remediation-plan.md:50–58` additionally requires shared capability consumption while retaining provider-specific UX.

Authority read: this task's `implement.jsonl`, `check.jsonl`, `prd.md`, `design.md`, `implement.md`; parent `.trellis/tasks/09-30-src-quality-remediation/{design.md,remediation-ledger.md}`; original audit above; frontend output/connector/quality/directory guidance. Current committed HEAD observed: `abb7a91d255666fc8f772cddecd66676b9f2848c`. The task PRD's C baseline is `f062d694e61da6bcb574f7fb548803b9e54197eb`; it is not today's complete source snapshot. Research also observes uncommitted D01/D02 work, including `generationPreparation.ts` and newly extracted repository owners. Source fingerprints below locate this proposal, not a clean implementation baseline.

**Before D06 implementation**, re-read the then-accepted D03 and D05 plans, final implementation/check reports, updated consumer paths, actual task context, and current source. D03 may relocate the page/form hosting boundary; D05 may change the schema/type owner and capability tool adapter. Do not overwrite their changes, rebuild their schemas, or assume their acceptance from this preparatory report. Capture a fresh entry snapshot and run the bounded entry tests before editing. Main owns spec/ledger/status and acceptance sequencing. D06 is not authorized to implement now.

Out of scope: D03 page/lifecycle extraction; D04 context/query schema; D05 tool/schema registration; D07 provider request/response consolidation; audio/music capability unification; model-bank changes; new model support, profile-version changes, project migration, generic form factories, or unrelated UI/CSS changes.

## 2. Actual owners and consumers

There are two presentation owners, with three actual user entry surfaces:

| Actual path / entry | Current responsibility | Proposed D06 treatment |
| --- | --- | --- |
| `src/components/agent/GenerationReview.tsx:47` / `GenerationReviewForm` | `key={call.id}` draft session; original proposal/revision; validate connector/key/prompt/profile; approve overrides; optionally remember; then `onAction(call.runId, "resume")` | Preserve all orchestration and identity; consume shared parameter projection in existing fields |
| `src/components/agent/GenerationReview.tsx:186` / `GenerationConfigurationFields` | Existing shared single/batch controls; resolves connector instance/provider; chooses supported models; hardcoded size/resolution/duration/ratio/quality arrays and resolution→8 transition | Primary UI removal of duplicated policy; keep Ant Design controls, labels, prompt editor, popup root, layout and disabled props |
| `src/components/agent/AgentGenerationBatches.tsx:591` / `BatchConfigurationFields` | Same fields via import at :56 and render at :645; project-identified live query; recommendation + local validation; batch owns item/revision/pending state | Remains a consumer of the same fields and `profileRequest`; no new batch form implementation or lifecycle extraction |
| `src/components/workspace/ProjectSettingsPanel.tsx:134` / `ProjectOutputSettings` | APIMart-only versioned project defaults and target aspect; explicit Save; retains invalid selections; CAS/rebase/acknowledge; dirty guard, retry/accept latest | Consume the same APIMart facts/projection/parameter validation via project adapter; preserve Radix controls and existing draft orchestration |
| `src/domain/output.ts` | APIMart constants/model predicates, defaults, permissive import parser, strict supported-profile validator, common native-key builder | Compatibility facade for public exports; delegate overlapping facts/defaults/parameter validation to pure leaf; preserve parser, versions and native-key contract |
| `src/lib/agent/generationProfiles.ts:38` | Strict submission shape; target/slot validation; role identity/mode/count restrictions; default parameters; provider-native mapping | Keep public schema and `profileRequest`; consume shared parameter policy, retain request-only checks and exact lowering |
| `src/lib/agent/generationProfiles.ts:125` / `GENERATION_PROFILES` | Seven advertised verified model rows; consumed by UI and tool | Derive parameter facts from the same owner; retain public export and observable row order/shape |
| `src/lib/agent/generationReviewDraft.ts:5` | Explicit selection replaces parameters, preserves target/inputs and unfinished prompt; mode from actual roles; removes APIMart frame ratio | Retain this adapter; call leaf only for genuinely shared parameter transitions/default views; never silently legalize explicit recommendation values |
| `src/lib/agent/generationSelection.ts` | Explicit > project > global > AI precedence; sanitized connector capability input; ambiguous/stale recommendation explanation; strict preference save/read | Preserve public behavior. Existing validators reach shared policy transitively; do not add another selection service |
| `src/lib/agent/generationTools.ts:148` / `generation_capabilities` | Read-only advertisement; sanitized connector IDs/provider/labels/configured; profiles, recommendations, `profileDate: "2026-09-19"` | No tool-schema rewrite. Same advertisement and envelopes; advertised capability is not permission or balance |
| `src/lib/ai/catalog.ts` | Provider-level chat/image/video/audio advertising and chat protocol/default base | Read-only reference; not the executable generation rule source |
| `src/lib/agent/generationPreparation.ts` | Connector/frozen destination, owned media, MIME/bytes/dimensions, flush/hash/read snapshot/fingerprint outside writes | Remains authoritative; do not move IO into the capability leaf |
| `src/lib/agent/generationMedia.ts` | PNG/JPEG/WebP header dimension reader | Retain; distinct from a form projection |

Other linked consumers to verify, without automatically editing them: `src/db/projects.ts:63–96` (current extracted project patch validation), `src/lib/agent/businessTools.ts` (project defaults validation; D05 may change it), `src/lib/generationIntent.ts` (manual production intent uses project defaults), `src/db/generationPreferences.ts`, `src/db/connectors.ts` (actual connector resolution), `src/domain/generationPreferences.ts`, `src/lib/projectOutputDraft.ts`, `src/lib/agent/generationReview.ts`, `src/lib/agent/generationRuntime.ts`, `src/db/agentGenerationBatches.ts`, `src/lib/agent/generationBatchRuntime.ts`.

Concurrent-source refresh: D02 changed repository consumers while this report was being prepared. The final read observes `ProjectSettingsPanel`/`businessTools` using `db/projects.ts`, and `generationPreparation`/`AgentGenerationBatches` using `db/connectors.ts`. The initially read `db/repo.ts` has been removed by that work. These are current observations, not a D02 acceptance claim; no repository changes were made by this researcher. Source paths and fingerprints below reflect the refreshed owners.

## 3. Exact model/parameter matrix from current source

Sources: `domain/output.ts:1–79,138–204`, `generationProfiles.ts:38–204`, and the two presentation owners. No new external/provider claim is made.

| Provider / exact model | Image size / video ratio | Resolution, stored/UI spelling | Duration/default | Extra controls/default | References and semantics |
| --- | --- | --- | --- | --- | --- |
| APIMart `gpt-image-2` | `IMAGE_RATIOS` (15) + `auto`; request default `auto`; project default target ratio with `16:9` fallback | `1k`,`2k`,`4k`; default `1k` | Unsupported | No quality/version | Only reference-image; 15 max; `n=1` |
| APIMart `gpt-image-2.5-flare` | Same 15 + `auto` | Same lowercase resolutions/default | Unsupported | quality `low`,`medium`,`high`,`xhigh`,`max`,`auto`; default `auto`; no version | Only reference-image; 16 max; `n=1`; retain auto precharge note |
| APIMart `gpt-image-2.5-sunburst` | Same as Flare, distinct model ID | Same | Unsupported | Same quality; no version | Same counts, distinct model identity |
| APIMart `gpt-image-2.5-ext` | `IMAGE_EXT_RATIOS` (10) + `auto`; excludes `2:1`,`1:2`,`3:1`,`1:3`,`9:21` | Store lowercase; **only `profileRequest`** lowers to `1K`,`2K`,`4K` | Unsupported | version `flare`,`sunburst`; default `flare`; no quality | Only reference-image; 16 max; `n=1` |
| APIMart `MiniMax-H3` | `VIDEO_RATIOS` (6); text default `16:9`; reference allows/defaults `adaptive`; frames follows input, no native aspect_ratio | `768P`,`2K`; default `2K` | Integer 4–15 inclusive; default 5 | Actual roles/mode; no size/quality/version | First/last frames OR up to 9 reference-images; no local reference-video adaptation; prompt max 7000 |
| AIHubMix `gpt-image-2` | Pixel sizes `auto`,`1024x1024`,`1536x1024`,`1024x1536`; default `auto` | Unsupported: reject stale resolution | Unsupported | quality omitted for model default, or `low`,`medium`,`high`; no version | Only reference-image; advertised 16; strict submit schema max16; native `n=1,output_format="png",async=true` |
| AIHubMix `veo-3.1-fast-generate-preview` | `16:9`,`9:16`; default `16:9` | `720p`,`1080p`,`4K`; default `720p` | `4,6,8`; default 8; non-720p OR reference mode requires 8 | Actual roles/mode; no size/quality/version | At most 3 reference-images / 1 reference-video; reference-video requires 720p; first/last frame mode remains distinct |

Exact arrays to retain: `IMAGE_RATIOS = [1:1,3:2,2:3,4:3,3:4,5:4,4:5,16:9,9:16,2:1,1:2,3:1,1:3,21:9,9:21]`; `IMAGE_EXT_RATIOS = [1:1,16:9,9:16,4:3,3:4,3:2,2:3,5:4,4:5,21:9]`; `VIDEO_RATIOS = [21:9,16:9,4:3,1:1,3:4,9:16]`. Preserve order, case and defaults, not just set membership.

Important qualifications to this matrix:

- APIMart frame request accepts an omitted or `adaptive` aspectRatio and omits native aspect_ratio. Project frame defaults require an explicit `adaptive` persisted ratio. These are separate representations of follow-input policy, not permission to drop an arbitrary fixed ratio while rendering.
- `profileRequest` currently derives missing mode as `inputs.length ? "reference" : "text"`; **it does not infer frame roles**. `applyGenerationSelection` explicitly derives frames/reference/text after a user applies a selection. Preserve this distinction; a proposal with first-frame and missing mode must not silently become executable merely because it is rendered.
- Video role validation rejects text with any input, frames without a first-frame or with references, and reference mode without inputs or with first/last-frame roles; one last-frame alone is invalid. Duplicate `role:mediaId` and multiple first/last-frame roles are rejected. Same media ID in distinct legitimate roles is not the same duplicate key.
- `GENERATION_PROFILES` is an advertisement, not the entire validator: AIHubMix image max16 is currently enforced by strict submit shape, not a separate branch in direct `profileRequest`; MiniMax `maxImages:9` describes reference images, not a new total applicable to all input modes. Do not opportunistically change direct-call validation semantics during extraction.
- Both image providers reject video-only fields; APIMart Image2 rejects quality/version, standard2.5 rejects version, Ext rejects quality; AIHubMix image rejects resolution/version. Both video providers reject size/quality/version. Hiding a control does not clear a stale value.
- `requiresAsyncEnabled` in AIHubMix advertised profiles is descriptive. It is not a currently implemented connector eligibility setting. Keep truthful advertisement and actual native async behavior; do not invent a new account toggle.
- Provider transport APIs are broader native clients, not verified UI model catalogs. `catalog.ts` advertises provider categories independent of chat wire protocol. Discovery and configured key state do not prove model entitlement, async account readiness, balance or paid success. Do not merge `connectors.ts`, model bank, chat checks or provider HTTP adapters into this owner.

## 4. Proposed shared owner and concrete contract

Add **one** independent leaf, `src/domain/generationCapabilities.ts`. It must have no React, Zod, Dexie, repository, provider-client, DOM, Blob-read, crypto or network dependencies. Move genuinely shared APIMart arrays/model predicates there and re-export them from `domain/output.ts` to preserve actual imports and literal union types. Keep the existing project interfaces/parser/profile version in `output.ts`; the leaf must not import its facade back and create a cycle. Seven explicit immutable profile records are sufficient; no extensible registry/service or dynamic form engine.

The leaf owns the executable *parameter* facts: exact provider+model+kind identity, supported scalar fields, ordered options, duration range/choices, scalar defaults, and conditional Veo/MiniMax parameter legality. Reference count/MIME facts may be described there for projection/advertisement, while existing real-input validation remains in its owner. Do not move async preflight or rewrite submission shape to eliminate another-looking duplicate.

Suggested signatures and fixed shape (names may follow repository conventions after entry rebase):

```ts
type GenerationProvider = "apimart" | "aihubmix";
type GenerationKind = "image" | "video";
type GenerationMode = "text" | "frames" | "reference";
type GenerationInputRole = "first-frame" | "last-frame" |
  "reference-image" | "reference-video";

// Permissive scalar view can represent imported/unfinished values.
// It is not a replacement for generationSubmitSchema or project parsing.
interface CapabilityParameters {
  size?: string; resolution?: string; duration?: number;
  aspectRatio?: string; mode?: string; quality?: string; version?: string;
}

type ParameterContext =
  | { purpose: "project-defaults"; mode?: string }
  | { purpose: "request"; mode?: string;
      inputRoles: readonly GenerationInputRole[] };

getGenerationCapability(provider: string, model: string,
  kind: GenerationKind): GenerationCapability | undefined;

// Project default target aspect and absent request defaults differ explicitly.
defaultGenerationParameters(profile: GenerationCapability, context:
  { purpose: "project-defaults"; targetAspect?: string } |
  { purpose: "request"; mode: GenerationMode }): CapabilityParameters;

validateGenerationParameters(profile: GenerationCapability,
  raw: Readonly<CapabilityParameters>, context: ParameterContext):
  readonly ParameterIssue[];

projectGenerationParameters(profile: GenerationCapability | undefined,
  raw: Readonly<CapabilityParameters>, context: ParameterContext):
  GenerationParameterProjection;

applyGenerationParameterIntent(profile: GenerationCapability,
  raw: Readonly<CapabilityParameters>, context: ParameterContext,
  intent: GenerationParameterIntent): CapabilityParameters;
```

`GenerationCapability` is an image/video discriminated data record. `ParameterIssue` has a stable code and affected scalar field(s), optionally diagnostic arguments. Existing project/request adapters map codes to their existing messages and ordering. The request-only role validator still provides its own errors. Avoid erasing controls into `Record<string,unknown>` or casting union profiles throughout JSX.

`GenerationParameterProjection` is a **fixed** image/video view: optional `size`, `resolution`, `quality`, `version`, `aspectRatio` choice properties and a `duration` property with ordered numeric choices or min/max/step; scalar display defaults, current-value validity, unavailable reason and parameter issues. A choice records raw/effective displayed value, supported options, and whether the raw value is invalid; a hidden unsupported field can still generate an issue. This is data for existing controls, not a renderer, control registry, schema interpreter or component factory. Labels/localized descriptions stay in the UI unless already part of public profile advertisement.

Contract details:

1. Lookup is exact by **provider + model + kind**. Same `gpt-image-2` ID across providers never reuses the other's semantics. Unknown/deleted provider/model has no verified projection and gets an explicit unavailable diagnosis; no nearest-model fallback.
2. Defaults return fresh scalar data, without credentials, connector IDs, target, prompt, input media IDs or persisted profile metadata. Request display defaults apply only to absent fields. Project wrappers use targetAspect/fallback16:9 and add unchanged `OUTPUT_PROFILE_VERSION="2026-09-18"`. Project target aspect and existing authored shot duration never change as a side effect.
3. Projection/validation are pure and preserve all raw values. Loading/reopening/rendering, provider capability advertisements, and derived option restrictions cannot mutate the draft, normalize case, trim the prompt, drop hidden fields, round durations, or change target/input identity.
4. The request adapter passes the current effective mode used by `profileRequest` and actual input roles. It must report role/mode mismatch independently. Project projection receives intended mode with no fake material IDs; no empty-input rejection of valid future frame/reference defaults.
5. Conditional options use effective defaults consistently: Veo720 text/frames offers4/6/8; non720 offers8; reference offers8; reference-video limits resolution to720p. MiniMax text offers six ratios, reference six+adaptive, frame control is hidden in Agent and follow-input-only in project settings. Preserve stale values visibly/in issues even when absent from current choices.
6. `GenerationParameterIntent` is a typed scalar-field edit, not a replacement draft. Preserve the currently intentional UI transition: an explicit Veo resolution change to1080p/4K patches duration8, matching existing `GenerationReview.tsx:286`. Switching back to720p leaves the chosen duration. Ordinary scalar edits patch only their field. Project mode switching preserves incompatible ratio until the user corrects it; it must not auto-select adaptive/fixed ratio.
7. Model/connector/recommendation selection remains an **explicit replacement** through `applyGenerationSelection`, not scalar intent. Keep empty parameter replacement on model switch, actual-role-derived mode, and APIMart frame ratio removal on this existing action. Applying an explicit Veo recommendation `{resolution:"1080p",duration:4}` keeps4 and shows error; do not reuse the scalar-resolution intent to silently fix it.
8. Pure validation owns shared parameter legality and absent-value defaults, with explicit context differences. Keep input identity/role count consistency, target validation, strict schema completeness and prompt constraints in `profileRequest`. No new generic "valid form" flag can bypass these boundaries.
9. Native lowering stays where it is: `profileRequest` retains n/prompt, aspect_ratio, Ext uppercase resolution, AIHubMix output_format/async, provider model/kind constraints. `output.generationParameters` retains its smaller common parameter contract, notably lowercase Ext resolution and conditional existing quality/version keys. Sharing scalar defaults must not add formerly omitted keys there.

## 5. Bounded implementation shape and compatibility proof obligations

Expected product edits after the separate authorization/entry gate:

- Add `src/domain/generationCapabilities.ts` for facts/pure functions.
- Update `src/domain/output.ts` to import/re-export moved facts and delegate common defaults/parameter legality; retain permissive shape parsing, extra bags, versions, project provider restriction, error accumulation and common native builder.
- Update `src/lib/agent/generationProfiles.ts` to consume those facts/common parameter validation, retaining actual request checks/lowering and existing public schemas. Build/retain `GENERATION_PROFILES` from shared facts without changing advertised JSON shape/order. A snapshot of current seven rows is a compatibility fixture, not a new registry API.
- Update only capability reads/parameter handlers in `GenerationConfigurationFields` and `ProjectOutputSettings`. Batch wrapper continues sharing fields. `generationReviewDraft.ts` changes only if needed for the shared pure intent boundary; do not replace its existing explicit-selection contract.

No expected edits to provider HTTP files, media preflight/runtime/DB/job ownership, package imports, page controllers, UI primitives, styles or task state. A later discovered necessary path must be justified against this scope and the accepted D03/D05 state, not silently included.

Proof obligations, to be recorded by implementation/check rather than assumed here:

| Boundary | Required preservation evidence |
| --- | --- |
| Public imports | Existing output arrays/predicates/type exports, generationSubmitSchema, profileRequest and GENERATION_PROFILES remain available; no reverse domain→lib/db imports, added value cycle or unknown→supported coercion |
| Shared owner consumption | Both presentation owners read projection; output validator/default wrappers and profileRequest consume common parameter policy. No repeated JSX provider array/conditional duration legality remains. Batch consumes same fields; derivation rather than copied tables demonstrated in source review |
| Exact config behavior | Table-driven explicit expected cases plus pre-entry old/current comparison: legal set, absent-value defaults, raw retained values, rejection category/message, parameter-key presence/case. Do not use the new projector's arrays as the sole oracle for its own validator |
| Project compatibility | parseGenerationDefaults preserves unknown model/version/value/extra through round trip; validate rejects until explicit reselection/removal; APIMart-only persisted defaults and manual no-default state retained; frame/text/reference transition errors remain; no generation side effect |
| Agent proposal identity | Applying/editing uses same target/ordered `(mediaId,role)` inputs and prompt bytes; call.id/remount boundary, original call arguments/revision, review override CAS and batch item/revision baseline remain unchanged |
| Hidden stale fields | Image2 quality/version, Ext quality,2.5 version,AIHubMix-image resolution,video size/quality/version and H3 fixed frame ratio are still rejected. Hiding a field cannot legalize them; correction is explicit replacement/reselection or supported edit |
| Connector identity | No automatic connector choice on render; exact instance selected by ID, same-model retained only if supported when user changes connection, same-provider multiple-connector ambiguity retained. Missing/keyless/wrong-provider connector blocks confirmation; frozen job provider/base URL is never derived from current UI selection |
| Busy/failure/recovery | Existing busy+saving flags/refs, CAS failures, project dirty guard/rebase/acknowledge, unchanged paid approval path, batch queue concurrency and unknown task recovery behavior survive; failed defaults save after approval retains confirmation and its toast behavior |
| Advertising/credentials | Same profiles/tool note/profileDate and sanitized configured connector list; no API key in projection or capability results. No inference of account authorization from catalog, discovery or profile presence |
| Paid boundary | Opening/editing/applying defaults/Save/clear preference causes zero provider calls; only explicit confirmed approval can resume paid submit; existing uncertain/known remote tasks recover without POST replay |

Keep the original first-error versus accumulated-error behavior in their adapters: project validation reports an ordered issue list, request validation throws its existing rejection. Unknown project video profile currently still receives scalar diagnostics; do not return early and erase them. Shared leaf issues are intermediate data, not a reason to collapse actionable errors into a generic invalid-form message.

## 6. Retain C02 duration and C06 resource contracts

Parent ledger reports C02/AR-03 and C06/PM-05 verified complete. Read retained implementation evidence at `.trellis/tasks/archive/2026-10/09-30-src-remediation-c/research/{C02-implement-handoff.md,C06-implement-handoff.md}`; their historical acceptance/evidence limits remain intact.

C02 owns `src/domain/music.ts:MUSIC_DURATION_LIMITS`: Flow1..240 and Suno10..360, finite integers for new generation settings, decoded output duration may be fractional; narrow legacy read/import/metadata paths retain historical fractions and require explicit repair before new generation. D06's MiniMax4..15 and Veo4/6/8 are **different model policies**. Do not reuse music bounds, round imported settings, alter Simple duration repair or include audio/music forms to grow the shared model.

Current generation preflight retains `generationPreparation.ts` ownership/project/kind/nonempty media checks; supported images PNG/JPEG/WebP/GIF generally; APIMart references20MiB; H3PNG/JPEG/WebP and width/height256..5760,ratio0.4..2.5; AIHubMix inline base64+prompt+8192 envelope32MiB. These are actual media checks, not satisfied by a valid scalar projection. Keep hash/flush/read snapshot and abort checks outside write transactions.

C06's neutral `src/lib/resource/limits.ts`, `boundedResponse.ts`, `boundedSse.ts` and existing provider readers remain untouched: image/video result256MiB differs from audio32MiB and from inline request32MiB; diagnostic64KiB/JSON4MiB and per-event SSE limits retain their own contracts. No unbounded Blob/JSON fallback, altered cap, download inside a DB write transaction, transport retry or paid replay may result from extracting UI capability rules. Read-only profile/default selection must not perform metadata IO as validation.

## 7. Entry tests and focused implementation acceptance

This role has **not run tests**, installed dependencies, started browsers/servers or made paid calls. Commands below are future entry/check instructions. Always use the user's installed pnpm explicitly: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; do not use Codex Runtime/bare pnpm. `package.json` currently advertises pnpm10.15.0, but the user's explicit local pnpm instruction controls this task. No install is part of D06.

First record fresh baseline results for existing entry tests:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test tests/output.test.ts tests/generationReviewDraft.test.ts tests/generationPreferences.test.ts tests/agentGeneration.test.ts tests/agentGenerationReview.test.ts tests/agentGenerationReviewTransactions.test.ts tests/agentGenerationBatch.test.ts tests/agentGenerationBatchSafety.test.ts tests/agentGenerationRecovery.test.ts tests/generationIntent.test.ts tests/catalog.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
```

Existing proof seams: output tests cover ratios/resolutions, quality/version incompatibility, mode switches, unknown import preservation and exact common native keys; reviewDraft tests already preserve unfinished prompt, replace model-specific parameters and retain invalid explicit Veo choices; preferences tests cover strict save/read and precedence/ambiguity; generation/review/transactions tests cover strict paid mapping, target/input/CAS/fingerprint, atomic approval and reopen; batch tests cover row revisions/whitespace and20-item/two-worker/unknown recovery; generationIntent verifies defaults are intent, not paid execution; catalog tests distinguish category advertisement from protocol. Entry failures must be attributed before changing anything, not buried under new tests.

Add meaningful focused pure-policy coverage (suggested future `tests/generationCapabilities.test.ts`, no file written here) and extend only relevant existing tests:

- APIMart each exact image model: all supported size/resolution combinations; all2.5 qualities; both Ext versions; defaults/absence and forbidden fields;15/16 reference boundary through existing strict request/preflight entry.
- H3 both resolutions, all integers4..15, all six ratios in text/reference plus adaptive only where valid. Projectframes requires adaptive; Agentframes omitted/adaptive remains valid; no fixed hidden ratio acceptance. Reject3/16/fractional/nonfinite through actual schemas/adapters, mixed roles, missing first-frame, duplicate roles and local reference-video.
- Veo text and valid frames at720p×4/6/8×both ratios;1080p/4K×8; reference images1..3 and reference-video1 only at720p×8. Negative high-res4/6, reference4/6, video reference high-res,4 images/2 videos, mixed or absent required roles. Explicit scalar high-res action→8; applied explicit invalid recommendation stays invalid.
- AIHubMix image pixel-size/three optional qualities, no implicit quality default, strict16 refs; ratio spelling rejected; hidden stale resolution/version rejected. Same model ID APIMart↔AIHubMix cannot inherit the other provider's size/fields.
- Purity/idempotence: freeze inputs, no mutation from lookup/defaults/projection/validation; projection twice/reopen does not rewrite values. Preserve undefined versus explicit invalid values and current array order. Parameter intent changes only intended field(s); explicit selection retains target/input/prompt identity. Invalid/unknown imported profile receives no fallback validated model.
- Compatibility oracle: use explicit matrix fixtures and captured pre-entry public outputs, including exact `GENERATION_PROFILES` JSON and full capability-tool envelope/credential omission. For every **complete** projected legal combination use real `generationSubmitSchema`→`profileRequest`; projection is never proof of owned media, valid target revision, account entitlement or complete prompt. Also validate corresponding project-compatible cases through `validateGenerationDefaults`→`generationParameters` and real project patch boundary.
- Retain zero-call default-save/clear/apply tests, one paidPOST after explicit approval, original/override envelope distinction, interrupted/unknown recovery noPOST, and no write rollback regression. Add a focused case only if the changed seam is not already proven by the existing suites.

After changes, run focused new/affected tests plus entry suite and TypeScript; capture before/after path attribution and static diagnostic/value-cycle differential. Main/checker owns broader final suite/build/model verification and independent review of actual changed paths. C02/C06 tests are retained consumers; rerun their affected tests if an unexpected shared import changes, rather than rewriting their policy.

## 8. Native/browser cases only for actual UI risks

Pure matrix correctness belongs in unit/entry tests. Native cases below exercise actual controls, IndexedDB session/CAS or approval transitions, with fixture data and blocked/mock provider traffic; no live generation is needed. Do not create production test hooks. Existing `scripts/c01-browser-regression.mjs`/`scripts/c02-browser-regression.mjs` show repository-native fixture/reporting patterns, but no current D06 browser script is claimed.

1. **Actual single and batch controls.** Open a single proposal and editable batch row using existing UI. Switch APIMart Image2→2.5→Ext→AIHubMixImage2 and back, including unfinished/whitespace prompt. Verify options/case/quality/version visibility and old incompatible-field replacement on explicit switch; immutable target/ordered reference IDs, correct call/item identity, original proposal arguments unchanged. Edit one batch row and prove the other row is unchanged. A missing/keyless/deleted connector remains unavailable, with no automatic instance selection. Open/close/reopen has zero provider calls.
2. **Conditional video controls and hidden stale values.** With real reference-role fixtures, use Veo reference-video: only720p and8 offered; with text at720p select4 then explicitly1080p→duration8. Seed an invalid reference/high-resolution duration4 proposal and a H3frames proposal with fixed ratio: initial render must retain the values and show validation, not silently legalize hidden state. Correct via the existing explicit action; single and batch must reach the same policy result. Illegal role combinations remain blocked despite legal-looking scalar options.
3. **Project default Save/reopen and import repair.** Seed unknown profile/extra and H3frames↔text incompatible ratio; verify retained "待调整/待确认" controls, blocked Save and explicit correction. Valid Save/reopen retains exact data, lower-case image/uppercase H3 values and unchanged shots. During Save controls/closing respect busy; inject CAS/storage failure then retry or adopt latest through existing flow, preserving dirty edits. This is the actual stateful Radix/IndexedDB risk, not a request to redesign navigation or guards.
4. **Approval/default failure and session ownership.** While confirmation is pending, controls/duplicate action are disabled; verify one override/approval and at most one mocked paid submit. Default persistence failure after approval reports the existing warning without undo/reapproving the request. Change to another call/project/row while a fixture operation resolves and prove it cannot replace the new draft/identity. Reopen a known/unknown remote-task fixture and use existing recovery; no paidPOST replay and frozen connector/destination retained. Defaults Apply/Save/clear still produces zero network calls.

Native report must name browser/version, fixtures, assertions, request counts and limitations. This proposal supplies cases only; no UI pass, entitlement, acoustic/media decode, peak-memory or provider reliability claim is made.

## 9. Acceptance boundary

AU-07 can be proposed for closure only after both actual presentation owners consume one parameter-policy/projection owner, single and batch continue sharing fields, genuine shared profile/project validation is delegated rather than copied, and matrix + current-entry + native risk cases pass with independently reviewed final paths. Keep provider-specific advertising/lowering and actual resource/identity/paid validation boundaries separate. This document does not change D03/D05/D07 or any ledger/status; it is ready for coordinator review and must be rebased at implementation entry.

## Source fingerprints at proposal write

These are local SHA-256 fingerprints of selected actual source owners/linked boundaries read during preparation; they are not whole-repository coverage or a replacement for the future entry snapshot.

| Path | SHA-256 |
| --- | --- |
| `src/components/agent/GenerationReview.tsx` | `46d18772536208e0499dcb6fd66943f10c2cd32ce1c40c1408b0c28c651732bd` |
| `src/components/agent/AgentGenerationBatches.tsx` | `534a1e18afd9053102b33eda9c00b8c2343d465a68ff92183d461b2f9763c1f9` |
| `src/components/workspace/ProjectSettingsPanel.tsx` | `634de344c9f1f2af4d012b7cf7fb229e78df52a755c6656c3853c3fe5287bbfb` |
| `src/domain/output.ts` | `b43d58fa0b6b6f5a4b001e75f8bac6e8b613794cd0f422d40d6d64992d98dd33` |
| `src/lib/agent/generationProfiles.ts` | `1e4e6c2b546b43b2c6801057edc4ef7b75e84ab2ddba4caf1f3c989b5b511a93` |
| `src/lib/agent/generationReviewDraft.ts` | `b7fbbc07965516308c49372b49de3d71c5e04c090b280a42c139e692f011ec6f` |
| `src/lib/agent/generationSelection.ts` | `f86880a721807bad8c252113098047f1f5b770d26c77ebdb22ce351cc433a040` |
| `src/lib/agent/generationTools.ts` | `048e10ff8601ff57053293d3b6fc1d9c1fefe8f3d3344d6aaf01cc1854bc833f` |
| `src/lib/ai/catalog.ts` | `3d32e29d5b526c323cbc27bfd7f92c5304a55debf6345094453f3144071feb6d` |
| `src/lib/agent/generationPreparation.ts` | `9f04785d944d98852726da709d630f1c712b2f08e32b353c2e40564362b3e0f0` |
| `src/lib/agent/generationMedia.ts` | `82f6aced544ad2c8aafe62dc0b33973859d8b7fa63851b7ff9ce7cba39a71709` |
| `src/lib/projectOutputDraft.ts` | `82d056980b5bfd8ce0f66f72e77431f3003959de9f08243b0925dc380db7f7ec` |
| `src/db/projects.ts` | `ea2d0cc2e7846368239f38e8802bf63e9c9fe33581ced34bb590614d700b85e7` |
| `src/db/connectors.ts` | `9d4b1ec444561cb578d5cc78184e74e78f7092a68a43551b996dfd6f95a4c91b` |
| `src/lib/agent/businessTools.ts` | `53350cfd60ac4e86cda8bd843dbde122ab50539d8c5ed3e3698604a5dc6441a5` |
| `src/lib/resource/limits.ts` | `aaed95b303a65539344a27c6fbee1670171248995a4e2da3fe4dc9cc4307bb17` |
| `src/domain/music.ts` | `e4aa833ff90eb581b77f30f88a48784ec57b3d9d7adb2a933b65db0fc65c47da` |

Captured at 2026-10-08T10:38:40+08:00. Re-read current source if any fingerprint changes.
