# Reviewed take selection and timeline arrangement

## Goal and ownership
Deliver R4, R5 from [the initiative](../09-22-agent-creative-experience/prd.md).

## Scope
Provide independent batch selection and reviewed deterministic timeline placement using actual durations and trims. Repeated action avoids duplicates, preserves manual work and reports conflicts.

## Acceptance
Owns AC5, AC6, AC7, AC8, AC9; use the parent criteria verbatim as integration acceptance. Add specific fixtures and UI observations during child design, including negative and recovery cases. Do not mark done based on prompts or mock-model assertions alone.

## Dependencies
Depends on R2 evidence contract; can use existing takes without R3, then integrate with R3 saved results.

## Design decisions to resolve before implementation
Resolve ambiguous placements and ordering explicitly; do not silently replace human edits or infer duration from text. Preview actual target revisions; preserve source media and undo behavior.

## Constraints and status
Parent UX, authorization, evidence and compatibility constraints apply. Planning backlog; no implementation claimed. Detailed design, execution plan and curated context are required before activation. Existing related work is linked in the parent background, not counted as this child's completed acceptance.
