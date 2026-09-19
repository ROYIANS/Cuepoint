# Implementation plan

Status: approved by user (“可以”); implementation and quality verification complete.

1. Extend memory inclusion domain/schema/CRUD/versions/ZIP and thread exclusion API.
   Add owner/CAS/roundtrip tests. No data backfill or inferred project-wide rules.
2. Implement pure lexical Chinese/Latin planner, exact envelope budgeting and selection
   reason/omission metadata. Tests for same-project isolation, follow-up intent, tags,
   applicability, statuses, exclusions, ties, long entries and unknown/small capacity.
3. Integrate new-run preview and safe-boundary refresh, effective-base replacement,
   exact per-step audit, Chat/Responses, retry/resume and compaction prefix invariants.
   Test memory edits/deletion/exclusion between requests, no repeated effects, frozen
   old snapshots, opaque reasoning preservation and transaction failure before POST.
4. Add basic read-only memory and project-history skill/tools. Strict parse and frozen
   project/exclusion enforcement; bounded source slices, actual source ownership,
   missing/stale statuses, no writes/automatic completion or hidden reasoning exposure.
5. Add inclusion editor and compact inspector → detail sheet. Historical actual vs next
   preview, source links and reversible thread exclusions, no toolbar clutter. Reuse
   MemoryEditor and readMemory error handling rather than new forms/storage bypasses.
6. Independent full-scope review. Local pnpm lint/test/build, git diff --check. Isolated
   Edge fixtures with mocked models: task A lesson → same-project B sends, unrelated C
   excluded, general vs related ranking, corrected/excluded step updates, source recall,
   compaction/reload, actual audit, model failure, keyboard/mobile and no paid generation.
7. Update seven-section code specs and evidence. Present grouped commit plan, then archive
   and journal after approval. Parent integration verifies recalled A→B flow explicitly.

pnpm: /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm only.

Likely affected: domain/projectMemory, domain/agent/context/types; db/projectMemories,
agentRuns/database and scoped policy helper; lib/memory planner; lib/agent taskContext,
contextPlanner/contextCompaction/runChat/skills/registry and memory tools; memory editor,
ContextUsagePanel/run details and scoped CSS; projectPackage; focused test files/specs.
Protocol adapters should remain unchanged unless actual envelope evidence requires it.
