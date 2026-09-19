# Proposed integrated commit plan

Status: user approved the complete commit and archive plan with “提交” on 2026-09-19. No push. All listed paths were created or edited for this integrated task. No unrecognized dirty files observed.

## 1. feat: add web research and named-project image inspection

- `src/components/agent/AgentRunDetails.tsx`
- `src/components/agent/ProjectImageSources.tsx`
- `src/components/agent/WebResearchSources.tsx`
- `src/components/studio/ConnectorsPage.tsx`
- `src/components/studio/SearchConnection.tsx`
- `src/db/database.ts`
- `src/db/searchConnections.ts`
- `src/domain/imageDiscovery.ts`
- `src/domain/referenceInput.ts`
- `src/domain/search.ts`
- `src/lib/agent/imageDiscovery.ts`
- `src/lib/agent/memoryToolNames.ts`
- `src/lib/agent/referenceContext.ts`
- `src/lib/agent/referenceEvidence.ts`
- `src/lib/agent/referenceToolNames.ts`
- `src/lib/agent/referenceTools.ts`
- `src/lib/agent/skills.ts`
- `src/lib/agent/tools.ts`
- `src/lib/agent/webToolNames.ts`
- `src/lib/agent/webTools.ts`
- `src/lib/ai/referenceWire.ts`
- `src/lib/ai/tavily.ts`
- `tests/imageDiscovery.test.ts`
- `tests/productionProposals.test.ts`
- `tests/webResearch.test.ts`
- `tests/webResearchRuntime.test.ts`

## 2. docs: record web research and project image contracts

- `.trellis/spec/frontend/agent-image-discovery.md`
- `.trellis/spec/frontend/agent-project-context.md`
- `.trellis/spec/frontend/agent-references.md`
- `.trellis/spec/frontend/agent-web-research.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/tasks/09-19-agent-project-image-discovery/check.jsonl`
- `.trellis/tasks/09-19-agent-project-image-discovery/design.md`
- `.trellis/tasks/09-19-agent-project-image-discovery/implement.jsonl`
- `.trellis/tasks/09-19-agent-project-image-discovery/implement.md`
- `.trellis/tasks/09-19-agent-project-image-discovery/prd.md`
- `.trellis/tasks/09-19-agent-project-image-discovery/research/acceptance-matrix.md`
- `.trellis/tasks/09-19-agent-project-image-discovery/research/existing-image-path.md`
- `.trellis/tasks/09-19-agent-project-image-discovery/research/review.md`
- `.trellis/tasks/09-19-agent-project-image-discovery/retrospective.md`
- `.trellis/tasks/09-19-agent-project-image-discovery/task.json`
- `.trellis/tasks/09-19-agent-project-image-discovery/validation/combined-mobile.png`
- `.trellis/tasks/09-19-agent-project-image-discovery/validation/combined-web-mobile.png`
- `.trellis/tasks/09-19-agent-project-image-discovery/validation/desktop.png`
- `.trellis/tasks/09-19-agent-project-image-discovery/validation/image-browser.cjs`
- `.trellis/tasks/09-19-agent-project-image-discovery/validation/mobile.png`
- `.trellis/tasks/09-19-agent-project-image-discovery/validation/quality.md`
- `.trellis/tasks/09-19-agent-web-research/check.jsonl`
- `.trellis/tasks/09-19-agent-web-research/design.md`
- `.trellis/tasks/09-19-agent-web-research/implement.jsonl`
- `.trellis/tasks/09-19-agent-web-research/implement.md`
- `.trellis/tasks/09-19-agent-web-research/prd.md`
- `.trellis/tasks/09-19-agent-web-research/research/provider-feasibility.md`
- `.trellis/tasks/09-19-agent-web-research/research/review.md`
- `.trellis/tasks/09-19-agent-web-research/retrospective.md`
- `.trellis/tasks/09-19-agent-web-research/task.json`
- `.trellis/tasks/09-19-agent-web-research/validation/connection-mobile.png`
- `.trellis/tasks/09-19-agent-web-research/validation/cors-browser.cjs`
- `.trellis/tasks/09-19-agent-web-research/validation/desktop.png`
- `.trellis/tasks/09-19-agent-web-research/validation/mobile.png`
- `.trellis/tasks/09-19-agent-web-research/validation/quality.md`
- `.trellis/tasks/09-19-agent-web-research/validation/web-browser.cjs`
- `.trellis/tasks/09-19-agent-web-vision/check.jsonl`
- `.trellis/tasks/09-19-agent-web-vision/commit-plan.md`
- `.trellis/tasks/09-19-agent-web-vision/design.md`
- `.trellis/tasks/09-19-agent-web-vision/implement.jsonl`
- `.trellis/tasks/09-19-agent-web-vision/implement.md`
- `.trellis/tasks/09-19-agent-web-vision/prd.md`
- `.trellis/tasks/09-19-agent-web-vision/task.json`
- `.trellis/tasks/09-19-agent-web-vision/validation.md`

## Verification
Independent lint/type-check, 72 test files / 891 tests, production build and diff check passed. Native Edge fixtures passed image-only and combined web/image loops for both protocols, source UI/mobile/keyboard, scope boundaries and configuration lifecycle. Authenticated Tavily search and live-model interpretation remain unverified; billed services were intercepted.

## Follow-on bookkeeping
After approved work commits, archive both verified child tasks and the integrated parent in a separate archive commit, then record the developer journal in a separate journal commit. No remote push. Archival updates paths and final status; do not interleave it with the two work commits.
