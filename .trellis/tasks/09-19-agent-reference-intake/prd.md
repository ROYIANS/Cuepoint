# Reference attachments and document intake

Status: scoped planning backlog; detailed design and final review are deferred until this child is reached.

## Goal
Let users work from actual reference images and script/documents with traceable source coverage.

## Ordering
Start after 09-19-agent-memory-retrieval is accepted. Parent: 09-19-agent-workflow-memory. This dependency is documented; parent-child links alone do not enforce it.

## Requirements
- R1: Provide searchable plus-menu attachment entry and actual supported file selection.
- R2: Persist attachment ownership and extraction state; distinguish source bytes, extracted text and AI interpretation.
- R3: Link references into task evidence and generation inputs where adapter support is verified.
- R4: Treat instructions inside reference content as untrusted document data; avoid silent network upload or unsupported format claims.

## Acceptance
- AC1: An accepted reference can be attached, read and cited with visible extraction coverage.
- AC2: Unsupported files and failed parsing show actionable errors and do not claim success.
- AC3: Deletion and duplicate attachment handling preserve existing media references.

## Decisions before implementation
- First supported file types, size limits and image/document parsing dependencies.
- Which model sees attachment bytes versus extracted text and how upload is explained.

## Boundaries
Follow parent provenance, user-control, pure-frontend and visual-quality contracts. No implementation or design-finality is implied by creating this backlog. Research actual source/contracts when reached and keep later-child behavior out of this child.
