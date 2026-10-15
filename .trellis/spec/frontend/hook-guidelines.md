# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Current product data reads use `useProductQuery(tx => ...)` or `useProductQueryState` from `packages/studio/src/lib/storage/hooks.ts`. The explicit readonly transaction must also reach nested readers. Dexie live-query observation stays inside the browser adapter. Mutations use the concrete business command owner under `packages/studio/src/db/`; the D02 map remains in [State Management](./state-management.md). Read the complete [shared storage contract](./shared-product-storage.md). Do not fetch live records with one-shot `useEffect` + `db.*.get`.

---

## Data Fetching

### `get()` vs query loading

`StoreTable.get(id)` returns `undefined` when the row is missing. `useProductQuery` also returns `undefined` while the initial query has not resolved.

If you write:

```ts
const row = useProductQuery(tx => tx.characters.get(id), [id]);
if (row === undefined) return <Loading />;
if (!row) return <NotFound />;
```

the not-found branch never runs. Missing ids stay on 加载中 forever.

**Contract**: coerce missing rows to `null` inside the query.

```ts
const character = useProductQuery(
  async tx => (await tx.characters.get(characterId)) ?? null,
  [characterId],
);

if (character === undefined) return <div>加载中…</div>;
if (character === null) return <div>找不到这个角色</div>;
```

| Query result | Meaning |
| --- | --- |
| `undefined` | Initial query still loading |
| `null` | loaded, no row |
| object | loaded row |

This applies to `characters`, `scenes`, `props`, `styles`, `episodes`, `projects`, and any other `db.*.get` detail page.

### Changed query dependencies

`useProductQuery` retains its previous successful result while a new dependency set loads. If downstream actions rely on loading being complete, include dependency identity in the result and return `undefined` until it matches the current identity. `useShotMedia` keys its result by sorted result-media IDs so gap filters and locate-shot navigation cannot treat the previous episode's collection as loaded. Native file availability is a separate check from logical media metadata.

`useProductQueryState` exposes an error while retaining the previous value; use it when the owning view provides visible recovery. `useProductQuery` throws a read error for the owning boundary. Never turn a failed read into an empty successful inventory. Disposal/remount suppresses obsolete completions; subscriptions reconcile committed changes only. Preserve exact selected-owner/current-kind reads and E04 negative invalidation assertions below on both adapters.

Identity belongs to the query result even when it contains `null` or an empty array. A returned row's `id` alone cannot distinguish an old missing/empty read from a newly requested read. Tag owner/project and entity/episode dependencies in the querier, then gate navigation, repair effects, mutation controls and export until the envelope matches. Validate returned ownership as well; matching requested envelope identity does not authorize a foreign row.

For stateful project/episode/asset pages, put a stable key before the component that calls queries and initializes local drafts. Use project, project+episode, or owner+entity identity as appropriate. Focus/search and unrelated live updates are not editing-target identity. A project-level key does not replace an episode envelope in a persistent Chrome component. Same-project episode loading must keep its project settings and Outlet mounted while hiding the old episode's links.

A key can destroy manual drafts. Install dirty/pending route and unload protection before relying on remount, and resolve internal parent-driven selection separately (for example material selection does not navigate). Preserve existing frozen target/baseline protocols. See the B01 scenario in state-management for explicit-discard and unavailable-record behavior.


---

## Naming Conventions

- Page-level live queries stay inline; extract a `use*` hook only when a second caller needs the same query.
- Repo functions are `add*` / `patch*` / `delete*` / `set*Slot`, not hooks.

---

## Common Mistake: get loading collapse

**Symptom**: `/characters/chr_does-not-exist` shows 加载中… forever.

**Cause**: `undefined` used for both loading and missing.

**Fix**: `?? null` in the liveQuery callback.

## B06: editor-scoped async completion (2026-09-30)

### 1. Scope / trigger

