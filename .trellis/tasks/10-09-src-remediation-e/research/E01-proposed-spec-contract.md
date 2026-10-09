# Proposed E01 durable contract (awaiting integrated independent PASS)

This is coordinator preparation for canonical spec synchronization, not unit acceptance. Final signatures, corrections and proof references must be reconciled with E01-check-snapshot before publishing to .trellis/spec.

## 1. Scope / Trigger

Manual task records/wrapup/goal-plan and voice configuration can outlive route/local close requests. Gallery/library/episode writes must preserve input/target and expose failures. Existing B02 memory promotion source/epoch and B01 route guard behavior remain compatible.

## 2. Signatures / Owners

`ManualDraftState = {dirty: boolean; pending: boolean; routeDirty?: boolean; routePending?: boolean}`; `ManualDraftDeparture = (leave: () => void, discard?: () => void | Promise<void>) => void`. `useManualDraftDeparture(dirty, pending, onDiscard, {readState?, route?})` returns stable `requestDeparture` and `confirmation`. `useManualDraftGuard(dirty, pending, onDiscard)` keeps its route-only JSX API. TaskRecords/TaskWrapup publish optional onDraftStateChange; Inspector aggregates actual children and own edits, registers a departure callback with chat before transitions. VoiceLibrary owns its frozen project/editor; repository revision/ownership remains authoritative.

## 3. Contracts / Invariants

Freeze opening input, task/thread/project/record identity and expected revision. Actual field edits, including sources/reference/sample settings, differ from opening baseline; reverting them returns clean. Dirty cancellation retains input, location, mounted scope and applicable caret/scroll. Pending reads/writes use synchronous refs before immediate repeated/close actions; pending cannot discard. Explicit discard retires the local session before departure. Rejecting a write retains original baseline/revision and actionable error; success retires only its initiating owner. Old completion cannot set state, toast or navigate a newer owner. Review pending deletion/creation callbacks in chat against this invariant.

Use one logical route/local decision per owner. Optional route flags isolate a nested MemoryEditor that already owns route blocking while preserving conservative local parent ownership. Local confirmation retains its initiating discard/leave callbacks; an optional scoped discard resets only the initiating editor without remounting a pending nested operation; an overlapping router blocker is reset before the initiating local leave runs. Do not allow a newer request to silently replace that callback. Same-path search retains owner and is not automatically departure. Same-path actual owner replacement requires local interception; route callbacks check before abort/creation/deletion. Effects invoke/depend on the stable requestDeparture binding rather than omitting the returned object dependency or depending on an unstable object. Keep existing memory promotion conservative ownership/source/CAS behavior; overlapping candidate and parent guards require native proof.

Caret restoration only invokes selection APIs when actual input/textarea numeric selection bounds exist and the initiating element is connected. Number/range/date/color/checkbox fields must not throw. Preserve relevant dialog scroll position; cleanup releases inactive owner refs.

## 4. Validation / Error Matrix

| Trigger | Required outcome |
| --- | --- |
| Open unchanged editor or edit then revert | Clean leave, no dirty prompt |
| Dirty Escape/close/backdrop/local owner change/SPA/POP | Continue retains exact draft/current scope; explicit discard may leave |
| Save/import/audition currently pending | Dismissal/discard blocked, no duplicate command |
| Repository rejection/conflict | Input/selected target remains; visible retryable error; original captured revision preserved |
| Async old owner finishes after unmount/replacement | Original authorized persistence only; no new-owner state/navigation publication |
| Native unsupported input selection API | Restore supported focus/scroll without calling unsupported setSelectionRange |
| Library create/delete | Mutually exclusive; correct studio owner/detail route preserved |
| Episode reorder/delete success | Original DB ordering/cascade and undo contract preserved |

## 5. Good / Base / Bad Cases

Good: edit record -> attempt board -> continue -> exact draft remains -> failed save -> same draft retry. Base: opening the same unchanged voice config can leave cleanly. Bad: mark every open form dirty, clear target before await, let an old delete navigate a newer thread, or silence a hook dependency warning.

## 6. Tests Required

Meaningful callback tests cover synchronous pre-rerender state and captured obsolete discard callbacks; native React/Radix/TanStack/IndexedDB fixtures cover actual dirty forms, Escape/pointer close, owner replacement, route/back/forward, delayed/rejected writes and correct retry/storage. Real voice reference import/audition is observed with offline provider transport, not paid-provider claims. Shared guard changes rerun B01 compatibility. Verify current full tests, typed static delta and value graph with exact input hashes; full-batch E has its later build/Node22/portable-gate proof.

## 7. Wrong vs Correct / Limits

Wrong: `<Dialog onOpenChange={next => !next && setEditing(undefined)}>` discards unsaved input; `void write(); close()` hides failure. Correct: consult synchronous owner state, resolve dirty departure, await frozen-owner write, keep failed form and close only successful initiating session. Wrong: setSelectionRange(null, null) on every HTMLInputElement. Correct: use only supported numeric selection bounds and connected original targets.

Local controlled Chromium and fake-indexeddb suites do not prove WebKit/mobile/OS unload UI or live paid providers. Typed diagnostic count delta is temporary review evidence, not QG01 semantic debt identity. Gallery complexity27→31 must receive responsibility review; it does not alone establish a bug or justify arbitrary helper extraction.
