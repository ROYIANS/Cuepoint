# Agent tools, permissions and continuation

## 1. Scope / Trigger
Read when changing tool protocol, Agent execution steps, approval UI, skills or configuration. This extends [execution foundation](./agent-execution.md); business CRUD and durable media execution follow [creative skills](./agent-creative-skills.md).

## 2. Signatures
- `AgentPermissionMode`: ask / assist / full.
- `AgentToolDefinition`: name/title/description/parameters/effect/parseArguments/highRisk/execute; optional prepare, atomic, recovery and requiresConfirmation.
- `requiresToolApproval(mode, tool, args): boolean` uses code-owned effect and risk.
- `getGeneralAgentConfig()` / `updateGeneralAgentConfig({permissionMode?, enabledSkillIds?})` in `db/agentSettings.ts`.
- `saveToolRound`, `transitionToolCall`, `pauseForApproval`, `resolveAgentToolApproval(runId, callId, decision)`, `resumeAgentRun`, `cancelAgentRun` in `db/agentTools.ts`.
- `resumeChatRun(runId, apiKey, controller, fetchImpl?, registry?)` runs under the thread Web Lock.
- Dexie v9 `agentToolCalls`: indexes include runId/threadId and unique run+providerCallId.

## 3. Contracts
- Run snapshots permissionMode, enabledToolNames and skill instructions. Later global changes affect only new runs, never pending approvals. Default is ask. Basic model transport and local plan/execution bookkeeping do not require tool approval.
- Ask gates business write/network tools; assist gates high-risk tools; full permits available validated tools without routine approval. Code-owned requiresConfirmation still gates paid submit_generation in every mode, so its configuration can be reviewed before spending. Risk/effect come from registry code, not model arguments. Effect/risk must match the approved durable call snapshot before execution.
- The two foundation tools remain: workspace_overview reads bounded project titles/counts; update_run_plan changes the current run checklist atomically with its result. They are joined by 33 business tools and 5 generation tools across six skill groups; see creative skills for the supported surface.
- Tool arguments use strict runtime schemas before dispatch. Registry enabled names are frozen per run. Unknown/disabled tools, invalid arguments and owner mismatches cannot execute.
- One model round emits a complete assistant tool_calls envelope; persist it and immutable tool records before invoking any tool. Never execute argument fragments as they stream. Complete tool results append once to the continuation message chain before the next request.
- Allow 32 model requests per segment (MODEL_STEPS_PER_SEGMENT), max 16 calls per model response, 32,768 argument characters per call, 65,536 result characters. Cumulative modelStep remains monotonic for ledger ordering and usage. Optional modelStepSegmentStart defaults to zero for legacy runs. Before context preparation or a new request, pauseAtModelStepLimit atomically parks run/message as interrupted with pauseReason=model_step_limit, preserving output/results. Only explicit resume from that structured pause advances the segment start; approval, ordinary interruption and reload never refresh allowance. A final answer on request 32 completes normally.
- Approval binds runId+callId, is compare-and-set from awaiting_approval and survives reload. Reject saves a tool error result without executing. Multiple approvals remain parked until all decisions are made. UI saves decisions even if the connector is unavailable.
- A failed/interrupted run with durable awaiting calls may still accept explicit decisions if it remains latest and has no running/unknown effects. Keep its failure state and error visible; decisions alone never auto-execute. This also handles failure while saving the paused state.
- Recovery reconciles the crash window between saving awaiting_approval and parking the run: when no unknown tool outcome exists, restore waiting_approval so the original decision remains actionable. Unknown effects take precedence and still block continuation.
- Waiting for approval releases the Web Lock and is nonterminal; startup recovery does not auto-execute it. Explicit continuation reacquires ownership. Completed calls never replay. Ordinary Stop after tool steps produces interrupted state; explicit End execution cancels remaining work.
- Interrupted running side effects become unknown unless the code-owned atomic/repeatable contract or same-owner durable generation job proves safe recovery. Unknown generation status always blocks, including multiple remote task IDs. Users may end a run after checking results. A tool run cannot be restarted from the original prompt; use saved continuation context.
- Thread deletion cascades calls and runs; late results do not resurrect them. Saving failure is reported separately from Stop. Before the next request starts, failed resumption preserves already saved partial answer.
- Tool provider protocol accepts JSON or SSE indexed function fragments only when the tool is enabled. Require unique complete IDs, valid JSON-object arguments and finish_reason tool_calls. Post-finish payload, unknown tool or incomplete calls fail without execution. One POST per model round remains the transport contract.

