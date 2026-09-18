# Asset information and model-aware project output settings

## Goal
Second batch following the approved reliability repairs. Make manually authored project/asset information complete and connected, with useful output defaults grounded in APIMart GPT Image 2 and MiniMax H3 capabilities.

## Requirements
- Preserve a quick minimal creation path; group optional advanced information and explain how it is used. No new mandatory creative prose.
- Finalize optional project brief/genre/audience/tone; character appearance/personality/motivation/voice; scene geography/time/lighting/atmosphere; prop material/size/use/continuity; style color/light/lens/composition/avoidance groups. Inventory existing fields first to avoid duplicate text boxes.
- Add explicit project style default, shot style override, and shot prop references, with owner validation, deletion cleanup, package remapping, and visible inheritance. Changing defaults must not overwrite explicit choices.
- Seed beat-to-shot cast/scene only on explicit creation; later beat edits must not silently overwrite shot decisions.
- Add project output settings with independent image and video defaults. Provider/model-aware options and validation use verified contracts in research/apimart-output-contracts.md. Keep creative target and generator constraints distinct; existing manual projects continue to work without provider setup.
- Show GPT Image 2 ratios and 1k/2k/4k tiers separately from H3 ratios, 768P/2K resolution and integer 4–15 second duration. H3 first/last-frame ratio comes from input and must be explained at relevant controls. Do not conflate official/standard image channels or H3 model variants.
- Model switch/incompatible defaults need explicit resolution, not silent coercion. Saved old settings survive migration and offline use. Credentials remain studio-global and excluded from packages.
- Reuse existing local media via an owner-aware picker; maintain independent library/project snapshots. Improve asset discovery, tab return, film labels and narrow-screen controls from audit findings.

## Acceptance criteria
- [ ] A user can describe project, character, scene, prop and style without AI, with clear optional fields and saving/error feedback.
- [ ] Style/prop/beat relationships survive delete/duplicate/export/import and cannot point to a foreign project.
- [ ] Image/video settings only offer applicable provider/model values and explain inherited/default/overridden values.
- [ ] GPT Image 2 standard and MiniMax H3 constraints have parameterized tests; incompatible model switch and legacy settings have migration tests.
- [ ] Existing media reuse requires no second upload; project library cannot mutate source studio assets.
- [ ] Responsive and keyboard workflows are checked, including create → fill → link → attach → delivery.

## Scope status
User approved direction on 2026-09-18. This is queued after batch one. Final field inventory, interaction design and migration plan must be made concrete before implementation. No generation execution in this batch. Use parent audit.md for evidence and unresolved issues.
