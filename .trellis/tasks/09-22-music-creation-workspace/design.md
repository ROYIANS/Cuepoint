# APIMart Music Creation Workspace: Design

The [parent design](../09-22-apimart-audio-music/design.md) is authoritative for cross-child contracts. This document identifies this child's concrete implementation boundaries.

## Owned modules

src/lib/ai/apimartAudio.ts and its focused helpers; shared generation job repositories/runtime; src/db/music.ts; src/components/music/; material adoption integration.

## Design decisions

- Follow parent design sections 5, 6 and 8. Keep provider-native provenance beside normalized audio metadata.
- Use existing connector normalization/redaction, but music /music/tasks parsing stays distinct from image/video /tasks.
- Persist original array positions before validating individual results; never renumber source indexes after filtering or sorting.
- Bound polling with ownership/backoff; failed retrieval pauses/retries queries, not submissions. Provider CDN fetches must not receive connector Authorization headers.
- Keep distinct draft, selected work and playing work state; a single playback coordinator prevents overlapping auditions.
- APIMart account and CORS behavior remain live-test limitations until demonstrated; do not report fixture coverage as a successful paid generation.

## Dependency and compatibility

Foundation and the shared job/coordinator contract from the Audio child. This ordering is required even if UI sketches can be prepared earlier. Existing video, material and Agent contracts remain supported. Preserve user source media and project ownership; no destructive data rollback.
