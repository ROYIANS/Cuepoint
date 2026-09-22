# Audio/Music Project Foundation

## Goal

Deliver the assigned portion of [the parent requirements](../09-22-apimart-audio-music/prd.md) as an independently verifiable checkpoint of the same release.

## Scope and requirements

Owns R1, R8, and shared storage portions of R2/R4/R7.

1. Add persisted video/audio/music project kinds, preserving missing-kind legacy video behavior and existing IP/archive/rename operations.
2. Define and store project-owned chapters, speakers, segments, takes, tracks, clips, music drafts/works, generation jobs and export records.
3. Implement revision-checked ownership validation and nondestructive source references; new audio/music projects do not create video episodes.
4. Extend media collection, deletion and ZIP transfer to every retained source/take/work/export; remap local IDs and preserve provider provenance without exporting credentials or active submission claims.
5. Introduce route/chrome dispatch and guard video-only mutations/episode repair before enabling new kinds.

## Dependencies

None. This child establishes the contracts consumed by all other children.

## Acceptance

Covers AC1, AC9, and lifecycle portions of AC10.

- [x] Legacy video records and old ZIP fixtures preserve navigation and episode behavior.
- [x] Cross-project/chapter/source references and nonfinite/invalid timeline fields reject atomically.
- [x] New project packages round-trip every referenced audio Blob, MIME, local relation and original provider identifier.
- [x] Deleting a project cleans new owned records; retained library snapshots survive; importing a package never resumes paid work.
- [x] Non-video routes cannot run film episode repair and video tools cannot mutate a non-video project.

## Out of scope

Do not expand the [parent exclusions](../09-22-apimart-audio-music/prd.md). Other children's primary deliverables remain with their owning task; necessary shared-contract changes must be reflected in the parent design.

## Status

Foundation implementation and targeted lifecycle tests complete. See implement.md for test evidence; parent integrated verification remains in progress.
