# A final full-scope check — Phase 2.2

Date: 2026-09-30. Role: native trellis-check. Base revision: `bbc8200`.

## Decision

**PASS — no concrete blocker found in the combined A01–A04 change set.** This is the final A-scope check before the main session's commit step. It covers the combined diagnostic, repository, undo and manual draft contracts, rather than A04 alone. It does not close the parent 51-finding remediation scope or verify B–E.

No product or test changes were made by this final checker. Only this report was written. No tests/builds were repeated, no subagents spawned, and no spec, ledger, task status, commit or push changes were made.

## Scope and method

Read the frontend index Quality Check, quality/type-safety contracts, applicable state-management and AI connector contracts, task check context, PRD/design/implementation plan, all four independent check reports and A-integration. Reviewed the current combined source/test diff and actual critical merged code, including downstream Agent callers and the existing persistence/cleanup helpers. Existing independent regression and red/green evidence was inspected; exhaustive per-unit tests and mutation exercises were not repeated.

The product scope contains 15 changed/new source files and six changed/new test files:

| Scope | Files / actual paths inspected |
| --- | --- |
| Responses diagnostics | `src/lib/ai/responsesStream.ts`, `tests/responsesStream.test.ts`; downstream `runChat` and `finishAgentRun` |
| Repository and values | `src/db/repo.ts`, `src/domain/slot.ts`, `src/lib/draftConflict.ts`; existing media/reference/restore transaction paths |
| Bulk/delete undo | `src/lib/undo.tsx`, `tests/undo.test.ts`, `tests/shotBulkUndo.test.ts`, `tests/shotDeleteUndo.test.ts`; actual ShotEditorPage callbacks |
| Slot sessions and consumers | `src/lib/slotEditSession.ts`, `src/components/slots/GenerationSlotCard.tsx`, Character/Scene/Prop/Style DetailPage, `src/components/shots/ShotEditorPage.tsx` |
| Duration/project drafts | `src/components/shots/DurationInput.tsx`, `src/components/workspace/ProjectSettingsPanel.tsx`, `src/lib/projectOutputDraft.ts`, `tests/manualDraftBaseline.test.ts`, `tests/manualDraftWiring.test.ts` |
| Spec consistency | Current changes in `ai-connectors.md` and `state-management.md` agree with the reviewed implementation and reported limitations |

This is a full-scope review of the A change set and its critical callchains. It is not a renewed full-source audit of every untouched line or every test in the repository. Frontend index checks were applied where affected: episode-scoped shots, project/studio ownership and existing media retention remain consistent; project-kind dispatch, delivery and chat-scroll behavior were not changed by A.

## Combined contract findings

### A01 — diagnostic boundary through persistence

`responsesStream.ts:166–173` permits only the six recognized failure diagnostic statuses. Arbitrary JSON status strings are omitted, while the error message is credential-redacted before truncation. Completed-with-error remains failure; successful output keeps `stop`/`tool_calls`. SSE still checks terminal event/status agreement before accepting the result.

`runChat.ts:285–287` passes only the returned failure message/finishReason to `finishAgentRun` and returns. `agentRuns.ts:217–232` saves these values in the run/message transaction. The merged change does not add retry or another POST. The independent report and current tests cover unknown short/long credential-bearing status, truncation-boundary redaction, recognized status compatibility, real saved rows and one-fetch assertions. A02–A04 do not introduce another diagnostic persistence path.

### A02 + A03 — transaction-owned snapshots and shared undo lifecycle

`repo.ts:1529–1570` returns the bulk inverse only after the forward transaction succeeds. Before values come from current rows, after values from normalized updated rows, and all eight allowed fields are supported with copied arrays and explicit optional clears. `undoEpisodeShotBulkPatch` at `repo.ts:1573–1608` validates scope, all targets, matching allowed key sets, current affected values and current/restored relationships before bulkPut. A third value rejects the group; restoring only the affected fields preserves independent text, duration/slot fields outside that patch and committed media.

`deleteEpisodeShots` at `repo.ts:1739–1765` reads the latest selected shots and referenced media/Blobs in the same production write transaction as nested deletion, reindexing, project touch and orphan cleanup. The returned snapshot reaches the UI after commit. The existing `restoreShots` ownership, duplicate-ID and ordering protections remain in use.

`ShotEditorPage.tsx:590–605` registers only successful nonempty repository results, without constructing inverse content or media from old rendered rows. The shared UndoController retains an unexpired failed action and visible error, shares one in-flight restore, and does not extend the original expiry. Old success/failure cannot clear or attach an error to a replacement action. Provider button rejection is caught while programmatic rejection remains observable. This lifecycle applies to both bulk and deletion undo without weakening either transaction contract.

Independent A02/A03 reports and current test assertions cover whole-group conflicts, validation before writes, storage rollback/retry, latest deletion snapshots, Blob/shared-media retention, ordering and pending replacement/expiry. No additional combined defect was identified.

### A04 — optional baseline compatibility and frozen manual sessions

