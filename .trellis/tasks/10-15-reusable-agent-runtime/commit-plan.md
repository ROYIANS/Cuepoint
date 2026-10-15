# Checkpoint commit plan

Status: implementation, final native ALL, all current-input bindings and cumulative integration review pass within the verification limits. The owner approved these exact groups and following child/parent archive+journal with “可以提交了” on 2026-10-15. Source/spec work commit is `928d723149b2f1bd7720edc8ee7becce74ef6f72`; task-document work commit follows.

Base: `c3bec9e96916c963840081919135e62663426bca`, branch `codex/reusable-agent-runtime`. All paths below are relative to the repository root. They are recognized changes authored by the current main/serialized implementer/checker session. The unrelated desktop-release task has no changed path in this batch.

## 1. `refactor: 抽离可复用 Agent 运行时`

Includes the actual core/provider packages, independent durable example, production Studio bindings, all affected build/quality/test/CI inputs, root/package documentation and canonical Trellis specs/registration. Removed former HTTP mechanism files are intentional moves into the provider package; Studio's product policy adapters remain.

147 paths:

- `.github/workflows/ghcr.yml`
- `.trellis/config.yaml`
- `.trellis/spec/agent-core/library/index.md`
- `.trellis/spec/agent-core/library/runtime.md`
- `.trellis/spec/agent-providers/library/index.md`
- `.trellis/spec/agent-providers/library/protocols.md`
- `.trellis/spec/agent-todo/cli/durable-host.md`
- `.trellis/spec/agent-todo/cli/index.md`
- `.trellis/spec/frontend/agent-context.md`
- `.trellis/spec/frontend/agent-execution.md`
- `.trellis/spec/frontend/agent-tools.md`
- `.trellis/spec/frontend/ai-connectors.md`
- `.trellis/spec/frontend/directory-structure.md`
- `.trellis/spec/frontend/monorepo-boundaries.md`
- `.trellis/spec/studio/frontend/index.md`
- `Dockerfile`
- `README.en.md`
- `README.md`
- `apps/desktop/package.json`
- `apps/desktop/scripts/build-frontend.mjs`
- `apps/desktop/scripts/build-frontend.test.mjs`
- `apps/desktop/ui/acceptanceStream.ts`
- `apps/web/package.json`
- `apps/web/vite.config.ts`
- `eslint.config.mjs`
- `examples/agent-todo/README.md`
- `examples/agent-todo/package.json`
- `examples/agent-todo/src/cli.ts`
- `examples/agent-todo/src/conformance.test.ts`
- `examples/agent-todo/src/host.ts`
- `examples/agent-todo/src/store.ts`
- `examples/agent-todo/src/summary.ts`
- `examples/agent-todo/src/tools.ts`
- `examples/agent-todo/src/types.ts`
- `examples/agent-todo/tsconfig.json`
- `knip.json`
- `package.json`
- `packages/agent-core/README.md`
- `packages/agent-core/package.json`
- `packages/agent-core/src/capabilities.ts`
- `packages/agent-core/src/checkpoint.ts`
- `packages/agent-core/src/compaction.test.ts`
- `packages/agent-core/src/compaction.ts`
- `packages/agent-core/src/contextBudget.ts`
- `packages/agent-core/src/index.ts`
- `packages/agent-core/src/reasoning.ts`
- `packages/agent-core/src/runtime.test.ts`
- `packages/agent-core/src/runtime.ts`
- `packages/agent-core/src/tools.test.ts`
- `packages/agent-core/src/tools.ts`
- `packages/agent-core/src/types.ts`
- `packages/agent-core/tsconfig.json`
- `packages/agent-providers/README.md`
- `packages/agent-providers/package.json`
- `packages/agent-providers/src/chatCompletions.ts`
- `packages/agent-providers/src/continuation.ts`
- `packages/agent-providers/src/endpoints.ts`
- `packages/agent-providers/src/http/baseUrl.ts`
- `packages/agent-providers/src/http/boundedResponse.ts`
- `packages/agent-providers/src/http/boundedSse.ts`
- `packages/agent-providers/src/http/index.ts`
- `packages/agent-providers/src/http/limits.ts`
- `packages/agent-providers/src/http/requestBoundary.ts`
- `packages/agent-providers/src/http/safeError.ts`
- `packages/agent-providers/src/index.ts`
- `packages/agent-providers/src/providers.test.ts`
- `packages/agent-providers/src/responses.ts`
- `packages/agent-providers/src/wire.ts`
- `packages/agent-providers/tsconfig.json`
- `packages/studio/package.json`
- `packages/studio/src/features/agent/commands/agentRunTerminalState.ts`
- `packages/studio/src/features/agent/commands/agentRuns.ts`
- `packages/studio/src/features/agent/commands/agentTools.ts`
- `packages/studio/src/features/agent/models/agent.ts`
- `packages/studio/src/features/agent/models/agentToolSelection.ts`
- `packages/studio/src/features/agent/models/context.ts`
- `packages/studio/src/features/agent/providers/chatStream.ts`
- `packages/studio/src/features/agent/providers/openaiCompatible.ts`
- `packages/studio/src/features/agent/providers/referenceWire.ts`
- `packages/studio/src/features/agent/providers/responsesStream.ts`
- `packages/studio/src/features/agent/runtime/businessSchemas.ts`
- `packages/studio/src/features/agent/runtime/contextCompaction.ts`
- `packages/studio/src/features/agent/runtime/contextPlanner.ts`
- `packages/studio/src/features/agent/runtime/contextPolicy.ts`
- `packages/studio/src/features/agent/runtime/contextUsage.ts`
- `packages/studio/src/features/agent/runtime/runChat.ts`
- `packages/studio/src/features/agent/runtime/runCredentials.ts`
- `packages/studio/src/features/agent/runtime/runOwnership.ts`
- `packages/studio/src/features/agent/runtime/toolDefinition.ts`
- `packages/studio/src/features/agent/runtime/toolLoading.ts`
- `packages/studio/src/features/agent/runtime/tools.ts`
- `packages/studio/src/features/agent/ui/chatExecutionFlows.ts`
- `packages/studio/src/features/audio/providers/apimartAudio.ts`
- `packages/studio/src/features/audio/providers/mimoSpeech.ts`
- `packages/studio/src/features/references/providers/tavily.ts`
- `packages/studio/src/features/settings/modelCatalog/sync.ts`
- `packages/studio/src/features/settings/ui/ConnectorsPage.tsx`
- `packages/studio/src/features/settings/updates/download.ts`
- `packages/studio/src/features/video/agent/generationRuntime.ts`
- `packages/studio/src/features/video/providers/aihubmix.ts`
- `packages/studio/src/features/video/providers/apimart.ts`
- `packages/studio/src/platform/http/baseUrl.ts`
- `packages/studio/src/platform/http/boundedResponse.ts`
- `packages/studio/src/platform/http/boundedSse.ts`
- `packages/studio/src/platform/http/requestBoundary.ts`
- `packages/studio/src/platform/http/safeError.ts`
- `packages/studio/src/platform/media/limits.ts`
- `packages/studio/src/platform/runtime/runtimeFetch.ts`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `quality/debt.json`
- `quality/studio-ownership.json`
- `quality/unused-contracts.json`
- `quality/workspaces.json`
- `tests/agentRuns.test.ts`
- `tests/agentRuntimeClaimRaces.test.ts`
- `tests/agentRuntimeCredentials.test.ts`
- `tests/agentRuntimeOwnership.test.ts`
- `tests/boundedInput.test.ts`
- `tests/chatStream.test.ts`
- `tests/d05ToolMetadata.test.ts`
- `tests/d07RequestBoundary.test.ts`
- `tests/e07ErrorContracts.test.ts`
- `tests/fixtures/shared-storage/nativeAcceptanceSuites.json`
- `tests/openaiCompatible.test.ts`
- `tests/setup.ts`
- `tests/webLocksFixture.test.ts`
- `tests/webResearchRuntime.test.ts`
- `tooling/agent-example-check.mjs`
- `tooling/agent-package-inputs.ts`
- `tooling/agent-packages.test.mjs`
- `tooling/build-agent-packages.mjs`
- `tooling/build-web.mjs`
- `tooling/native-storage-regression.mjs`
- `tooling/prepare-native-test-probe.test.mjs`
- `tooling/quality-check.mjs`
- `tooling/quality-fixture.mjs`
- `tooling/quality/architecture.mjs`
- `tooling/quality/shared.mjs`
- `tooling/quality/unused.mjs`
- `tooling/snapshot-owners.ts`
- `tooling/workspace.mjs`
- `tooling/workspace.test.mjs`
- `tsconfig.app.json`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`

## 2. `docs(task): 记录 Agent 抽离与集成验收`

Includes child contracts/context manifests, authored research/independent review and final verification, plus cumulative parent integration and this exact commit plan. Raw temporary scripts, logs, browser profiles, generated evidence and package tarballs remain outside the repository.

25 paths:

- `.trellis/tasks/10-15-monorepo-agent-extraction/implement.md`
- `.trellis/tasks/10-15-monorepo-agent-extraction/prd.md`
- `.trellis/tasks/10-15-monorepo-agent-extraction/verification.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/check.jsonl`
- `.trellis/tasks/10-15-reusable-agent-runtime/commit-plan.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/design.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/implement.jsonl`
- `.trellis/tasks/10-15-reusable-agent-runtime/implement.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/prd.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/baseline-and-change-boundary.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/browser-acceptance.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/conformance-map.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/core-host-slice.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/extraction-inventory.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/final-execution.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/final-repair-boundary.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/independent-review.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/package-boundary-review.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/provider-change-boundary.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/provider-review.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/runtime-review.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/todo-change-boundary.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/research/todo-review.md`
- `.trellis/tasks/10-15-reusable-agent-runtime/task.json`
- `.trellis/tasks/10-15-reusable-agent-runtime/verification.md`

## Unrecognized changes

None in the inspected dirty state. Recheck immediately before executing the confirmed batch; do not silently add any later unrelated path.

## Following work commits

After the two work commits, finish/archive this child and the completed parent coordination task through Trellis, retaining their authored Markdown and recording the accepted checkpoint hashes. Then record the session journal; bookkeeping commits follow all work commits. The unrelated desktop-release task remains active. No amend, push, tag, package publication or hosted dispatch is included.