## 4. Validation & Error Matrix
| Condition | Outcome |
| --- | --- |
| Unknown/disabled tool | No execution |
| Invalid args / injected approval field | Strict rejection, result explains error when safely recorded |
| Ask + write/network | Durable approval pause |
| Assist + high risk | Durable approval pause |
| Full | No routine approval, still validation/ownership checks; paid generation configuration requires confirmation |
| Double approve / cross-run call ID | Reject stale or mismatched decision |
| Approvals partly resolved | Keep parked; do not send another model request |
| Completed call on resume | Reuse result, no invocation |
| Unknown side effect | Block resume/retry; allow ending run |
| Model segment exhausted | Saved, non-error pause; explicit continue grants up to 32 more requests, completed tools never replay |
| Registry effect/risk changed after approval | Refuse old approval |
| Connector unavailable | Permit local rejection/end; model continuation waits |

## 5. Good / Base / Bad
Good: tool result saved → page closes → explicit continue reuses result → next model request.
Base: no tool response, ordinary text completes through the same runtime.
Bad: silently change ask to full for a pending call, retry completed paid work, or append duplicate tool results into history.

## 6. Tests Required
`agentTools.test.ts`: all permission branches with controlled definitions, immutable decision ownership, invalid arguments, original settings snapshot, 32-request segments across reload, repeated continuation without replay, approval/Stop without budget reset, old eight-step failures, final-step completion, duplicate call IDs, approve/reject continuation, uncertain effects, deletion, Stop and save failure, atomic plan result.
`agentToolsReview.test.ts`: approval-before-park crash, multi-approval ordering, live-tab ownership, late deletion result, unknown-effect precedence.
`chatStream.test.ts`: tool JSON/SSE assembly, disabled/invalid/truncated calls, finish reason, call limit, no fallback POST.
Browser local fixture: multiple tool steps and plan, refresh while awaiting approval, approve and reject to final response, inspect result details. Real paid APIs are not required.

## 7. Wrong vs Correct
Wrong: run a tool as soon as its streamed name becomes available, and prompt for approval afterward.
Correct: finish/validate the call envelope, persist it, evaluate code-owned permissions, then claim and execute only after any required decision.

Wrong: clone an interrupted tool run's original request to start over.
Correct: retain assistant/tool call-result chain and execute only unresolved safe steps before asking the model for the next step.

## Composer, metadata and diagnostics
- Composer has status above, plus/model/send inside, mode/permission and context ring below. Plus exposes searchable skills and real controls only. Popup interiors are flat (no nested card borders); model and context dismiss on outside click/Escape, restore trigger focus, and fit narrow viewports.
- ChatItem `aboveMessage` hosts activity/reasoning, `belowMessage` hosts attribution/usage/copy/errors; never position copy buttons over a separately aligned model footer. Clear docs variant negative bottom margin. Completed tools collapse; approvals, unknown outcomes and errors remain visible.
- Context preview shares `buildAgentRequestMessages` with run creation. Counts are explicitly heuristic estimates, never billing usage; provider limits override verified model specs, and unknown limits remain unknown. Provider metadata is connector-scoped and duplicate limits use the smallest known value. No output-limit-as-context fallback.
- Actual usage comes from response JSON/SSE. Persist per-step metrics idempotently; aggregate fields only when all rounds provided them. Generation throughput excludes approval/tool time and requires real output token counts plus streaming timing; historical/missing values are hidden.
- Composer dock measures its full height with ResizeObserver so controlbar and multiline input cannot cover final transcript content.

