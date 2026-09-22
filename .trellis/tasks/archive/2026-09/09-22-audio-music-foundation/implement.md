# Audio/Music Project Foundation: Implementation

Status: implementation complete; targeted foundation tests passed. Parent integrated verification is in progress.

## Dependency

None. This child establishes the contracts consumed by all other children.

## Ordered checklist

- [x] Trace all project-kind assumptions and establish legacy fixtures.
- [x] Add domain records, additive tables and checked repository operations.
- [x] Extend media retention/delete/import/export as one lifecycle change.
- [x] Wire kind-aware gallery and workspace dispatch with video-route guards.
- [x] Run targeted project/repository/package tests and typecheck, then record the verified foundation contract.

## Validation

Use the [parent gate/command plan](../09-22-apimart-audio-music/implement.md), with the explicit local pnpm path. Add meaningful tests for this child's listed acceptance behavior rather than implementation-mirroring assertions. Run focused tests and typecheck after changed code; use the integrated full gate at the final child.

- Legacy video records and old ZIP fixtures preserve navigation and episode behavior.
- Cross-project/chapter/source references and nonfinite/invalid timeline fields reject atomically.
- New project packages round-trip every referenced audio Blob, MIME, local relation and original provider identifier.
- Deleting a project cleans new owned records; retained library snapshots survive; importing a package never resumes paid work.
- Non-video routes cannot run film episode repair and video tools cannot mutate a non-video project.

## Risks and rollback

Affected ownership: src/domain/types.ts and new audio/music domain modules; src/db/database.ts, repo.ts and new repositories; src/lib/projectPackage.ts; project gallery, project routes and WorkspaceChrome. Validate legacy behavior at those boundaries. Stop on a failed invariant, keep saved originals, and revert code/availability rather than removing project data. Follow trellis-before-dev and trellis-check; curated JSONL context is required only if the selected workflow dispatches subagents.

## Implemented contract and evidence (2026-09-22)

- Dexie v23 adds the ten audio/music tables; `Project.kind` remains optional for legacy video records. `createAudioMusicProject` seeds a chapter/voice track or music draft without video episodes.
- `src/db/audio.ts` and `music.ts` expose scoped create/patch/delete operations, compare-and-swap revisions, immutable source media, and an atomic whole-chapter clip replacement for undo/redo. `audioGeneration.ts` supplies prepare/claim/patch and was handed to the parent runtime owner for integration.
- `audioProjectPackage.ts` adds version 1 allowlisted payloads, ID remapping, transaction validation, dormant imported jobs and source provenance. Backups reject missing audio files. Cleanup and orphan collection retain takes, works, exports and saved job results.
- Project gallery, index routing, chrome and settings distinguish video/audio/music. Video episode repair and timeline mutations reject non-video projects. Audio/music availability was enabled after the UI owner confirmed both workspace pages exist.
- Targeted command: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test tests/audioFoundation.test.ts tests/projectPackage.test.ts tests/repo.test.ts tests/materialLibrary.test.ts tests/materialIntegration.test.ts tests/productionProposals.test.ts` — 6 files, 81 tests passed.
- TypeScript passed after initial repository work. The final shared typecheck subsequently reported only the parent-owned Agent adapter's nullable patch conversion; parent is completing that integration. Browser interaction and live paid provider calls are outside this foundation evidence.

## Integrated delivery evidence

Implementation complete and in review. See [parent validation](../09-22-apimart-audio-music/validation.md) for the full automated/browser evidence and explicit live-provider/hardware limits. Final UI retains existing shadcn defaults. No Git commit/push or archive has been performed.
