# Design and boundaries

## Model Bank increment boundary
The current metadata references live inside reasoningPolicy and presentation combines
provider/reference fields independently. Move existing definitions to lib/ai/modelBank,
add a shared resolver in modelMetadata and consume it in both UI surfaces. Preserve
reasoning connector gates and exact-ID semantics. Add an independently implemented
read-only AST comparison script and manual maintenance notes. No wholesale upstream
package vendoring, runtime catalog fetch, scheduler, provider pricing or new protocol
capabilities. Regression tests prove wire policy and provider precedence remain intact.

## Gap and implementation locations
Current transport rejects tool responses; runChat makes one request and has no tool ledger/policy. Add wire support in chatStream, durable tool call repository and v9 table, runtime loop in lib/agent, registry/skills definitions, and UI progress/approval controls. Existing Agent task/run/connector separation is preserved. No production adapters or business mutation APIs change.

## Contracts shared by workers
Domain owns AgentPermissionMode ('ask'|'assist'|'full'), AgentToolCall record, wire request messages and call shape. Run snapshots permissionMode, enabledToolNames and skill instructions at begin; current mode changes affect new runs only. Optional fields let v8 runs remain readable/retryable. AgentConfig stores default mode and enabled skills; initial default is ask.
Tool registry definitions are code-owned: name/title/description, JSON parameters, parseArguments(raw):unknown (Zod strict), effect ('read'|'write'|'network'|'bookkeeping'), highRisk(args), execute(args,{runId,threadId,signal}). Builtins workspace_overview and update_run_plan. No model-directed dynamic imports or arbitrary URLs.
Tool wire messages use assistant tool_calls and tool tool_call_id. ChatMessage role remains display-only; AgentRequestMessage is separately extended for wire. Transport only accepts calls when input.tools includes matching tool name; parser assembles indexed streaming fragments, validates IDs/name/JSON and returns toolCalls on success with finishReason tool_calls. Exactly one POST per round; no implicit fallback.

## Durable steps
Persist complete model tool-call envelope and immutable calls before any tool executes. A unique run+provider-call-ID ledger prevents duplicate dispatch; input name/arguments mismatch rejects. Call states: pending, awaiting_approval, approved, running, completed, failed, rejected, unknown. Run waiting_approval is nonterminal. Record result before next model request; append a full assistant/tool chain exactly once to continuationMessages. Store modelStep and current output separately; checkpoint monotonic across rounds.
Resume waiting calls only after acquiring per-thread lock. Approval decisions are atomic compare-and-set and scoped to exact run/call. Pause releases lock. Reload does not execute anything automatically. Interrupted running tools become unknown (conservative, no blind replay); a run with unknown effects cannot be retried from scratch. Completed tool steps never execute twice. Internal plan tool mutation/result should share a Dexie transaction to be safely deduplicated.

## Runtime limits and UX
Max 8 model requests per run, max 16 tool calls per response, bounded argument/output sizes. Stop checks before/after every await and before dispatch. Deletion cannot recreate ledger rows. UI shows tool title/status/arguments/result with approve/reject or continue for recoverable execution. If tool execution already happened, use resume from saved context instead of initial-prompt retry. Unknown outcome shows an explicit reconciliation message and permits cancel only.
Permission selector has three Chinese labels and explanatory text; persisted Agent setting is snapshotted per run. Builtin skill panel lists real current capabilities, not future claims. Pending approval cards show scope and requested change; broader mode must never retroactively authorize pending calls.

## Reference and validation
Reference LobeHub agent-runtime humanApprove and context-engine tools/skills separation; use IndexedDB/Web Locks rather than server orchestration. Controlled fixture tools test all permission branches without shipping fake business actions. No dependency additions. Tests cover ledger transactions, policy, loop/round context, rejection/resume/recovery, no repeat, provider tool fragments, legacy text chat and browser fixture flows.

## User-requested UI refinement (before work commit)
User provided reference screenshots and approved refinements to this existing child: minimize composer controls, unify their shape, remove unimplemented plus-menu and reasoning stubs, fix copy/footer overlap and align with answer content, replace nested tool cards with an expandable activity list. Preserve runtime/approval semantics; mandatory attention stays visible and completed steps collapse. Reference local LobeHub ChatInput and Conversation source and installed ChatItem slots; keep repository visual language. Implementation ownership: composer controls/CSS versus transcript/run details/CSS. Verify actual browser at desktop and narrow viewport, approval state, expanding results and copying, then existing lint/tests/build.

## Cursor composer and context inspection increment
User requested a three-level composer: actual execution status above, plus/model/send in the input surface, mode/permission and context usage below. Plus routes to a searchable skills subpage, the same model picker, and the context inspector. No unavailable MCP/upload/search actions. Context uses the same eligible message assembly as beginAgentRun; active/recoverable runs use frozen request/continuation context. Character-based token counts are explicitly estimates; no fabricated capacity or actual usage. This changes composer props, context helper/tests, transcript slots and dock safe-area measurement. User additionally approved real reasoning parameter transport in this iteration; model-specific supported values, frozen run settings, legacy defaults and retry/resume preservation are required.

## Final UI steering and protocol compatibility
User prefers compact anchored context popover (not full width), outside-click/Escape dismissal for both context and model selection, and flat plus menu internals. Use Radix nonmodal popovers with shared themed portal, collision padding and focus restoration. Plus home has search/categories and skills subpage only; no model/context shortcuts. Model metadata is normalized from provider directory `context_length`/`context_window`, otherwise explicitly labeled verified reference fallback. Price hidden without a trustworthy price/unit contract. Reply footer contains icon/model/real cumulative usage/measured throughput only when available; no estimated billing stats.
User observed GPT-5.6 Luna + function tools + reasoning incompatibility on Chat Completions. Add a frozen protocol decision and stateless Responses adapter, preserving encrypted reasoning items for protocol continuity only. Full response items must be saved atomically with tool calls before dispatch; resume uses saved function outputs and never resubmits paid requests automatically after failure. A user-triggered retry of legacy text-only failed runs may select the corrected protocol; explicitly snapshotted protocols stay immutable.

## Full snapshot boundary (supersedes curated subset)
Copy the complete packages/model-bank into vendor/lobehub/model-bank, unchanged.
Keep license+manifest outside the mirrored directory. Generate all default provider
model arrays and a small capacity index from those source modules; schemas/constants
and computed records must retain upstream values. The runtime adapter owns lookup
precedence, not data editing. Replace the previous six-entry catalog; move existing
wire allowlist back to reasoningPolicy so complete data is not confused with the
client's implemented protocols. Restrict test discovery to application tests while
retaining upstream tests verbatim. Sync is manual and local; no scheduler/network.
