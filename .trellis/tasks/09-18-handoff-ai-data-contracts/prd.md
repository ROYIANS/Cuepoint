# Manual media handoff and safe AI data contracts

## Goal
Third batch: finish an understandable manual delivery flow and define safe, reviewable AI-to-business-data boundaries before connecting generation or agent mutations.

## Requirements
- Export a human-readable shot-organized delivery package: current shot order/IDs, text, linked entities, selected stills/video, missing-media report and manifest. Keep restore backups separate from production handoff.
- Preserve original files and full prose; resolve duplicate filenames safely, show progress/errors and validate permissions/storage failures. No full timeline rendering engine.
- Define typed context assembly for project → world/assets → episode/beat → shot, with explicit inherited vs overridden defaults and source IDs/revisions.
- Define generation target including project/entity/slot, provider/model parameters, input media roles, task state and provenance; completion checks target/revision before attaching output.
- AI-authored changes should be proposals users can review/apply/undo. Respect manual edits, expired/deleted targets, failed/partial outputs and offline recovery.
- Keep secrets outside project exports/context. Prompt text/content is data, never tool authorization. No actual AI execution in the contract-only work.

## Acceptance criteria
- [ ] A manual fixture can be created, linked, populated with media, reviewed and handed off without configuring AI.
- [ ] Handoff has ordered identifiable media and readable metadata; missing files are reported, never silently treated as complete.
- [ ] Tests cover cross-project/slot targeting, revision conflicts, deleted targets, retries/idempotency and package round trip.
- [ ] Context contains intended scoped data/defaults and excludes keys and unrelated project data.
- [ ] UI shows preview of proposed changes and supports cancel/apply/undo before AI writes are enabled.

## Scope status
Direction approved 2026-09-18, queued after asset/output foundation. Concrete manifest format and contract UX will be designed from the completed second-batch schema before implementation.
