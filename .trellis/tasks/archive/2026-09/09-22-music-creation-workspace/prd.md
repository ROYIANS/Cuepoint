# APIMart Music Creation Workspace

## Goal

Deliver the assigned portion of [the parent requirements](../09-22-apimart-audio-music/prd.md) as an independently verifiable checkpoint of the same release.

## Scope and requirements

Owns R7, music portions of R8, R10.

1. Implement documented Flow Music and Suno request validation, submission, query parsing and result normalization.
2. Persist known task IDs and remote results before downloading; recover monitoring and failed downloads without repeating generation POSTs.
3. Build creation rail, project work history/list, selected work details/lyrics and a persistent coordinated player.
4. Support description/supplied-lyrics modes, engine-specific settings, rename/favorite/notes, original downloads and reuse-as-draft.
5. Preserve all result works and original provider source IDs/indexes; explicitly adopt generated music into library/audio project snapshots.

## Dependencies

Foundation and the shared job/coordinator contract from the Audio child. This ordering is required even if UI sketches can be prepared earlier.

## Acceptance

Covers AC7, AC8, music portions of AC9/AC12.

- [ ] Exact wire fixtures verify Flow fields/BPM/duration and Suno custom/inspiration/instrumental/version rules without ignored cross-engine fields.
- [ ] One, two and more-than-two results are preserved; original Suno one-based source indexes survive UI sorting.
- [ ] Reload and multi-tab recovery query known tasks without duplicate paid submissions; unknown submissions remain visibly unresolved.
- [ ] Remote-complete/download-failed can recover from saved URLs/task data without generation; wrong MIME/empty blobs are not saved as playable success.
- [ ] Reusing parameters only edits the draft. Favorites/renames persist; switching work details does not restart the current audition.
- [ ] Saved music adopted into an audio project remains usable when the source project is later deleted.

## Out of scope

Do not expand the [parent exclusions](../09-22-apimart-audio-music/prd.md). Other children's primary deliverables remain with their owning task; necessary shared-contract changes must be reflected in the parent design.

## Status

Planning complete for final parent review; implementation not started. Read this task's design.md and implement.md and the parent summary approval before activation.
