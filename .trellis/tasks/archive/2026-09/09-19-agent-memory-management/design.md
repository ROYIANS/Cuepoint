# Project memory management design

Status: approved by the user via “ok”; implementation in progress.

## Change boundary
Current gap: reviewed decisions/lessons are confined to individual task summaries;
there is no project-owned editable knowledge collection. Add a memory aggregate and
UI around those sources. Do not fork current project facts or alter request assembly.

## Domain and persistence
Introduce projectMemory domain types and a strict input schema. A current row contains
id, projectId, category, title, normalized topic key, body, applicability text, tags,
status (pending_review/active/disabled/superseded), revision, optional supersededBy,
source descriptor/snapshot, createdAt/updatedAt and last reviewed timestamp.
Append immutable version rows (versionId, memoryId, projectId, revision, change reason,
complete captured row). IndexedDB v16: current rows indexed by projectId and status;
versions indexed by projectId and compound memoryId/revision. No data backfill.

All repo APIs take projectId explicitly. Read current row and project in the same
transaction; compare expected revision on mutations. Reject studio/missing projects
and foreign source ownership. Validate bounded strings, categories, tags and source
shape. Disable/reactivate/replace produce versions; delete removes current+all history.
Replacement compares revisions of both entries atomically. Never mutate old versions.

## Source promotion
Read the chosen summary and exact revision from the database; accept only a confirmed
summary belonging to the project. Display source applicability/freshness before saving;
confirmed historical experience may remain useful after unrelated current facts change,
but it must be explicitly reviewed rather than described as currently verified output.
The source selector references decisions/lessons by category and item index plus exact
text/version; use a stable source identity to make repeated promotion idempotent.
Retain task title, source item, confirmed revision and bounded associated evidence.
Source URLs are code-resolved from current ownership, never stored model URLs.

Candidates are selected from already structured summary entries, not a fresh AI
extraction request. The user edits the reusable formulation and applicability before
confirming save. Manual entries are explicitly human knowledge, not invented evidence.
Deleted source leaves a visible excerpt and unavailable state; edits can explicitly
reaffirm applicability while preserving historical provenance.

## Duplicates and conflict handling
Normalize Unicode/whitespace/case for exact duplicate comparison and topic matching.
Show exact existing duplicate rather than insert another. Same-topic different text
shows possible conflict and offers cancel, retain as a distinct topic after editing,
or explicit replacement. Never silently overwrite. Semantic contradictions with
unrelated wording are beyond this deterministic first version; UI avoids overclaiming.

## Interface
Project route `/p/$projectId/memory` with existing workspace chrome. Restrained list:
search/status/category filters, title, short content preview, source/status and date;
wide-screen detail area or sheet, single-column mobile editor. Empty state explains
what belongs here and offers manual entry. Details show applicability, source excerpt,
source availability and revision history. Delete confirmation distinguishes disable
(reversible) from permanent deletion. Unsaved edits are preserved across source/CAS
refresh and require explicit discard before close/navigation.

TaskWrapup adds a retain-to-memory action for confirmed decision/lesson items, also
available after task completion/archive. The compact promotion editor shows project
and provenance, calls the shared memory repo and links to the resulting record.
Agent plus menu gets a project memory navigation entry for bound chats; no permanent
extra toolbar, no toggle pretending retrieval is implemented.

## Deletion and project packages
Project deletion cascades memory+versions in its existing transaction. Source task
or chat deletion does not delete promoted knowledge; dynamic source lookup reports it
missing. Project ZIP captures memory and history consistently alongside business rows.
Import validates the dataset, allocates new project/memory IDs and remaps version and
replacement references. Source excerpts carry origin metadata only, not active foreign
links. Imported current entries start pending review; history retains original states
as historical data. No chat/task import or hidden source reassignment is introduced.

## Safety and follow-up
Data stays local; no network required for this child. Memory is user-controlled data,
not permission or an instruction overriding present intent. Later retrieval consumes
explicit eligible project versions and records actual usage, designed in its own child.
