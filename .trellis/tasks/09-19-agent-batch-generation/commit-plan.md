# Proposed work commits

Status: user approved this exact plan on 2026-09-19 with “提交吧”; execution authorized. All listed paths were edited by this session or its assigned agents. No unrecognized changes. No push is included.

## 1. `feat: add reviewed batch generation and candidate selection`

- `src/components/agent/AgentChatPage.tsx`
- `src/components/agent/AgentGenerationBatches.tsx`
- `src/components/agent/AgentGenerationResults.tsx`
- `src/components/agent/GenerationReview.tsx`
- `src/components/agent/TaskRecords.tsx`
- `src/components/agent/generationBatch.css`
- `src/db/agentGeneration.ts`
- `src/db/agentGenerationBatches.ts`
- `src/db/agentTaskRecords.ts`
- `src/db/agentTaskWrapups.ts`
- `src/db/database.ts`
- `src/db/repo.ts`
- `src/domain/agentGeneration.ts`
- `src/domain/agentGenerationBatch.ts`
- `src/domain/agentTaskRecords.ts`
- `src/lib/agent/businessStore.ts`
- `src/lib/agent/businessTools.ts`
- `src/lib/agent/generationBatchRuntime.ts`
- `src/lib/agent/generationRuntime.ts`
- `src/lib/agent/generationTools.ts`
- `src/lib/agent/runOwnership.ts`
- `src/lib/agent/skills.ts`
- `src/lib/agent/taskTools.ts`
- `src/lib/agent/wrapupEvidence.ts`
- `tests/agentBusiness.test.ts`
- `tests/agentGeneration.test.ts`
- `tests/agentGenerationBatch.test.ts`
- `tests/agentGenerationBatchSafety.test.ts`
- `tests/productionProposals.test.ts`

## 2. `docs: record batch generation contracts and integration validation`

- `.trellis/spec/frontend/agent-batch-generation.md`
- `.trellis/spec/frontend/agent-creative-skills.md`
- `.trellis/spec/frontend/agent-execution.md`
- `.trellis/spec/frontend/agent-task-wrapup.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/tasks/09-19-agent-batch-generation/check.jsonl`
- `.trellis/tasks/09-19-agent-batch-generation/commit-plan.md`
- `.trellis/tasks/09-19-agent-batch-generation/design.md`
- `.trellis/tasks/09-19-agent-batch-generation/implement.jsonl`
- `.trellis/tasks/09-19-agent-batch-generation/implement.md`
- `.trellis/tasks/09-19-agent-batch-generation/prd.md`
- `.trellis/tasks/09-19-agent-batch-generation/research/existing-generation.md`
- `.trellis/tasks/09-19-agent-batch-generation/research/review.md`
- `.trellis/tasks/09-19-agent-batch-generation/retrospective.md`
- `.trellis/tasks/09-19-agent-batch-generation/task.json`
- `.trellis/tasks/09-19-agent-batch-generation/validation/batch-browser.cjs`
- `.trellis/tasks/09-19-agent-batch-generation/validation/desktop.png`
- `.trellis/tasks/09-19-agent-batch-generation/validation/mobile.png`
- `.trellis/tasks/09-19-agent-batch-generation/validation/parent-integration.cjs`
- `.trellis/tasks/09-19-agent-batch-generation/validation/parent-integration.md`
- `.trellis/tasks/09-19-agent-batch-generation/validation/quality.md`
- `.trellis/tasks/09-19-agent-workflow-memory/prd.md`
- `.trellis/tasks/09-19-agent-workflow-memory/task.json`

## After approved work commits

Archive the completed batch-generation child, update the parent integration gate based on the archived child, and record the session journal using work-commit hashes. The parent is not silently archived as an unrelated cleanup task.
