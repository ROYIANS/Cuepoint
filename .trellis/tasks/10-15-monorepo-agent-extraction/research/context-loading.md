# Implementation and Review Context Loading

## Loading contract

Each implementation/check dispatch starts with the actual active child path and reads that child's PRD, design, execution plan and manifest. Also read the parent design, execution contract and architecture findings. Prior child verification is a prerequisite, not implied by task links.

Automatic injection has a 32,768-byte per-file cap and a 131,072-byte total cap under the current defaults. Several existing specs exceed the file limit, and a combined manifest can exceed the total limit. Successful manifest validation establishes real paths and syntax, not complete context delivery.

Before changing or reviewing the relevant owner, explicitly read its required canonical specs in bounded line chunks through EOF. Inspect any truncation/omission notice, and pull omitted material directly; do not treat an injected prefix as the whole spec. Keep canonical documents in the manifests so their ownership remains clear. Do not raise global injection limits, duplicate specs or alter Trellis runtime for this task.

The current oversize documents are frontend quality-guidelines, native-product-runtime, component-guidelines, state-management, audio-music and ai-connectors. Re-evaluate file sizes at dispatch because canonical docs may change. The most relevant tails include native probe prerequisites, quality contracts and feature behavior; their position does not make them optional.

## Scope freshness and retention

Re-enumerate actual paths after each predecessor and load only the current owner's detailed feature specs before editing that feature. Keep accepted decisions/contracts in authored Markdown rather than copied source or raw probe output. When tasks are archived, repair cross-task manifest references to the retained archive locations before considering the context reusable.