Connector probe/test and script File.text reads may finish after close/reopen, credentials change, text edit or unmount. A completion must belong to its initiating editor/request, including error and finally paths. Local component refs are sufficient; this contract does not require a global async operation registry.

### 2. Signatures

Keep existing `ConnectorsSection` handlers (in `components/studio/ConnectorsPage.tsx`) and provider signatures: `listConnectorModels(connector, usage?, fetchImpl?)` and `testConnectorConnection(connector, fetchImpl?)` have no AbortSignal API. Guard publication locally without redesigning their transport. `StoryEditor.applyScriptFile(file: File)` captures episode ownership, request sequence and script edit revision; `DraftStatus.onUseLatest` participates in that lifetime. Alias an ordinary returned `useLatest` action as `adoptLatestDraft` when calling it behind guards, so Hook naming tools do not mistake it for a conditional React Hook.

### 3. Contracts

Capture frozen connector definition/credentials at invocation. Only the current mounted editor/credential request may publish models, toast or clear its busy flag. Closing/changing credentials invalidates a read; a later request's busy state must survive the old finally. Save/disconnect are synchronous single-writer operations: refuse direct duplicate callbacks, credential edits, dismissal and opening another editor while pending. On failure retain the form; publication after unmount is suppressed. Mount effect setup must restore lifetime state after cleanup/setup replay.

For script reads, newest request wins. Increment script revision on every manual edit, including edit-then-revert. A successful latest read can apply only if the initiating script revision is unchanged; otherwise preserve current text and expose an imported candidate for explicit adopt/discard. Unrelated title/logline edits survive import. New reads supersede prior candidates; read failure preserves the draft and permits retry. Use latest, scope change and unmount invalidate pending reads/candidates. Preserve filename/MIME acceptance and no automatic scene splitting.

### 4. Validation / error matrix

| Completion or action | Expected outcome |
| --- | --- |
| Old editor/credentials success or rejection | No models, toast or busy release in new session |
| Test's nested model read becomes obsolete | No stale models or later success publication |
| Two writes invoked before rerender | Only first repository operation starts |
| Save/disconnect pending dismissal/edit/open | Guard rejects, matching controls disabled |
| Current write rejects | Visible error, form retained, current operation released |
| File A then B returns in either order | Only latest B can apply/be offered |
| Latest file returns after script edit/revert | Candidate, current text unchanged |
| Import after title-only edit | Script may apply; edited title preserved |
| Read fails or component unmounts | No overwrite; error only in live matching session |
| Explicit use latest | Pending import/candidate retired before baseline adoption |

### 5. Good / base / bad cases

Good: close probe A, open editor B, start B; A finally cannot clear B's busy state. Base: unchanged script accepts a supported file normally. Bad: `setDraft(current => ({...current, script: await file.text()}))` with no initiating revision, or using an unconditional finally to clear shared pending.

### 6. Required tests

Execute actual production component callbacks with deferred provider/File promises: both orders, credential change, nested test/list, same-render duplicate writes, pending dismissal and failure, unmount and effect replay. Verify script newer text, edit/revert, title-only edit, adopt/discard and useLatest, including captured old candidate callbacks after a replacement candidate appears. Advance the production debounce timeout and assert the actual repository write, rather than testing only Retry/flush callbacks. A mocked hook/JSX host verifies callback lifetimes, not real Radix or browser scheduling; state the distinction in evidence.

### 7. Wrong vs correct

Wrong: reset busy on close, then let any old promise update shared form state. Correct: invalidate the read's owner synchronously, freeze input and check owner at every publication/finally. Writes use a separate synchronous pending lock and retain their initiating form until settlement.


## Feature hook ownership

