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
  Named-project discovery and the exclusive `{discoveryCallId,candidateId}` reader
  use the run-scoped contract in [Image Discovery](./agent-image-discovery.md).
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
vision metadata overrides exact model-catalog evidence; unsupported/unknown capability
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
originating thread/project scope. A valid send consumes its captured text/reference
snapshot into a local attempt immediately; first-send navigation moves the submitted
attempt, while newer home edits remain home-scoped. Sending locks attachment
mutations so late imports cannot strand a submitted draft. See [Agent Send Recovery](./agent-send-recovery.md). Source modals retain keyboard
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

## Historical source lookup compatibility

`task_read` index/detail and `project_history_read` must project reference tool results through `historicalToolSummary`; reference identities, revisions and coverage may remain, raw cached source text/pixels may not. Old nested task/history lookups are summarized rather than recursively trusting opaque JSON. Fresh safe lookup results carry the code-owned `sourceProjectionVersion: 1`. At Chat/Responses materialization, correlate tool outputs with their function-call names and downgrade unmarked historical lookup outputs. Do not modify immutable ledger records or authored user/assistant prose. Regression coverage includes withdrawn/revised/foreign sources, index/detail/nested reads, both transports, and old frozen wire arrays.

## B07 / E02: one compose scope and revision-safe submitted attempts

### 1. Scope / trigger

Within the application/document lifetime, unsent text and attachments belong to the same thread/project session. Changing topics or home project selection must not pair one topic's text with another topic's references. E11 retains this state across view unmount; actual reload remains a new session. E02's [send recovery contract](./agent-send-recovery.md) supersedes the original B07 clear-after-begin timing while preserving draft ownership.

### 2. Signatures

`runtime/chatDraftStore.ts` owns `createChatDraftStore()` and the document singleton `chatDrafts`, with `session(scope, projectId?)`, `snapshot(scope)`, `subscribe(listener)` and `shutdown()`. `useReferenceDraft(scope, projectId?)` is its React adapter. The retained model owns text, textRevision, a whole-draft mutation revision, attachments and imports. `setText(text)` advances text revision on every edit; `capture()` freezes scope/text/revision/attachments and active imports before any await. Send checks that captured list, including imports started before rerender.

`consume(submitted): DraftRecovery` uses exact-version acknowledgement immediately and returns `{scope, revision}` for the consumed whole-draft state. `restore(submitted, recovery): boolean` compares that state and restores only when it is still the same empty draft. `reserveDestination(scope)` establishes an empty independent compose session and refuses an existing session, including one edited back to empty. Existing `moveTo`/`acknowledge` remain guarded helpers; E02's initial-send path must not refill the destination composer or clear it again after begin. Existing attach/import/retry/cancel/clearSent operations retain their origin scope.

### 3. Contracts

The scope is JSON `[threadId ?? 'home', projectId]`. Switching A/B/back restores each session's text and attachments. New topic never clears an old unsent draft merely because creation starts or fails. Preserve the loaded/routed-thread ownership gate, with only the exact creation-receipt handoff documented in send recovery.

Capture a send synchronously, acquire the existing duplicate-send lock, and consume only that submitted version into its immutable local attempt before preparation. If home creation waits while the user edits, newer home text remains there; the created thread starts with an independent empty composer. Never overwrite an existing target session, even one edited back to empty. Failure retains exact submitted text/references in its recovery candidate. Restore only through the unchanged consumed whole-draft revision; refusal leaves both the candidate and newer draft intact. Successful begin joins the durable user ID without another delayed composer clear. Execution failure after admission follows durable-run recovery and cannot restore an already-sent draft.

Every import success updater preserves compose text/revision and other fields. All text/reference/import mutations advance the whole-draft revision. Import progress/failure stays in its initiating scope with original File/error/reference resources. Sending blocks all attachment mutations (including removal/cancel), duplicate send and active imports; text editing remains supported. Web Lock, compatibility and one-POST execution stay authoritative. Ordinary view/route changes never abort retained imports or Agent execution. The service owns the reserved thread independently of navigation; a view may navigate only for its still-matching creation attachment.

Capture the consumed revision before notifying subscribers. A synchronous subscriber may edit and revert the same compose scope during publication; reading the revision after notification would incorrectly authorize restoration over that newer empty draft. Register import controllers and original completion before publishing loading state, because a subscriber may cancel or begin application shutdown synchronously. Queued cancelled imports must release their controller and loading entry without dispatching.

### 4. Validation / error matrix

| Scenario | Expected outcome |
| --- | --- |
| A text/reference → B → A | A restored; B has independent draft |
| Home project A → B | Separate text/reference sessions |
| New-topic creation fails outside Send | Original unsent draft unchanged |
| First-send preparation/creation fails | Exact recoverable attempt; submitted composer already consumed |
| First-send navigation fails | Retained attempt; no newer origin/destination draft overwritten |
| Begin fails with proved rollback | Explicit retry or guarded restore; retain exact attachments |
| Begin outcome unknown | No draft restore/re-admission; read-only status check |
| Text edit/revert or edit-back-to-empty after consume | Newer revision survives; automatic restore refused |
| A begin succeeds while B has equal text | B unchanged; no delayed acknowledgement of current draft |
| Import completes after scope change | Updates origin references only; preserves text/version |
| Existing destination session | Reservation refuses overwrite |

### 5. Good / base / bad cases

Good: send A from home, type B while creation waits, see A in the attempt and later durable thread, then return home to B. Base: submitted content clears immediately into the visible attempt; begin acknowledgement cannot clear another revision. Bad: a global text state, unconditional topic clearing, moving the latest home draft or comparing only text when restoring.

### 6. Required tests

Exercise actual page and compose-hook callbacks with held compatibility/creation/begin/navigation: A/B/back, home project change, same-render edits/send, equal-string different owners, edit/revert, edited-empty and each failure boundary. Assert persisted message/run payloads where feasible. Cover asynchronous reference import success/failure/cancel/unmount, retained resources, whole-draft attachment/import mutation, attachment lock and existing loading gates. View unmount must not stop parsing or lose its original scope; application shutdown closes new import admission, aborts actual owned parsers and awaits every captured original import promise. A cancelled old operation cannot remove a newer controller or attach a late result. Pure/callback tests do not establish browser paint or actual history event delivery; keep browser and mocked transport limits explicit.

### 7. Wrong vs correct

Wrong: after begin, clear the currently displayed text by string equality, refill the created-thread composer with the already-submitted payload, or restore a failed payload over a draft edited back to empty.

Correct: consume the captured scoped version immediately, keep the submitted payload in a local attempt, leave later drafts independent, and restore only by the unchanged whole-draft generation. Join durable acceptance by canonical identity without a second clear.
