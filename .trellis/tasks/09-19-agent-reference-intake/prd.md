# Reference attachments and document intake

Status: implementation approved by user on 2026-09-19, including native selected-model image reading.
Parent: 09-19-agent-workflow-memory. Prerequisite: memory retrieval, now committed and archived.

## Goal
Let users bring reference images and scripts into a project, work from them in conversation, reuse them across project conversations, and inspect exactly which source material the AI received or read.

## Confirmed decisions
- User selected images, TXT/Markdown, text-based PDF and DOCX together for the first release.
- User selected project-shared storage with on-demand reading across conversations. Only explicitly attached references automatically participate in the current request; the entire library is never automatically injected.
- Existing project ownership, reviewed generation, permission controls and Trellis-style source/summary/memory separation remain authoritative.
- No legacy-data compatibility or backfill work is required during development.

## Foundation at planning time
- Composer plus menu has memory, parameters and skills, but no actual attachment entry (`src/components/agent/AgentControls.tsx`).
- Chat messages and canonical request messages currently contain plain strings (`src/domain/types.ts:536`, `src/domain/agent.ts:26`); Responses conversion is also text-only (`src/lib/ai/responsesStream.ts:24`). Both transports need actual image support.
- Project media blobs already exist (`src/domain/types.ts:350`), but reference ownership must be incorporated into media retention and deletion (`src/db/repo.ts:547`, `src/db/repo.ts:589`).
- No PDF or DOCX parser dependency is installed. LobeHub uses PDF.js text extraction and Mammoth raw-text extraction in Node loaders; browser integration must be implemented for this frontend. Evidence: research/intake-foundation.md.

## Requirements
- R1 — Attachment UX: searchable plus-menu entries for importing files and selecting existing project references; support drag/drop and image paste without breaking ordinary text paste. Show compact attachment chips, progress, errors, retry and removal. Keep flat menus, keyboard navigation, outside-click dismissal and narrow-screen usability. No attachments means no empty strip.
- R2 — Durable sources: persist project owner, immutable source identity/digest, original bytes, filename/type/size, extraction state and versioned chunks. Same-project duplicates reuse source bytes. Different project ownership is never inferred from matching bytes. Separate original material, extracted text and AI interpretation.
- R3 — Actual use and provenance: selected images reach a supported vision model; selected documents contribute bounded extracted text with source locators and visible coverage. AI can search/read other available references only inside the current project. Task evidence can link those sources; image media can be selected for existing reviewed generation inputs only when that adapter supports them. Referencing a file never triggers a paid generation job.
- R4 — Trust and disclosure: document instructions are data, never system instructions or permission grants. Local import/parse causes no provider upload. The attachment UI explains that sending shares selected images or extracted text with the chosen model. Do not render imported HTML or follow embedded links automatically. Unsupported formats/capabilities must produce clear recovery, not silent omission.
- R5 — Request integrity: adapt Chat Completions and Responses, request audits, retries, continuation and context compression together. Preserve immutable source/version locators and disclose omitted pages/chunks. Do not count base64 characters as text tokens or pretend image-token estimates are exact. New unselected files do not enter requests merely because they share the project.
- R6 — Lifecycle: removing a draft chip only detaches it. Removing a project reference withdraws it from new search/read/requests and leaves historical source descriptors marked unavailable. Shared media still owned by other business entities/jobs must survive. Deleting a conversation does not delete shared project references. Project export/import and project deletion cover the new records without orphaned or cross-project links.

## Initial engineering limits
Centralize these proposed safeguards and show them before/at selection: JPEG/PNG/WebP up to 10 MiB each; TXT/MD up to 5 MiB; PDF/DOCX up to 20 MiB; up to 10 files in one selection. UTF-8 and BOM-marked UTF-16 text supported. Parse at most 300 PDF pages or 1,000,000 extracted characters per document; oversized/partial documents have explicit coverage and cannot be reported fully read. Enforce separate decompression and worker resource limits. Provider-specific stricter limits win. These are application safeguards, not claimed provider limits; calibrate through fixtures before release.

## Acceptance criteria
- AC1 (R1-R3): import each supported format, inspect preview/coverage, send it, and observe actual selected image/text content in mocked payloads for both protocols. Citations open the correct image, PDF page, text lines or extracted DOCX paragraph.
- AC2 (R1,R2,R4): unsupported, corrupt, password-protected and scan-only files have actionable states; mixed PDF pages disclose which pages lack extractable text. Cancelling/retrying/reloading parsing creates no duplicate imports or submissions. Empty documents are distinct from parse failures.
- AC3 (R2,R3,R5): a second conversation in the same project can search and read the reference; an unrelated project cannot. Unselected library contents are absent from initial requests. Chat-only mode does not gain search/read tools.
- AC4 (R3,R5): long documents show partial request coverage; tool reads are bounded and cited. Compaction/retry/resume retain source identity and valid protocol envelopes without replaying uploads or generation. Missing sources block affected new dispatch rather than silently disappearing.
- AC5 (R2,R6): duplicate files, draft removal, library removal, thread deletion, project deletion and ZIP round-trip preserve intended ownership and unrelated generation/business media. Deleted references cannot re-enter fresh requests through stale tool results or prepared drafts.
- AC6 (R1-R6): targeted unit/integration tests, lint/build and real-browser UI/protocol validation pass; specs and retrospective record the learned contracts. Browser tests use mocked providers and incur no paid calls.

## Out of scope
OCR/scanned PDF interpretation, audio/video parsing, legacy DOC, spreadsheets/slides, web crawling, provider-hosted file stores, vector databases, cloud sync, automatic promotion into long-term memory, and the later batch-generation workflow. DOCX is a text source, not a faithful page-layout preview; PDF reading order/layout may be imperfect and is exposed as extracted text.

## Planning readiness
No unresolved product question blocks this scope. Dependency versions, worker packaging, provider capability verification and transport wire fixtures are implementation checks with fail-closed behavior; they cannot silently broaden scope. Design, ordered implementation plan and curated manifests accompany this PRD. The user approved implementation and the native selected-model image-reading addition on 2026-09-19. Implementation and integration validation are now complete; final quality checks and commit preparation follow.

## Approved image-reading addition
The user explicitly requested a read-image tool using the currently selected model's own vision capability. It must support both uploaded and generated project images, enforce project ownership, and deliver actual pixels to the next request of that same model (not a separate hidden vision model). Unsupported models must produce an actionable switch-model response. Image filenames/metadata alone are not successful image reading. Validate both protocols and generated-image reuse. User approved implementation together with this addition.
