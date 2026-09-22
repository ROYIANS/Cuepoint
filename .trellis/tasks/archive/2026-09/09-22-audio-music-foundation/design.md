# Audio/Music Project Foundation: Design

The [parent design](../09-22-apimart-audio-music/design.md) is authoritative for cross-child contracts. This document identifies this child's concrete implementation boundaries.

## Owned modules

src/domain/types.ts and new audio/music domain modules; src/db/database.ts, repo.ts and new repositories; src/lib/projectPackage.ts; project gallery, project routes and WorkspaceChrome.

## Design decisions

- Use the parent design's additive discriminator and new tables. Preserve generic Blob storage while avoiding a blanket widening of image/video slot contracts.
- Read the latest schema version before appending a migration. Legacy records are video; an explicit unsupported kind produces a supported error rather than entering the video repair path.
- Transactions enforce a single project owner across all references. UI and Agent consumers use these repositories rather than separate mutations.
- ZIP parsing validates a versioned audio/music payload before writes. Local identifiers are remapped together; external task/clip identifiers remain inert provenance.
- Keep new creation unavailable until lifecycle and route tests pass. Roll back UI availability rather than deleting data.

## Dependency and compatibility

None. This child establishes the contracts consumed by all other children. Existing video, material and Agent contracts remain supported. Preserve user source media and project ownership; no destructive data rollback.
