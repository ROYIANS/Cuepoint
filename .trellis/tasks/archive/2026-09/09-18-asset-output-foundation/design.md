# Asset/output foundation design

## Boundary and approval
User explicitly requested “提交然后做下一批” after reviewing the three-batch plan. Proceed with the second batch; no repeat permission gate. Existing model adapter execution remains outside scope. This adds manual business data and reusable validated generation defaults without network calls or credentials.

## Data contract
Add optional strings, preserving existing meaning and keeping old records readable with empty UI fallbacks:
- Project: brief, genre, audience, tone; defaultStyleId?: Id; generationDefaults?: ProjectGenerationDefaults (from domain/output.ts).
- Character: personality, motivation, voice (existing appearance/bio/notes retained).
- Scene: geography, lighting (existing location/timeOfDay/atmosphere/notes retained).
- Prop: appearance, material, size, usage, continuity (existing kind/notes retained).
- VisualStyle: palette, lighting, lens, composition, negativePrompt (existing notes retained).
- Shot: propIds?: Id[]; styleId?: Id | null. Missing/undefined style inherits project default; null explicitly means no style; string is explicit project-local style. Derived effective style is not stored. Deleting an explicit style resets that shot to null so an unrelated project default does not silently apply.

Repo patches whitelist new fields and validate same-owner references transactionally. New shots with a beat inherit its cast/scene on creation only; existing shot move/edit is unchanged. Duplicate preserves explicit state. Delete cleans prop references/defaultStyleId/shot style references. ZIP parse validates shape, retains fields, remaps all entity references using project-local ID maps. Old DBs need no index migration: fields are additive/optional; old ZIP remains compatible.

## Output defaults
Project aspect is a creative target, expanded to H3 concrete ratios (21:9,16:9,4:3,1:1,3:4,9:16), retaining existing 16:9/9:16/1:1 mappings for legacy display. Generator defaults use a separate typed domain module. Only verified APIMart standard GPT Image 2 and MiniMax H3 presets are offered now, plus unconfigured/manual. No arbitrary discovered model implies a verified schema.

ProjectGenerationDefaults = optional image/video configurations with provider='apimart', exact model ID, profileVersion='2026-09-18', modality-specific parameters. Image: size (supported ratios or auto), resolution 1k/2k/4k. Video: mode text/frames/reference, aspectRatio concrete/adaptive as applicable, resolution 768P/2K, duration integer4..15. H3 frames mode ratio is adaptive and UI explains input controls ratio; media roles/advanced flags stay at future generation entry. No connector ID/key in project settings. Keys remain studio-global.

Missing defaults remain unconfigured, not silently enabled. Legacy/unknown profile/config is retained by package parsing and surfaced as unsupported until user explicitly replaces/resets it. A shared validator and payload builder implement exact case-sensitive native fields, preventing stale saved data from generating an invalid request later. Explicit mode switches keep unsupported values visible and block Save until corrected, or use a clearly labeled reset to recommended values. Project ratios/timing never overwrite existing shots. Model defaults use an explicit form Save/Cancel with clear errors.

## UI
Maintain existing dark production-workspace visual language and components; no redesign of site chrome. Project basic information and output sections become scrollable, grouped dialog content accessible from a visible settings button; optional details use lightweight disclosure. Asset details retain name/summary essentials first, expandable optional creative fields, and per-field reliable draft status. Shot design UI gains prop multi-select and style override with explicit inherit/none labels; delivery export resolves these names. Project asset library supports search and selected-tab restoration; studio library queries stay owner-scoped. Film screens say story/project rather than misleading episode labels where applicable. Narrow toolbars wrap without losing actions.

Reuse media by selecting an existing same-owner record through a searchable image/video picker inside the shared slot dialog; selection must honor result/reference modality. Sharing IDs is safe because repo orphan checks scan committed references. Never expose cross-project media. Pending uploads or saves disable picker actions.

## Verification and rollout
Repo and pure-domain tests cover reference ownership/delete/duplicate/import, beat seeding, legacy config, invalid defaults and payload mapping. Use final full lint/test/build and independent check, plus browser workflows for project settings, optional asset data, style/props, media picker and responsive layout. No paid model execution. No new dependencies required.
