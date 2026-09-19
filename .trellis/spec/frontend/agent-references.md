# Project reference intake and native image reading

## 1. Scope / Trigger
Read before changing attachments, project reference libraries, PDF/DOCX parsing,
vision inputs, source citations, project media retention or ZIP transfer. Reference
material is original evidence, not automatically accepted business fact or memory.

## 2. Signatures
- Dexie v17 adds `projectReferences` and `referenceChunks`; bytes remain in `media`.
- `ReferenceAttachment = { referenceId, revision }`; immutable source identities
  belong to one project. `ProjectReference` records digest, mediaId, type, status,
  operationId, extraction coverage and warnings. Chunks retain real page/line/paragraph locators.
- `importReferenceFile(projectId,file,{signal?,onProgress?})`,
  `retryReferenceImport(projectId,id,options?)`, `registerProjectImage(projectId,mediaId)`.
- `getReferenceSource(projectId,attachment)`, `searchProjectReferences(projectId,query,limit?)`,
  `readProjectReference(projectId,attachment,{start?,limit?,maxChars?})`,
  `removeProjectReference(projectId,id)`.
- `beginAgentRun` accepts `attachments?: ReferenceAttachment[]`. Messages preserve
  attachment identity and selected text context; run context and per-step reference
  audit preserve the actual prepared selection rather than the current library.
- Tools: `project_reference_search`, `project_reference_read`, `read_project_image`.
  Read-image accepts a real project-owned `mediaId`, including generated media.
- `ReferenceSourceLink({projectId,attachment,label?,chunkIndex?})` is the shared
  source inspector for chat, task records and wrap-up evidence.

## 3. Contracts
### Import and storage
Import and extraction are local. Hashing, Blob reads, worker waits, PDF decoding and
model transport must stay outside Dexie transactions. Short transactions revalidate
project existence and operation identity before publishing. Cancel/retry/removal
cannot let an older parser publish over a newer operation. Duplicate bytes reuse
only within the same project. No legacy data backfill is part of this feature.

Supported input: JPEG/PNG/WebP, UTF-8 or BOM-marked UTF-16 TXT/MD, text PDFs and DOCX.
Centralized byte/unit/character/decompression limits live in `REFERENCE_LIMITS`.
Partial PDFs disclose empty pages and truncation. DOCX paragraphs are extracted
positions, never fabricated page numbers. Empty text differs from parse failure.
The character limit and coverage count the exact persisted chunk text, including
inserted separators when source units share a chunk. ZIP validation checks this
count and ready/partial status against extraction coverage; a long multiline source
must round-trip through the same app without exceeding its own import limits.

PDF.js worker, CMaps and fonts are local packaged assets; no document-directed
external requests. Mammoth uses raw text only. It is statically imported inside the
lazy worker graph because Vite's default IIFE worker output cannot contain dynamic
chunks. Do not render unsanitized document HTML or evaluate imported instructions.

### Requests and tools
Only selected sources enter a new request automatically; unselected project sources
are searched/read on demand in smart mode. Tool allowlists, permission snapshots and
project scope remain code-owned. The current selected model performs image reading;
there is no hidden image-analysis model or extra model request outside the tool loop.

Canonical messages keep lightweight `referenceInput` metadata. Wire materializers
resolve it into Chat `image_url` or Responses `input_image` parts immediately before
HTTP. Revalidate project, run and source availability after asynchronous encoding.
Never store repeated base64 in messages, run audits or tool results. Explicit provider
vision metadata overrides exact model-bank evidence; unsupported/unknown capability
fails with a model-switch/remove-image action, not a filename-only fallback.

A completed read-image tool queues pixels for the next same-model request; it does
not itself mean visual analysis is complete. Pair normal tool output with a typed
user-image input exactly once, preserving Responses opaque reasoning envelopes and
provider call IDs. Audit labels describe prepared inputs unless transmission is
proven; failed preflight must not claim pixels were already sent.

