# Reference intake design

## Boundaries and data model
Use the existing project media store for immutable bytes, with a separate project reference aggregate and chunk table rather than stuffing document text into MediaRecord. A reference owns projectId, mediaId, digest, type, display filename, extraction revision, state, warnings and coverage. Chunks carry referenceId/revision, stable order and real source locators. Message attachments and run audits hold lightweight immutable descriptors; they do not repeatedly persist base64 data or full library contents.

Suggested states: importing, parsing, ready, partial, failed and unavailable. Recovery distinguishes interrupted local parsing from already persisted ready data. Hash/read/decode/worker operations happen outside Dexie transactions. Short transactions revalidate project existence and source revision before atomic writes; no native asynchronous entity lookup loops inside transactions. Use a per-import operation identity so cancelled or superseded parser results cannot revive deleted records.

## Import and extraction
1. Validate owner, extension, detected content signature, size and selection count.
2. Read/hash outside the transaction; look up duplicates within the project and reuse an immutable source when appropriate.
3. Persist source and processing record, then dispatch bounded local parsing work.
4. PDF.js runs using locally bundled worker assets and emits page-indexed text; empty pages are recorded, not silently skipped. Release document resources on success, failure and cancellation.
5. Mammoth browser raw-text extraction accepts ArrayBuffer and emits extracted paragraph locators. Do not use its unsanitized HTML conversion. Preview plain text; embedded images/layout are not claimed as processed. Preflight DOCX ZIP contents and uncompressed sizes, cap actual output and worker lifetime, and never dereference external relationships.
6. Decode TXT/MD as UTF-8 or BOM-marked UTF-16; report invalid/unsupported encodings instead of silently replacing an entire file with corrupted text.
7. Persist bounded chunks, per-page/paragraph coverage and parser diagnostics. A worker failure is retryable and isolated from chat. Interrupted parsing may resume locally with explicit state; it never sends a model request.

Use lazy parser imports so the ordinary chat bundle does not eagerly absorb PDF/DOCX libraries. Verify installed package versions/licenses and browser worker bundling before selecting pinned dependency versions. Existing LobeHub Node loaders are architectural references, not drop-in browser modules.

## Request construction and on-demand reading
Extend canonical request content with typed text/image-reference parts while preserving tool-call pairing and Responses continuation items. Resolve media descriptors to provider payloads immediately before dispatch outside transactions. Keep resolved bytes ephemeral; audit stable identity, revision, exact text/chunk ranges and selected image identity, not duplicate base64 blobs.

Resolve image capability from explicit connector metadata and verified model-bank fields. The existing compact bank lookup contains limits only; deriving a vision index must preserve snapshot data and provenance. Do not infer support from a model-name substring. Unknown or unsupported capability gives a switch-model/remove-image action; never send a filename as a substitute for image input. Revalidate provider contracts with official documentation and captured mocked payloads during implementation.

Compute document allowance inside the existing shared context budget after system/tools/project facts/memory/output reserve. A selected long document contributes bounded text plus a source manifest and an honest coverage indication; smart-mode read tools can retrieve more chunks. In chat-only mode, display omitted coverage and do not promise automatic further reading. Image cost is explicitly an estimate with conservative limits when model-specific accounting is unavailable. Avoid measuring encoded image bytes as prose.

Add bounded project-reference search/read tools to the existing frozen skill/permission mechanism. Search returns source descriptors, locators and short excerpts; read accepts validated source IDs/revisions/ranges. Both enforce the run's project, availability and result limits at execution time. Reference text is delimited untrusted source material. A successful parse or tool read is not evidence that an AI conclusion is verified.

Compaction retains source/version locators and summarized coverage. Retry and continuation use the frozen selected set and immutable content revisions; a new project import does not change that set. Deleted/unavailable sources cannot be silently revived from old prepared envelopes; require explicit repair/new preparation and show any historical text already stored in a transcript as historical content.

## Interaction design
Use the existing searchable plus-menu for Import files and Project references. Project references opens a searchable flat list with type icon, name and processing state, plus a compact source inspector. Composer chips appear only with actual attachments and allow preview/removal; importing without a selected project first invokes the existing project selector and preserves the draft. No nested bordered cards. Selection, cancel and outside-click restore focus correctly.

The source inspector shows an image preview or extracted text with source locators, processing warnings and request coverage. Avoid a promise of exact DOCX pagination. Use the existing task evidence navigation for reference links rather than inventing a second task viewer. Request audit distinguishes selected references from later tool-read references.

## Lifecycle and transfer
Draft removal is detachment. Library removal withdraws the source from new use and marks references unavailable; original bytes are collected only when no other retained business/media owner requires them. Historical message excerpts may remain in the transcript and must not be described as erased. Running generation jobs retain media according to existing job contracts. Thread deletion removes message ownership but preserves library ownership. Project deletion cascades new records; active run restrictions still apply.

Extend media retention, deletion, project ZIP validation/export/import and any source remapping together. Validate all imported owner relationships and chunk revisions before committing. No old-data backfill; a schema addition is still necessary for new tables. Replacing a document creates a new immutable version/source rather than mutating the evidence behind old citations.

## Risks and rollback
PDF text ordering, mixed scanned pages, DOCX layout loss and limited browser resources are visible extraction limitations. Failed imports must leave removable/retryable records, not block the project. Parser dependencies and request wire changes are separate implementation checkpoints. Roll back UI exposure if needed without rewriting source bytes or silently deleting valid project data. No external upload occurs until an authorized send/tool request; ordinary import remains local.

## Native read-image tool
Provide a scoped read-image tool resolving project media IDs from uploads or generation outputs. Persist lightweight image descriptors in tool results and append protocol-valid user image input for the same selected model after the paired tool result. No hidden model switch or extra vision service. Revalidate ownership/availability and capability before dispatch. Keep descriptors durable, pixel payloads ephemeral, and avoid replaying already completed tool calls during continuation.
