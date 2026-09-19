# Grouped commit plan

Approved by user: 提交和归档这个批次的任务，然后准备下一阶段. Includes the inspector fix.
All listed files were changed by this task.

## 1. `feat: add scoped project memory retrieval and request audit`

- `src/components/agent/ContextUsagePanel.tsx`
- `src/components/agent/MemoryContextDetails.tsx`
- `src/components/agent/MessageList.tsx`
- `src/components/agent/memoryContext.css`
- `src/components/memory/MemoryEditor.tsx`
- `src/components/memory/ProjectMemoryPage.tsx`
- `src/components/memory/memory.css`
- `src/db/agentRuns.ts`
- `src/db/agentTools.ts`
- `src/db/memoryRetrieval.ts`
- `src/domain/agent.ts`
- `src/domain/context.ts`
- `src/domain/memoryRetrieval.ts`
- `src/domain/projectMemory.ts`
- `src/domain/types.ts`
- `src/lib/agent/contextCompaction.ts`
- `src/lib/agent/contextPlanner.ts`
- `src/lib/agent/contextUsage.ts`
- `src/lib/agent/memoryContext.ts`
- `src/lib/agent/memoryToolNames.ts`
- `src/lib/agent/memoryTools.ts`
- `src/lib/agent/projectContext.ts`
- `src/lib/agent/runChat.ts`
- `src/lib/agent/skills.ts`
- `src/lib/agent/tools.ts`
- `src/lib/memory/retrieval.ts`
- `src/lib/memory/schema.ts`
- `tests/agentMemoryTools.test.ts`
- `tests/agentSettings.test.ts`
- `tests/memoryInclusion.test.ts`
- `tests/memoryRetrieval.test.ts`

## 2. `fix: preserve task evidence transactions and recover inspector reads`

- `src/components/agent/TaskWrapup.tsx`
- `src/lib/agent/wrapupEvidence.ts`
- `tests/agentTaskWrapup.test.ts`
- `tests/agentGeneration.test.ts`

## 3. `docs: record memory retrieval contracts and validation`

- `.trellis/spec/frontend/agent-memory-retrieval.md`
- `.trellis/spec/frontend/agent-project-context.md`
- `.trellis/spec/frontend/agent-task-wrapup.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/project-memory.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/check.jsonl`
- `.trellis/tasks/09-19-agent-memory-retrieval/commit-plan.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/design.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/implement.jsonl`
- `.trellis/tasks/09-19-agent-memory-retrieval/implement.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/prd.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/research/retrieval-foundation.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/research/review.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/research/task-transaction-bug.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/task.json`
- `.trellis/tasks/09-19-agent-memory-retrieval/validation/browser-regression.cjs`
- `.trellis/tasks/09-19-agent-memory-retrieval/validation/quality.md`
- `.trellis/tasks/09-19-agent-memory-retrieval/validation/task-transaction-regression.cjs`

## Unrecognized dirty files

None.

After work commits: archive the current Trellis task and record the journal in separate
bookkeeping commits. Do not push.
