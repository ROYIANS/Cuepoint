# Implementation Plan

Status: awaiting final planning approval. This parent owns coordination and integrated acceptance; activate the appropriate child only after the final review gate.

## Sequence and ownership

1. **Foundation** — 09-22-audio-music-foundation.
   Add typed project dispatch, durable entities, checked repositories, media retention and package transfer. Audit kind guards before enabling new creation.
2. **Audio production** — 09-22-audio-production-workspace.
   Implement manual import/recording, scripts/takes, waveform timeline, shared schedule, WAV export and APIMart TTS. Establish shared job/recovery boundaries here.
3. **Music creation** — 09-22-music-creation-workspace.
   Implement Flow Music/Suno transport, query/result handling, durable downloads and the works/player UI.
4. **Agent integration and integrated release** — 09-22-audio-music-agent-integration.
   Expose the shared operations, project context and generation review; finish cross-project material reuse and final browser/regression evidence.

These are sequential checkpoints, not authorization to finish after a partial feature. Do not spawn agents solely because child tasks exist. The configured execution workflow determines inline versus explicitly requested delegation.

## Required context before edits

Use trellis-before-dev. Read the relevant frontend spec indexes and targeted docs: directory-structure, component-guidelines, state-management, hook-guidelines, type-safety, quality-guidelines, ai-connectors, ip-material-library, production-contracts, agent-tools, agent-project-context, agent-creative-skills and agent-library-tools. UI follows the parent design contract and frontend-design skill. Do not run package installation unless required by an identified dependency.

## Gates

### Foundation
- Legacy video project/ZIP behavior, routes and Agent business writes remain intact.
- New kind ownership and wrong-kind guards tested at repo and route entry boundaries.
- All new media references participate in save/cleanup/backup/import/delete.
- Non-video records cannot trigger episode repair.
- Import is atomic with complete ID remapping, MIME restoration and no credentials/live submission claims.

### Audio
- Synthetic audio fixtures verify trims, overlaps, seek offsets, gains, fades, mute/solo, split and WAV headers/sample output.
- Repository tests verify take preservation, CAS edits/undo, chapter ownership and export revision capture.
- Browser checks exercise decode and actual Web Audio rendering; mocked recorder tests alone do not establish playback/export correctness.
- Recorder verifies denied permission, unsupported MIME, device end, late final data, cleanup and usable keep/discard.
- A manual no-key/no-Agent scenario creates a complete mixed audio artifact.
- TTS fixture tests cover documented bounds, binary vs JSON errors, uncertain outcomes and duplicate claims.

### Music
- Exact Flow/Suno wire contracts, mode-dependent fields, all result counts, Unicode limits and duration normalization.
- Recovery for known tasks versus uncertain submissions; one local intent produces at most one submit.
- Remote-completed/download-failed remains recoverable without regeneration.
- Original source IDs/indexes survive view sorting, rename, favorites and package transfer.

### Agent and release
- All permission modes, immutable reviews, stale source/project/connector/run guards and exactly-one local execution.
- Manual edits during Agent work cannot be overwritten through stale previews.
- Tool group loading respects offered-tool snapshots and budget.
- Deleting chat does not remove shared work; deleting project blocks late tool/job writes.
- Desktop and narrow keyboard interactions, player coordination, draft flush, meaningful errors and project navigation.
- Full quality gate plus documented evidence and remaining live-provider limitations.

## Commands

Always use the user's local pnpm executable. Do not use bundled or bare pnpm.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:verify
```

Run focused meaningful tests during each child, then the full gate for integrated changes. Repeat only after changed code, failures or unresolved concerns. No tests are necessary for these planning-only document edits.

## High-risk files and rollback

- src/domain/types.ts, src/db/database.ts, src/db/repo.ts: additive kind/schema and lifecycle changes.
- src/routes/p.$projectId.tsx, p.$projectId.index.tsx, WorkspaceChrome: video route assumptions and repair effects.
- src/lib/projectPackage.ts: version-aware validation, remapping and media MIME.
- src/lib/agent/tools.ts, skills.ts, projectContext.ts and review/runtime boundaries: permissions, offered groups and effect/revision integrity.
- src/lib/ai/apimart.ts: preserve existing media-specific contracts when extracting shared transport.

Retain original Blobs and legacy defaults. Roll back UI availability or code, not user data. Never remove tables, sources or completed works to recover from a failed rollout.

## Before child activation

- Latest parent final summary approved in a subsequent user message.
- Child prd/design/implement files read; dependencies satisfied.
- Re-read git state and active workflow, then task.py start for that child.
- If dispatch workflow is selected, curate real spec/research entries in implement.jsonl and check.jsonl first; inline workflow loads context via trellis-before-dev.
- Material product-scope changes go back to parent review; routine implementation details remain autonomous.

## Completion

Use trellis-check and required project finish workflow; update relevant executable specs for new contracts and retain validation evidence. Report completed behavior, test evidence and actual provider/browser limitations. Follow existing authorization for commits/pushes; do not publish or deploy merely because implementation is complete.


## Follow-up: Agent project creation and music UX (2026-09-22)

User requests filling Agent audio/music project creation and simplifying the music workspace against their Suno screenshot. Implementation authorized; preserve existing shadcn defaults and APIMart-only capabilities.

Behavior gaps: project_create is video-only and must create the requested kind with correct seeded records and no video-only arguments for audio/music. Preserve frozen project scope: creation must not silently rebind an existing conversation. Expose a concrete continuation path to the created project. Music currently stacks engine/mode/title/lyrics/settings/connection forms and permanently reserves empty details.

Change boundary: Agent business tool schema/creation repository call, its capability/preview/result and project-picker affordance if needed; MusicWorkspacePage and extracted creation/details/list CSS; existing shared player may gain queue navigation through optional callbacks. No provider/schema migration, new arrangement features, mock artwork or paid live calls. Root owns shared player and validation; workers own Agent and music UI separately.

UI contract: compact Simple/Custom switch and engine/model selection; Simple starts with one useful idea input. Custom exposes lyrics/style, optional controls collapsed. Draft selection compact; generation control remains reachable. Main area is works/search/filter with inline pending jobs, no permanent empty detail panel. Selecting details opens contextual aside/Sheet. Persistent player supports useful previous/next if available; independent active playback vs detail selection. Narrow switches creation/works and opens details Sheet without losing edits. Preserve engine/mode drafts and never reinterpret a description as lyrics on a mode switch. Only documented APIMart controls.

Sources: user screenshot; https://help.suno.com/en/articles/2462273 (Simple description), https://help.suno.com/en/articles/2415873 (Custom lyrics). Adopt information hierarchy, not every Suno parameter.

Validation: project_create legacy/new kinds/schema/atomic replay/scope tests; music mode/persistence tests; lint/full test/build; real desktop and 390px browser validation, no paid POSTs.