`useChatExecutionSession` owns the synchronous execution mutex, AbortController and token release lifetime. `useChatSelection` owns current field identity/revision reconciliation. `useShotEditorKeyboard` owns the capture listener and latest typed input callbacks. Consume stable returned functions/refs with truthful Hook dependencies; a ref returned by another hook is not automatically recognized as a locally stable ref by the lint rule. Abort/effect replay does not release the execution lock before transport final flush. See [the D03 feature contract](./component-guidelines.md#d03-feature-responsibility-contract-2026-10-08).

## Coherent context preview ownership

Chat preview has one live subscription at ContextUsageTrigger and a complete input-identity gate. Its panel, ring and memory preview consume the same snapshot. Policy/memory management queries retain their own scope envelopes and current availability; old results/callbacks cannot publish in another thread. See [the D04 coherent-preview contract](./agent-context.md#d04-coherent-preview-snapshot-contract-2026-10-08).

Shot/beat text retention follows `state-management.md` D08. `useTextDraftRetention` keeps readable pending rows; synchronous status refs protect the input event and actual pending-ID state participates in memo invalidation. Existing debouncedDraft owns timers, baselines, retry and persistence. Avoid dummy revision dependencies or a second draft store.

## E04 SS09 precise library query scope and held-result identity (2026-10-09)

### 1. Scope

Apply scoped fallback reads to ProjectGalleryPage and typed current-kind asset reads to AssetLibraryPages. Keep existing project/IP/link metadata queries, MediaThumb reads, authored search/sort/loading behavior and accepted E01 navigation/mutation/error ownership.

### 2. Signatures / Owners

The gallery owns the visible fallback project-ID set; readProjectCoverIds returns Map<projectId, mediaId>. Deduplicate IDs and return empty without DB reads when none remain. Execute one readonly db.shots transaction with N exact projectId.equals cursors. Each keyed asset kind queries its matching typed studio table and invokes its actual cover function. Query results carry the current owner/kind key before use.

### 3. Contracts

Explicit coverMediaId wins through existing nullish semantics. Only visible projects needing fallback enter the owner set. Read complete rows, reduce first eligible firstFrame by strict order comparison so equal-order primary-key traversal stays stable across episodes, and return a narrow Map. A missing selected media record preserves existing render fallback rather than choosing a different later shot. Reject retained results under a changed filter/IP/search/archive/sort owner key. Preserve actual authored asset search fields and stable sort; wrapper IDs/provenance/cover fields do not become search data. Keep E01 locks/errors/captured targets untouched.

### 4. Validation / Error Matrix

Explicit-cover-only set -> zero fallback reads. Unselected-owner shot write -> no fallback callback/read/reducer work. Other-kind table write -> no current-kind asset query rerun. These claims exclude broad gallery project/IP metadata queries and MediaThumb behavior. Relevant fallback mutation/cleared explicit cover -> refresh. Equal-order/multi-episode/no firstFrame/missing media -> existing selection semantics. Held old owner/kind result -> cannot populate the new scope. Query errors/loading retain established UI semantics; do not claim new error handling absent source.

### 5. Good / Base / Bad Cases

Good: N precise owner cursors share one readonly snapshot. Base: complete DB records are transient inputs to a narrow Map, with no persisted cover cache. Bad: call Map JSON bytes physical column projection, query all four asset tables for a fixed kind, or minimize requests using anyOf without verifying installed Dexie observability.

### 6. Tests Required

Use actual original/current pages and native IndexedDB for explicit/fallback/ties/multi-episode/missing media, search/sort/IP/archive and held filter/kind identity; retain full writer all-four-kind matrix plus independent critical subset. Insert a shot for an excluded owner whose projectId index key lies between selected owner keys. Preserve the anyOf counterexample:47 complete cursor rows versus45 matched reducer visits and an irrelevant rerun. Final exact ranges must show zero fallback read/reducer work for the same insertion within the bounded post-commit wait. Distinguish3 requests/3 transactions before from3 requests/1 transaction after. Verify current E01 writes against final helper/source and unchanged producer.

### 7. Wrong vs Correct

Wrong: say final cleanup uses one query, call the gap a shot-primary-key gap, or infer disk/latency savings from projection/callback counters. Correct: label one readonly transaction with N cursor requests, distinguish complete returned rows, cached warm behavior, reducer work and Blob-excluding JSON bytes, and preserve finite negative-wait and device limits. Typed-static deltas remain independent from formal quality-debt acceptance.


## E05 decorative animation lifecycle contract

Independent E05 review accepted on 2026-10-09.

### 1. Scope / Trigger

Apply to decorative ClickSpark scheduling during idle, clicks, overlap, live drawing-option changes, visibility or reduced-motion changes, resize, StrictMode replay and unmount. Keep the existing component; no animation registry.

### 2. Signatures / Owners

Keep existing ClickSpark props and JSX. Refs own live sparks/current start callback. The draw effect owns one nullable RAF ID plus visibilitychange and motion-query change listeners; the resize effect owns its native ResizeObserver and debounce timeout. Final resize cleanup retires burst refs; drawing-option cleanup cancels/clears while preserving live original timestamps.

### 3. Contracts / Invariants

Enabled live bursts hold at most one pending component frame. Idle/expired/disabled/unmounted states maintain no loop. Disabled transitions cancel, reset timestamps and clear; enable alone never replays old bursts, next click restarts. Update drawing props from original live timestamps under current duration/options. Preserve eight default radial strokes, local click geometry, line width/color, easing, child bubbling, aria-hidden and pointer-events none. StrictMode restores one owned lifecycle.

### 4. Validation / Error Matrix

Idle: zero executed callbacks/pending IDs. Click: native draw, expiration clear, then zero work. Active hide/reduce: exact owned cancellation/reset, disabled clicks add no bursts. Reversal: no stale replay, next click draws. Props: same timestamp/current equations and shortening-duration expiry. Native resize: expected backing dimensions/local coordinates; active pending-resize unmount: zero pending RAF/timer/listeners/observers, zero later draw/timeout callbacks. Canvas/context unavailable: no draw scheduling.

### 5. Good / Base / Bad Cases

Good: cancel/reset when unavailable and preserve timestamps through drawing-option cleanup. Base: ease-out t*(2-t); distance=eased*radius*scale; length=size*(1-eased); eight evenly spaced angles and width=2. Bad: unconditional empty RAF chain, retaining disabled bursts for replay, clearing active timestamps on every color/easing change, or treating an original before PASS as proof of the new availability behavior.

### 6. Required Tests

Execute the actual component in an isolated native browser; count executed component callbacks and pending/cancel IDs, excluding Playwright polling. Forward real clock/scheduling. Verify actual drawing/clear alpha and exact equations, real child click/bubbling, overlap, actual emulateMedia change/reversal, labeled visibility seam, prop updates/expiry, actual ResizeObserver and StrictMode/unmount. Read pending/event/after in one browser task or live event. Keep minimal permanent original snapshot/provenance, fixture browser types, fresh cache/explicit optimizer entry, one main document, zero page errors, producer/source-map/loaded-body hashes and failures.

### 7. Wrong vs Correct / Attribution and Limits

Wrong: request-only/fake-clock native performance claims; lifecycle freeze equals document.hidden; cross-RPC pending ID matching; whole-history max treated as current ownership; 2502 edges described as all value edges. Correct: finite executed-callback evidence and contemporaneous cancellation; explicit handler seam vs OS throttle; original/current contracts distinct. Current AST attribution is 420 TS files, 2502 total edges, zero parse errors and zero static value cycles. Writer root closure is 759 files (packages/studio/src/tests/scripts), current full gate is 766 inputs including seven configs. Typed additions remain separate from QG01 debt acceptance; full-app/device/CI/battery/latency claims require their own evidence.

## E07 effect ownership and deferred reconciliation

Independent E07 integration accepted on 2026-10-09.

### 1. Scope / Trigger

Use actual effect dependencies and stable callback ownership for live references, async imports, active run predicates, audio cursor/player effects and deferred external draft reconciliation.

### 2. Signatures / Owners

Keep existing components/hooks. Exact runtime type predicates express narrowed active business state; refs retain current owned readers and callbacks. `useDebouncedDraft` owns external JSON-version tracking and its guarded reconciliation attempt.

### 3. Contracts / Invariants

Track an external version only after controller rebase succeeds. A value arriving while persistence is in flight must be retried after completion even if its primitive value or memoized object identity does not change. Guarded every-render reconciliation preserves equality/version guards and does not loop. Hook suggested dependencies must be assessed against lifecycle semantics before adopting them.

### 4. Validation / Error Matrix

Updated external values during pending save reconcile after successful completion and subsequent renders. Failures retain exact local draft and original error identity. Task/session replacement retires async ownership, and effects clean up listeners, observers and audio/player resources.

### 5. Good / Base / Bad Cases

Good: capture full call context for dependent async work and cancel retired operations. Base: stable primitive/memo value rebase succeeds after persistence completes. Bad: adding only initialValue/controller dependencies and permanently missing a deferred failed rebase attempt.

### 6. Required Tests

Actual ReactDOM/TextDraftField/Dexie primitive and memoized regression must reproduce the dependency-only failure and pass the guard implementation. Deterministic hook-host tests have explicit scheduler limitations; retain native scene evidence for actual relevant ownership.

### 7. Wrong vs Correct

Wrong: automatic Hook autofix or fake hook rendering as proof of all React scheduling. Correct: individual reviewed effect contract, one exact documented Hook allowance and current native source/body/DB proof. No StrictMode/concurrent or OS behavior claim beyond executed cases.

## useProductQuery callbacks must only await database work (2026-10-14)

### 1. Scope / Trigger
Read before writing or editing any `useProductQuery` / `useProductQueryState` callback. Found through the new error details dialog: opening a chat topic crashed with `PrematureCommitError` ("Transaction committed too early").

### 2. Signatures
`useProductQuery(query, deps)` runs `liveQuery(() => transaction("r", ALL_TABLES, query))` (`packages/studio/src/lib/storage/browser.ts`). The hook rethrows a query failure during rendering, so a failed query surfaces as a page crash.

### 3. Contracts
The callback runs inside one read transaction over every table. Await only Dexie operations (`db.*`, or helpers that take the `db`/`tx` you were given). Any other await (a dynamic `import()`, a timer, `fetch`, `crypto.subtle`, a lock request, a file or blob read) lets the transaction commit early and the query fails with `PrematureCommitError`. Work that needs such an await runs before the query (and its result is passed in or kept in component state), or the value is read with `useEffect` + `useState`, discarding a stale result on cleanup.

### 4. Validation & Error Matrix
| Callback awaits | Result |
| --- | --- |
| Only `db.*` or helpers given `db` | Works |
| Dynamic `import()`, timer, network, crypto | `PrematureCommitError`, rethrown into rendering |
| A query that never touches the database | Do not use `useProductQuery`; use state |

### 5. Good / Base / Bad Cases
Good: resolve the lazily imported catalog in an effect and keep the result in state. Base: a query that reads two tables with `db.x.get`. Bad: `useProductQuery(async () => ({capability: await resolveVisionCapability(...)}))`, which loads a 1.78 MB JSON by dynamic import inside the transaction (`ModelSelectTrigger`, fixed).

### 6. Tests Required
`tests/productQueryTransactionSafety.test.ts` pins both sides against the real store: a non-Dexie wait inside the query fails with `PrematureCommitError`; the same work done before the query succeeds.

### 7. Wrong vs Correct
Wrong: put any awaited non-database work inside the query callback. Correct: do it first, or move it out of the query. The same ordering already applies to `agentRuns.ts` (vision is resolved before the transaction), and any catalog lookup used in a transaction must be read from memory.

