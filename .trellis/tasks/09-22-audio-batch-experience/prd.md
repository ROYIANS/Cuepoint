# Reviewed batch voice production

## Current delivery status — 2026-10-10
Implemented and accepted for the approved R3/R5 scope, with independent review, integrated quality/test/typecheck/build/model-bank gates, native mixed-result/reload/retry evidence and an explicitly confirmed real MiMo saved/playback sample. Ready for the parent session's archive workflow; this PRD does not change `task.json`, commit or archive. See [final acceptance](validation/2026-10-10-final-acceptance.md) and [native evidence](acceptance/2026-10-10-native-acceptance.md).

## Goal and ownership
Deliver R3, R5 from [the initiative](../09-22-agent-creative-experience/prd.md).

## Scope
Prepare a concrete set of segments and voice settings, confirm as one batch, persist per-item status and present aggregate progress with expandable failures. Reload and retry retain saved work and submission identity.

## Acceptance
Owns AC4, AC6, AC7, AC8, AC9; the parent criteria are reproduced verbatim with evidence and detection limits in [final acceptance](validation/2026-10-10-final-acceptance.md). Automated protocol/repository negatives, normal native UI/HTTP/export evidence and a small real-model/provider sample support this delivery; prompt or mock-model assertions alone do not establish acceptance.

## Dependencies
Depends on R2 evidence contract and R1 approval/stop semantics.

## Approved implementation boundary
The user-approved design is delivered: one project/chapter, 1–20 exact segments, at most two concurrent requests, one concrete whole-batch confirmation, durable per-item progress and explicit failed-only new drafts requiring renewed confirmation. Pause/Stop stops future sends and preserves accepted or uncertain identities; reload/import never automatically issues a paid POST. The actual individual provider adapters remain in use. Existing saved outputs survive failures, and model confirm flags cannot grant permission. See [design](design.md), [implementation record](validation/2026-10-10-implementation.md) and [independent review](validation/2026-10-10-independent-review.md).

## Constraints and status
Parent UX, authorization, evidence and compatibility constraints apply. On 2026-10-10 the user authorized completing this existing backlog task and replied “批准，按这套设计实现” to the R3/R4 design. Implementation and the required acceptance are now complete for this scope. The eleven-item fault/recovery scenario is a controlled loopback test; the real-model draft preparation and one real MiMo request are separately recorded. Metadata and playback startup do not certify pronunciation, timbre or listening quality, and the samples do not cover every provider/device. Historical design/research and earlier handoff limitations retain their original date and are superseded for current status by final acceptance.
