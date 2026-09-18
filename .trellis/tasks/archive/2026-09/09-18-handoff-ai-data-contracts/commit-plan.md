# Proposed batch-three commits

## 1. fix: align workspace header across responsive layouts
- src/components/workspace/WorkspaceChrome.tsx

## 2. feat: add production handoff and reviewed change contracts
- src/components/produce/ProducePage.tsx
- src/components/produce/ProductionProposalsPanel.tsx
- src/db/database.ts
- src/db/repo.ts
- src/db/productionProposals.ts
- src/domain/production.ts
- src/lib/productionHandoff.ts
- src/lib/productionContext.ts
- src/lib/productionRevision.ts
- src/lib/generationIntent.ts
- tests/productionHandoff.test.ts
- tests/productionContext.test.ts
- tests/productionProposals.test.ts
- tests/generationIntent.test.ts
- .trellis/spec/frontend/index.md
- .trellis/spec/frontend/quality-guidelines.md
- .trellis/spec/frontend/production-contracts.md
- .trellis/tasks/09-18-handoff-ai-data-contracts/prd.md
- .trellis/tasks/09-18-handoff-ai-data-contracts/design.md
- .trellis/tasks/09-18-handoff-ai-data-contracts/implement.md
- .trellis/tasks/09-18-handoff-ai-data-contracts/implement.jsonl
- .trellis/tasks/09-18-handoff-ai-data-contracts/check.jsonl
- .trellis/tasks/09-18-handoff-ai-data-contracts/task.json
- .trellis/tasks/09-18-handoff-ai-data-contracts/verification.md
- .trellis/tasks/09-18-handoff-ai-data-contracts/commit-plan.md

## Excluded
- .tanstack/ — pre-existing unrelated generated files.

After confirmation, commit work first, then archive current task and record journal via Trellis scripts. Do not amend or push.
