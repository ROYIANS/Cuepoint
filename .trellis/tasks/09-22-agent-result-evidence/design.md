# Evidence-backed outcomes — first delivery

## Gap and boundary
A completed write call currently has a sparse or inconsistent result, so the model must reread entities and the process UI cannot name confirmed changes. First deliver versioned direct-write receipts for local film/audio/music editing and a compact persisted-receipt display. This is an incremental R2 delivery; asynchronous generation/job evidence, semantic claim adjudication, source-range impact reports and binding/recovery changes remain subsequent work.

## Contract
Tool-owned `writeReceipt` version 1 contains a bounded list of direct target entries: entity kind, operation (created/updated/deleted), stable id, ownerId, optional revision, bounded label. Coverage is explicitly direct targets, not a complete cascade report or proof of goal completion. Receipt metadata is never accepted from model arguments. Supported business writes additionally return bounded whitelisted normalized records and effective style information. Existing top-level result keys remain compatible.

Produce receipts within existing atomic business+ledger transactions. Receipt serialization failure rolls back the write. Replay returns the saved result. No new database table/migration or network request. No receipt based on before/after counts, assistant prose, plan state or preview. Missing/old/unsupported receipts remain unverified. Read and network calls never become evidence of local writes merely through a receipt-shaped payload.

## Presentation
A pure helper accepts only owned completed atomic write calls from a code-owned supported tool list and validates receipt shape, operation/entity mapping and run ownership. Project creation can name its new project from an unbound run; never accept foreign owners for bound runs. Summarize recorded operations, not unique final surviving entities. Multiple edits to one object remain multiple operations; a later deletion does not erase earlier history. Details link to the original call rather than trusting a result-provided URL. Do not show arbitrary returned prose or raw records in the compact UI.

Render one small disclosure outside the existing auto-collapsed process details so saved changes remain discoverable. Details are bounded and disclose omitted operations. Describe these as effects at execution time, not current project truth. Receipts during streaming are shown only after committed tool results; assistant text remains distinct and is not silently rewritten. This stage does not detect every unsupported completion claim or force another model request.

## Compatibility and rollback
Preserve permissions, scope, preview revisions, Stop, paid approval and result limits. Code-owned receipts are additive for object results; legacy array-only/unsupported mutations remain uncovered rather than changing their shape. Rollback presentation/receipt production without rewriting historical results. No automatic retries or paid validation.