## Reasoning and Responses
- Model settings offer only verified connector/model effort values. Conversation selection is keyed by thread + connector identity/base URL + model, and saved in ChatThread; each run freezes the effective value. Default means omit the parameter. Retry/resume use the run snapshot.
- GPT-5.6 Luna + enabled functions + effort other than none (including default) uses Responses on supported OpenAI-compatible/AIHubMix connectors. `protocol` is selected before POST and saved; no automatic retry/fallback to another paid endpoint. Explicit legacy text-only retry may select the corrected protocol if no protocol was saved; existing snapshots stay fixed.
- Stateless Responses sends store:false and requests reasoning.encrypted_content. Save full output envelope with tool ledger atomically, and append paired function_call_output exactly once. Require complete terminal status and enabled/validated functions before dispatch. Preserve encrypted reasoning for continuation only; public UI renders summary text, never ciphertext or raw reasoning fields.
- `responseItems` consistency is checked before replaying side effects. Incomplete/error/aborted streams never cause partial tool execution. Terminal-only output does not create first-token timing.
- Source references: local LobeHub useReasoningEffortControl, modelExtendParams, contextBuilders/openai; official OpenAI reasoning/function-calling and AIHubMix Responses overview.
- Chat shell uses overflow:clip on its non-scrollable outer layer: the decorative grain extends outside its bounds, and hidden overflow can be programmatically scrolled by popup auto-focus. Transcript alone owns conversation scrolling; focus calls use preventScroll.
## LobeHub context metadata reference

LobeHub separates the model's advertised capacity from the live context estimate. The static fallback metadata is maintained in its `model-bank` package (`packages/model-bank/src/aiModels/openai.ts`), where GPT-5.6 Luna declares a `contextWindowTokens` value of `1_050_000`; the same model's pricing table has a separate `272_000` token tier boundary. Provider `/models` data is normalized in `packages/model-runtime/src/utils/modelParse.ts`, with provider values taking precedence over the model-bank fallback. The composer inspector uses `useTokenBreakdown → useTokenCount → packages/utils/src/tokenizer` (the `tokenx` npm estimator) to count sliced message text, draft, assistant instructions, tool definitions/prompts and history summary. Its runtime context-engine has a separate, richer accounting path for tool results, reasoning and provider usage. The popup is not reading a usage total from the model-list endpoint.

When matching this behavior locally, keep capacity (`contextWindowTokens`) and request usage as separate fields. A single maximum value is suitable for the progress denominator, while pricing thresholds should remain metadata for billing display and must not be presented as a second context limit.

## Composer surfaces

The home composer exposes only the conversation type (`Agent` / `任务`), the plus menu, model selection and send. The detail composer adds the execution surface (`智能` / `对话`), permission control, context inspector, expand editor, browser-supported voice input and send-shortcut menu. Conversation mode snapshots an empty tool list into the run; changing the UI mode affects only new runs.

- Expanded editor is an opaque, borderless surface scoped to the conversation column. Its dock fills the column and lifts the normal 800px width cap; textarea flexes to remaining height with autosize disabled, toolbar/controlbar stay at the bottom. Keep sidebar visible, hide/inert the covered transcript, preserve draft/selection, reset expansion when changing topics. Expanded Enter inserts a newline; Cmd/Ctrl+Enter sends, IME composition never sends.
- Home Agent/任务 switch is inside the lower-left toolbar, before plus. Detail's smart/conversation switch is bottom-left; permissions + context are bottom-right. The task board is still deferred and its menu item is labeled accordingly.
- Interaction mode is persisted per thread and frozen per run. Context preview uses the same empty skill/tool set in conversation mode. Legacy retries must retain empty missing tool snapshots instead of taking current global skills.
- Reference model capacity is independent of connector-specific reasoning support (e.g. APIMart). Label it as reference; a reported gateway limit still takes precedence. Pricing tiers are not alternate context capacities.
