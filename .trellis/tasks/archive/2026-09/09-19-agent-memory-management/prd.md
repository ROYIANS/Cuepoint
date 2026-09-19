# Creative memory capture and management

Status: approved by the user via “ok”; implementation in progress.
Parent: 09-19-agent-workflow-memory. Prerequisites: task-wrapup and project-context
are implemented, validated, committed and archived.

## Goal
Turn selected project experience into durable, inspectable knowledge that the user
can correct and manage, ready for the subsequent scoped retrieval delivery.

## Confirmed foundations
The user prioritizes Trellis-style work, project-owned context and long-term memory,
excellent flat dark UI, and no development-era compatibility work. Project facts
remain in business tables. Reviewed summaries already provide structured decisions,
lessons, versions and evidence; ordinary assistant replies are not verified knowledge.
Repository evidence is recorded in research/memory-foundation.md.

## Proposed requirements for approval
- R1: Memories belong to one real project; initial categories are convention, creative
  preference, decision and lesson. No implicit global scope or cross-project reuse.
- R2: From a confirmed task summary, select decisions/lessons as editable candidates,
  inspect source excerpts and explicitly confirm saving. Task completion/archive never
  silently activates memory. No additional model call is needed for structured items.
- R3: Manual creation, search/category/status filters, edit, disable/reactivate, delete
  and revision history work offline. Preserve unsaved edits on CAS conflicts.
- R4: Retain source project/task/thread/summary ID and revision, item identity and
  bounded evidence snapshot. Distinguish human assertion, confirmed source, historical
  source, missing source and imported provenance. Current live facts outrank memory.
- R5: Exact repeated content or the same source item is deduplicated. A same-topic
  different entry is shown for review; explicit replacement supersedes earlier memory
  atomically. Do not claim arbitrary semantic contradiction detection across all text.
- R6: Delete a source conversation without deleting independently promoted memory;
  retain excerpt and missing-source state. Delete a memory and its revisions together.
  Delete a project and all its memories/revisions. Archiving tasks retains sources.
- R7: Include memories/revisions and bounded source excerpts in project ZIP backup.
  Import remaps project/memory/version references and marks entries pending review;
  absent task sources remain detached instead of linking into a different project.
- R8: Project memory page plus a source-side summary entry; bound-chat plus menu links
  to the project memory page. Flat searchable list and spacious detail editor; no
  nested-card stack. Keyboard/mobile and explicit unsaved-change handling required.
- R9: Define active/disabled/superseded/pending-review and source/applicability state
  for later retrieval. Do not modify model prompt assembly or claim automatic recall.

## Acceptance criteria
- AC1: A confirmed summary lesson can be selected, edited, saved to its project,
  reopened and traced to exact source revision (R1,R2,R4).
- AC2: A user can manually add, correct, disable, reactivate and permanently delete
  memory offline; reload preserves results and deletion (R3,R6).
- AC3: Duplicate submission is idempotent; explicit replacement preserves both histories
  and only the chosen current entry is active. Competing edits retain local draft (R5).
- AC4: Other-project sources/IDs are rejected in repository transactions, not only UI.
  Source deletion is visible; project deletion has no orphaned memory rows (R1,R4,R6).
- AC5: Export/import round-trips content, history and excerpts into new IDs with pending
  review and no live foreign-project links; malformed data rolls back import (R7).
- AC6: Source promotion, search/filter/edit/history, deletion confirmation and empty/
  missing/error states are usable on desktop and narrow mobile, without paid APIs (R8).
- AC7: Existing task review, project context and package tests remain green. No prompt
  injection or automatic model request is introduced by memory CRUD (R9).

## Out of scope
Global preferences, embeddings, model-generated semantic deduplication, automatic
activation, Agent memory tools or retrieval/prompt injection, historical transcript
backfill, full chat export, cloud sync, migration/reassignment of pre-project data.

## Final review
The user approved the full proposal via “ok”, including explicit promotion review,
project-only management, source/deletion lifecycle and pending-review imports.
