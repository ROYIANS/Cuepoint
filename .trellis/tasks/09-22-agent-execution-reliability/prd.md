# Reliable execution and stop reasons

## Goal and ownership
Deliver R1, R5 from [the initiative](../09-22-agent-creative-experience/prd.md).

## Scope
Build on pending tool readiness changes and inspect request/response/ledger evidence. Remove redundant start prompts; distinguish a finished response from verified work. Preserve advice-only intent and genuine approval/input/Stop/budget boundaries.

## Acceptance
Owns AC1, AC2, AC6, AC7, AC9; use the parent criteria verbatim as integration acceptance. Add specific fixtures and UI observations during child design, including negative and recovery cases. Do not mark done based on prompts or mock-model assertions alone.

## Dependencies
No dependency on later children; coordinate stop/outcome semantics with R2.

## Film feedback follow-up
Use [the source-checked film review](../09-22-agent-creative-experience/film-feedback.md) when designing the next iteration: seamless project creation-to-editing continuation, authoritative contextual ownership defaults, and structured recovery with effect certainty. Preserve immutable historical run scope and approval semantics; explicitly resolve how a new project's conversation continues before implementation. Missing owner defaults must never silently correct a conflicting supplied ID or guess an ambiguous episode. These are planned additions, not features of the first delivery.

## Design and evidence boundary
Existing source evidence does not establish whether the screenshot response contained hidden tool calls. First obtain or reproduce that trace without paid side effects. Any stronger no-call continuation policy must be bounded and reviewed, not keyword-driven.

## Constraints and status
Parent UX, authorization, evidence and compatibility constraints apply. Implementation authorized by the user on 2026-09-22. Detailed design and execution plan are now present. Runtime-only presentation is not semantic outcome verification; live acceptance remains required. Existing related work is linked in the parent background, not counted as this child's completed acceptance.

## Current delivery acceptance: create and continue
A clean projectless smart conversation requesting creation plus editing creates its video/audio/music project, retains the same user goal and run, and invokes the next scoped tool without an extra user message. Create-only remains explicit. Atomic rollback/replay and source provenance, frozen original requests, current-scope validation, approvals and Stop must all hold. Existing cross-scope references or prior foreign effects block automatic binding before creation, with an explicit create-only recovery path. This is one bounded part of R1; no-call semantic continuation and real-model obedience remain separate acceptance.
