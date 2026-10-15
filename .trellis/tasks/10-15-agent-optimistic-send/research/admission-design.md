# Research: optimistic-send admission identity and recovery

- Query: How can a submission paint before preparation while reconciling delayed or uncertain durable admission without duplicate messages, runs or paid dispatch?
- Scope: internal; Agent UI/flow, Agent commands, shared ProductStore, existing regression seams
- Date: 2026-10-15

## Findings

### Files found and current behavior

| File | Responsibility / source evidence |
| --- | --- |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx` | `handleSend` captures the draft and selected connector/model synchronously, then acquires the ref-backed execution lock before the first await (381–429). Actual messages come from committed storage (163–169); home still renders `HomeWelcome` until navigation (704–726). |
| `packages/studio/src/features/agent/ui/chatExecutionFlows.ts` | Compatibility precedes all mutation (73). Creates a home thread, binds execution identity, acquires ownership, moves draft and navigates before atomic begin (76–123). Acknowledges the draft only after begin succeeds, then dispatches (133–134). |
| `packages/studio/src/features/agent/ui/useChatExecutionSession.ts` | Same-tick duplicate exclusion is already synchronous (22–30). Route change aborts if execution thread differs (19–21); new-thread binding must precede navigation. Release is token/epoch conditional (32–36). |
| `packages/studio/src/features/agent/ui/useReferenceDraft.ts` | Per-scope text revision, exact attachment revision, synchronous capture and guarded transfer/acknowledgement (55–63, 137–195). Sessions survive only inside the mounted page. |
| `packages/studio/src/features/agent/commands/chat.ts` | `createChatThread` generates its ID after awaiting general-Agent settings (19–22); inserts using `add` in its own transaction (31–34). Needs caller-provided ID for creation-ack reconciliation. |
| `packages/studio/src/features/agent/commands/agentRuns.ts` | Atomic begin reads actual thread/history and refuses competing runs (78–98). IDs are currently created inside the transaction (112–114); user, assistant and run are inserted together (187–207). |
| `packages/studio/src/features/settings/models/connectors.ts` | `runWithCompatibleChatModel` runs action only after captured identity/currentness/compatibility checks (73–100). It returns `ok:false` for preparation rejection rather than always throwing. |
| `packages/studio/src/features/agent/runtime/runOwnership.ts` | `withThreadRunLock` performs recovery before entering the callback (67–72). `withOwnedExecution` prevents concurrent capability use, not a future duplicate dispatch after release (33–42). |
| `packages/studio/src/platform/storage/native.ts` | Native driver queries the same operation/fingerprint after commit-reply failure (509–524). Unresolved status raises `UnknownCommitError`; it never replays the callback. |
| `packages/studio/src/platform/storage/errors.ts` | `StorageError.certainty` distinguishes `rollback` and `unknown`; `UnknownCommitError` retains operation/workspace identity (1–24). |
| `packages/studio/src/platform/storage/types.ts` | Public ProductStore exposes typed transactions/rows but no durable operation-status API (86–105). |
| `tests/b07ComposeSessions.test.ts` | Real page/hook callback host already covers deferred creation/begin/navigation, scope/revision isolation and recovery (159–275); UI leaves/provider I/O are mocked, so this is not actual browser scheduling proof (4–6). |
| `tests/connectors.test.ts` | No mutation/chat POST before compatibility, and stale discovery refusal (120–190). |
| `tests/agentRuns.test.ts`, `tests/agentReferences.test.ts` | Real command atomicity, frozen run retry and validated reference context; preserve existing contracts. |
| `tests/sharedNativeOutcome.test.ts`, `tests/sharedNativePreparationOutcome.test.ts` | Existing native uncertain-outcome regressions demonstrate typed uncertainty must not be downgraded. |

### Recommended smallest shared signatures

Use one agent-owned model type (for example `features/agent/models/chatSubmission.ts`) with no new persisted table or index:

```ts
type ChatAdmissionIdentity = Readonly<{
  runId: string;
  userMessageId: string;
  assistantMessageId: string;
}>;

// Existing options, plus optional caller-owned new-thread identity.
createChatThread(options?: ExistingOptions & {id?: string}, store?: ProductStore): Promise<ChatThread>;

// Existing input, plus identity only for a fresh user turn.
beginAgentRun(input: ExistingInput & {admission?: ChatAdmissionIdentity}, store?: ProductStore): Promise<AgentRun>;

