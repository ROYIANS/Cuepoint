# A批具体提交计划

用户于2026-09-30回复ok，已按workflow Phase3.4确认并执行两笔顺序工作提交；没有推送、部署或归档。原工作区起点干净，当前所有路径均有本会话main/implement/check归属。129files/1660tests/typecheck/model/build与final fullscope check全部通过。父任务51项保持active，A已验证7项，B01next。

## 1. fix: 修复诊断保存、撤销和编辑并发一致性

共23个文件。

- `.trellis/spec/frontend/ai-connectors.md`
- `.trellis/spec/frontend/state-management.md`
- `src/components/assets/CharacterDetailPage.tsx`
- `src/components/assets/PropDetailPage.tsx`
- `src/components/assets/SceneDetailPage.tsx`
- `src/components/assets/StyleDetailPage.tsx`
- `src/components/shots/DurationInput.tsx`
- `src/components/shots/ShotEditorPage.tsx`
- `src/components/slots/GenerationSlotCard.tsx`
- `src/components/workspace/ProjectSettingsPanel.tsx`
- `src/db/repo.ts`
- `src/domain/slot.ts`
- `src/lib/ai/responsesStream.ts`
- `src/lib/draftConflict.ts`
- `src/lib/projectOutputDraft.ts`
- `src/lib/slotEditSession.ts`
- `src/lib/undo.tsx`
- `tests/manualDraftBaseline.test.ts`
- `tests/manualDraftWiring.test.ts`
- `tests/responsesStream.test.ts`
- `tests/shotBulkUndo.test.ts`
- `tests/shotDeleteUndo.test.ts`
- `tests/undo.test.ts`

## 2. chore: 记录源码整改A验证和逐项台账

共71个文件。

- `.trellis/tasks/09-30-src-quality-architecture-audit/task.json`
- `.trellis/tasks/09-30-src-quality-remediation/batch-gates.md`
- `.trellis/tasks/09-30-src-quality-remediation/check.jsonl`
- `.trellis/tasks/09-30-src-quality-remediation/commit-plan.json`
- `.trellis/tasks/09-30-src-quality-remediation/commit-plan.md`
- `.trellis/tasks/09-30-src-quality-remediation/design.md`
- `.trellis/tasks/09-30-src-quality-remediation/implement.jsonl`
- `.trellis/tasks/09-30-src-quality-remediation/implement.md`
- `.trellis/tasks/09-30-src-quality-remediation/prd.md`
- `.trellis/tasks/09-30-src-quality-remediation/progress.md`
- `.trellis/tasks/09-30-src-quality-remediation/remediation-ledger.json`
- `.trellis/tasks/09-30-src-quality-remediation/remediation-ledger.md`
- `.trellis/tasks/09-30-src-quality-remediation/research/B-next-unit-contracts.md`
- `.trellis/tasks/09-30-src-quality-remediation/task.json`
- `.trellis/tasks/09-30-src-quality-remediation/tools/render-ledger.py`
- `.trellis/tasks/09-30-src-quality-remediation/tools/verify-ledger.py`
- `.trellis/tasks/09-30-src-remediation-a/check.jsonl`
- `.trellis/tasks/09-30-src-remediation-a/design.md`
- `.trellis/tasks/09-30-src-remediation-a/implement.jsonl`
- `.trellis/tasks/09-30-src-remediation-a/implement.md`
- `.trellis/tasks/09-30-src-remediation-a/prd.md`
- `.trellis/tasks/09-30-src-remediation-a/research/B01-scope-preparation.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A-final-check.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A-integration.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A01-check.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A01-implementation.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A02-check.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A02-eslint-results.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A02-eslint-run.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A02-implementation.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A03-check.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A03-implementation.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A04-check.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/A04-implementation.md`
- `.trellis/tasks/09-30-src-remediation-a/reviews/check-initial-context.jsonl`
- `.trellis/tasks/09-30-src-remediation-a/reviews/implement-initial-context.jsonl`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/build-stderr.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/build-stdout.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/commands.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/diffcheck.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/eslint-results.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/eslint-run.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/eslint-summary.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/generated-route.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/models-stderr.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/models-stdout.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/post-gate-source-check.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/pre-gate-source-hashes.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/tests-stderr.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/tests-stdout.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/typecheck-stderr.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/before-A04-check-fixes/typecheck-stdout.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/build-stderr.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/build-stdout.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/commands.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/diffcheck.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/eslint-results.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/eslint-run.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/eslint-summary.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/generated-route.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/models-stderr.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/models-stdout.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/post-gate-source-check.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/pre-gate-source-hashes.json`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/tests-stderr.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/tests-stdout.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/typecheck-stderr.txt`
- `.trellis/tasks/09-30-src-remediation-a/reviews/integration/typecheck-stdout.txt`
- `.trellis/tasks/09-30-src-remediation-a/task.json`
- `.trellis/tasks/09-30-src-remediation-a/tools/scan-changed-source.py`
- `.trellis/tasks/09-30-src-remediation-a/tools/verify-batch.py`

## 未识别修改

无。

代码提交：57f842be60ea45f3b5292df6066904484f448afe。第二笔为本文件所列任务记录提交，其自身SHA不写入自身。执行前dirty paths与清单完全一致，验证过的source/test hashes完全一致，未纳入其他用户编辑。
