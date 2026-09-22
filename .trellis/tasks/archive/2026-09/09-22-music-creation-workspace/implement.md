# APIMart Music Creation Workspace: Implementation

Status: planning; await latest parent final-summary approval, satisfy dependencies, then activate this child.

## Dependency

Foundation and the shared job/coordinator contract from the Audio child. This ordering is required even if UI sketches can be prepared earlier.

## Ordered checklist

- [ ] Implement provider contract fixtures and parsers, including errors and uncommon result shapes.
- [ ] Extend shared coordinator with music monitor/download recovery and deduplicated local capture.
- [ ] Build provider-aware form/drafts and persistent works/player/details UI.
- [ ] Add parameter reuse, favorites, downloads and explicit material/project adoption.
- [ ] Exercise all result/recovery/package fixtures and desktop/narrow interaction evidence.

## Validation

Use the [parent gate/command plan](../../../09-22-apimart-audio-music/implement.md), with the explicit local pnpm path. Add meaningful tests for this child's listed acceptance behavior rather than implementation-mirroring assertions. Run focused tests and typecheck after changed code; use the integrated full gate at the final child.

- Exact wire fixtures verify Flow fields/BPM/duration and Suno custom/inspiration/instrumental/version rules without ignored cross-engine fields.
- One, two and more-than-two results are preserved; original Suno one-based source indexes survive UI sorting.
- Reload and multi-tab recovery query known tasks without duplicate paid submissions; unknown submissions remain visibly unresolved.
- Remote-complete/download-failed can recover from saved URLs/task data without generation; wrong MIME/empty blobs are not saved as playable success.
- Reusing parameters only edits the draft. Favorites/renames persist; switching work details does not restart the current audition.
- Saved music adopted into an audio project remains usable when the source project is later deleted.

## Risks and rollback

Affected ownership: src/lib/ai/apimartAudio.ts and its focused helpers; shared generation job repositories/runtime; src/db/music.ts; src/components/music/; material adoption integration. Validate legacy behavior at those boundaries. Stop on a failed invariant, keep saved originals, and revert code/availability rather than removing project data. Follow trellis-before-dev and trellis-check; curated JSONL context is required only if the selected workflow dispatches subagents.

## Integrated delivery evidence

Implementation complete and in review. See [parent validation](../../../09-22-apimart-audio-music/validation.md) for the full automated/browser evidence and explicit live-provider/hardware limits. Final UI retains existing shadcn defaults. No Git commit/push or archive has been performed.
