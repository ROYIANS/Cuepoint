# E01 independent review contract

Review AU02/PU10/SS06 as one integrated unit after both implementation reports finish and source hash freeze matches. This checklist supplements approved PRD, not a new product requirement. No PASS claim is made here.

## Scope and producer review

- Inventory actual changed source/test/runner files from entry697 snapshot, including new helpers/deletions/untracked files. Review every full body and caller touched, plus fixtures/transforms/runners so assertions actually exercise production behavior.
- Verify exact before hashes against entry/Git baseline and all final hashes. Keep original writer reports immutable; reviewer corrections receive distinct before/after/evidence attribution.
- Do not count fake-indexeddb or string wiring tests as native Radix/TanStack departure proof. Browser observers/delay/rejection wrappers should call real business command except deliberately rejected path, with clear points before/after native IndexedDB writes. No provider calls needed.

## AU02: owner/session transitions

- Real dirty equality: unchanged/new empty/editor-open baseline is not dirty; title/body/kind/claim/source/Todo and wrapup content/reference fields matter. Editing then restoring initial value must become clean.
- Route departure and local same-path thread/task changes reach the actual owner before keyed replacement or Sheet unmount; actual AgentChatPage openThread/board/new/deletion paths matter, not only parent harness setState.
- Records communicate dirty and pending to inspector; wrapup and memory candidate preserve existing epoch semantics. Pending reads use current synchronous refs where immediate close/click occurs.
- Continue editing keeps exact input, editor scope and current thread/location after Escape, close/backdrop, task switch, SPA and browser back/forward. Explicit discard targets initiating owner, not whichever task is current later. Router and local prompt cancellation/confirm must not double-dialog/deadlock.
- Rejected save retains frozen expectedRevision and input; retry does not accidentally adopt a new row baseline. Successful save cleans/closes according to existing behavior. Session replacement/unmount cannot let stale completion mutate a new editor.

## PU10: voice semantics

- Baseline covers name, selected voice/mode/instruction, clone reference and relevant local sample edits. Clean editor leaves; actual dirty fields prompt; pending reference import/audition/save cannot leave.
- Nested source picker/connection dialogs retain focus and parent guard behavior. Successful audition uses existing durable generation and media; discard does not delete retained preview media.
- Save failure keeps exact speaker input/error for retry with original captured revision/owner. Choosing another voice/edit/new/back or route departure resolves the current draft first.

## SS06: mutation failures

- Inspect every targeted current action, distinguish already-caught IP binding from a missing-catch finding. Keep project draft flush/archive/export semantics.
- Synchronous locks prevent duplicate add/rename/delete/reorder/bind calls in the same event batch before rerender. Pending modal cancel/Escape/backdrop cannot dismiss. Freeze delete/rename/bind target and field inputs.
- Failure retains dialog/value/selected delete target and retry path; success dismisses only owning session. Unmounted owner suppresses stale UI completion/navigation without canceling already legitimate persistence semantics.
- Episode reorder preserves current order on reject, updates on success and retains actual undo contract. Library create opens correct studio route/kind, not project picker; deletion actual DB cascade is preserved.

## Verification and limits

Use relevant focused suite and current typecheck; full tests when all E01 source is frozen and no writer remains, then broaden only for new failures. Execute both actual native runners and supplement missing critical cases independently. Include B01 manual route guard regression if shared useManualDraftGuard changes. Compare complete baseline/current typed static per-file diagnostics and value-edge graph; real new non-complexity diagnostics must be corrected, complexity changes need responsibility review. Existing diagnostics are not proof E01 failed or QG01 complete. Record all commands/exit and observed cases, actual runtime paths/tool versions. Do not claim real iOS/readers/paid-provider behavior from local controlled Chromium fixtures.

Review result must explicitly list blockers/fixes/limitations, every changed path and exact acceptance hashes. Main owns specs, ledger closure, E02 activation and commits.