Text sources share the context budget and include truthful chunk coverage. Composer
preview and run creation reuse `selectReferenceContext` and the same character
budget; scope-tag asynchronous results so a previous project/model/attachment
selection cannot appear as the current preview. Image
cost is explicitly heuristic (4096 tokens/image currently), not billing. Compression
retains source/revision/coverage but removes old pixels; a later read-image can
explicitly inspect them again. Historical source validation still applies. Retry
uses frozen selection and cannot revive a withdrawn reference through cached text
or its raw mediaId. Re-adding bytes under a new active reference does not revive
the old source identity. Fresh tools resolve the current active reference explicitly.

`project_history_read` must not replay cached reference-tool result bodies. Task
wrap-up evidence projects reference tools to source identities, coverage and
historical state instead of sending cached chunks/excerpts again. Historical user
messages, authored notes and assistant interpretations remain history; withdrawal
does not claim to erase prose already authored from a source.

### Lifecycle, evidence and UX
Draft removal only detaches. Reference removal withdraws new use; historic prose and
source descriptors remain historical. GC retains bytes owned by other project
assets or generation jobs. `businessStore.mediaUsage` and approval owner snapshots
must count active project reference ownership too, so deletion previews and final
GC agree. Thread deletion preserves project library ownership;
project deletion and ZIP include references/chunks and correct media remapping.
ZIP validation verifies source digests and ownership before writes.

Task records may cite user attachments and completed reference-read tool results.
Wrap-up source fingerprints include current reference/byte availability; withdrawal
makes a saved review stale. A reference's existence or a read success never proves
a completed business result. Use bulk reads for large evidence sets rather than
long runs of immediately resolved native promises in a transaction.

UI is flat, dark and scoped: searchable plus-menu, compact chips only when present,
source preview and explicit parse errors/retry. Async draft results retain their
originating thread/project scope. Move home attachments to the created thread before
navigation and clear them only after run creation succeeds. Sending locks attachment
mutations so late imports cannot strand a moved draft. Source modals retain keyboard
focus, Escape/outside-click dismissal and narrow-screen bounds.

## 4. Validation & Error Matrix
| Condition | Behavior |
| --- | --- |
| Foreign project / withdrawn source / revision mismatch | Reject before pixels or source text dispatch |
| Unknown/non-vision selected model | Actionable error; preserve draft and attachments |
| Corrupt/oversized/encrypted file | Explicit error; no false ready state |
| Scan-only/mixed PDF | Missing-text coverage; no OCR claim |
| Cancel/retry/delete during parse | Old operation cannot publish |
| Source/thread removed during image encoding | No HTTP |
| Long document | Bounded chunks and visible omitted coverage |
| Compressed historical image | Retain locator, omit pixels until explicit read |
| Same project, new conversation | Library reuse, no automatic bulk context injection |
| Project ZIP imported | New project IDs, valid source and chunk ownership |

## 5. Good / Base / Bad Cases
Good: attach script → read cited passages → inspect generated project image with
current model → record observation with source → human verifies results.
Base: plain chat without references retains existing execution behavior.
Bad: every file in a project enters the system prompt, a read tool invents an image
description from metadata, or a removed file remains silently available to new runs.

## 6. Tests Required
`references.test.ts`: actual text/DOCX extraction, limits, deduplication,
cancel/retry, ownership, retention, deletion, package roundtrip/tamper.
`agentReferences.test.ts`: both wire formats, current-model read-image pairing,
no persisted data URLs, capability rejection, source deletion during encoding,
continuation/retry and compression without repeated historical pixels.
`referenceEvidence.test.ts`: bounded structured source extraction, foreign metadata
exclusion, stale version/bytes and withdrawal invalidating wrap-up snapshots.
Native browser: actual PDF/DOCX workers; direct image+document and tool-read generated
image for both protocols; real file input, preview, library reuse, keyboard/mobile,
empty strip removal and failure-draft retention. Mock paid providers.

## 7. Wrong vs Correct
Wrong: `read_project_image` returns `{description: media.filename}` and claims success.
Correct: return durable image identity, queue actual pixels into the same model's
next request, then let that model describe the image.

Wrong: parse a DOCX or await image encoding inside an IndexedDB write transaction.
Correct: process outside it, then publish after a short owner/operation CAS check.
