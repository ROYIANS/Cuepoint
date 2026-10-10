# Reviewed take selection and arrangement

## Goal and boundary

Complete R4/R5 with separately reviewable batch selection and timeline placement using saved decoded duration/trim metadata. Reuse audio repositories, whole-chapter CAS and existing edit history. This work can use existing takes before R3 and later integrate with its saved outputs.

## Product behavior

- Selection and placement are separate explicit actions and previews. Selecting never creates clips; placing never silently changes selection.
- Review a bounded explicit set of chapter segments and owned saved takes. Defaults use the already selected valid take; when a choice is ambiguous, ask within the review rather than selecting an arbitrary newest/first take.
- Default arrangement appends missing segments in manuscript order to an explicit existing voice track, beginning at that track's actual last clip end (or a reviewed supplied start). Use actual trimmed duration and a reviewed nonnegative gap, default zero.
- Preserve every existing clip. Any existing chapter clip for a requested segment is shown as already placed/conflicting and is not duplicated, even if its take/track differs. Do not move, replace or delete manual clips in this first complete behavior.
- Preview includes exact take, target track, position, trim, duration, preserved/conflicting/omitted counts. A changed chapter, take, media, selection or track invalidates the proposal. User can reprepare without applying a stale rebase.
- Confirmed exact replay returns its committed effect without adding clips. Generated stable proposal/item/clip identity and existing segment placement checks both prevent duplication. A new proposal against already placed segments shows preserved/skipped rows.

## Repository contract

Add separate immutable selection/arrangement proposal types and scoped persistence at the next available Dexie version; coordinate with R3 v24 to avoid version collisions. Capture project/chapter, exact owner, prepared inputs/revisions, document fingerprint, ordered operations and stable operation ID. Proposal approval is local review for writes and uses normal Agent permission/preview rules, never a paid-generation flag.

Selection atomically validates all explicit pairs against segment and take versions and ownership, then changes only reviewed selectedTakeId fields. Placement atomically validates the whole chapter document, target tracks/takes/media/metadata and current proposal; insert only new clips. Existing clip records/revisions remain byte-identical. Do not use the current replacement helper unchanged because it touches unrelated clip revisions.

Return bounded actual added/selected/preserved/conflict counts and identities with authoritative receipts. Retain source availability and selected/placed/not-auditioned separation. No before/after count-only attribution and no trusted model-supplied result identity.

## History and concurrency

Extend the existing AudioClipHistory command boundary for an approved insertion group and undo/redo. Undo removes exactly the inserted set only if the expected chapter document still matches; redo reapplies stable identity under the same guard. A later manual/foreign edit causes a conflict, not an overwrite. History stays ephemeral as current edit history does; durable proposal identity still protects reload/replay.

Track take selection separately from clip history, with an explicit reviewed reversal or compatible selection history guard; do not claim that clip undo changes selection. Avoid touching existing clips on selection. Chapter/project deletion and imported history must not revive proposals.

## Integration and compatibility

Manual chapter actions and Agent prepare/read/apply adapters share repository contracts. Tools use current R1 contextual owner rules, frozen scope, CAS and ordinary write approval. No network or model choice is needed to compute positions. Package proposals export as dormant historical records with remapped IDs and no live approval; old packages without these fields remain accepted. Preserve original takes/media, cascade owned proposals on deletion and retain required reference media.

## UI and validation

Use one flat review dialog/disclosure with concise selected/added/preserved/conflict summary, expandable IDs/details and existing components. Keyboard/focus/Escape and 390 px layout are required. Mixed ambiguous/deleted/foreign inputs cannot be partially applied under an atomic promise; model/user must prepare an explicit valid subset.

Rollback disables new actions while retaining proposals and source audio; no destructive data migration. Research is [current gap and design](research/current-gap-and-design.md). Automated real-duration/CAS/replay/manual-preservation/history tests, then independent gates and native desktop/narrow tests, are required.
