# APIMart GPT Image 2.5 models

## Goal

Users can pick APIMart `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, and `gpt-image-2.5-ext` in the same image-generation confirmation UI and project defaults that already offer `gpt-image-2`. Paid submit still needs an explicit confirm. Unsupported combinations fail locally; they are never silently remapped.

## Background

Image generation is a verified allowlist today: APIMart image is only `gpt-image-2` in `generationProfiles.ts`, copied into Agent tool enums, project defaults, and `GenerationConfigurationFields`. Pickers live on the conversation batch/single confirm form and project **图片默认值**.

Official contracts (2026-09-20): [GPT-Image-2.5](https://docs.apimart.ai/cn/api-reference/images/gpt-image-2.5/generation) uses model ids `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst`, the same async `task_id` array as Image 2, 15 ratios + auto, lowercase `1k`/`2k`/`4k`, quality including `auto`, up to 16 references. [GPT-Image-2.5 Ext](https://docs.apimart.ai/cn/api-reference/images/gpt-image-2.5-ext/generation) always sends `model: gpt-image-2.5-ext` plus `version: flare|sunburst`, 10 ratios + auto, uppercase `1K`/`2K`/`4K`, and may return `{code:202,data:{id}}` instead of `{code:200,data:[{task_id}]}`. The current client treats any envelope `code !== 200` as failure.

## Requirements

- **R1** APIMart image pickers list `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, and `gpt-image-2.5-ext`. Labels are human-readable; stored and submitted ids are the official model strings. New project defaults remain `gpt-image-2`.
- **R1b** Ext is one picker value. Selecting it shows **版本** (`flare` / `sunburst`, default `flare`), submitted as native `version`. Leaving Ext drops `version`.
- **R2** Model switches replace provider-specific parameters; they do not merge incompatible fields. Image 2 still rejects `quality`. Ext does not send `quality` and only accepts its size set.
- **R3** Keep provider `n: 1`. Batch candidates stay separate requests.
- **R4** Image inputs stay `reference-image`. Caps: Image 2 = 15; flare/sunburst/ext = 16.
- **R5** Adapter sends native fields (`size`, resolution case, `quality`, `version`, `image_urls`). Ext 202 object envelopes yield a task id without weakening Image 2 / video `code:200` array parsing.
- **R6** No automatic fallback across Image 2 / 2.5 / Ext. Unsupported saved defaults stay visible for repair. Do not bump `OUTPUT_PROFILE_VERSION`; existing Image 2 records with `2026-09-18` remain valid.
- **R7** Paid confirmation, fingerprinting, unknown-submit blocking, and batch confirmation stay unchanged.
- **R8** Flare/sunburst expose a quality control (`low` / `medium` / `high` / `xhigh` / `max` / `auto`), default **`auto`**, and send that value. Short copy warns that `auto` pre-authorizes the max tier. Image 2 and Ext hide quality.

## Out of scope

Transparent background, `output_format`, `output_compression`, `moderation`, exact-pixel `size`, `n > 1`, official-channel GPT Image 2, AIHubMix 2.5, other APIMart image families, video model changes, live billed CI calls.

## Decisions

| Decision | Choice |
| --- | --- |
| Keep Image 2 | Yes; still selectable and the new-project default |
| Ext in the picker | One model plus a version dropdown, default `flare` |
| 2.5 quality | Show for flare/sunburst only; default and send `auto` |

## Acceptance Criteria

- [ ] AC1: With an APIMart connector, the generation model list includes Image 2 plus the three 2.5 entries; each choice builds a valid local profile without a paid POST.
- [ ] AC2: Flare/sunburst drafts send lowercase resolution and `quality` (default `auto`). Image 2 drafts omit quality. Ext drafts send `model: gpt-image-2.5-ext`, `version`, uppercase resolution, and only Ext sizes.
- [ ] AC3: Existing Image 2 project defaults, preferences, and in-flight drafts still validate.
- [ ] AC4: Profile/tool enum, review form, project defaults, and request mapping stay in lockstep; unsupported combinations error locally before POST.
- [ ] AC5: Adapter tests accept Ext task ids from documented 200-array and 202-object envelopes without changing Image 2 / video success detection.
