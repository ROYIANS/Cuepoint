# D04 context preview contract draft

Coordinator preparation only; apply after independent D04 PASS. Reconcile any checker fix before publication.

## 1. Scope / Trigger

Maintain this contract when changing the chat context preview, usage ring/tooltip/panel, memory details or context-policy editor. Displayed facts must come from one coherent current scope; historical frozen requests and the next-send editable policy are different views. Execution request construction remains in its existing owners.

## 2. Signatures / Owners

- `db/agentContextPreview.ts` owns `ContextPreviewInput`, `contextPreviewIdentity(input)`, `contextPreviewTables()` and `readAgentContextPreview(input): Promise<ContextPreviewRead>`.
- The input contains thread/project/interaction mode, normalized draft, attachments, model/provider and model metadata. Its identity includes those exact request-relevant values; credentials and retained parent-query results are excluded.
- `ContextUsageTrigger` owns one `useContextUsage`/live subscription and one display assembly. Ring, tooltip, `ContextUsagePanel` and preview memory details consume that same result. The panel receives a snapshot rather than querying/planning independently.
- `ContextParameters` retains its own lightweight policy-source query and existing field-intent write/reset/default-copy APIs. `MemoryContextDetails` separately reads current management availability/exclusions, without recomputing preview selection/budget. `MemoryRunHistory` supplies the frozen saved selection and existing readOnly contract.

## 3. Contracts / Invariants

- Resolve model-bank vision preparation outside the database transaction. Durable fact reading uses one outer read-only transaction over the explicit deduplicated preview table list, including every nested task/project/memory/reference/IP/audio reader store. Do not use `db.tables` or add out-of-transaction durable reads to the preview.
- Validate agent/thread/project existence and requested binding. Missing, unavailable/foreign scope and read failure return explicit discriminated states, never ready defaults or fake empty selections. Loaded empty history/memory/reference data is a legitimate ready result. Unknown capacity remains unknown.
- The subscription's ready/error/missing/empty result is usable only for the current complete identity. A result retained from a previous thread, project, provider/model, metadata, draft or attachments cannot expose its percentage, budget, coverage or enabled memory action in a new scope.
- Parent transcript/status queries keep their actual consumers. They are not preview snapshot inputs; temporarily retained or empty parent data cannot be treated as complete durable context.
- Reuse the existing task/project/memory/reference selection functions and budgets. Current draft estimation uses the normalized current draft, not a deferred draft labeled current. No global cache/store, duplicate planner or new execution request policy is introduced.
- The latest active/recoverable saved run retains the existing predicate and frozen request interpretation. Its saved context/ref/memory/capacity/project inputs remain frozen; absent saved fields remain absent rather than acquiring new live selections. Historical summaries use the saved run's threshold even if the current policy changes. Editable current policy affects the next send and does not rewrite this audit view.
- Policy editing waits for a matching loaded source and disables controls for loading/missing/error/mismatch. Each callback submits only its changed field, including explicit `undefined` to clear a local token limit. Reset/default-copy remain separate commands. A synchronous scope-bound lock rejects callbacks from an old thread; late success/error/finally publication belongs to the initiating live session.
- Memory management keys include thread, run/preview and selection project. Its current availability envelope is also scope-bound. Historical selection text remains frozen while current availability/readOnly controls writes. Exclusion changes still use the original guarded `setThreadMemoryExcluded` transaction; they do not mutate the frozen request.

## 4. Validation / Error Matrix

| Condition | Required behavior |
| --- | --- |
| Initial query or complete identity changes | Loading state; hide retained budget/coverage and disable memory actions |
| Missing agent/thread/project | Explicit missing state, no ready budget |
| Requested project differs from thread binding | Unavailable state; no foreign-project preview |
| Durable read/vision input failure | Explicit error, not default policy/empty successful budget |
| Ready snapshot with no history/memory/references | Valid empty ready result |
| Saved run lacks optional request inputs/capacity | Keep absence/unknown, do not reconstruct from new live data |
| Current policy changed after saved run | Preserve saved threshold/audit selection; next-send policy remains editable |
| Thread changes during policy/memory write | Old callback/publication cannot affect the new owner; existing per-field command semantics remain |

## 5. Good / Base / Bad Cases

- Base: trigger, ring and opened panel use the same snapshot; ready empty data stays distinguishable from loading/error.
- Good: a concurrent writer cannot modify the facts between nested preview reads; all nested reads belong to one native read-only transaction.
- Good: switching from A to B hides A's ready/error/empty results until B's complete identity resolves; saved run summary threshold stays frozen after editing next-send policy.
- Bad: querying the panel again, planning from temporarily empty parent arrays, treating missing data as loaded defaults, using live policy to reinterpret a saved run, or publishing A's late write feedback in B.

## 6. Tests Required

Use actual trigger/panel/parameters/memory entry points and original per-field policy commands. Cover retained ready/error/empty states for every identity, loading/missing/foreign scope/error and legitimate empty results, frozen historical thresholds and absent optional inputs. Verify all nested durable readers and their store list. Native IndexedDB evidence must prove one actual transaction and the concurrent writer boundary, not merely inspect a table array. Retain B01 identity/navigation and B07 compose-session browser cases where applicable. Preserve failed fixture/setup attempts and demonstrate the fault or state was reached; no weakened assertions/timeouts or live-provider coverage claims.

## 7. Migration / Limits

AgentChatPage removes obsolete preview task/messages/runs props; its transcript/status and D03 execution/selection/reference owners remain. Five production files and their direct consumers are the bounded D04 migration; unrelated provider/tool/draft/capability policies stay with later units. The new semantic DB fact owner is independently linted; large UI functions retain measured complexity debt, including increases for explicit state/identity handling. Finite native fixtures validate local DB/UI boundaries with zero provider requests, not all browsers, paid services, image interpretation or performance. Whole-batch model/build/final review and formal E07/QG01 gates remain separate acceptance.
