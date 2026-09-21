# 已确认提交计划

用户已确认提交，按以下分组执行；不推送、不发布。共享依赖先提交，界面与性能改动随后提交。分组只覆盖本次修复。

## 1. `fix: 修复草稿并发、数据兼容与 Agent 执行边界`

- `.trellis/spec/frontend/agent-creative-skills.md`
- `.trellis/spec/frontend/agent-references.md`
- `.trellis/spec/frontend/agent-tools.md`
- `.trellis/spec/frontend/ai-connectors.md`
- `.trellis/spec/frontend/state-management.md`
- `src/components/agent/AgentChatPage.tsx`
- `src/components/assets/AssetTextField.tsx`
- `src/components/assets/CharacterDetailPage.tsx`
- `src/components/assets/PropDetailPage.tsx`
- `src/components/assets/SceneDetailPage.tsx`
- `src/components/assets/StyleDetailPage.tsx`
- `src/components/assets/WorldSettingPanel.tsx`
- `src/components/story/StoryPage.tsx`
- `src/components/ui/draft-status.tsx`
- `src/components/workspace/EpisodeListPage.tsx`
- `src/db/agentGenerationBatches.ts`
- `src/db/agentRuns.ts`
- `src/db/agentToolRecovery.ts`
- `src/db/agentTools.ts`
- `src/db/database.ts`
- `src/db/repo.ts`
- `src/lib/agent/businessStore.ts`
- `src/lib/agent/generationBatchRuntime.ts`
- `src/lib/agent/generationRuntime.ts`
- `src/lib/agent/memoryTools.ts`
- `src/lib/agent/referenceEvidence.ts`
- `src/lib/agent/runChat.ts`
- `src/lib/agent/runOwnership.ts`
- `src/lib/agent/taskTools.ts`
- `src/lib/agent/tools.ts`
- `src/lib/agent/wrapupEvidence.ts`
- `src/lib/ai/aihubmix.ts`
- `src/lib/ai/apimart.ts`
- `src/lib/ai/catalog.ts`
- `src/lib/ai/chatStream.ts`
- `src/lib/ai/openaiCompatible.ts`
- `src/lib/ai/referenceWire.ts`
- `src/lib/ai/responsesStream.ts`
- `src/lib/ai/safeError.ts`
- `src/lib/debouncedDraft.ts`
- `src/lib/draftConflict.ts`
- `src/lib/projectPackage.ts`
- `tests/agentAuditRemediation.test.ts`
- `tests/agentReferences.test.ts`
- `tests/auditDataIntegrity.test.ts`
- `tests/chatStream.test.ts`
- `tests/connectorMigration.test.ts`
- `tests/draftConcurrency.test.ts`
- `tests/mediaMetadata.test.ts`
- `tests/productionProposals.test.ts`

## 2. `fix: 修复编辑交互并优化大列表与 Agent 加载`

- `.github/workflows/ghcr.yml`
- `.trellis/spec/frontend/agent-batch-generation.md`
- `.trellis/spec/frontend/chat-performance.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/production-contracts.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `src/components/agent/AgentGenerationBatches.tsx`
- `src/components/agent/AgentGenerationResults.tsx`
- `src/components/agent/ChatWorkspace.tsx`
- `src/components/agent/MessageList.tsx`
- `src/components/agent/ModelIconCatalog.ts`
- `src/components/agent/ModelIcons.tsx`
- `src/components/agent/ModelSelectTrigger.tsx`
- `src/components/agent/taskWorkspace.css`
- `src/components/shots/DurationInput.tsx`
- `src/components/shots/ShotEditorPage.tsx`
- `src/components/shots/ShotRowViewport.tsx`
- `src/components/studio/PropLibraryPage.tsx`
- `src/components/studio/StudioField.tsx`
- `src/components/studio/StyleLibraryPage.tsx`
- `src/lib/ai/reasoningPolicy.ts`
- `src/lib/durationInput.ts`
- `src/lib/formFieldFocus.ts`
- `src/lib/generationIntent.ts`
- `src/lib/generationTargetDestination.ts`
- `src/lib/productionContext.ts`
- `tests/durationInput.test.ts`
- `tests/formFieldFocus.test.ts`
- `tests/generationIntent.test.ts`
- `tests/generationTargetDestination.test.ts`
- `tests/modelMetadata.test.ts`

## 3. `docs: 记录全盘审查修复与验证结果`

- `.trellis/tasks/09-21-audit-remediation/`：任务范围、中文报告、复核结论、复现脚本、性能数据、日志及截图。

## 保留的先前改动

以下是本轮开始前已经存在的审查产物，不混入上述代码提交：

- `.trellis/workspace/ROYIANS/index.md`
- `.trellis/workspace/ROYIANS/journal-1.md`
- `.trellis/tasks/archive/2026-09/09-21-full-project-audit/`

项目工作流在代码提交后再归档任务、记录会话。这些后续 bookkeeping 提交会单独执行；先前审查文件仍保持原样。