readAgentAdmission(input: {
  threadId: string;
  admission: ChatAdmissionIdentity;
  connector: AgentRun["connector"];
  model: string;
  content: string;
  attachments?: ReferenceAttachment[];
}, store?: ProductStore): Promise<
  | {status: "absent"}
  | {status: "accepted"; run: AgentRun; userMessage: ChatMessage; assistantMessage: ChatMessage}
  | {status: "mismatch"}
>;
```

The UI creates the optional home-thread ID and all three admission IDs **synchronously before the first await**, after acquire succeeds. The frozen UI attempt also retains origin scope, project, original text/revision, cloned attachment records, selected connector identity/model/reasoning/interaction mode, and creation time. `createId` is already synchronous (`platform/identity.ts:3–10`). Keep the credential only in the existing ephemeral flow closure; never persist keys into the attempt/record.

ID inputs should be bounded, nonempty, control/whitespace-free and distinct; accept the actual existing generated-ID shape. Admission must reject combination with `retryOfRunId`: durable regeneration is a different existing operation that reuses the prior user message. Defaults preserve all existing command callers. A reused explicit identity must reject rather than `put` or silently overwrite.

**Do not implement begin as “if this run exists, return it.”** Existing flow immediately calls `executeChatRun` on every successful begin return. Such idempotent success would turn a recovery click into a second model dispatch. Keep begin create-only; use the separate read-only helper to establish accepted facts.

`readAgentAdmission` must read all three rows (and owning thread) inside one explicit read transaction. All three absent is `absent`; partial rows, foreign ownership or conflicting identity is `mismatch`. `accepted` requires matching thread/project ownership, run→user/assistant pointers, user/assistant roles, assistant `runId`, normalized connector identity/model, expected user text (including the existing attachment-only fallback), and attachment reference ID/revision list. References saved by `selectReferenceContext` retain the submitted ordered attachment list (`features/references/agent/referenceContext.ts:43–90`). Never find an admission by text equality or timestamp proximity.

### Flow and recovery rules

1. Acquire the current synchronous lock; publish the frozen attempt and claim submitted compose contents immediately. No storage read/write or compatibility request precedes that publication. Showing a provisional row is local UI work and does not violate the no-write-before-compatibility barrier.
2. Run existing compatibility gate against captured connector/model/current-selection policy. A stale/cancelled result must settle the attempted row visibly; `ok:false` cannot be forgotten because it did not throw.
3. For home, call create with the reserved ID; bind `executionThreadRef` before navigation. Move only the submitted attempt/scope, not the current newer draft. Keep the attempt owner above `ChatWorkspace key={activeThreadId}` and above the home/detail rendering branch.
4. Under the held thread lock, run atomic begin with the frozen IDs. Check abort/current ownership at real await boundaries; do not start execution after a genuine route departure merely because begin eventually committed.
5. On normal begin success, mark accepted/acknowledge exactly the claimed revision, then dispatch exactly once through existing execution ownership. Transport failure after this point belongs to the durable run UI; it must never restore an accepted message as unsent.
6. Join the committed/provisional row by **userMessageId**. When that durable row appears, render it once and retire the provisional representation. Preserve the accepted record even when query notification arrives before the begin promise resolves or after its acknowledgement is lost. Do not readmit based on bubble visibility.
7. On preparation or guaranteed rollback failure, retain a local attempted row and recovery actions. Explicit retry first performs read-only reconciliation using the same frozen IDs; `accepted` routes to durable status/explicit existing resume or regeneration, `mismatch` blocks, and confirmed absent plus known rollback can retry admission. Preserve the frozen submitted model/reference revisions unless the user explicitly edits into a new attempt.
8. On `UnknownCommitError`, read reconciliation once for positive accepted evidence. **An absent row is not proof of rollback while the native operation may still be pending.** Keep `unknown` and offer read-only “核对状态”; prohibit repeat begin, implicit resume/dispatch and orphan deletion. A failed reconciliation read also stays unknown. Do not replace typed uncertainty with a generic “send failed, retry” state.
9. New-thread creation acknowledgement can also be uncertain before begin was called. The reserved thread ID permits a read-only exact-thread check; adopt a positively matched created thread, but do not automatically proceed to a paid request from the catch. An absent/mismatched read remains unresolved. Explicit recovery must retain the same thread ID rather than create another home thread.
10. Existing `updateChatThread` before begin is another separate mutation boundary (`chatExecutionFlows.ts:114–122`). A native unknown here must also retain unknown certainty. Optionally move this exact reasoning/interaction patch into the begin transaction to remove that intermediate acknowledgement boundary; do not conflate “begin was never called” with proof that the earlier mutation rolled back.

### Important traps

- `discardUnusedThread` currently calls cascade deletion merely from `created=true` (chatExecutionFlows:27–29, 85–96). Any new cleanup must additionally prove the owned thread has no run/message, in one guarded transaction, and never run after uncertain admission. A later accepted commit must not be erased as an “empty orphan.”
- `withThreadRunLock` first interrupts abandoned runs. Read/reconcile an already known admission before any retry path that could call begin again. A prior accepted run is not a fresh send even if recovery changed its status.
- `sending` currently lasts through transport/final persistence. Keep duplicate-send lock until final settle. Draft text can continue editing, while attachment mutations currently remain locked (AgentChatPage:585–601); do not silently widen attachment concurrency in E02.
- Current `moveTo` carries submitted text into the destination composer. An immediate claim/clear protocol needs a version-aware variant; calling existing move after clearing its source would confuse restoration. The attempted-message owner should carry the submitted payload while current compose sessions carry only new edits.
- Restoring/editing a failed attempt cannot overwrite a newer draft, including edit-then-revert or edits to empty. Use captured revisions/session ownership, not string equality. If the current draft is newer, retain the attempted row and expose recovery without replacement.
- Exact attachment revision is authoritative. A newer/retracted/deleted source on retry must fail current admission checks and keep recoverable attempt; silently substituting the latest reference changes the submitted intent.
- An optional stable ID does not itself prove whether an external request happened. Positive accepted evidence means “durable user/run exists,” never “network may be automatically replayed.”

### Necessary tests for this task only

1. Command-level real-store tests: explicit three IDs persist atomically; rejected validation leaves no partial rows; duplicate identity cannot overwrite or make a new run; read helper accepted/absent/mismatch with partial/foreign/changed-payload tuples; legacy callers and frozen durable retry remain valid.
2. Actual page/hook/flow deferred tests: immediate attempted user payload while compatibility/create/begin is held; same-tick send duplicate blocked; new home bind before navigation; late acknowledgement/query deduplication; newer text and attachment revisions preserved; all preparation failure boundaries including `ok:false` settle visibly.
3. Fault injection on the actual transaction boundary: execute begin commit then reject its acknowledgement; reconciliation absorbs existing IDs and dispatch count remains zero from recovery. An injected unknown with initially absent rows and later accepted rows stays unknown until positive reconciliation; retry/cleanup produce zero additional mutations or paid requests. Injected query failure cannot downgrade certainty.
4. Keep targeted `b07ComposeSessions`, `connectors`, `agentRuns`, `agentReferences`, execution-session/ownership regressions affected by the new seam. Update B07 assertions where immediate submitted-draft claim intentionally changes visible compose contents; retain their actual ownership guarantees.
5. At least one deterministic real React DOM paint/callback test for pending/failed/accepted row and retained composer, since the existing B07 host is not browser paint evidence. No full build, packaging, full suite or native acceptance in this stage (explicit user direction).

### Related specs

- `.trellis/spec/frontend/agent-execution.md`: atomic begin, one POST, explicit durable retry, held ownership, no startup resubmission; its signatures need the new optional identity/read helper documented after implementation.
- `.trellis/spec/frontend/agent-references.md`, B07: synchronous capture, per-scope/version transfer, no overwrite and current in-page-only persistence limit. Update the timing contract from post-begin clear to immediate submitted-attempt claim without weakening ownership.
- `.trellis/spec/frontend/shared-product-storage.md:145–167`: callbacks run once; unresolved native commit stays uncertain and authorizes no mutation/paid replay.
- `.trellis/spec/frontend/chat-performance.md`: preserve keyed/memoized historical row isolation, retained execution owner and demand-loaded rich transcript. An attempted user row must appear on home before route/storage completion too.

### External references

None needed: this decision is established by current local ProductStore and Agent contracts. No external product/version assumption was used.

## Caveats / Not Found

- Public ProductStore has no operation-status resolver exposing fingerprint. Therefore a read returning absent cannot safely convert an already unknown native commit to retryable rollback. Resolving negative unknown outcomes fully would require a separate reviewed storage API extension; conservative read-only status recovery is the bounded E02 option.
- Session drafts/attempts are not persisted across page unmount/reload today. Preserve that explicit scope unless PRD chooses new persistence; durable accepted rows still survive normally. Reload must never trigger a model resubmission.
- This research did not execute tests, package/build, access providers or mutate product/spec/Git state. It supports the design and targeted implementation, not an acceptance claim.
