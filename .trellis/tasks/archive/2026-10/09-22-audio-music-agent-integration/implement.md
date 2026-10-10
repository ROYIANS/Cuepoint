# Audio/Music Agent Integration and Release: Implementation

Status: implementation and final integrated acceptance complete on 2026-10-10. The following ordered plan is retained as history; the source requirements are checked against [final acceptance](../09-22-apimart-audio-music/validation/2026-10-10-final-acceptance.md).

## Dependency

Audio and Music children complete with stable shared repository/generation contracts.

## Ordered checklist

- [x] Add project-kind context and compact audio/music skill groups with scope validation tests.
- [x] Add script/draft/clip/take/work tools over the shared repositories.
- [x] Extend reviewed generation UI/adapters and durable execution; test all permission modes and races.
- [x] Wire artifact navigation/export preparation and verify no device capture is agent-triggered.
- [x] Run integrated manual/Agent and audio/music material workflows in browser.
- [x] Run full quality gate, update specs, record evidence and report actual limitations.

## Validation

Use the [parent gate/command plan](../09-22-apimart-audio-music/implement.md), with the explicit local pnpm path. Add meaningful tests for this child's listed acceptance behavior rather than implementation-mirroring assertions. Run focused tests and typecheck after changed code; use the integrated full gate at the final child.

- Context accurately reflects audio/music records without inventing video episodes or including credentials/raw blobs.
- Wrong-project targets, stale revisions, deleted projects and connector destination changes block effects.
- All Agent permission modes still require generation review; approved execution claims once and preserves original model call envelopes.
- Manual and Agent generation produce the same job/source/work representation. Manual edits during review invalidate stale actions.
- Deleting chat preserves project works; deleting project blocks late generation/application while retaining historical read-only chat behavior.
- Loaded groups fit the 36-tool budget and tools are callable only after being offered for that request.
- Full typecheck/tests/build/model snapshot verification pass; evidence distinguishes mocked provider checks from live results.

## Risks and rollback

Affected ownership: src/lib/agent/audioTools.ts, musicTools.ts, skills.ts, tools.ts, toolLoading.ts, projectContext.ts; generation review components/adapters; project-scope guards; targeted regression tests and specs. Validate legacy behavior at those boundaries. Stop on a failed invariant, keep saved originals, and revert code/availability rather than removing project data. Follow trellis-before-dev and trellis-check; curated JSONL context is required only if the selected workflow dispatches subagents.

## Integrated delivery evidence

Implementation complete. Historical [parent validation](../09-22-apimart-audio-music/validation.md) remains preserved; current [final acceptance](../09-22-apimart-audio-music/validation/2026-10-10-final-acceptance.md) closes its specific live-provider/hardware/visual gaps. Final UI retains existing shadcn defaults. Root coordinates work commits and archive after verification; this record makes no deployment claim.
