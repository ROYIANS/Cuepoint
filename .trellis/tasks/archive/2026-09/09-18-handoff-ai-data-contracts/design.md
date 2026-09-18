# Manual handoff and reviewed production changes

## Approval and boundary
User approved “ok提交，下一批” after batch-two review. Implement batch three now; do not repeat planning approval. This completes the manual handoff and local data contracts before remote AI execution. No connector calls, polling, rendering timeline, new dependency, or automatic provider completion writes.

## Deliverable 1: episode media handoff
A separate production ZIP (format cuepoint-handoff-v1) contains README.md, manifest.json, shots.csv, missing.md and shot folders with full readable metadata plus original selected first/last/clip result files. Preserve shot order via zero-padded directory sequence plus sanitized shot number and stable unique suffix. Each manifest row identifies project/episode/shot, asset links/names, manual status, expected slot/media IDs, actual exported file paths, and gaps. A still in clip is exported as a planning placeholder and reported as missing finished video. Broken/foreign/wrong-kind/zero-byte media are reported and never included. Optional last-frame absence is not a completion blocker but represented in slot state. Export originals only, no recompression/transcoding. Escape filenames/path traversal; duplicate labels/media cannot overwrite a path. Do not include connector/chat/extra fields.

Flush project drafts before a single readonly snapshot of project/episode/selected shots, referenced entities and media Blobs. Compress outside DB transaction. UI in Produce shows progress, summary of gaps, errors/retry and clear distinction from restore backup. Project mode film uses project name; series includes episode. Empty episode export is disabled/explicitly rejected. Tests read ZIP contents and ensure filenames/manifest paths match real file bytes.

## Deliverable 2: typed AI context and generation intent
Whitelist projection only. Build shot context from same-project project/world/episode/beat and related cast/scene/props/effective style, output defaults and local media metadata. Do not spread DB rows, extra, credentials, chat or unrelated entities. Include source IDs + deterministic revision tokens based on canonical content; media metadata includes byte size/MIME/local IDs, never Blob/object URL. Missing links generate warnings, foreign records never appear. Inherited/default vs explicit style and authored timing are explicit.

GenerationTarget discriminates shot, character, scene, prop and style with legal slot literal unions and projectId (shot also episodeId). Revision is checked against current entity content, not coarse updatedAt timestamps (shots lack them). GenerationIntent records ID/target/baseRevision/context source revisions/provider/model/common parameters/explicit media role inputs, status, provider task ID and provenance with no credentials. Type contracts plus validation/state transitions cover prepared→submitted→running→succeeded/failed/cancelled; no remote executor is added. Completion may prepare a pending proposal only for successful validated output; it never changes a slot automatically. Source revisions remain available for later dependency conflict policy.

## Deliverable 3: persistent reviewed proposals
New Dexie v7 productionProposals table with id/projectId/episodeId/status/createdAt indexes; local workflow history is excluded from restore ZIP/handoff because IDs and revision tokens are tied to current DB. Persistent rows survive SPA reload/offline reopening; no background AI task processing yet. Project deletion removes its proposal rows. Proposal mutation logic in dedicated src/db/productionProposals.ts (repository layer) uses existing repo patch helpers within a transaction; components never write tables directly.

Supported changes this batch: shot content/notes/duration (whitelisted patch) and media result attachment for any supported target slot. Source is manual or generation provenance. Each proposal stores before/after review data, exact base target revision, proposed local media ID/kind, status pending/applied/cancelled/undone, timestamps and appliedRevision for conditional undo. create captures current baseline (or checks supplied expected revision from generation). apply atomically validates ID/owner/target/slot/media, base revision and status, then writes proposal+entity. Repeated apply returns same completed row, never reexecutes; cancelled/undone do not apply again. Undo only restores affected fields/result when current target still matches appliedRevision; refuses to overwrite newer manual edits. Repeated undo is idempotent. Cancel is explicit; conflicts remain pending and user can cancel then create a fresh proposal after reviewing current data.

Media proposals must retain before/after media while pending/applied to support apply/undo. Orphan checks treat relevant proposal media IDs as references; cancelled/undone history needs explicit lifecycle cleanup policy (safe retention preferred this batch over data loss). Project deletion remains final cascade. No unreviewed or failed/partial generation output gets attached. Failed proposal apply leaves row and data unchanged for retry.

UI in Produce: “变更提案” panel with shot selector, manual text proposal form and same-owner result media proposal option, readable current→proposed preview, pending/applied/history list, apply/cancel/undo and visible conflicts. Explain manual preview is usable now; AI may supply the same proposals later. Do not present fake AI responses or a nonfunctional generate button. Wait pending actions before close; errors preserve form/proposal. No raw revision tokens in normal UI.

## Ownership and compatibility
- Handoff worker owns src/lib/productionHandoff.ts and tests.
- Context worker owns src/lib/productionContext.ts, src/lib/productionRevision.ts, src/lib/generationIntent.ts and tests.
- Root owns src/db/productionProposals.ts, database.ts v7, repo.ts proposal reference/delete integration and tests; coordinate shared types.
- Root creates shared domain/production.ts contract first, also owns ProducePage UI + new production components/docs/browser integration.
Existing domain entity schema unchanged; additive table migration. Old backup remains supported. Existing manual status/timing/slot editing semantics retained except now referenced proposal media cannot be prematurely removed.

## User-requested header repair
Explicit row/column positions prevent project actions occupying the title grid cell. Verify desktop and narrow layouts. Shot table header and row boundaries were measured equal; no table sizing change required.
