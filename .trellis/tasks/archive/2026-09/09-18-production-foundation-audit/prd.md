# Manual production foundation: audit and first repair batch

## Goal
Before connecting AI to business data, make existing manual authoring, media attachment, production checks and backup reliable. The broader user objective also includes comprehensive asset information, usable configuration and connected props/style/media workflows; the audit records subsequent expansion instead of implying this first repair batch completes that objective.

## Background
AIHubMix work committed as 6969415 and archived. Full non-AI module audit is complete in audit.md with source, runtime and UI evidence. Existing relevant tests pass while new characterization probes demonstrate lost writes, stale filters and false readiness. The user approved the first repair batch on 2026-09-18; implementation is now in progress.

## Approved first-batch requirements
- R1: Make independent field/slot patches atomic across project, episode, shot and four asset entities; move last-episode check inside delete transaction. Prevent stale full-record snapshots overwriting unrelated fields (F01,F06).
- R2: Expose saving/error/retry for asset text and media edits, preserve drafts on failure, await successful slot commit before closing, and prevent overlapping upload/commit actions. No draft-owned abandoned media remains after cancel/replacement; never remove referenced media (F02,F04).
- R3: Scope shot filters to episodes, migrate legacy project filter preferences without applying foreign beat IDs, remap all filter IDs on project import, prune deleted beat references and make locate-shot reveal its target with feedback (F03,F08).
- R4: Keep still-image clip placeholders usable for planning, but report them distinctly from existing video-ready clips; verify referenced scene/media existence and type for delivery and gap checks. Do not infer readiness from IDs alone (F05).
- R5: Flush active drafts before backup, fail visibly when flush fails, and export a consistent DB snapshot. Printed storyboard includes full untruncated content (F07,F08).
- R6: Repair multi-copy partial-success retry, accessible labels/action visibility and slot media inspection. Image inspection fits full image, video inspection provides controls without nesting interactive controls in tile buttons (F09,F10).

## Acceptance criteria
1. Concurrent independent patches/slot writes preserve all changes; concurrent deletes leave at least one episode.
2. Simulated quota/save/upload failures retain user input, expose retry and avoid false success. Cancel/replacement/upload-close races do not leak draft media or delete shared records.
3. Switching episodes and restoring old/new ZIPs never hides shots via foreign/stale beat filters; the none sentinel survives. Deep links reveal their intended row.
4. Missing/wrong-kind media cannot pass video readiness; placeholder image remains allowed and labeled. Broken scene IDs surface clearly.
5. Immediate backup after an edit includes that edit or displays failure; long storyboards retain all text when printed. Legacy package compatibility remains tested.
6. Copy retry targets only remaining items; controls work by keyboard/touch; media can be inspected. Full existing tests/lint/build pass, plus targeted regression/browser checks.

## Deferred follow-up (part of broader user objective)
Optional project/character/scene/prop/style field groups; project style default and shot override; shot prop assignments; initial beat cast/scene inheritance; existing-media picker; owner-aware global library and project search; tab return/film copy/responsive toolbar; named media handoff package; typed AI context/target/revision/provenance contracts. Plan these as subsequent coherent batches from audit findings.

## Out of scope for first batch
AI execution/generation UI, provider work, new field schemas or asset links, full video timeline/rendering engine, cloud storage and collaboration backend. No automatic rewriting of existing creative prose.

## Planning status
Audit and PRD convergence complete. User approved this scope on 2026-09-18 and asked to create subsequent tasks and begin the first batch. Task is in progress. Model-aware output configuration is tracked in 09-18-asset-output-foundation; handoff and AI contracts in 09-18-handoff-ai-data-contracts.
