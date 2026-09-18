# Agent tools and permissions

## Outcome and authorization
Second sequential child of the user-approved Agent core round, after execution/message foundation. Chat can run validated builtin tools through a bounded multi-step model loop; all tool calls/results/approval decisions remain visible and durable.

## Scope
- Tool and skill registries, strict argument validation, provider wire tool-call support.
- Three permission modes: request approval for edits/internet; assist approval for high-risk operations; full access executes available validated tools. Basic model calls and local execution/plan bookkeeping never need tool approval.
- Persist calls, arguments, decisions and results; render readable progress, approve/reject and resume controls in conversation.
- Initial builtin skills: workspace overview (read-only project/asset counts and limited titles) and execution planning (maintain this run's checklist). Future task board consumes the same plan semantics; no business mutations or real internet tool yet.
- Reload preserves pending approvals. Completed calls are not executed again. Ambiguous interrupted side effects must stop for reconciliation rather than silently retry.

## Acceptance
1. Model can query workspace overview, record a plan, receive tool results, and finish an answer in one run.
2. Unknown tools, invalid arguments, mismatched run ownership and disabled tools cannot execute.
3. Permission matrix is tested with controlled write/network/high-risk tools. Model-supplied risk/approval flags cannot bypass policy.
4. Approval is bound to one immutable call; decisions survive reload, reject produces a tool result, double-click cannot double execute.
5. Sequential tool rounds are bounded; errors and step limit are honest terminal outcomes. A partial tool round is not treated as a final answer.
6. Stop, deletion, browser route changes and retry maintain existing execution invariants. Runs that already executed tools cannot restart from initial prompt and repeat effects.
7. Pure frontend; no network search, business CRUD, media generation, attachments, memory or subagent delegation introduced.


## Approved UI/protocol additions (2026-09-19)
- Cursor-style composer with status above and mode/permission/context below; flat searchable plus/skills menus, no nonfunctional controls.
- Compact dismissible context popover; provider model metadata first, explicit estimate/source/unknown semantics.
- Model-specific reasoning configuration persisted per thread and frozen per run; model info and actual token/throughput attribution in message footer.
- Responses support for GPT-5.6 Luna function tools with reasoning, complete-envelope durable continuation and no automatic paid retry.
- Responsive model picker and outside-click/Escape/focus behavior for popovers.

## Home/detail and expanded editor refinement (2026-09-19)
- Home Agent/task and plus belong inside the composer; permissions/context only appear in detail.
- Detail smart/conversation is a real execution switch, persisted per thread and frozen for retries. Conversation sends no tool schemas or skill prompts.
- Expanded editor fills only the conversation column, starts at the top, hides covered transcript/header, keeps sidebar visible, and pins toolbars to the bottom. Preserve draft and support newline/IME safely.
- Expose browser-supported voice input and durable Enter vs Cmd/Ctrl+Enter preference; expanded editing always uses Cmd/Ctrl+Enter.
- Trace local LobeHub model capacity, pricing tier and live token estimation sources; retain provider priority and separate fallback model metadata from reasoning support.

## Model Bank (2026-09-19)
- User approved an application-owned catalog for common model metadata, maintained manually on demand rather than scheduled synchronization.
- Migrate existing verified exact-ID context/reasoning records, support source-attributed output limits, and share per-field provider-first resolution between picker and context inspector.
- Supply a read-only local LobeHub comparison command with revision/hash, changed/missing fields and untracked IDs. No executing upstream code or automatic runtime capability changes.

## Full Model Bank correction (2026-09-19)
- User explicitly requires the entire LobeHub Model Bank, identical data with no
  selective six-model subset or invented additions. This supersedes the curated
  subset scope above; manual maintenance remains unchanged.
- Copy all package files verbatim and retain license/provenance. Derive complete
  model arrays without field filtering and keep supplier variants separate.
- Replace handwritten bank with full-data lookup, preserving live provider priority
  and separate application transport constraints. Verify source bytes and generated
  field equality; include all model types, enabled/disabled and empty catalogs.
