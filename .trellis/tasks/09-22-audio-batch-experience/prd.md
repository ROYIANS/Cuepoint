# Reviewed batch voice production

## Goal and ownership
Deliver R3, R5 from [the initiative](../09-22-agent-creative-experience/prd.md).

## Scope
Prepare a concrete set of segments and voice settings, confirm as one batch, persist per-item status and present aggregate progress with expandable failures. Reload and retry retain saved work and submission identity.

## Acceptance
Owns AC4, AC6, AC7, AC8, AC9; use the parent criteria verbatim as integration acceptance. Add specific fixtures and UI observations during child design, including negative and recovery cases. Do not mark done based on prompts or mock-model assertions alone.

## Dependencies
Depends on R2 evidence contract and R1 approval/stop semantics.

## Design decisions to resolve before implementation
Specify target/version policy, batch limit/concurrency and cancellation behavior in detailed planning. No model confirm flag, auto replay, or fabricated provider bulk endpoint. Existing saved outputs survive failures.

## Constraints and status
Parent UX, authorization, evidence and compatibility constraints apply. Planning backlog; no implementation claimed. Detailed design, execution plan and curated context are required before activation. Existing related work is linked in the parent background, not counted as this child's completed acceptance.
