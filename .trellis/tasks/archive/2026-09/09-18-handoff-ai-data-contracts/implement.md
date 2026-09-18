# Execution plan

User approved batch-three execution on 2026-09-18 after second-batch commit.

1. Write shared target/proposal/intent types; implement independent handoff exporter, context/revision/intent helpers and proposal repository concurrently with bounded ownership.
2. Wire production ZIP progress/error UI and manual proposal preview/apply/cancel/undo workflow; ensure no AI calls or fabricated outputs.
3. Cover ZIP roundtrip inspection, owner/slot validation, revision conflicts, deleted targets, idempotent retry/undo, generation failure/state transitions, media retention and DB migration.
4. Run independent full-scope check and lint/test/build; browser create→proposal preview→apply→undo/cancel/conflict, handoff export and readable output, narrow viewport.
5. Update executable specs and verification. Prepare commit proposal; keep third-batch code uncommitted until applicable confirmation.

Boundary: no timeline rendering, remote AI submission/polling, online sharing, or durable download manager. ZIP processing stays in memory; large media can exhaust browser memory and must fail visibly without altering source data.
