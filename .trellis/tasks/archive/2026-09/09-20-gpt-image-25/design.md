# Design — APIMart GPT Image 2.5

## Boundaries

| Layer | Owner |
| --- | --- |
| Verified profile | `src/lib/agent/generationProfiles.ts` (`GENERATION_PROFILES`, `profileRequest`, submit schema) |
| Project defaults | `src/domain/output.ts` + `src/lib/agent/businessSchemas.ts` + `ProjectSettingsPanel` |
| Preferences / review | `src/domain/generationPreferences.ts`, `GenerationConfigurationFields`, `applyGenerationSelection` |
| Wire | `src/lib/ai/apimart.ts` submit + `generationRuntime.nativeRequest` |
| Tools | `src/lib/agent/generationTools.ts` enum must match the schema |

Do not add a new connector, table, or Dexie version. Job `model` / `parameters` already persist arbitrary verified payloads.

## Profile table (APIMart image)

Canonical **stored** values: `size` as ratio/`auto`, `resolution` as `1k`/`2k`/`4k`, `quality` only on standard 2.5, `version` only on Ext.

| model | max refs | sizes | native resolution | extra body |
| --- | --- | --- | --- | --- |
| `gpt-image-2` | 15 | 15 ratios + auto | `1k`/`2k`/`4k` | none; reject `quality` |
| `gpt-image-2.5-flare` / `sunburst` | 16 | same as Image 2 | lowercase | `quality` default `auto` |
| `gpt-image-2.5-ext` | 16 | 10 ratios + auto | map to `1K`/`2K`/`4K` | `version` default `flare`; reject `quality` |

`OUTPUT_PROFILE_VERSION` stays `2026-09-18`. Validator accepts the four models; unknown/old records still parse into `extra` and fail mapping until the user reselects.

`ImageGenerationDefaults` gains optional `quality` and `version`. Parser treats them as known keys. `generationParameters` forwards them when present (plus `n: 1`). Ext case mapping happens in `profileRequest`, not in stored defaults.

## Request construction

`profileRequest` remains the only place that builds paid image parameters.

`nativeRequest` currently copies job parameters except `mode`/`quality`, then puts AIHubMix quality under `extra`. Change: if provider is APIMart and the job model is standard 2.5, copy `quality` onto the JSON body. If model is Ext, copy `version` (already in parameters) and do not send `quality`. Keep AIHubMix on `extra.quality`.

Ext-only submit options:

- Header `X-APIMart-Response-Version: 2026-07-27`
- Header `Idempotency-Key: job.id` (stable per claimed job)

`request()` today fails when envelope `code !== 200`. Treat `200` and `202` as success when `error` is absent. `submitGeneration` then accepts:

1. `data` array of `{ task_id }` (current Image 2 / video)
2. `data` object with nonempty `id` or `task_id` (Ext 202 example)

Do not treat a 202 object as multiple tasks. Video submit stays on the array parser; if video ever returned 202-object it would be a separate change.

## UI

`GenerationConfigurationFields` already filters `GENERATION_PROFILES` by provider+kind. Add display labels; keep `value` as model id.

- Image 2.5: show quality (`auto` default) instead of hiding it for all APIMart image.
- Ext: hide quality; show 版本; size options from the Ext profile, not the full `IMAGE_RATIOS`.
- Model/connector change already calls `applyGenerationSelection` with empty parameters, so leftover `2:1` / `quality` / `version` do not merge.

Project **图片默认值** uses the same four models. When Ext is selected, show 版本. When flare/sunburst is selected, show 画质 default `auto`. Image 2 stays size+resolution only.

Copy near quality: `auto` 会按最高档预扣，完成后再按实际用量结算.

## Compatibility

- Existing `gpt-image-2` drafts, preferences, and jobs keep validating.
- Saved Image 2 with profile `2026-09-18` stays “known” in project settings.
- Preferences schema must allow `quality: auto|xhigh|max` and `version`.
- Agent `project_update` `imageDefaults` enum expands in lockstep.

## Tests

- `profileRequest` / schema: each new model, Ext size rejection, Image 2 quality rejection, default auto/flare.
- `apimart.test.ts`: 200-array unchanged; 202-object task id; Ext headers on image submit only.
- `output.test.ts` / `generationPreferences.test.ts` / `generationReviewDraft.test.ts`: new fields, no silent merge.
- `agentGeneration.test.ts`: one mocked flare POST with `quality: auto`; one Ext POST with `version` + uppercase resolution.
- No live paid calls.

## Rollback

Revert profile allowlist and adapter 202/header changes. In-flight Image 2 jobs are unaffected. A half-applied 2.5 draft would only fail local validation until the user switches back to Image 2.
