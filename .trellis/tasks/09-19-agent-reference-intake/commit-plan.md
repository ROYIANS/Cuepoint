# Commit plan

All paths below belong to the approved reference-intake task. No unrecognized dirty files found. The user approved this plan on 2026-09-19. Work commits execute in the order below, followed by task archival and journal bookkeeping. No push is authorized.

## 1. feat: add project reference intake and native image reading

- `package.json`
- `pnpm-lock.yaml`
- `src/components/agent/AgentChatPage.tsx`
- `src/components/agent/AgentControls.tsx`
- `src/components/agent/ContextUsagePanel.tsx`
- `src/components/agent/FloatingComposer.tsx`
- `src/components/agent/MessageList.tsx`
- `src/components/agent/ModelSelectTrigger.tsx`
- `src/components/agent/ReferenceAttachments.tsx`
- `src/components/agent/ReferenceLibrary.tsx`
- `src/components/agent/TaskRecords.tsx`
- `src/components/agent/TaskWrapup.tsx`
- `src/components/agent/composerTypes.ts`
- `src/components/agent/references.css`
- `src/components/agent/useReferenceDraft.ts`
- `src/db/agentRuns.ts`
- `src/db/agentTaskRecords.ts`
- `src/db/agentTools.ts`
- `src/db/database.ts`
- `src/db/references.ts`
- `src/db/repo.ts`
- `src/domain/agent.ts`
- `src/domain/agentTaskWrapup.ts`
- `src/domain/context.ts`
- `src/domain/referenceInput.ts`
- `src/domain/references.ts`
- `src/domain/types.ts`
- `src/lib/agent/businessStore.ts`
- `src/lib/agent/businessTools.ts`
- `src/lib/agent/contextCompaction.ts`
- `src/lib/agent/contextPlanner.ts`
- `src/lib/agent/contextUsage.ts`
- `src/lib/agent/memoryToolNames.ts`
- `src/lib/agent/memoryTools.ts`
- `src/lib/agent/referenceContext.ts`
- `src/lib/agent/referenceEvidence.ts`
- `src/lib/agent/referenceToolNames.ts`
- `src/lib/agent/referenceTools.ts`
- `src/lib/agent/runChat.ts`
- `src/lib/agent/skills.ts`
- `src/lib/agent/tools.ts`
- `src/lib/agent/wrapupEvidence.ts`
- `src/lib/ai/chatStream.ts`
- `src/lib/ai/modelBank/index.ts`
- `src/lib/ai/modelMetadata.ts`
- `src/lib/ai/referenceWire.ts`
- `src/lib/ai/responsesStream.ts`
- `src/lib/ai/visionCapability.ts`
- `src/lib/projectPackage.ts`
- `src/lib/references/docx.ts`
- `src/lib/references/docx.worker.ts`
- `src/lib/references/import.ts`
- `src/lib/references/mammoth.d.ts`
- `src/lib/references/package.ts`
- `src/lib/references/parse.ts`
- `src/lib/references/pdf.ts`
- `tests/agentBusiness.test.ts`
- `tests/agentMemoryTools.test.ts`
- `tests/agentReferences.test.ts`
- `tests/agentSettings.test.ts`
- `tests/productionProposals.test.ts`
- `tests/referenceEvidence.test.ts`
- `tests/references.test.ts`

## 2. docs: record reference intake contracts and validation

- `.trellis/spec/frontend/agent-context.md`
- `.trellis/spec/frontend/agent-creative-skills.md`
- `.trellis/spec/frontend/agent-references.md`
- `.trellis/spec/frontend/agent-task-wrapup.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/production-contracts.md`
- `.trellis/tasks/09-19-agent-reference-intake/check.jsonl`
- `.trellis/tasks/09-19-agent-reference-intake/commit-plan.md`
- `.trellis/tasks/09-19-agent-reference-intake/design.md`
- `.trellis/tasks/09-19-agent-reference-intake/implement.jsonl`
- `.trellis/tasks/09-19-agent-reference-intake/implement.md`
- `.trellis/tasks/09-19-agent-reference-intake/prd.md`
- `.trellis/tasks/09-19-agent-reference-intake/research/intake-foundation.md`
- `.trellis/tasks/09-19-agent-reference-intake/research/parser-implementation.md`
- `.trellis/tasks/09-19-agent-reference-intake/research/retrospective.md`
- `.trellis/tasks/09-19-agent-reference-intake/research/review.md`
- `.trellis/tasks/09-19-agent-reference-intake/task.json`
- `.trellis/tasks/09-19-agent-reference-intake/validation/browser-regression.cjs`
- `.trellis/tasks/09-19-agent-reference-intake/validation/pdf-browser.cjs`
- `.trellis/tasks/09-19-agent-reference-intake/validation/pdf-fixtures.py`
- `.trellis/tasks/09-19-agent-reference-intake/validation/quality.md`
- `.trellis/tasks/09-19-agent-workflow-memory/prd.md`
- `.trellis/tasks/09-19-agent-workflow-memory/task.json`
- `README.md`
- `THIRD_PARTY_NOTICES.md`

## After work commits

Archive only `09-19-agent-reference-intake`, then record the session journal using the two work-commit hashes. The parent workflow task and batch-generation child remain active. Do not push.
