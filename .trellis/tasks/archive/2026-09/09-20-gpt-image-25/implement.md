# Implement — APIMart GPT Image 2.5

Single task. Adapter envelope and profile allowlist must ship together.

## Checklist

1. Add Ext size constant and optional `quality` / `version` on image defaults in `src/domain/output.ts`. Keep `OUTPUT_PROFILE_VERSION`. Validate per model; map nothing silently.
2. Extend `generationSubmitSchema` / `GENERATION_PROFILES` / `profileRequest` in `src/lib/agent/generationProfiles.ts`. Image allowlist: Image 2 + flare + sunburst + ext. Quality enum includes `auto`/`xhigh`/`max`. Ext maps resolution case and requires `version`.
3. Keep tool JSON schema in `generationTools.ts` identical to the Zod enum and quality/version fields.
4. `generationPreferences.ts` + `businessSchemas.ts` `imageDefaults` in lockstep.
5. `nativeRequest`: APIMart 2.5 quality on the body; Ext `version`; AIHubMix quality still `extra`.
6. `apimart.ts`: success codes 200/202; parse Ext object task id; Ext-only response-version and idempotency headers keyed by job id.
7. UI: `GenerationConfigurationFields` labels, Ext version + size subset, 2.5 quality default auto + pre-auth note. `ProjectSettingsPanel` same models/fields. Image 2 remains the empty-project default via `defaultImageGeneration`.
8. Tests listed in design. `pnpm lint` and targeted Vitest files, then `pnpm test` if targeted is green.
9. Browser: open batch/review form with APIMart connector — list four models, Ext shows 版本, flare shows 画质 auto, Image 2 has no 画质. Do not click paid 确认生成.

## Validation

```bash
pnpm lint
pnpm exec vitest run tests/apimart.test.ts tests/output.test.ts tests/generationReviewDraft.test.ts tests/generationPreferences.test.ts tests/agentGeneration.test.ts tests/agentGenerationReview.test.ts tests/agentBusiness.test.ts
pnpm test
```

## Risky files

- `src/lib/ai/apimart.ts` `request` / `submitGeneration` — video and Image 2 must still require a task-id array on `code: 200`.
- `nativeRequest` quality skip list — do not send `quality` to Image 2 or Ext.
- `OUTPUT_PROFILE_VERSION` — do not bump.

## Rollback

Revert the allowlist and adapter parse/header changes. Do not rewrite stored Image 2 jobs.
