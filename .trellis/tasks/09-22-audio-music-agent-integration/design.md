# Audio/Music Agent Integration and Release: Design

The [parent design](../09-22-apimart-audio-music/design.md) is authoritative for cross-child contracts. This document identifies this child's concrete implementation boundaries.

## Owned modules

src/lib/agent/audioTools.ts, musicTools.ts, skills.ts, tools.ts, toolLoading.ts, projectContext.ts; generation review components/adapters; project-scope guards; targeted regression tests and specs.

## Design decisions

- Follow parent design section 7 and existing agent-tools/project-context/creative-skills contracts. Do not fork a second audio state store.
- Keep business mutations atomic under existing ledger completion and expected revisions. If shared repository transactions need adaptation, preserve the existing atomic tool contract explicitly.
- Generation review freezes target/source settings; UI overrides are stored separately from immutable Chat/Responses calls and disclosed in tool results.
- Tools may organize existing audio and prepare exports, but cannot activate a mic, invoke a local file picker or claim acoustic understanding from metadata.
- Project snapshots are bounded by kind with coverage counts; details are fetched on demand. Existing video tool operations reject wrong kinds.
- Run one integrated regression gate after the final code changes, then update executable specs and finish-work records without introducing an automatic deployment.

## Dependency and compatibility

Audio and Music children complete with stable shared repository/generation contracts. Existing video, material and Agent contracts remain supported. Preserve user source media and project ownership; no destructive data rollback.