All five slot setters read current rows and compare the target slot within the existing production write transaction. `sameSlotValue` compares prompt, ordered image/video references and result identity/kind; absent slots equal editor empties. Only the requested slot is merged into the current entity. Media validation, project touch and committed orphan cleanup remain in that transaction, including equal-final convergence.

`patchShot` compares submitted fields, using duration `?? 0`; project patches compare touched fields after determining trimmed/normalized final values. Defaults use structural comparison, including absent optional keys and empty defaults, rather than object identity. Conflicting multi-field project patches reject atomically.

Repository baseline parameters remain optional. Actual unchanged callers in Agent business tools, generation runtime, generation batches and production proposals still call the setters without a manual baseline. Their existing approval/revision/transaction paths were inspected; the merged change does not force them into the manual draft protocol. The Agent deletion caller may continue ignoring the new snapshot return value.

All four asset callbacks, three shot slot callbacks, DurationInput, five project text callbacks and immediate default-style selection carry the relevant manual baseline. Slot target keys include owner/entity/slot. SlotEditSession clones the baseline and freezes the original owner, metadata and persist callback; current-target mismatch rejects before persistence. Upload/picker ownership stays with that session, and a delayed old save does not close the switched target. Failed save preserves the retained draft and its referenced owned media for retry; explicit cancel uses existing orphan cleanup.

### A04 output confirmation and cross-layer dependencies

Output drafts retain separate values, baselines and applied live fingerprints. Only changed aspect/defaults fields are submitted. Clean fields follow live changes, dirty fields retain their baseline, and saving defers live rebase. Returning a field to clean can consume its deferred live value.

After successful persistence, ProjectSettingsPanel reads the current project once and acknowledges saved fields from that authoritative snapshot. This handles another writer committing the same field before acknowledgement, including a return to the old baseline; repeated stale props cannot undo that confirmation. The helper retains a newer local edit if it differs from the submitted value. Failure keeps the draft and offers explicit adopt-latest. Busy protection, explicit save and unload protection remain present.

The current tests execute real component callbacks through a lightweight Hook host and real repository writes. The A04 report's three final red/green regressions are present in the stable gate snapshot; no obsolete pre-fix gate was used as final proof.

No new cross-layer value cycle was introduced by the pure helpers: `slotEditSession` and `domain/slot` have only type imports; `draftConflict` has no imports; `projectOutputDraft` has type imports plus a value import of the leaf `draftConflict`. None imports UI or repository code. This conclusion is from the actual new dependency edges, not a claim that all pre-existing cycles were removed.

## Final stable gate evidence

The main session's final logs in `reviews/integration/` record:

| Gate | Recorded result |
| --- | --- |
| `pnpm lint` / TypeScript | exit 0 |
| Full Vitest | 129 files / 1660 tests passed, exit 0 |
| Model-bank verification | 197 files / 85 providers / 1855 models verified, exit 0 |
| Production build | exit 0 |
| Diff whitespace check | exit 0 |

Commands use the explicit local pnpm path. Pre/post gate evidence records 525 unchanged source/test files. This checker independently recomputed current SHA-256 values for all 525 `src/tests` files: **no changed, missing or extra files** against `integration/pre-gate-source-hashes.json`. The three final A04 correction hashes also match its independent report. Thus the inspected product snapshot matches the final stable gate; no test/build rerun was necessary.

Generated route evidence records 3995 identical non-trivia tokens before/after build and restoration of the original formatting. This was inspected as generated-code evidence, not claimed as manual line-by-line review.

The separate ESLint/SonarJS scan still exits 1 for existing diagnostics; TypeScript lint success is not ESLint-clean status. The summary retains diagnostic counts and reports no new Hook issue. Slot editor complexity 24→33 and output complexity 40→39 / cognitive 23→24 remain D03 work; the final check does not reinterpret those values as resolved architecture debt.

## Limits and handoff

- No real browser navigation, React DOM/StrictMode cleanup, visual interaction, picker or audio decode validation was performed by this final pass. Repository tests use Dexie/fake-indexeddb. The lightweight Hook host proves executed callback wiring for its inputs, not complete browser scheduling or retained-query identity safety.
- No live provider requests, paid generation or user database operations were performed. Existing unit evidence is not exhaustive proof for every legacy/media input.
- Slot conflicts still have no dedicated adopt-latest/media-merge button. The documented flow is retain/retry, or copy prompt and explicitly cancel/reopen; cancel may reclaim session-owned orphan uploads. This is not a claim of complete media merging.
- B01 remains responsible for full page query identity and dirty/pending navigation protection. A04 protects the opened slot session; it does not close B01. D03 complexity/refactoring and E06 build chunk/performance work remain deferred. The build retains its existing large-chunk warning.
- No specific unresolved A01–A04 defect requiring new product edits or gate expansion was found. The implementation plan still leaves A integration/spec/parent bookkeeping to the main session; this checker deliberately did not alter it.

The main session may use this PASS to mark the final A check verified and prepare its concrete commit plan. The parent 51-finding scope remains active, with B01 next.
