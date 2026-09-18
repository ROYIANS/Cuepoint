# Local reference research

Inspected /Users/xiaomengdao/WebstormProjects/lobehub at commit
`ebe586289d55936b738e4dc822dbdd745196b4f3` on 2026-09-19. These are observations
of that checkout, not claims about all live deployments. No source copied into product.

## Findings
1. `packages/const/src/settings/agent.ts:26` defines defaults:
   enableContextCompression=true, enableHistoryCount=false, historyCount=20.
   Therefore a 20-message preset is distinct from enabling the cap.
2. `src/features/ChatInput/ActionBar/Params/Controls.tsx:852` renders compression
   and history switches. A conditional SliderField has min=0, max=20 and
   unlimitedInput, so 20 is not necessarily the maximum supported typed value.
3. `packages/context-engine/src/processors/HistoryTruncate.ts` counts logical groups,
   preserves grouped assistant/tool relationships and returns none at zero.
   Do not implement arbitrary wire-array slicing.
4. `packages/agent-runtime/src/utils/tokenCounter.ts` uses a default 128,000-token
   window, 0.5 threshold ratio and drift-aware accounting (default multiplier 1.25).
   The count includes tool definitions and calls. 64,000 follows from those defaults;
   it is not a universal model limit or guaranteed reduction rate.
5. `packages/agent-runtime/src/agents/GeneralChatAgent.ts:565` uses hysteresis after
   an existing summary: default subsequent threshold 0.65 (constant at line 52),
   unless configured. `toLLMCall` checks before calls, including later tool rounds.
6. `packages/agent-runtime/src/transport/compression.ts` separates buildPrompt,
   createGroup, finalizeGroup, rollbackGroup and updateGroup behind a persistence
   interface. `src/store/chat/agents/transports/ClientCompressionTransport.ts` tracks
   compression and summary operations, propagates abort and finalizes/rolls back groups.
   Its client transport still calls application services; it is not a drop-in
   IndexedDB-only solution for Cuepoint.
7. Prompt sources: `packages/prompts/src/chains/compressContext.ts` and
   `packages/prompts/src/prompts/compressContext/index.ts` (read after default policy
   confirmation). The chain supplies prior summary plus new history in a user message
   under a dedicated compression system instruction. Summary sections include context,
   key information, decisions, action items and technical details. It explicitly keeps
   the latest user instruction authoritative and marks superseded/completed goals as
   historical; the 60–80% reduction is a prompt aspiration, not a runtime guarantee.

## Current Cuepoint integration points
- `src/lib/agent/contextUsage.ts:5`: all complete/legacy messages are directly mapped
  into the request; no limit/summary policy exists. Token estimator is a heuristic.
- `src/db/agentRuns.ts`: creates immutable request/task/settings snapshots in a local
  transaction. Model I/O must remain outside Dexie transactions.
- `src/lib/agent/runChat.ts:97`: loop over model calls/tool rounds; budget checks need
  to cover this loop, not just the Send handler.
- `src/domain/agent.ts`: run status and responseItems; keep compaction jobs distinct
  from assistant message output and tool accounting.
- `src/db/agentSettings.ts`, `src/domain/types.ts:520`: add defaults/thread overrides.
- `src/components/agent/AgentControls.tsx`, `ContextUsagePanel.tsx`: config entry and
  context preview; same planner should produce runtime and displayed allocations.

## Adaptation guidance
Keep raw records; activate only completed summaries. Carry task/plan data as structured
source-of-truth inputs. Respect response call/output and reasoning continuation groups.
Treat summaries as fallible historical data, not elevated system instructions or
user-approved durable knowledge. Record real provider usage separately from estimates.
