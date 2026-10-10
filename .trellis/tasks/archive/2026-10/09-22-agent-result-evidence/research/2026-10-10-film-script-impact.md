# Film script change-impact receipt — 2026-10-10

## Authorized boundary

The user authorized completing and accepting all existing task criteria. R2 PRD and film-feedback explicitly require source-range invalidations and committed side effects. This increment exposes the already implemented normalization effect of `episode_update`; it does not synchronize beat/shot prose or rearrange shots.

## Contract

Add a bounded code-owned `scriptImpact` to the existing successful `episode_update` result, only when `patch.script` is present. Produce it inside the same `executeAtomicTool` transaction as the mutation, saved tool result and ordinary write receipt. Capture the normalized before story, update through `updateEpisodeDraft`, then compare the persisted normalized after story. A beat range is invalidated only when it was actually valid before and is absent after; do not infer from word counts or strings in a model response. Keep beat IDs, contents and all shots unchanged.

Suggested version 1 fields: `ownerId`, `episodeId`, `invalidatedBeatRangeIds`, `invalidatedBeatRangeCount`, `omittedBeatRangeIds`, `retainedShotIds`, `retainedShotCount`, `omittedShotIds`, and an explicit `semanticSynchronization: "not_performed"`. Cap each displayed ID array at 40, use deterministic order, and disclose exact totals/omissions. Shots must be filtered by actual project and episode. No full shot records, media or raw script is needed in this impact.

The usual bounded row/receipt stays present. Preview should disclose that a script update can invalidate source ranges while preserving existing beats/shots. Replays return the exact persisted historical impact; a later manual edit must not replace its evidence. Result serialization or ledger persistence failure rolls back both script and impact. Changes of title/logline alone have no script impact claim.

## Verification

Real repository/Agent fixture with two valid ranges: one excerpt remains valid, one becomes invalid; include a beat without a range and a preexisting malformed range to ensure neither is counted. Add shots in this episode and another episode/project, verify only scoped IDs are listed and all shot records/revisions remain byte-identical. Test unchanged script, title-only patch, 41+ ranges/shots bounded coverage, result/ledger rollback, stale preview, and exact saved replay. Existing film tool output/protocol tests remain required.

## Sources

- `src/domain/types.ts:normalizeEpisodeStory`: removes mismatching ranges, preserves beat content.
- `src/db/episodes.ts:updateEpisodeDraft`: normalizes and persists inside Dexie.
- `src/lib/agent/businessTools.ts:episode_update`: current atomic write adapter.
- `src/lib/agent/businessWriteReceipt.ts`: bounded result enrichment, rollback on overflow.
