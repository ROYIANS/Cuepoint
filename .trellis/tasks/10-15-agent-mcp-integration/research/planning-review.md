# Research: E10 planning consistency review

- Query: Review the converged PRD/design/stage plan against current product integration and published SDK findings.
- Scope: internal consistency; existing authored SDK evidence reused, no new external compatibility claim.
- Date: 2026-10-16

## Findings

The plan consistently retains the confirmed scope: desktop macOS/Windows, both stdio and Streamable HTTP, manual credentials plus OAuth, and practical Web remote reuse without a new proxy or desktop dependency. It addresses the actual static registry/admission gap, frozen offered definitions, binding fingerprints, E07 finite-kind extension, unknown-effect publication, native credential revision boundaries and SDK replay defaults. No blocking product-scope contradiction was found. Source/dependency compatibility remains deliberately unproven until the Stage 1 spike.

Two implementation-contract clarifications should be incorporated before the relevant stage, rather than left to incidental adapter behavior:

1. **Unknown MCP report publication must not return a success-shaped tool result to the ordinary loop.** `packages/agent-core/src/runtime.ts:164–167` unconditionally tries the non-atomic running→completed transition when `tool.execute` returns, and lines 177–188 treat only persisted `completed` as established success. Once E07 preserves original call `unknown`, its MCP adapter must retain/publish evidence and then raise the reviewed typed unresolved/pending outcome, rather than return its report descriptor. E07's `savedResult` (`packages/studio/src/features/agent/commands/agentJobs.ts:89`) currently accepts only completed calls; publication reconciliation (`:237`) and historical report loading must explicitly support retained unknown evidence without interpreting it as completion or permission to repeat. The design requires the right semantics; Stage 3 should name this return/error and readback branch and test actual loop settlement, not only stored job status.

2. **Late known replies belong to the original call even after the generation is retired.** `design.md` correctly retires dispatch authority on edit/disconnect and preserves a completion when Stop arrives late. Clarify the same distinction for disconnect/reconnect/tool-list replacement: forbid new dispatch and publication *into a replacement*, but allow an established original reply to update only its exact original invocation/job/call when those owners still exist. A blanket postflight `assertCurrent` would discard known effects and manufacture unknown outcomes after successful IO. Conversely, an unknown or unverifiable late response must remain unknown. `packages/agent-core/src/runtime.ts:171–177` already reconciles original committed completions; `agentJobs.ts:58–62` binds historical reports to their original call envelope. Add one fixture barrier after effect/before reply, retire generation, deliver the original response, and prove no replacement write or repeat invocation occurs. Deletion still prevents resurrection.

Neither clarification requires reopening transport/auth/platform choices or expanding scope. They can be a few lines in design/Stage 3 plus focused cases in the planned original-operation/late-completion tests.

Main-agent resolution, 2026-10-16: both clarifications are now explicit in
design.md and Stage 3/AC2 validation in implement.md. This closes the planning
wording findings; actual implementation and runtime tests remain pending.

## Files found

- `.trellis/tasks/10-15-agent-mcp-integration/prd.md`: confirmed desktop priority and complete selected transport/authentication requirements.
- `.trellis/tasks/10-15-agent-mcp-integration/design.md`: concrete native host, credential revision, discovery, dispatch and retained-result design.
- `.trellis/tasks/10-15-agent-mcp-integration/implement.md`: bounded SDK spike and four implementation stages with scoped checks and explicit deferred installed acceptance.
- `.trellis/tasks/10-15-agent-mcp-integration/research/product-integration-design.md`: current static Studio composition, core extension seams, binding and E07 limitations.
- `.trellis/tasks/10-15-agent-mcp-integration/research/sdk-and-oauth-design.md`: inspected published SDK defaults, credential and process-lifetime recommendations.
- `packages/agent-core/src/runtime.ts:164`: actual return/completion/error boundary that MCP adapters must satisfy.
- `packages/studio/src/features/agent/commands/agentJobs.ts:89`: completed-only original-result assumption and retained-publication/readback owner.

## Related specs

- `.trellis/spec/frontend/agent-tools.md`: exact approval and unknown outcome barrier.
- `.trellis/spec/frontend/agent-jobs-results.md`: original result certainty, publication and scoped retained readback.
- `.trellis/spec/frontend/native-product-runtime.md`: native generation authority and truthful current-owner validation.
- `.trellis/spec/frontend/interaction-feedback.md`: quiet normal paths and actionable uncertainty recovery.

## External references (docs, versions)

No additional web research or version claim. The SDK report's published rmcp 3.5.1 and browser client 2.3.1 candidates remain prospective dependencies; no installation or execution occurred in this review.

## Caveats / Not Found

- This is a planning/source review, not a compiler, protocol fixture, login, native vault, process-tree or installed-platform pass.
- No implementation, tests/builds, task metadata/spec edits, Git operations or delegation were performed.
- Read context through PRD/design/implementation plan and authored research; researcher isolation excludes implement/check manifests.
