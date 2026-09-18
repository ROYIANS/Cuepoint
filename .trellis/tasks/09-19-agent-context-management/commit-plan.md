# Proposed commit batch

1. `feat: add durable conversation context management`

All paths are recognized edits for this task; no unrelated files are included.

- `.trellis/spec/frontend/agent-context.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/tasks/09-19-agent-context-management/check.jsonl`
- `.trellis/tasks/09-19-agent-context-management/commit-plan.md`
- `.trellis/tasks/09-19-agent-context-management/design.md`
- `.trellis/tasks/09-19-agent-context-management/implement.jsonl`
- `.trellis/tasks/09-19-agent-context-management/implement.md`
- `.trellis/tasks/09-19-agent-context-management/prd.md`
- `.trellis/tasks/09-19-agent-context-management/research/lobehub-context.md`
- `.trellis/tasks/09-19-agent-context-management/task.json`
- `.trellis/tasks/09-19-agent-context-management/verification.md`
- `src/components/agent/AgentChatPage.tsx`
- `src/components/agent/AgentControls.tsx`
- `src/components/agent/ContextCompactionDetails.tsx`
- `src/components/agent/ContextParameters.tsx`
- `src/components/agent/ContextUsagePanel.tsx`
- `src/components/agent/FloatingComposer.tsx`
- `src/components/agent/composerTypes.ts`
- `src/components/agent/contextParameters.css`
- `src/db/agentRuns.ts`
- `src/db/agentTasks.ts`
- `src/db/agentTools.ts`
- `src/db/contextSettings.ts`
- `src/db/database.ts`
- `src/db/repo.ts`
- `src/domain/agent.ts`
- `src/domain/context.ts`
- `src/domain/types.ts`
- `src/lib/agent/contextCompaction.ts`
- `src/lib/agent/contextPlanner.ts`
- `src/lib/agent/contextPolicy.ts`
- `src/lib/agent/contextUsage.ts`
- `src/lib/agent/runChat.ts`
- `src/lib/ai/chatStream.ts`
- `src/lib/ai/responsesStream.ts`
- `tests/contextManagement.test.ts`
- `tests/contextUsage.test.ts`
- `tests/productionProposals.test.ts`

After user confirmation: commit this coherent feature, archive only the current task,
then record the developer journal. No push.
